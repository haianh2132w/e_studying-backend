import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthUser } from '../common/types/auth-user.js';
import { AdminPostQueryDto } from './dto/admin-misc.dto.js';

const POST_SUMMARY = {
  id: true,
  title: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
  author: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.PostSelect;

@Injectable()
export class AdminPostsService {
  constructor(private readonly prisma: PrismaService) {}

  //  danh sách mọi bài viết (cả nháp) 
  async list(query: AdminPostQueryDto) {
    const { page, limit, q, status, authorId, categoryId } = query;
    const where: Prisma.PostWhereInput = {
      ...(q && { title: { contains: q } }),
      ...(status && { status }),
      ...(authorId && { authorId }),
      ...(categoryId && { categoryId }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: POST_SUMMARY,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // Xem nội dung đầy đủ để quyết định có vi phạm hay không
  async getOne(id: number) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { ...POST_SUMMARY, content: true },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return post;
  }

  //  xóa bài vi phạm, ghi lý do vào nhật ký 
  async remove(admin: AuthUser, id: number, reason: string, ip?: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      select: { title: true, authorId: true, status: true },
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');

    // Xóa và ghi nhật ký trong một transaction: hoặc cả hai, hoặc không gì cả
    await this.prisma.$transaction([
      this.prisma.post.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          userId: admin.id,
          action: 'DELETE_POST',
          entity: 'Post',
          entityId: String(id),
          ip,
          metadata: {
            reason,
            title: post.title,
            authorId: post.authorId,
            status: post.status,
          },
        },
      }),
    ]);
    return { message: 'Đã xóa bài viết' };
  }
}