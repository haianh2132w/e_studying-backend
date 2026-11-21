import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { OwnershipService } from '../ownership/ownership.service.js';
import { AuthUser } from '../common/types/auth-user.js';
import { CreateChapterDto } from './dto/create-chapter.dto.js';
import { UpdateChapterDto } from './dto/update-chapter.dto.js';
import { ReorderDto } from './dto/reorder.dto.js';

const CHAPTER_SELECT = {
  id: true,
  courseId: true,
  title: true,
  description: true,
  position: true,
  status: true,
} satisfies Prisma.ChapterSelect;

@Injectable()
export class InstructorChaptersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  // danh sách chương của khóa (gồm cả chương nháp)
  async list(user: AuthUser, courseId: number) {
    await this.ownership.assertOwnsCourse(user, courseId);
    const rows = await this.prisma.chapter.findMany({
      where: { courseId },
      orderBy: { position: 'asc' },
      select: { ...CHAPTER_SELECT, _count: { select: { lessons: true, quizzes: true } } },
    });
    const chapters = rows.map(({ _count, ...c }) => ({
      ...c,
      lessonsCount: _count.lessons,
      quizzesCount: _count.quizzes,
    }));
    return { courseId, chapters };
  }

  // thêm chương. Vị trí do server tính (cuối danh sách)
  async create(user: AuthUser, courseId: number, dto: CreateChapterDto) {
    await this.ownership.assertOwnsCourse(user, courseId);
    const last = await this.prisma.chapter.aggregate({
      where: { courseId },
      _max: { position: true },
    });
    return this.prisma.chapter.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'DRAFT',
        position: (last._max.position ?? 0) + 1,
      },
      select: CHAPTER_SELECT,
    });
  }

  // chi tiết chương kèm thống kê
  async getOne(user: AuthUser, chapterId: number) {
    await this.ownership.assertOwnsChapter(user, chapterId);
    const chapter = await this.prisma.chapter.findUniqueOrThrow({
      where: { id: chapterId },
      select: {
        ...CHAPTER_SELECT,
        lessons: {
          orderBy: { position: 'asc' },
          select: { id: true, title: true, type: true, durationMin: true, position: true, isPreview: true, status: true },
        },
        quizzes: {
          orderBy: { id: 'asc' },
          select: { id: true, title: true, status: true, _count: { select: { questions: true } } },
        },
      },
    });
    return {
      ...chapter,
      quizzes: chapter.quizzes.map(({ _count, ...q }) => ({ ...q, questionsCount: _count.questions })),
      stats: {
        totalLessons: chapter.lessons.length,
        publishedLessons: chapter.lessons.filter((l) => l.status === 'PUBLISHED').length,
        totalMinutes: chapter.lessons.reduce((sum, l) => sum + l.durationMin, 0),
      },
    };
  }

  // sửa chương (tên, mô tả, trạng thái)
  async update(user: AuthUser, chapterId: number, dto: UpdateChapterDto) {
    await this.ownership.assertOwnsChapter(user, chapterId);
    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: { title: dto.title, description: dto.description, status: dto.status },
      select: CHAPTER_SELECT,
    });
  }

  // Sắp xếp lại thứ tự chương
  async reorder(user: AuthUser, courseId: number, dto: ReorderDto) {
    await this.ownership.assertOwnsCourse(user, courseId);
    const ids = dto.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Danh sách có id trùng');

    const found = await this.prisma.chapter.count({ where: { courseId, id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('Có chương không thuộc khóa học này');

    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.chapter.update({ where: { id: i.id }, data: { position: i.position } }),
      ),
    );
    return this.list(user, courseId);
  }

  // Xóa chương: chương đã xuất bản và đã có học viên học thì CHỈ được chuyển về nháp
  async remove(user: AuthUser, chapterId: number) {
    await this.ownership.assertOwnsChapter(user, chapterId);
    const chapter = await this.prisma.chapter.findUniqueOrThrow({
      where: { id: chapterId },
      select: { status: true },
    });
    if (chapter.status === 'PUBLISHED') {
      const [progress, attempts] = await this.prisma.$transaction([
        this.prisma.lessonProgress.count({ where: { lesson: { chapterId } } }),
        this.prisma.quizAttempt.count({ where: { quiz: { chapterId } } }),
      ]);
      if (progress + attempts > 0) {
        throw new ConflictException('Chương đã có học viên học. Hãy chuyển về nháp thay vì xóa.');
      }
    }
    await this.prisma.chapter.delete({ where: { id: chapterId } }); // bài học, quiz xóa theo (Cascade)
    return { message: 'Đã xóa chương' };
  }
}