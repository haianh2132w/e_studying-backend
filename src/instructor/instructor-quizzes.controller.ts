import {
    Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { InstructorQuizzesService } from './instructor-quizzes.service.js';
import { CreateQuizDto } from './dto/create-quiz.dto.js';
import { UpdateQuizDto } from './dto/update-quiz.dto.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';

@Roles('INSTRUCTOR', 'ADMIN')
@Controller('instructor')
export class InstructorQuizzesController {
    constructor(private readonly quizzes: InstructorQuizzesService) { }

    @Post('chapters/:id/quizzes')
    create(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CreateQuizDto,
    ) {
        return this.quizzes.create(user, id, dto);
    }

    @Get('quizzes/:id')
    getOne(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
        return this.quizzes.getOne(user, id);
    }

    @Patch('quizzes/:id')
    update(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateQuizDto,
    ) {
        return this.quizzes.update(user, id, dto);
    }

    @HttpCode(200)
    @Delete('quizzes/:id')
    remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
        return this.quizzes.remove(user, id);
    }

    @Post('quizzes/:id/questions')
    addQuestion(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CreateQuestionDto,
    ) {
        return this.quizzes.addQuestion(user, id, dto);
    }

    @HttpCode(200)
    @Delete('questions/:id')
    removeQuestion(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
        return this.quizzes.removeQuestion(user, id);
    }
}