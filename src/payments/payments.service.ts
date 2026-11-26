import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildPaymentUrl, makeTxnRef, normalizeIp, parseTxnRef, verifySignature } from './vnpay.util.js';

type IpnResult = { RspCode: string; Message: string };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private cfg() {
    const tmnCode = this.config.get<string>('VNPAY_TMN_CODE');
    const secret = this.config.get<string>('VNPAY_HASH_SECRET');
    const baseUrl = this.config.get<string>('VNPAY_URL');
    const returnUrl = this.config.get<string>('VNPAY_RETURN_URL');
    if (!tmnCode || !secret || !baseUrl || !returnUrl) {
      throw new ServiceUnavailableException('Chưa cấu hình cổng thanh toán VNPay');
    }
    return { tmnCode, secret, baseUrl, returnUrl };
  }

  // ---------- UC 16: tạo link thanh toán ----------
  async createUrl(user: AuthUser, enrollmentId: number, ip: string) {
    const cfg = this.cfg();
    const e = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, userId: user.id }, // chỉ đăng ký CỦA CHÍNH MÌNH
      include: {
        payment: true,
        course: { select: { isActive: true, price: true, salePrice: true } },
        class: { select: { isActive: true, price: true, salePrice: true, endDate: true } },
      },
    });
    if (!e || !e.payment) throw new NotFoundException('Không tìm thấy đăng ký');
    if (e.status === 'ACTIVE') throw new ConflictException('Bạn đã thanh toán và đăng ký rồi');
    if (e.status !== 'PENDING' || e.payment.method !== 'VNPAY') {
      throw new BadRequestException('Đăng ký này không cần thanh toán. Hãy đăng ký lại.');
    }

    // Đọc lại giá hiện hành: admin có thể đã đổi giá sau lúc đăng ký
    const target = e.course ?? e.class;
    if (!target || !target.isActive) throw new NotFoundException('Khóa học hoặc lớp học không còn khả dụng');
    if (e.class && e.class.endDate < new Date()) throw new BadRequestException('Lớp học đã kết thúc');
    const amount = target.salePrice ?? target.price;
    if (amount.lte(0)) throw new BadRequestException('Mục này hiện miễn phí, hãy đăng ký lại');

    // Mỗi lần tạo link là một mã giao dịch mới. Không ghi đè nếu IPN vừa kịp xác nhận thành công
    const txnRef = makeTxnRef(e.id);
    const updated = await this.prisma.payment.updateMany({
      where: { id: e.payment.id, status: { not: 'SUCCESS' } },
      data: { amount, status: 'PENDING', txnRef },
    });
    if (updated.count === 0) throw new ConflictException('Đăng ký đã được thanh toán');

    const paymentUrl = buildPaymentUrl({
      ...cfg,
      txnRef,
      amountVnd: amount.toNumber(),
      ip: normalizeIp(ip),
      orderInfo: `Thanh toan don hang ${txnRef}`,
    });
    return { enrollmentId: e.id, amount, txnRef, paymentUrl, expiresInMinutes: 15 };
  }

  // ---------- UC 17: IPN, VNPay gọi server của mình ----------
  async handleIpn(query: Record<string, string>): Promise<IpnResult> {
    try {
      const { secret } = this.cfg();
      if (!verifySignature(query, secret)) return this.ipnLog(query, null, '97', 'Invalid signature');

      // Điều kiện 2: đơn tồn tại (tra theo id đăng ký nằm trong txnRef)
      const txnRef = query.vnp_TxnRef ?? '';
      const enrollmentId = parseTxnRef(txnRef);
      const payment = enrollmentId
        ? await this.prisma.payment.findUnique({
            where: { enrollmentId },
            include: { enrollment: { select: { userId: true, classId: true } } },
          })
        : null;
      if (!payment) return this.ipnLog(query, null, '01', 'Order not found');

      // Điều kiện 3: số tiền khớp (VNPay gửi số tiền đã nhân 100)
      const sent = query.vnp_Amount ?? '';
      if (!/^\d{1,15}$/.test(sent) || Number(sent) !== payment.amount.toNumber() * 100) {
        return this.ipnLog(query, payment.id, '04', 'Invalid amount');
      }

      // Điều kiện 4: đơn còn đang chờ. Đã xử lý rồi thì không làm lại (idempotent)
      if (payment.status !== 'PENDING') return this.ipnLog(query, payment.id, '02', 'Order already confirmed');

      const success = query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00';
      if (!success) {
        // Chỉ lần thử HIỆN TẠI mới được đánh dấu thất bại; thông báo muộn của link cũ bị bỏ qua
        if (txnRef === payment.txnRef) {
          await this.prisma.payment.updateMany({
            where: { id: payment.id, status: 'PENDING', txnRef },
            data: { status: 'FAILED' },
          });
        }
        return this.ipnLog(query, payment.id, '00', 'Confirm Success');
      }

      const activated = await this.prisma.$transaction(async (tx) => {
        const r = await tx.payment.updateMany({
          where: { id: payment.id, status: 'PENDING' }, // chỉ một request thắng
          data: {
            status: 'SUCCESS',
            paidAt: new Date(),
            txnRef,
            gatewayTxnNo: query.vnp_TransactionNo?.slice(0, 64),
          },
        });
        if (r.count === 0) return false;
        await tx.enrollment.update({
          where: { id: payment.enrollmentId },
          data: { status: 'ACTIVE', pricePaid: payment.amount },
        });
        if (payment.enrollment.classId) {
          const { classId, userId } = payment.enrollment;
          await tx.classStudent.upsert({
            where: { classId_userId: { classId, userId } },
            update: { status: 'ACTIVE' },
            create: { classId, userId, status: 'ACTIVE' },
          });
        }
        return true;
      });
      return activated
        ? this.ipnLog(query, payment.id, '00', 'Confirm Success')
        : this.ipnLog(query, payment.id, '02', 'Order already confirmed');
    } catch (e) {
      this.logger.error('Xử lý IPN VNPay lỗi', e instanceof Error ? e.stack : String(e));
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }

  // Ghi nhật ký mỗi lần VNPay gọi (không ghi chữ ký) và trả đúng định dạng VNPay yêu cầu
  private ipnLog(query: Record<string, string>, paymentId: number | null, code: string, message: string): IpnResult {
    void this.audit.log({
      action: 'VNPAY_IPN',
      entity: 'Payment',
      entityId: paymentId ? String(paymentId) : null,
      metadata: {
        rspCode: code,
        txnRef: (query.vnp_TxnRef ?? '').slice(0, 40),
        responseCode: query.vnp_ResponseCode ?? null,
        transactionStatus: query.vnp_TransactionStatus ?? null,
      },
    });
    return { RspCode: code, Message: message };
  }

  // ---------- Return URL: chỉ kiểm tra để hiển thị, KHÔNG đổi dữ liệu ----------
  describeReturn(query: Record<string, string>) {
    let valid = false;
    try {
      valid = verifySignature(query, this.cfg().secret);
    } catch {
      valid = false;
    }
    const status = !valid ? 'invalid' : query.vnp_ResponseCode === '00' ? 'success' : 'failed';
    const ref = parseTxnRef(query.vnp_TxnRef ?? '') ? query.vnp_TxnRef : undefined;
    return { status, ref };
  }
}