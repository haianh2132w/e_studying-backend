import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { InstructorClassesService } from './instructor-classes.service.js';
import {
  AddClassStudentDto,
  ClassStudentQueryDto,
  SetClassCoursesDto,
  UpdateClassStudentDto,
  UpdateClassSyllabusDto,
} from './dto/instructor-class.dto.js';

@Roles('INSTRUCTOR', 'ADMIN')
@Controller('instructor')
export class InstructorClassesController {
  constructor(private readonly classes: InstructorClassesService) {}

  @Get('classes')
  listMine(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.classes.listMine(user, q);
  }

  @Get('classes/:id')
  getOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.classes.getOne(user, id);
  }

  @Get('classes/:id/students')
  students(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ClassStudentQueryDto,
  ) {
    return this.classes.students(user, id, q);
  }

  // Giới hạn tốc độ vì route này tra cứu người dùng theo email/username
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('classes/:id/students')
  addStudent(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddClassStudentDto,
  ) {
    return this.classes.addStudent(user, id, dto);
  }

  @Patch('classes/:id/students/:userId')
  updateStudent(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateClassStudentDto,
  ) {
    return this.classes.updateStudent(user, id, userId, dto);
  }

  @Put('classes/:id/syllabus')
  updateSyllabus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClassSyllabusDto,
  ) {
    return this.classes.updateSyllabus(user, id, dto);
  }

  @Put('classes/:id/courses')
  setCourses(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetClassCoursesDto,
  ) {
    return this.classes.setCourses(user, id, dto);
  }
}