import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { InstructorChaptersService } from './instructor-chapters.service.js';
import { CreateChapterDto } from './dto/create-chapter.dto.js';
import { UpdateChapterDto } from './dto/update-chapter.dto.js';
import { ReorderDto } from './dto/reorder.dto.js';

@Roles('INSTRUCTOR', 'ADMIN')
@Controller('instructor')
export class InstructorChaptersController {
  constructor(private readonly chapters: InstructorChaptersService) {}

  @Get('courses/:id/chapters')
  list(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chapters.list(user, id);
  }

  @Post('courses/:id/chapters')
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateChapterDto,
  ) {
    return this.chapters.create(user, id, dto);
  }

  @Put('courses/:id/chapters/order')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReorderDto,
  ) {
    return this.chapters.reorder(user, id, dto);
  }

  @Get('chapters/:id')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chapters.getOne(user, id);
  }

  @Patch('chapters/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.chapters.update(user, id, dto);
  }

  @HttpCode(200)
  @Delete('chapters/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.chapters.remove(user, id);
  }
}