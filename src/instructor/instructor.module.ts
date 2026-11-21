import { Module } from '@nestjs/common';
import { OwnershipModule } from '../ownership/ownership.module.js';
import { InstructorCoursesService } from './instructor-courses.service.js';
import { InstructorChaptersService } from './instructor-chapters.service.js';
import { InstructorCoursesController } from './instructor-courses.controller.js';
import { InstructorChaptersController } from './instructor-chapters.controller.js';

@Module({
  imports: [OwnershipModule],
  providers: [InstructorCoursesService, InstructorChaptersService],
  controllers: [InstructorCoursesController, InstructorChaptersController],
})
export class InstructorModule {}