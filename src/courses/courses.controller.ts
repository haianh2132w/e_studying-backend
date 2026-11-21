import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { CoursesService } from './courses.service.js';
import { CourseQueryDto } from './dto/course-query.dto.js';

@Public()
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  list(@Query() query: CourseQueryDto) {
    return this.courses.list(query);
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.courses.getById(id);
  }
}