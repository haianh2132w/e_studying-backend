import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { CsrfGuard } from './common/guards/csrf.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { MailModule } from './mail/mail.module.js';
import { UsersModule } from './users/users.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { ClassesModule } from './classes/classes.module.js';
import { PostsModule } from './posts/posts.module.js';
import { HomeModule } from './home/home.module.js';
import { AccessModule } from './access/access.module.js';
import { LessonsModule } from './lessons/lessons.module.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';
import { ProgressModule } from './progress/progress.module.js';
import { QuizzesModule } from './quizzes/quizzes.module.js';
import { OwnershipModule } from './ownership/ownership.module.js';
import { InstructorModule } from './instructor/instructor.module.js';
import { AdminModule } from './admin/admin.module.js';
import { AuditModule } from './audit/audit.module.js';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './common/interceptors/audit.interceptor.js'
import { UploadsModule } from './uploads/uploads.module.js';
import { ImportsModule } from './imports/import.module.js';
import { CloudinaryModule } from './cloudinary/cloudinary.module.js';
import { PaymentsModule } from './payments/payments.module.js';



@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    MailModule,
    UsersModule,
    CategoriesModule,
    CoursesModule,
    ClassesModule,
    PostsModule,
    HomeModule,
    AccessModule,
    LessonsModule,
    EnrollmentsModule,
    ProgressModule,
    QuizzesModule,
    OwnershipModule,
    InstructorModule,
    AdminModule,
    AuditModule,
    UploadsModule,
    ImportsModule,
    CloudinaryModule,
    PaymentsModule
  ],
  controllers: [AppController],
  providers: [AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }
  ],
})
export class AppModule { }