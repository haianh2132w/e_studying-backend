import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AdminDashboardService } from './admin-dashboard.service.js';

@Roles('ADMIN')
@Controller('admin')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('dashboard')
  getDashboard() {
    return this.dashboard.getDashboard();
  }
}
