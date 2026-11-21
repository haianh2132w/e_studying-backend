import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CourseQueryDto } from './dto/course-query.dto.js';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CourseQueryDto) {
    const { page, limit, q, categoryId, instructorId, minPrice, maxPrice } = query;

    const price: Prisma.DecimalFilter = {};
    if (minPrice !== undefined) price.gte = minPrice;
    if (maxPrice !== undefined) price.lte = maxPrice;

    const where: Prisma.CourseWhereInput = {
      isActive: true,
      ...(q && { title: { contains: q } }),
      ...(categoryId && { categoryId }),
      ...(instructorId && { instructorId }),
      ...(Object.keys(price).length > 0 ? { price } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          durationHours: true,
          price: true,
          salePrice: true,
          isFeatured: true,
          category: { select: { id: true, name: true } },
          instructor: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: number) {
    const course = await this.prisma.course.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        title: true,
        description: true,
        objectives: true,
        thumbnailUrl: true,
        durationHours: true,
        price: true,
        salePrice: true,
        category: { select: { id: true, name: true } },
        instructor: { select: { id: true, fullName: true, avatarUrl: true, bio: true } },
        chapters: {
          where: { status: 'PUBLISHED' },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            position: true,
            lessons: {
              where: { status: 'PUBLISHED' },
              orderBy: { position: 'asc' },
              // KHÔNG chọn content, resourceUrl: chỉ bài xem thử mới được lộ nội dung (làm ở lượt sau)
              select: { id: true, title: true, type: true, durationMin: true, isPreview: true },
            },
            quizzes:{
              where:{status:'PUBLISHED'},
              orderBy:{id:'asc'},
              select:{id:true,title:true}
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Không tìm thấy khóa học');

    const lessons = course.chapters.flatMap((c) => c.lessons);
    return {
      ...course,
      totalLessons: lessons.length,
      totalMinutes: lessons.reduce((sum, l) => sum + l.durationMin, 0),
    };
  }
}