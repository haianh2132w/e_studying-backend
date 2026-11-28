import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) { }

  // Tạo URL ảnh QR 
  buildQrUrl(amount: Prisma.Decimal, txnRef: string): string {
    const { VIETQR_BANK_ID, VIETQR_ACCOUNT_NO, VIETQR_ACCOUNT_NAME } = process.env;
    if (!VIETQR_BANK_ID || !VIETQR_ACCOUNT_NO) {
      throw new InternalServerErrorException('Chưa cấu hình VietQR trong .env');
    }
    const qs = new URLSearchParams({
      amount: amount.toFixed(0),          // Decimal → chuỗi số nguyên, vd "499000"
      addInfo: txnRef,                    // nội dung chuyển khoản = mã giao dịch
      accountName: VIETQR_ACCOUNT_NAME ?? '',
    });
    return `https://img.vietqr.io/image/${VIETQR_BANK_ID}-${VIETQR_ACCOUNT_NO}-compact2.png?${qs}`;
  }

  // Chốt giao dịch (dùng chung cho mọi cổng) 
  async settle(txnRef: string, success: boolean): Promise<{ status: string; alreadyProcessed?: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.findUnique({
        where: { txnRef },
        include: { enrollment: true },
      });
      if (!p) throw new NotFoundException('Không tìm thấy giao dịch');

      // Chỉ đổi khi còn PENDING. count = số dòng thực sự được đổi.
      const { count } = await tx.payment.updateMany({
        where: { txnRef, status: 'PENDING' },
        data: success
          ? { status: 'SUCCESS', paidAt: new Date() }
          : { status: 'FAILED' },
      });
      if (count === 0) return { status: p.status, alreadyProcessed: true };
      if (!success) return { status: 'FAILED' };

      await tx.enrollment.update({
        where: { id: p.enrollmentId },
        data: { status: 'ACTIVE', pricePaid: p.amount },
      });

      if (p.enrollment.classId) {
        await tx.classStudent.upsert({
          where: { classId_userId: { classId: p.enrollment.classId, userId: p.enrollment.userId } },
          update: { status: 'ACTIVE' },
          create: { classId: p.enrollment.classId, userId: p.enrollment.userId, status: 'ACTIVE' },
        });
      }
      return { status: 'SUCCESS' };
    });
  }

  // Kiểm tra giao dịch có thuộc về user không
  private async findOwned(userId: number, txnRef: string) {
    const p = await this.prisma.payment.findUnique({
      where: { txnRef },
      select: { status: true, method: true, enrollment: { select: { userId: true } } },
    });
    // Không có HOẶC không phải của mình → cùng một lỗi 404 (không lộ là có tồn tại)
    if (!p || p.enrollment.userId !== userId) throw new NotFoundException('Không tìm thấy giao dịch');
    return p;
  }

  async getStatus(userId: number, txnRef: string) {
    const p = await this.findOwned(userId, txnRef);
    return { status: p.status };
  }

  // Chỉ dùng khi dev: giả lập "đã chuyển khoản"
  async devConfirm(userId: number, txnRef: string) {
    if (process.env.NODE_ENV === 'production') throw new NotFoundException();
    const p = await this.findOwned(userId, txnRef);
    if (p.method !== 'QR') throw new BadRequestException('Giao dịch này không phải thanh toán QR');
    return this.settle(txnRef, true);
  }
}