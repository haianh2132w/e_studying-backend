import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { QuizzesService } from './quizzes.service.js';
import { QuizzesController } from './quizzes.controller.js';

@Module({
  imports: [AccessModule],
  providers: [QuizzesService],
  controllers: [QuizzesController],
})
export class QuizzesModule {}