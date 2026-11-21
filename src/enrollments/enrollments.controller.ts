import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { EnrollmentsService } from './enrollments.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';

@Controller('enrollments')
export class EnrollmentsController {
    constructor(private readonly enrollments: EnrollmentsService) { }

    @Post()
    create(@CurrentUser() user: AuthUser, @Body() dto: CreateEnrollmentDto) {
        return this.enrollments.create(user, dto);
    }
}