import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext) {
    const skip = this.reflector.getAllAndOverride<boolean>('skipCsrf', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest();
    if (skip || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const header = req.headers['x-csrf-token'];
    const cookie = req.cookies?.csrf_token;
    if (!header || !cookie || header !== cookie) {
      throw new ForbiddenException('CSRF token không hợp lệ');
    }
    return true;
  }
}