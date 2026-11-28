import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service.js';
import { EnrollmentsController } from './enrollments.controller.js';
import { MeController } from './me.controller.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  providers: [EnrollmentsService],
  controllers: [EnrollmentsController, MeController],
  imports:[PaymentsModule]
})
export class EnrollmentsModule { }