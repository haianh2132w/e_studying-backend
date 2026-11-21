import { Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { ProgressService } from './progress.service.js';

@Controller()
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @HttpCode(200)
  @Post('lessons/:id/complete')
  complete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.progress.complete(id, user);
  }

  @Get('courses/:id/progress')
  courseProgress(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.progress.getCourseProgress(id, user);
  }
}