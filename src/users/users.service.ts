import { BadRequestException, Injectable, BadGatewayException, HttpException, Logger, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { validateImage } from '../common/utils/image-validator.js';
// Chỉ chọn trường an toàn, KHÔNG bao giờ có passwordHash
const ME_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  bio: true,
  createdAt: true,
  role: { select: { name: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly cloud: CloudinaryService) { }
  private readonly logger=new Logger(UsersService.name)
  getMe(userId: number) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: ME_SELECT });
  }

  updateMe(userId: number, dto: UpdateProfileDto) {
    // Trường undefined sẽ được Prisma bỏ qua, chỉ cập nhật cái gửi lên
    return this.prisma.user.update({
      where: { id: userId },
      data: { fullName: dto.fullName, bio: dto.bio },
      select: ME_SELECT,
    });
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { message: 'Đổi mật khẩu thành công' };
  }

  async setAvatar(userId: number, file?: Express.Multer.File) {
    validateImage(file);
    let url: string;
    try {
      url = await this.cloud.uploadAvatar(file!.buffer, userId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error('Upload avatar thất bại', e instanceof Error ? e.stack : String(e));
      throw new BadGatewayException('Không tải được ảnh lên, vui lòng thử lại');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });
    return { avatarUrl: url };
  }

   async removeAvatar(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    if (!user.avatarUrl) throw new NotFoundException('Bạn chưa có ảnh đại diện');
    try {
      await this.cloud.deleteAvatar(userId);
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error('Xóa ảnh trên Cloudinary thất bại', e instanceof Error ? e.stack : String(e));
    }
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    return { message: 'Đã xóa ảnh đại diện' };
  }
} 