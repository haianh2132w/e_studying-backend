import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { LessonsService } from './lessons.service.js';
import { LessonsController } from './lessons.controller.js';

@Module({
  imports: [AccessModule],
  providers: [LessonsService],
  controllers: [LessonsController],
})
export class LessonsModule {}