import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
  OnModuleInit, UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { PrismaService } from '../prisma/prisma.service.js';
import { OwnershipService } from '../ownership/ownership.service.js';
import { AccessService } from '../access/access.service.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { DOC_TYPES, cleanFileName, validateUpload } from './file-validator.js';
import type {} from 'multer';

const STORAGE_DIR = join(process.cwd(), 'storage', 'lesson-files');
// Tên file lưu trên đĩa luôn có dạng này (do server tạo), kiểm tra lại trước khi đọc
const KEY_REGEX = /^[0-9a-f-]{36}\.(pdf|docx|pptx)$/;

@Injectable()
export class UploadsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly access: AccessService,
  ) {}

  async onModuleInit() {
    await mkdir(STORAGE_DIR, { recursive: true });
  }

  private async safeUnlink(key: string) {
    if (!KEY_REGEX.test(key)) return;
    await unlink(join(STORAGE_DIR, key)).catch(() => undefined);
  }

  // Giảng viên đính kèm (hoặc thay) file cho bài học
  async attachLessonFile(user: AuthUser, lessonId: number, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Thiếu file (tên trường phải là "file")');
    await this.ownership.assertOwnsLesson(user, lessonId);

    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: { type: true, fileKey: true },
    });
    if (lesson.type !== 'DOCUMENT') {
      throw new BadRequestException('Chỉ bài học dạng DOCUMENT mới đính kèm được file');
    }

    const ext = validateUpload(file, DOC_TYPES);
    const key = `${randomUUID()}.${ext}`; // tên do server đặt, không dùng tên của client
    const fileName = cleanFileName(file.originalname, ext);

    await writeFile(join(STORAGE_DIR, key), file.buffer, { flag: 'wx' });
    try {
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: { fileKey: key, fileName },
      });
    } catch (e) {
      await this.safeUnlink(key); // ghi DB lỗi thì không để file mồ côi
      throw e;
    }
    if (lesson.fileKey) await this.safeUnlink(lesson.fileKey); // xóa file cũ

    return { lessonId, fileName, size: file.size };
  }

  async removeLessonFile(user: AuthUser, lessonId: number) {
    await this.ownership.assertOwnsLesson(user, lessonId);
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: { fileKey: true },
    });
    if (!lesson.fileKey) throw new NotFoundException('Bài học chưa có file');

    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { fileKey: null, fileName: null },
    });
    await this.safeUnlink(lesson.fileKey);
    return { message: 'Đã xóa file đính kèm' };
  }

  // Tải file: cùng quy tắc xem bài học (bài xem thử ai cũng tải được, còn lại phải có quyền)
  async openLessonFile(lessonId: number, user: AuthUser | null) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        status: 'PUBLISHED',
        chapter: { status: 'PUBLISHED', course: { isActive: true } },
      },
      select: {
        fileKey: true,
        fileName: true,
        isPreview: true,
        chapter: { select: { courseId: true } },
      },
    });
    if (!lesson || !lesson.fileKey || !lesson.fileName) {
      throw new NotFoundException('Bài học không có file đính kèm');
    }

    if (!lesson.isPreview) {
      if (!user) throw new UnauthorizedException('Vui lòng đăng nhập để tải tài liệu');
      if (!(await this.access.canAccessCourse(user, lesson.chapter.courseId))) {
        throw new ForbiddenException('Bạn chưa đăng ký khóa học này');
      }
    }

    if (!KEY_REGEX.test(lesson.fileKey)) throw new NotFoundException('File không hợp lệ');
    const path = join(STORAGE_DIR, lesson.fileKey);
    try {
      await access(path);
    } catch {
      throw new NotFoundException('File không còn tồn tại');
    }

    const ext = extname(lesson.fileKey).slice(1);
    return {
      stream: createReadStream(path),
      contentType: DOC_TYPES[ext].contentType,
      fileName: lesson.fileName,
    };
  }
}