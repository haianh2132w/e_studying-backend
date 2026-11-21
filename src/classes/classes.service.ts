import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClassQueryDto } from './dto/class-query.dto.js';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ClassQueryDto) {
    const { page, limit, q, categoryId, instructorId } = query;
    const where: Prisma.ClassWhereInput = {
      isActive: true,
      ...(q && { title: { contains: q } }),
      ...(categoryId && { categoryId }),
      ...(instructorId && { instructorId }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.class.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          schedule: true,
          totalHours: true,
          price: true,
          salePrice: true,
          startDate: true,
          endDate: true,
          category: { select: { id: true, name: true } },
          instructor: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }),
      this.prisma.class.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: number) {
    const cls = await this.prisma.class.findFirst({
      where: { id, isActive: true },
      select: {
        id: true,
        title: true,
        description: true,
        objectives: true,
        assessment: true,
        schedule: true,
        totalHours: true,
        thumbnailUrl: true,
        price: true,
        salePrice: true,
        startDate: true,
        endDate: true,
        category: { select: { id: true, name: true } },
        instructor: { select: { id: true, fullName: true, avatarUrl: true, bio: true } },
        syllabus: {
          orderBy: { sessionNo: 'asc' },
          select: { sessionNo: true, objective: true },
        },
        courses: {
          where: { course: { isActive: true } },
          select: { course: { select: { id: true, title: true, thumbnailUrl: true } } },
        },
        _count: { select: { students: { where: { status: 'ACTIVE' } } } },
      },
    });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp học');

    const { _count, courses, ...rest } = cls;
    return {
      ...rest,
      courses: courses.map((c) => c.course),
      studentCount: _count.students,
    };
  }
}