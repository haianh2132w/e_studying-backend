import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as crypto from 'crypto';
import ExcelJS from 'exceljs';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { CreateQuizDto } from '../instructor/dto/create-quiz.dto.js';
import { InstructorClassesService } from '../instructor/instructor-classes.service.js';
import { OwnershipService } from '../ownership/ownership.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
    CLASS_COLS, COURSE_COLS, ClassRowDto, ClassStudentRowDto, CourseRowDto, QUIZ_COLS, QuizRowDto,
    STUDENT_COLS, TEMPLATES, USER_COLS, UserRowDto,
} from './import-schemas.js';
import { Col, readSheet, validateXlsx } from './xlsx-reader.js';

type Upload = Express.Multer.File | undefined;
export interface Failed { row: number; errors: string[] }
interface Cand<T> { row: number; key: string; data: T }

const MAX_ROWS = 500;
const MAX_QUIZ_ROWS = 200;

@Injectable()
export class ImportsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly ownership: OwnershipService,
        private readonly classes: InstructorClassesService,
        private readonly audit: AuditService,
    ) { }

    //  Dùng chung: đọc file, kiểm tra từng dòng bằng DTO 
    private async parse<T extends object>(file: Upload, cols: Col[], Dto: new () => T, maxRows: number) {
        validateXlsx(file);
        const rows = await readSheet(file!.buffer, cols, maxRows);
        const ok: { row: number; dto: T }[] = [];
        const failed: Failed[] = [];
        for (const r of rows) {
            const errors = [...r.errors];
            const dto = plainToInstance(Dto, r.values);
            if (errors.length === 0) {
                const issues = await validate(dto, { whitelist: true });
                for (const i of issues) {
                    errors.push(`${i.property}: ${Object.values(i.constraints ?? {}).join('; ')}`);
                }
            }
            if (errors.length > 0) failed.push({ row: r.row, errors });
            else ok.push({ row: r.row, dto });
        }
        return { ok, failed };
    }

    private async finish(user: AuthUser, type: string, total: number, created: number, failed: Failed[]) {
        failed.sort((a, b) => a.row - b.row);
        await this.audit.log({
            userId: user.id,
            action: 'IMPORT',
            entity: type,
            metadata: { total, created, failed: failed.length }, // KHÔNG ghi nội dung file
        });
        return { type, total, created, failedCount: failed.length, failed };
    }

    // Tên danh mục và email giảng viên -> id (mỗi loại một truy vấn cho cả file)
    private async refMaps() {
        const [cats, instructors] = await Promise.all([
            this.prisma.setting.findMany({
                where: { type: 'CATEGORY', isActive: true },
                select: { id: true, name: true },
            }),
            this.prisma.user.findMany({
                where: { isActive: true, role: { name: 'INSTRUCTOR' } },
                select: { id: true, email: true },
            }),
        ]);
        return {
            cat: new Map(cats.map((c) => [c.name.toLowerCase(), c.id] as const)),
            ins: new Map(instructors.map((u) => [u.email.toLowerCase(), u.id] as const)),
        };
    }

    // Loại các dòng trùng (với dữ liệu đã có hoặc với dòng trước trong file)
    private takeUnique<T>(cands: Cand<T>[], existing: Set<string>, failed: Failed[], message: string): T[] {
        const out: T[] = [];
        for (const c of cands) {
            if (existing.has(c.key)) {
                failed.push({ row: c.row, errors: [message] });
                continue;
            }
            existing.add(c.key);
            out.push(c.data);
        }
        return out;
    }

    // tài khoản 
    async importUsers(user: AuthUser, file: Upload) {
        const { ok, failed } = await this.parse(file, USER_COLS, UserRowDto, MAX_ROWS);
        const total = ok.length + failed.length;
        if (ok.length === 0) return this.finish(user, 'users', total, 0, failed);

        const roles = new Map(
            (
                await this.prisma.setting.findMany({
                    where: { type: 'ROLE', isActive: true },
                    select: { id: true, name: true },
                })
            ).map((r) => [r.name, r.id] as const),
        );
        const existing = await this.prisma.user.findMany({
            where: {
                OR: [
                    { email: { in: ok.map((r) => r.dto.email.toLowerCase()) } },
                    { username: { in: ok.map((r) => r.dto.username) } },
                ],
            },
            select: { email: true, username: true },
        });
        const takenEmail = new Set(existing.map((u) => u.email.toLowerCase()));
        const takenName = new Set(existing.map((u) => u.username.toLowerCase()));

        // Mật khẩu ngẫu nhiên không ai biết; người dùng tự đặt qua "Quên mật khẩu". Băm MỘT lần cho cả file
        const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

        const data: Prisma.UserCreateManyInput[] = [];
        for (const { row, dto } of ok) {
            const email = dto.email.toLowerCase().trim();
            const roleId = roles.get(dto.role);
            if (!roleId) {
                failed.push({ row, errors: ['role: không hợp lệ'] });
                continue;
            }
            if (takenEmail.has(email) || takenName.has(dto.username.toLowerCase())) {
                failed.push({
                    row,
                    errors: ['Email hoặc username đã tồn tại (trong hệ thống hoặc ở dòng trước trong file)'],
                });
                continue;
            }
            takenEmail.add(email);
            takenName.add(dto.username.toLowerCase());
            data.push({
                email,
                username: dto.username,
                fullName: dto.fullName,
                passwordHash,
                roleId,
                emailVerified: true,
            });
        }
        if (data.length > 0) await this.prisma.user.createMany({ data });
        return this.finish(user, 'users', total, data.length, failed);
    }

    // khóa học 
    async importCourses(user: AuthUser, file: Upload) {
        const { ok, failed } = await this.parse(file, COURSE_COLS, CourseRowDto, MAX_ROWS);
        const total = ok.length + failed.length;
        const { cat, ins } = await this.refMaps();

        const cands: Cand<Prisma.CourseCreateManyInput>[] = [];
        for (const { row, dto } of ok) {
            const categoryId = cat.get(dto.category.toLowerCase());
            const instructorId = ins.get(dto.instructorEmail.toLowerCase());
            const errors: string[] = [];
            if (!categoryId) errors.push(`category: không có danh mục "${dto.category}" (hoặc đang bị tắt)`);
            if (!instructorId) {
                errors.push(`instructorEmail: "${dto.instructorEmail}" không phải giảng viên đang hoạt động`);
            }
            if (dto.salePrice !== undefined && dto.salePrice >= dto.price) {
                errors.push('salePrice: phải nhỏ hơn price');
            }
            if (!categoryId || !instructorId || errors.length > 0) {
                failed.push({ row, errors });
                continue;
            }
            cands.push({
                row,
                key: `${instructorId}|${dto.title.toLowerCase()}`,
                data: {
                    title: dto.title,
                    description: dto.description,
                    objectives: dto.objectives,
                    thumbnailUrl: dto.thumbnailUrl,
                    durationHours: dto.durationHours ?? 0,
                    price: dto.price,
                    salePrice: dto.salePrice,
                    isFeatured: dto.isFeatured ?? false,
                    categoryId,
                    instructorId,
                },
            });
        }

        const existing = cands.length
            ? await this.prisma.course.findMany({
                where: {
                    title: { in: cands.map((c) => c.data.title) },
                    instructorId: { in: [...new Set(cands.map((c) => c.data.instructorId))] },
                },
                select: { title: true, instructorId: true },
            })
            : [];
        const data = this.takeUnique(
            cands,
            new Set(existing.map((e) => `${e.instructorId}|${e.title.toLowerCase()}`)),
            failed,
            'Khóa học (cùng tiêu đề và giảng viên) đã tồn tại hoặc bị lặp trong file',
        );
        if (data.length > 0) await this.prisma.course.createMany({ data });
        return this.finish(user, 'courses', total, data.length, failed);
    }

    // lớp học 
    async importClasses(user: AuthUser, file: Upload) {
        const { ok, failed } = await this.parse(file, CLASS_COLS, ClassRowDto, MAX_ROWS);
        const total = ok.length + failed.length;
        const { cat, ins } = await this.refMaps();

        const cands: Cand<Prisma.ClassCreateManyInput>[] = [];
        for (const { row, dto } of ok) {
            const categoryId = cat.get(dto.category.toLowerCase());
            const instructorId = ins.get(dto.instructorEmail.toLowerCase());
            const errors: string[] = [];
            if (!categoryId) errors.push(`category: không có danh mục "${dto.category}" (hoặc đang bị tắt)`);
            if (!instructorId) {
                errors.push(`instructorEmail: "${dto.instructorEmail}" không phải giảng viên đang hoạt động`);
            }
            if (dto.salePrice !== undefined && dto.salePrice >= dto.price) {
                errors.push('salePrice: phải nhỏ hơn price');
            }
            const start = new Date(dto.startDate);
            const end = new Date(dto.endDate);
            if (start >= end) errors.push('startDate: phải trước endDate');
            if (!categoryId || !instructorId || errors.length > 0) {
                failed.push({ row, errors });
                continue;
            }
            cands.push({
                row,
                key: `${instructorId}|${dto.title.toLowerCase()}|${start.toISOString().slice(0, 10)}`,
                data: {
                    title: dto.title,
                    description: dto.description,
                    objectives: dto.objectives,
                    assessment: dto.assessment,
                    schedule: dto.schedule,
                    totalHours: dto.totalHours ?? 0,
                    thumbnailUrl: dto.thumbnailUrl,
                    price: dto.price,
                    salePrice: dto.salePrice,
                    startDate: start,
                    endDate: end,
                    categoryId,
                    instructorId,
                },
            });
        }

        const existing = cands.length
            ? await this.prisma.class.findMany({
                where: {
                    title: { in: cands.map((c) => c.data.title) },
                    instructorId: { in: [...new Set(cands.map((c) => c.data.instructorId))] },
                },
                select: { title: true, instructorId: true, startDate: true },
            })
            : [];
        const data = this.takeUnique(
            cands,
            new Set(
                existing.map((e) => `${e.instructorId}|${e.title.toLowerCase()}|${e.startDate.toISOString().slice(0, 10)}`),
            ),
            failed,
            'Lớp học (cùng tiêu đề, giảng viên, ngày bắt đầu) đã tồn tại hoặc bị lặp trong file',
        );
        if (data.length > 0) await this.prisma.class.createMany({ data });
        return this.finish(user, 'classes', total, data.length, failed);
    }

    // học viên vào lớp 
    async importClassStudents(user: AuthUser, classId: number, file: Upload) {
        await this.ownership.assertOwnsClass(user, classId); // kiểm tra quyền TRƯỚC khi đọc file
        const cls = await this.prisma.class.findUniqueOrThrow({
            where: { id: classId },
            select: { isActive: true },
        });
        if (!cls.isActive) throw new BadRequestException('Lớp học đang bị ẩn');

        const { ok, failed } = await this.parse(file, STUDENT_COLS, ClassStudentRowDto, MAX_ROWS);
        const total = ok.length + failed.length;

        // Dùng lại đúng luật của "thêm học viên", mỗi dòng một lần
        let created = 0;
        for (const { row, dto } of ok) {
            try {
                await this.classes.addStudent(user, classId, { emailOrUsername: dto.emailOrUsername });
                created++;
            } catch (e) {
                if (!(e instanceof HttpException)) throw e;
                failed.push({ row, errors: [e.message] });
            }
        }
        return this.finish(user, 'class-students', total, created, failed);
    }

    // quiz (tất cả hoặc không gì cả) 
    async importQuiz(user: AuthUser, chapterId: number, quiz: CreateQuizDto, file: Upload) {
        await this.ownership.assertOwnsChapter(user, chapterId);
        const { ok, failed } = await this.parse(file, QUIZ_COLS, QuizRowDto, MAX_QUIZ_ROWS);
        const total = ok.length + failed.length;

        const questions: Prisma.QuestionCreateWithoutQuizInput[] = [];
        for (const { row, dto: q } of ok) {
            const answers = [q.answerA, q.answerB, q.answerC, q.answerD, q.answerE, q.answerF]
                .map((text, i) => ({ letter: 'ABCDEF'[i], text }))
                .filter((a): a is { letter: string; text: string } => !!a.text);

            const errors: string[] = [];
            if (!answers.some((a) => a.letter === q.correct)) {
                errors.push(`correct: đáp án ${q.correct} đang để trống`);
            }
            const texts = answers.map((a) => a.text.toLowerCase());
            if (new Set(texts).size !== texts.length) errors.push('Các đáp án không được trùng nhau');
            if (errors.length > 0) {
                failed.push({ row, errors });
                continue;
            }
            questions.push({
                content: q.question,
                position: questions.length + 1,
                answers: {
                    create: answers.map((a) => ({ content: a.text, isCorrect: a.letter === q.correct })),
                },
            });
        }

        if (failed.length > 0) {
            failed.sort((a, b) => a.row - b.row);
            throw new BadRequestException({
                message: 'File có dòng lỗi nên chưa tạo quiz nào. Hãy sửa file rồi tải lại.',
                total,
                failed,
            });
        }

        const created = await this.prisma.quiz.create({
            data: {
                chapterId,
                title: quiz.title,
                instructions: quiz.instructions,
                status: 'DRAFT',
                questions: { create: questions },
            },
            select: { id: true, title: true, status: true },
        });
        const result = await this.finish(user, 'quiz', total, questions.length, []);
        return { ...result, quiz: created };
    }

    // File mẫu 
    async buildTemplate(type: string): Promise<Buffer | null> {
        const cols = TEMPLATES.get(type);
        if (!cols) return null;

        const wb = new ExcelJS.Workbook();
        // Sheet dữ liệu: CHỈ có dòng tiêu đề, để quên xóa cũng không import nhầm dữ liệu mẫu
        const data = wb.addWorksheet('Data');
        data.columns = cols.map((c) => ({ header: c.key, key: c.key, width: 22 }));
        data.getRow(1).font = { bold: true };

        const guide = wb.addWorksheet('Huong dan');
        guide.columns = [
            { header: 'Cot', key: 'key', width: 20 },
            { header: 'Bat buoc', key: 'required', width: 10 },
            { header: 'Kieu', key: 'kind', width: 10 },
            { header: 'Ghi chu', key: 'note', width: 60 },
        ];
        guide.getRow(1).font = { bold: true };
        for (const c of cols) {
            guide.addRow({ key: c.key, required: c.required ? 'Co' : 'Khong', kind: c.kind, note: c.note });
        }
        return Buffer.from(await wb.xlsx.writeBuffer());
    }
}