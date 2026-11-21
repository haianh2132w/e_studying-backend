import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.setting.findMany({
      where: { type: 'CATEGORY', isActive: true },
      select: { id: true, name: true, description: true },
      orderBy: { name: 'asc' },
    });
  }
}