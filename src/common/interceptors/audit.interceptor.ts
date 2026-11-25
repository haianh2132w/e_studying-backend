import {
  CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditService } from '../../audit/audit.service.js';
import { AuthUser } from '../types/auth-user.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser | null | undefined;
    const skip = this.reflector.getAllAndOverride<boolean>('skipAudit', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // Chỉ ghi thao tác GHI của giảng viên và admin
    if (!WRITE_METHODS.has(req.method) || skip || !user || user.role === 'STUDENT') {
      return next.handle();
    }

    const record = (outcome: 'SUCCESS' | 'DENIED') => {
      void this.audit.log({
        userId: user.id,
        action: req.method,
        entity: req.route?.path ?? req.path, // đường dẫn mẫu, ví dụ /api/instructor/chapters/:id
        entityId: req.params?.id ?? null,
        ip: req.ip,
        metadata: { outcome, params: req.params }, // TUYỆT ĐỐI không ghi req.body
      });
    };

    return next.handle().pipe(
      tap(() => record('SUCCESS')),
      catchError((err) => {
        if (err instanceof HttpException && err.getStatus() === 403) record('DENIED');
        return throwError(() => err);
      }),
    );
  }
}