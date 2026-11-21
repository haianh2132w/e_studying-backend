import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module.js';
import { ProgressService } from './progress.service.js';
import { ProgressController } from './progress.controller.js';

@Module({
  imports: [AccessModule],
  providers: [ProgressService],
  controllers: [ProgressController],
})
export class ProgressModule {}