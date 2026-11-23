import { Module } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service.js';
import { AdminUsersService } from './admin-users.service.js';
import { AdminDashboardController } from './admin-dashboard.controller.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminRefsService } from './admin-refs.service.js';
import { AdminCoursesService } from './admin-courses.service.js';
import { AdminClassesService } from './admin-classes.service.js';import { AdminCoursesController } from './admin-courses.controller.js';
import { AdminClassesController } from './admin-classes.controller.js';
import { AdminSettingsService } from './admin-settings.service.js';
import { AdminPostsService } from './admin-posts.service.js';
import { AdminAuditService } from './admin-audit.service.js';
import { AdminManageController } from './admin-manage.controller.js';


@Module({
    providers:[AdminDashboardService,AdminUsersService,AdminRefsService,AdminCoursesService,AdminClassesService,AdminSettingsService,AdminPostsService,AdminAuditService],
    controllers:[AdminDashboardController,AdminUsersController,AdminCoursesController,AdminClassesController,AdminManageController]
})
export class AdminModule {}
