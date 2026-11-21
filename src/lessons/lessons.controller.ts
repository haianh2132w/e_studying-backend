import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { AuthUser } from '../common/types/auth-user.js';
import { LessonsService } from './lessons.service.js';

@Public()
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get(':id')
  getLesson(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser | null,
  ) {
    return this.lessons.getLesson(id, user);
  }
}