import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { AdminSettingsService } from './admin-settings.service.js';
import { AdminPostsService } from './audit-post/admin-posts.service.js';
import { AdminAuditService } from './audit-post/admin-audit.service.js';
import {
  SettingQueryDto,
  CreateSettingDto,
  UpdateSettingDto,
} from './dto/admin-setting.dto.js';
import { UpdateActiveDto } from './dto/admin-course-class.dto.js';
import {
  AdminPostQueryDto,
  DeletePostDto,
  AuditQueryDto,
} from './dto/admin-audit-post.dto.js';
import { SkipAudit } from '../common/decorators/skip-audit.decorator.js';

@Roles('ADMIN')
@Controller('admin')
export class AdminManageController {
  constructor(
    private readonly settings: AdminSettingsService,
    private readonly posts: AdminPostsService,
    private readonly audit: AdminAuditService,
  ) { }

  //  Cài đặt 
  @Get('settings')
  listSettings(@Query() q: SettingQueryDto) {
    return this.settings.list(q);
  }

  @Post('settings')
  createSetting(@Body() dto: CreateSettingDto) {
    return this.settings.create(dto);
  }

  @Get('settings/:id')
  getSetting(@Param('id', ParseIntPipe) id: number) {
    return this.settings.getOne(id);
  }

  @Patch('settings/:id')
  updateSetting(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.settings.update(id, dto);
  }

  @Patch('settings/:id/status')
  setSettingStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActiveDto,
  ) {
    return this.settings.setStatus(id, dto.isActive);
  }

  //  Bài viết 
  @Get('posts')
  listPosts(@Query() q: AdminPostQueryDto) {
    return this.posts.list(q);
  }

  @Get('posts/:id')
  getPost(@Param('id', ParseIntPipe) id: number) {
    return this.posts.getOne(id);
  }

  @SkipAudit()
  @HttpCode(200)
  @Delete('posts/:id')
  removePost(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeletePostDto,
    @Ip() ip: string,
  ) {
    return this.posts.remove(admin, id, dto.reason, ip);
  }

  //  Nhật ký 
  @Get('audit-logs')
  listAudit(@Query() q: AuditQueryDto) {
    return this.audit.list(q);
  }


}
