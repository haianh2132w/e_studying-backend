import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { OwnershipService } from '../ownership/ownership.service.js';
import { AuthUser } from '../common/types/auth-user.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';

@Injectable()
export class InstructorCoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  //khóa học của tôi (kể cả khóa đang bị ẩn, để giảng viên còn thấy)
  async listMine(user: AuthUser, { page, limit }: PaginationDto) {
    const where: Prisma.CourseWhereInput = { instructorId: user.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          isActive: true,
          price: true,
          salePrice: true,
          category: { select: { id: true, name: true } },
          _count: { select: { chapters: true, enrollments: { where: { status: 'ACTIVE' } } } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);
    const items = rows.map(({ _count, ...c }) => ({
      ...c,
      chaptersCount: _count.chapters,
      activeEnrollments: _count.enrollments,
    }));
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  //học viên của khóa (đăng ký trực tiếp hoặc thuộc lớp có chứa khóa này)
  async students(user: AuthUser, courseId: number, { page, limit }: PaginationDto) {
    await this.ownership.assertOwnsCourse(user, courseId);

    const lessonWhere: Prisma.LessonWhereInput = {
      status: 'PUBLISHED',
      chapter: { status: 'PUBLISHED', courseId },
    };
    const where: Prisma.UserWhereInput = {
      OR: [
        { enrollments: { some: { courseId, status: 'ACTIVE' } } },
        {
          classStudents: {
            some: {
              status: 'ACTIVE',
              class: { isActive: true, courses: { some: { courseId } } },
            },
          },
        },
      ],
    };

    const [users, total, totalLessons] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { fullName: 'asc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          enrollments: { where: { courseId, status: 'ACTIVE' }, select: { id: true } },
        },
      }),
      this.prisma.user.count({ where }),
      this.prisma.lesson.count({ where: lessonWhere }),
    ]);

    // Tiến độ của cả trang trong MỘT truy vấn (tránh gọi lặp cho từng học viên)
    const ids = users.map((u) => u.id);
    const progress = ids.length
      ? await this.prisma.lessonProgress.groupBy({
          by: ['userId'],
          where: { userId: { in: ids }, lesson: lessonWhere },
          _count: { _all: true },
        })
      : [];
    const done = new Map(progress.map((p) => [p.userId, p._count._all]));

    const items = users.map(({ enrollments, ...u }) => {
      const completed = done.get(u.id) ?? 0;
      return {
        ...u,
        source: enrollments.length > 0 ? 'DIRECT' : 'CLASS',
        completedLessons: completed,
        percent: totalLessons === 0 ? 0 : Math.round((completed / totalLessons) * 100),
      };
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit), totalLessons };
  }
}