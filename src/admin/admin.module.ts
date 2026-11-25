import { Module } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminUsersService } from './user/admin-users.service.js';
import { AdminDashboardController } from './admin-dashboard.controller.js';
import { AdminUsersController } from './user/admin-users.controller.js';
import { AdminRefsService } from './admin-refs.service.js';
import { AdminCoursesService } from './course-class/admin-courses.service.js';
import { AdminClassesService } from './course-class/admin-classes.service.js';
import { AdminCoursesController } from './course-class/admin-courses.controller.js';
import { AdminClassesController } from './course-class/admin-classes.controller.js';
import { AdminSettingsService } from './admin-settings.service.js';
import { AdminPostsService } from './audit-post/admin-posts.service.js';
import { AdminAuditService } from './audit-post/admin-audit.service.js';
import { AdminManageController } from './admin-manage.controller.js';

@Module({
    providers: [
        AdminDashboardService,
        AdminUsersService,
        AdminRefsService,
        AdminCoursesService,
        AdminClassesService,
        AdminSettingsService,
        AdminPostsService,
        AdminAuditService,
    ],
    controllers: [
        AdminDashboardController,
        AdminUsersController,
        AdminCoursesController,
        AdminClassesController,
        AdminManageController,
    ],
})
export class AdminModule { }
