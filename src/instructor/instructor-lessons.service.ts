import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { LessonType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { OwnershipService } from '../ownership/ownership.service.js';
import { AuthUser } from '../common/types/auth-user.js';
import { sanitizeContent } from '../common/utils/sanitize.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { ReorderDto } from './dto/reorder.dto.js';

const LESSON_SELECT = {
  id: true,
  chapterId: true,
  title: true,
  type: true,
  content: true,
  resourceUrl: true,
  durationMin: true,
  position: true,             
  isPreview: true,
  status: true,
} satisfies Prisma.LessonSelect;

@Injectable()
export class InstructorLessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  // Nội dung HTML phải lọc trước khi lưu (chống stored XSS), giống bài blog
  private clean(content: string) {
    return sanitizeContent(content).trim() || null;
  }

  // Quy tắc theo loại bài học
  private assertValid(
    type: LessonType,
    resourceUrl: string | null | undefined,
    content: string | null | undefined,
    hasFile: boolean,
  ) {
    if ((type === 'VIDEO' || type === 'LINK') && !resourceUrl) {
      throw new BadRequestException('Bài học dạng VIDEO hoặc LINK cần có resourceUrl');
    }
    if (type === 'DOCUMENT' && !resourceUrl && !content && !hasFile) {
      throw new BadRequestException(
        'Bài học dạng DOCUMENT cần có nội dung, resourceUrl hoặc file đính kèm',
      );
    }
  }

  async getOne(user: AuthUser, lessonId: number) {
    await this.ownership.assertOwnsLesson(user, lessonId);
    return this.prisma.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: LESSON_SELECT });
  }

  // thêm bài học. Vị trí do server tính (cuối chương)
  async create(user: AuthUser, chapterId: number, dto: CreateLessonDto) {
    await this.ownership.assertOwnsChapter(user, chapterId);
    const type = dto.type ?? 'VIDEO';
    const content = dto.content !== undefined ? this.clean(dto.content) : null;
    this.assertValid(type, dto.resourceUrl, content, false);

    const last = await this.prisma.lesson.aggregate({
      where: { chapterId },
      _max: { position: true },
    });
    return this.prisma.lesson.create({
      data: {
        chapterId,
        title: dto.title,
        type,
        content,
        resourceUrl: dto.resourceUrl,
        durationMin: dto.durationMin ?? 0,
        isPreview: dto.isPreview ?? false,
        status: dto.status ?? 'DRAFT',
        position: (last._max.position ?? 0) + 1,
      },
      select: LESSON_SELECT,
    });
  }

  // sửa bài học
  async update(user: AuthUser, lessonId: number, dto: UpdateLessonDto) {
    await this.ownership.assertOwnsLesson(user, lessonId);
    const current = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: { type: true, content: true, resourceUrl: true, fileKey: true },
    });

    // Kiểm tra trạng thái SAU KHI sửa (gộp giá trị cũ và mới)
    const type = dto.type ?? current.type;
    const content = dto.content !== undefined ? this.clean(dto.content) : current.content;
    const resourceUrl = dto.resourceUrl !== undefined ? dto.resourceUrl : current.resourceUrl;
    this.assertValid(type, resourceUrl, content, !!current.fileKey);

    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: dto.title,
        type: dto.type,
        content: dto.content !== undefined ? content : undefined,
        resourceUrl: dto.resourceUrl,
        durationMin: dto.durationMin,
        isPreview: dto.isPreview,
        status: dto.status,
      },
      select: LESSON_SELECT,
    });
  }

  async reorder(user: AuthUser, chapterId: number, dto: ReorderDto) {
    await this.ownership.assertOwnsChapter(user, chapterId);
    const ids = dto.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Danh sách có id trùng');

    const found = await this.prisma.lesson.count({ where: { chapterId, id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('Có bài học không thuộc chương này');

    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.lesson.update({ where: { id: i.id }, data: { position: i.position } }),
      ),
    );
    const lessons = await this.prisma.lesson.findMany({
      where: { chapterId },
      orderBy: { position: 'asc' },
      select: { id: true, title: true, position: true },
    });
    return { chapterId, lessons };
  }

  // Bài đã xuất bản và đã có học viên hoàn thành thì CHỈ được chuyển về nháp
  async remove(user: AuthUser, lessonId: number) {
    await this.ownership.assertOwnsLesson(user, lessonId);
    const lesson = await this.prisma.lesson.findUniqueOrThrow({
      where: { id: lessonId },
      select: { status: true },
    });
    if (lesson.status === 'PUBLISHED') {
      const done = await this.prisma.lessonProgress.count({ where: { lessonId } });
      if (done > 0) {
        throw new ConflictException('Bài học đã có học viên hoàn thành. Hãy chuyển về nháp thay vì xóa.');
      }
    }
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { message: 'Đã xóa bài học' };
  }
}