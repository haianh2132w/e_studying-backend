import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminRefsService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCategory(categoryId: number) {
    const found = await this.prisma.setting.findFirst({
      where: { id: categoryId, type: 'CATEGORY', isActive: true },
      select: { id: true },
    });
    if (!found)
      throw new BadRequestException('Danh mục không hợp lệ hoặc đang bị tắt');
  }

  // Người được gán phải là giảng viên và đang hoạt động
  async assertInstructor(instructorId: number) {
    const found = await this.prisma.user.findFirst({
      where: { id: instructorId, isActive: true, role: { name: 'INSTRUCTOR' } },
      select: { id: true },
    });
    if (!found) {
      throw new BadRequestException(
        'Giảng viên không hợp lệ (không tồn tại, bị khóa hoặc không có role INSTRUCTOR)',
      );
    }
  }

  // Giá khuyến mãi phải nhỏ hơn giá gốc
  assertPrices(price: number, salePrice: number | null | undefined) {
    if (salePrice !== null && salePrice !== undefined && salePrice >= price) {
      throw new BadRequestException('Giá khuyến mãi phải nhỏ hơn giá gốc');
    }
  }

  assertDates(start: Date, end: Date) {
    if (start >= end)
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
  }
}
