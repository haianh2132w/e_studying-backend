import { Body, Controller, Post, HttpCode,Req,Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator.js';
import { SkipCsrf } from '../common/decorators/skip-csrf.decorator.js';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { ResendCodeDto } from './dto/resend-code.dto.js';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public() @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @Public() @SkipCsrf()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-code')
  resendCode(@Body() dto: ResendCodeDto) {
    return this.auth.resendCode(dto);
  }

   private setAuthCookies(res: Response, access: string, refresh: string) {
    const base = {
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
    };
    const week = 7 * 24 * 60 * 60 * 1000;
    res.cookie('access_token', access, { ...base, httpOnly: true, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, { ...base, httpOnly: true, path: '/api/auth', maxAge: week });
    res.cookie('csrf_token', crypto.randomBytes(24).toString('hex'), {
      ...base,
      httpOnly: false,
      maxAge: week,
    });
  }

  @Public() @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { access, refresh, user } = await this.auth.login(dto);
    this.setAuthCookies(res, access, refresh);
    return { user };
  }

  @Public() @SkipCsrf()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { access, refresh } = await this.auth.refresh(req.cookies?.refresh_token);
    this.setAuthCookies(res, access, refresh);
    return { message: 'Đã làm mới phiên đăng nhập' };
  }

  // @Public để đăng xuất được kể cả khi access token đã hết hạn; vẫn bắt buộc CSRF token
  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.refresh_token);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token', { path: '/api/auth' });
    res.clearCookie('csrf_token');
    return { message: 'Đã đăng xuất' };
  }

    @Public() @SkipCsrf()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(200)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public() @SkipCsrf()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }
}

