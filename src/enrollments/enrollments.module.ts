import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { MeController } from './me.controller.js';

@Module({
  providers: [EnrollmentsService],
  controllers: [EnrollmentsController, MeController],
})
export class EnrollmentsModule { }