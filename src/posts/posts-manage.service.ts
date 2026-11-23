import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthUser } from '../common/types/auth-user.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { sanitizeContent, toPlainText } from '../common/utils/sanitize.js';
import { CreatePostDto, UpdatePostDto } from './dto/post.dto.js';

const POST_SUMMARY = {
  id: true,
  title: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.PostSelect;

const POST_FULL = {
  ...POST_SUMMARY,
  content: true,
} satisfies Prisma.PostSelect;

@Injectable()
export class PostsManageService {
  constructor(private readonly prisma: PrismaService) { }

  private cleanContent(html: string) {
    const clean = sanitizeContent(html);
    if (!toPlainText(clean))
      throw new BadRequestException('Nội dung bài viết không được để trống');
    return clean;
  }

  private async assertCategory(categoryId?: number | null) {
    if (!categoryId) return;
    const found = await this.prisma.setting.findFirst({
      where: { id: categoryId, type: 'CATEGORY', isActive: true },
      select: { id: true },
    });
    if (!found) throw new BadRequestException('Danh mục không hợp lệ');
  }

  // Chỉ tìm bài CỦA CHÍNH MÌNH; bài người khác hoặc không tồn tại đều là 404
  private async findOwn(userId: number, id: number) {
    const post = await this.prisma.post.findFirst({
      where: { id, authorId: userId },
      select: POST_FULL,
    });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return post;
  }

  async create(user: AuthUser, dto: CreatePostDto) {
    await this.assertCategory(dto.categoryId);
    const status = dto.status ?? 'DRAFT';
    return this.prisma.post.create({
      data: {
        authorId: user.id, // lấy từ token, không bao giờ từ body
        title: dto.title,
        content: this.cleanContent(dto.content),
        categoryId: dto.categoryId,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
      },
      select: POST_FULL,
    });
  }

  // ---------- Sửa  ----------
  async update(user: AuthUser, id: number, dto: UpdatePostDto) {
    const current = await this.findOwn(user.id, id);
    if (dto.categoryId !== undefined) await this.assertCategory(dto.categoryId);

    const data: Prisma.PostUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.content !== undefined)
      data.content = this.cleanContent(dto.content);
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.status !== undefined && dto.status !== current.status) {
      data.status = dto.status;
      data.publishedAt = dto.status === 'PUBLISHED' ? new Date() : null;
    }

    // authorId trong where: lớp bảo vệ thứ hai, dù đã kiểm tra ở findOwn
    return this.prisma.post.update({
      where: { id, authorId: user.id },
      data,
      select: POST_FULL,
    });
  }

  // ---------- Xóa ----------
  async remove(user: AuthUser, id: number) {
    const result = await this.prisma.post.deleteMany({
      where: { id, authorId: user.id },
    });
    if (result.count === 0)
      throw new NotFoundException('Không tìm thấy bài viết');
    return { message: 'Đã xóa bài viết' };
  }

  // ---------- Danh sách của tôi ----------
  async listMine(
    userId: number,
    status: 'PUBLISHED' | 'DRAFT',
    { page, limit }: PaginationDto,
  ) {
    const where: Prisma.PostWhereInput = { authorId: userId, status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy:
          status === 'PUBLISHED'
            ? { publishedAt: 'desc' }
            : { updatedAt: 'desc' },
        select: POST_SUMMARY,
      }),
      this.prisma.post.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // Lấy một bài của mình (kể cả nháp) để đưa lên form chỉnh sửa
  getMine(userId: number, id: number) {
    return this.findOwn(userId, id);
  }
}
