import { Module } from '@nestjs/common';
import { InstructorModule } from '../instructor/instructor.module.js';
import { OwnershipModule } from '../ownership/ownership.module.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

@Module({
  imports: [OwnershipModule, InstructorModule],
  providers: [ImportsService],
  controllers: [ImportsController],
})
export class ImportsModule {}