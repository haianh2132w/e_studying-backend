import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { EnrollmentsService } from './enrollments.service.js';

@Controller('me')
export class MeController {
    constructor(private readonly enrollments: EnrollmentsService) { }

    @Get('enrollments')
    enrollmentsList(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
        return this.enrollments.listEnrollments(user.id, q);
    }

    @Get('courses')
    courses(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
        return this.enrollments.listMyCourses(user.id, q);
    }

    @Get('classes')
    classes(@CurrentUser() user: AuthUser, @Query() q: PaginationDto) {
        return this.enrollments.listMyClasses(user.id, q);
    }

    @Get('classes/:id')
    classDetail(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
        return this.enrollments.getMyClass(user.id, id);
    }
}