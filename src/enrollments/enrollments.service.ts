import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthUser } from '../common/types/auth-user.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';

const CLASS_DETAIL_SELECT = {
    id: true,
    title: true,
    description: true,
    objectives: true,
    assessment: true,
    schedule: true,
    totalHours: true,
    thumbnailUrl: true,
    startDate: true,
    endDate: true,
    instructor: { select: { id: true, fullName: true, avatarUrl: true, bio: true } },
    syllabus: { orderBy: { sessionNo: 'asc' }, select: { sessionNo: true, objective: true } },
    courses: { select: { course: { select: { id: true, title: true, thumbnailUrl: true } } } },
} satisfies Prisma.ClassSelect;

@Injectable()
export class EnrollmentsService {
    constructor(private readonly prisma: PrismaService) { }

    private newTxnRef() {
        return `PRG${Date.now()}${crypto.randomBytes(4).toString('hex')}`;
    }

    // ---------- Đăng ký (UC 15, 16) ----------
    async create(user: AuthUser, dto: CreateEnrollmentDto) {
        const { courseId, classId } = dto;
        if ((courseId && classId) || (!courseId && !classId)) {
            throw new BadRequestException('Chỉ chọn một trong hai: courseId hoặc classId');
        }

        // Giá tính ở server từ DB
        let price: Prisma.Decimal;
        if (courseId) {
            const c = await this.prisma.course.findFirst({
                where: { id: courseId, isActive: true },
                select: { price: true, salePrice: true },
            });
            if (!c) throw new NotFoundException('Không tìm thấy khóa học');
            price = c.salePrice ?? c.price;
        } else {
            const c = await this.prisma.class.findFirst({
                where: { id: classId, isActive: true },
                select: { price: true, salePrice: true, endDate: true },
            });
            if (!c) throw new NotFoundException('Không tìm thấy lớp học');
            if (c.endDate < new Date()) throw new BadRequestException('Lớp học đã kết thúc');
            price = c.salePrice ?? c.price;
        }

        const existing = await this.prisma.enrollment.findFirst({
            where: { userId: user.id, ...(courseId ? { courseId } : { classId }) },
        });
        if (existing?.status === 'ACTIVE') throw new ConflictException('Bạn đã đăng ký rồi');

        const isFree = price.lte(0);

        return this.prisma.$transaction(async (tx) => {
            // Dùng lại dòng cũ (PENDING/CANCELLED) vì @@unique không cho tạo dòng thứ hai
            const enrollment = existing
                ? await tx.enrollment.update({
                    where: { id: existing.id },
                    data: { status: isFree ? 'ACTIVE' : 'PENDING', pricePaid: 0 },
                })
                : await tx.enrollment.create({
                    data: {
                        userId: user.id,
                        courseId,
                        classId,
                        status: isFree ? 'ACTIVE' : 'PENDING',
                    },
                });

            // Mỗi lần đăng ký (hoặc thử thanh toán lại) có mã giao dịch mới
            const txnRef = this.newTxnRef();
            const method = isFree ? 'FREE' : 'VNPAY';
            const status = isFree ? 'SUCCESS' : 'PENDING';
            const paidAt = isFree ? new Date() : null;
            await tx.payment.upsert({
                where: { enrollmentId: enrollment.id },
                update: { method, amount: price, status, txnRef, paidAt },
                create: { enrollmentId: enrollment.id, method, amount: price, status, txnRef, paidAt },
            });

            // Lớp miễn phí: vào danh sách học viên ngay
            if (isFree && classId) {
                await tx.classStudent.upsert({
                    where: { classId_userId: { classId, userId: user.id } },
                    update: { status: 'ACTIVE' },
                    create: { classId, userId: user.id, status: 'ACTIVE' },
                });
            }

            return {
                enrollmentId: enrollment.id,
                status: enrollment.status,
                requiresPayment: !isFree,
                amount: price,
                txnRef,
            };
        });
    }

    // ---------- Lịch sử đăng ký (UC 26) ----------
    async listEnrollments(userId: number, { page, limit }: PaginationDto) {
        const where = { userId };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.enrollment.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { enrolledAt: 'desc' },
                select: {
                    id: true,
                    status: true,
                    pricePaid: true,
                    enrolledAt: true,
                    course: { select: { id: true, title: true, thumbnailUrl: true } },
                    class: { select: { id: true, title: true, thumbnailUrl: true, startDate: true, endDate: true } },
                    payment: { select: { method: true, status: true, paidAt: true } },
                },
            }),
            this.prisma.enrollment.count({ where }),
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ---------- Khóa học của tôi (UC 18) ----------
    async listMyCourses(userId: number, { page, limit }: PaginationDto) {
        const where: Prisma.CourseWhereInput = {
            isActive: true,
            OR: [
                { enrollments: { some: { userId, status: 'ACTIVE' } } },
                {
                    classCourses: {
                        some: {
                            class: {
                                isActive: true,
                                students: { some: { userId, status: 'ACTIVE' } },
                                enrollments: { some: { userId, status: 'ACTIVE' } },
                            },
                        },
                    },
                },
            ],
        };
        const [items, total] = await this.prisma.$transaction([
            this.prisma.course.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { title: 'asc' },
                select: {
                    id: true,
                    title: true,
                    thumbnailUrl: true,
                    durationHours: true,
                    category: { select: { id: true, name: true } },
                    instructor: { select: { id: true, fullName: true, avatarUrl: true } },
                },
            }),
            this.prisma.course.count({ where }),
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ---------- Lớp học của tôi (UC 19) ----------
    async listMyClasses(userId: number, { page, limit }: PaginationDto) {
        const where = { userId, class: { isActive: true } };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.classStudent.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { class: { startDate: 'desc' } },
                select: {
                    status: true,
                    class: {
                        select: {
                            id: true,
                            title: true,
                            thumbnailUrl: true,
                            schedule: true,
                            startDate: true,
                            endDate: true,
                            instructor: { select: { id: true, fullName: true } },
                        },
                    },
                },
            }),
            this.prisma.classStudent.count({ where }),
        ]);
        const items = rows.map((r) => ({ ...r.class, memberStatus: r.status }));
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ---------- Chi tiết lớp đã tham gia (UC 20) ----------
    async getMyClass(userId: number, classId: number) {
        const member = await this.prisma.classStudent.findUnique({
            where: { classId_userId: { classId, userId } },
            select: { status: true },
        });
        if (!member || member.status !== 'ACTIVE') {
            throw new ForbiddenException('Bạn không phải học viên của lớp này');
        }
        const cls = await this.prisma.class.findFirst({
            where: { id: classId, isActive: true },
            select: CLASS_DETAIL_SELECT,
        });
        if (!cls) throw new NotFoundException('Không tìm thấy lớp học');

        const { courses, ...rest } = cls;
        return { ...rest, courses: courses.map((c) => c.course) };
    }
}