import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome() {
    const [featuredCourses, latestClasses, latestPosts] = await Promise.all([
      this.prisma.course.findMany({
        where: { isActive: true, isFeatured: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          price: true,
          salePrice: true,
          category: { select: { id: true, name: true } },
          instructor: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }),
      this.prisma.class.findMany({
        where: { isActive: true },
        orderBy: { startDate: 'desc' },
        take: 3,
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          startDate: true,
          endDate: true,
          price: true,
          salePrice: true,
        },
      }),
      this.prisma.post.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { publishedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          title: true,
          publishedAt: true,
          author: { select: { id: true, fullName: true } },
        },
      }),
    ]);
    return { featuredCourses, latestClasses, latestPosts };
  }
}