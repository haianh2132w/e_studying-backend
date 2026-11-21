import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor() {
    const port = Number(process.env.MAIL_PORT);
    this.transporter = process.env.MAIL_HOST
      ? nodemailer.createTransport({
          host: process.env.MAIL_HOST,
          port,
          secure: port === 465,
          auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
        })
      : null;
  }

  async sendCode(to: string, subject: string, code: string) {
    if (!this.transporter) {
      this.logger.warn(`[DEV] Mã gửi tới ${to}: ${code}`);
      return;
    }
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to,
      subject,
      text: `Mã của bạn là ${code}. Mã hết hạn sau 10 phút. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.`,
    });
  }
}