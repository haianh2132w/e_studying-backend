import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { InstructorCoursesService } from './instructor-courses.service.js';

@Roles('INSTRUCTOR', 'ADMIN')
@Controller('instructor')
export class InstructorCoursesController {
  constructor(private readonly courses: InstructorCoursesService) {}

  @Get('courses')
  listMine(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
    return this.courses.listMine(user, q);
  }

  @Get('courses/:id/students')
  students(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: PaginationDto,
  ) {
    return this.courses.students(user, id, q);
  }
}