import { Module } from '@nestjs/common';
import { OwnershipModule } from '../ownership/ownership.module.js';
import { InstructorCoursesService } from './instructor-courses.service.js';
import { InstructorChaptersService } from './instructor-chapters.service.js';
import { InstructorLessonsService } from './instructor-lessons.service.js';
import { InstructorQuizzesService } from './instructor-quizzes.service.js';
import { InstructorCoursesController } from './instructor-courses.controller.js';
import { InstructorChaptersController } from './instructor-chapters.controller.js';
import { InstructorLessonsController } from './instructor-lessons.controller.js';
import { InstructorQuizzesController } from './instructor-quizzes.controller.js';
import { InstructorClassesService } from './instructor-classes.service.js';
import { InstructorClassesController } from './instructor-classes.controller.js';


@Module({
  imports: [OwnershipModule],
  providers: [
    InstructorCoursesService,
    InstructorChaptersService,
    InstructorLessonsService,
    InstructorQuizzesService,
    InstructorClassesService
  ],
  controllers: [
    InstructorCoursesController,
    InstructorChaptersController,
    InstructorLessonsController,
    InstructorQuizzesController,
    InstructorClassesController
  ],
})
export class InstructorModule {}