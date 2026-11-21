import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { QuizzesService } from './quizzes.service.js';
import { SubmitQuizDto } from './dto/submit-quiz.dto.js';

@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get(':id')
  getQuiz(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.quizzes.getQuiz(id, user);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  @Post(':id/submit')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.quizzes.submit(id, user, dto);
  }
}