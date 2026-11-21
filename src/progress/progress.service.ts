import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessService } from '../access/access.service.js';
import { AuthUser } from '../common/types/auth-user.js';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async complete(lessonId: number, user: AuthUser) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        status: 'PUBLISHED',
        chapter: { status: 'PUBLISHED', course: { isActive: true } },
      },
      select: { chapter: { select: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học');

    const courseId = lesson.chapter.courseId;
    if (!(await this.access.canAccessCourse(user, courseId))) {
      throw new ForbiddenException('Bạn chưa đăng ký khóa học này');
    }

    // upsert: bấm hoàn thành nhiều lần vẫn chỉ có một dòng (khóa chính ghép userId + lessonId)
    await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      update: {},
      create: { userId: user.id, lessonId },
    });
    return this.getCourseProgress(courseId, user);
  }

  async getCourseProgress(courseId: number, user: AuthUser) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, isActive: true },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Không tìm thấy khóa học');
    if (!(await this.access.canAccessCourse(user, courseId))) {
      throw new ForbiddenException('Bạn chưa đăng ký khóa học này');
    }

    const lessonWhere: Prisma.LessonWhereInput = {
      status: 'PUBLISHED',
      chapter: { status: 'PUBLISHED', courseId },
    };
    const [total, completed] = await this.prisma.$transaction([
      this.prisma.lesson.count({ where: lessonWhere }),
      this.prisma.lessonProgress.count({ where: { userId: user.id, lesson: lessonWhere } }),
    ]);
    return {
      courseId,
      totalLessons: total,
      completedLessons: completed,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }
}