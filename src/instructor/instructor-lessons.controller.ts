import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { InstructorLessonsService } from './instructor-lessons.service.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { ReorderDto } from './dto/reorder.dto.js';

@Roles('INSTRUCTOR', 'ADMIN')
@Controller('instructor')
export class InstructorLessonsController {
  constructor(private readonly lessons: InstructorLessonsService) {}

  @Post('chapters/:id/lessons')
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLessonDto,
  ) {
    return this.lessons.create(user, id, dto);
  }

  @Put('chapters/:id/lessons/order')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReorderDto,
  ) {
    return this.lessons.reorder(user, id, dto);
  }

  @Get('lessons/:id')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.lessons.getOne(user, id);
  }

  @Patch('lessons/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessons.update(user, id, dto);
  }

  @HttpCode(200)
  @Delete('lessons/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.lessons.remove(user, id);
  }
}