import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntry {
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ip?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Không bao giờ ném lỗi: ghi nhật ký thất bại không được làm hỏng nghiệp vụ chính
  async log(entry: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action.slice(0, 100),
          entity: entry.entity.slice(0, 100),
          entityId: entry.entityId?.slice(0, 50) ?? null,
          ip: entry.ip?.slice(0, 64) ?? null,
          metadata: entry.metadata,
        },
      });
    } catch (e) {
      this.logger.error('Không ghi được audit log', e instanceof Error ? e.stack : String(e));
    }
  }
}