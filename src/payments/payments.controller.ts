import { Body, Controller, Get, Ip, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { PaymentsService } from './payments.service.js';

// Chỉ giữ tham số dạng chuỗi bắt đầu bằng vnp_ (Express có thể phân tích thành mảng hoặc object)
function vnpQuery(raw: Record<string, unknown>): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!k.startsWith('vnp_')) continue;
    if (typeof v !== 'string') return null;
    out[k] = v;
  }
  return out;
}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('vnpay/create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto, @Ip() ip: string) {
    return this.payments.createUrl(user, dto.enrollmentId, ip);
  }

  // VNPay gọi từ máy chủ của họ: không đăng nhập, không giới hạn tốc độ
  @Public()
  @SkipThrottle()
  @Get('vnpay/ipn')
  ipn(@Query() raw: Record<string, unknown>) {
    const query = vnpQuery(raw);
    if (!query) return { RspCode: '97', Message: 'Invalid signature' };
    return this.payments.handleIpn(query);
  }

  @Public()
  @Get('vnpay/return')
  returnUrl(@Query() raw: Record<string, unknown>, @Res() res: Response) {
    const result = this.payments.describeReturn(vnpQuery(raw) ?? {});
    const front = this.config.get<string>('FRONTEND_URL');
    if (!front) return res.json(result);
    const ref = result.ref ? `&ref=${encodeURIComponent(result.ref)}` : '';
    return res.redirect(302, `${front}/payment/result?status=${result.status}${ref}`);
  }
}