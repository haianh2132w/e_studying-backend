import { Body, Controller, Get, HttpCode, Patch,Delete,Post,UploadedFile,UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { FileInterceptor } from '@nestjs/platform-express';
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) { }

  @Get('me')
  getMe(@CurrentUser() user: { id: number }) {
    return this.users.getMe(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: { id: number }, @Body() dto: UpdateProfileDto) {
    return this.users.updateMe(user.id, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(200)
  @Patch('me/password')
  changePassword(@CurrentUser() user: { id: number }, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  @Post('me/avatar')
  uploadAvatar(@CurrentUser() user: { id: number }, @UploadedFile() file: Express.Multer.File) {
    return this.users.setAvatar(user.id, file);
  }

  @HttpCode(200)
  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: { id: number }) {
    return this.users.removeAvatar(user.id);
  }
}