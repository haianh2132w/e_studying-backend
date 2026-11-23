import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditQueryDto } from './dto/admin-audit-post.dto.js';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) { }

  async list(query: AuditQueryDto) {
    const { page, limit, userId, action, entity, from, to } = query;

    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      // 'to' chỉ có ngày (2026-11-30) thì tính đến hết ngày đó
      if (to.length === 10) end.setUTCHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    if (createdAt.gte && createdAt.lte && createdAt.gte > createdAt.lte) {
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    }

    const where: Prisma.AuditLogWhereInput = {
      ...(userId && { userId }),
      ...(action && { action }),
      ...(entity && { entity }),
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          ip: true,
          metadata: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}