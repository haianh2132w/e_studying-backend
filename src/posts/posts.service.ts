import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PostQueryDto } from './dto/post.dto.js';

// Danh sách không trả content (nội dung dài), chỉ trả thông tin tóm tắt
const POST_LIST_SELECT = {
  id: true,
  title: true,
  publishedAt: true,
  category: { select: { id: true, name: true } },
  author: { select: { id: true, fullName: true, avatarUrl: true } },
} satisfies Prisma.PostSelect;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PostQueryDto) {
    const { page, limit, q, categoryId } = query;
    const where: Prisma.PostWhereInput = {
      status: 'PUBLISHED', // nháp không bao giờ lọt ra API công khai
      ...(q && { title: { contains: q } }),
      ...(categoryId && { categoryId }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        select: POST_LIST_SELECT,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getById(id: number) {
    const post = await this.prisma.post.findFirst({
      where: { id, status: 'PUBLISHED' },
      select: { ...POST_LIST_SELECT, content: true },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');

    // Bài liên quan: cùng danh mục, trừ chính bài này
    const related = await this.prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        id: { not: id },
        ...(post.category ? { categoryId: post.category.id } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: POST_LIST_SELECT,
    });
    return { ...post, related };
  }
}
