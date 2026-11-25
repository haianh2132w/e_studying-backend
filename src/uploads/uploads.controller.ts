import {
  Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Res, StreamableFile,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { UploadsService } from './uploads.service.js';

@Controller()
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Roles('INSTRUCTOR', 'ADMIN')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('instructor/lessons/:id/file')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.uploads.attachLessonFile(user, id, file);
  }

  @Roles('INSTRUCTOR', 'ADMIN')
  @HttpCode(200)
  @Delete('instructor/lessons/:id/file')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.uploads.removeLessonFile(user, id);
  }

  // @Public vì bài xem thử cho khách tải; quyền được kiểm tra thủ công trong service
  @Public()
  @Get('lessons/:id/file')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser | null,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.uploads.openLessonFile(id, user);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(file.stream);
  }
}