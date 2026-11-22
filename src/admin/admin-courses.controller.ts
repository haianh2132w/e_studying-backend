import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AdminCoursesService } from './admin-courses.service.js';
import { AdminListQueryDto, CreateCourseDto, UpdateCourseDto, UpdateActiveDto } from './dto/admin-course-class.dto.js';

@Roles('ADMIN')
@Controller('admin/courses')
export class AdminCoursesController {
  constructor(private readonly courses: AdminCoursesService) {}

  @Get()
  list(@Query() q: AdminListQueryDto) {
    return this.courses.list(q);
  }

  @Post()
  create(@Body() dto: CreateCourseDto) {
    return this.courses.create(dto);
  }

  @Get(':id')
  getOne(@Param('id', ParseIntPipe) id: number) {
    return this.courses.getOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseDto) {
    return this.courses.update(id, dto);
  }

  @Patch(':id/status')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActiveDto) {
    return this.courses.setStatus(id, dto.isActive);
  }
}