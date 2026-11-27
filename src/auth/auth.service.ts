import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
    ForgotPasswordDto,
    LoginDto,
    RegisterDto,
    ResendCodeDto,
    ResetPasswordDto,
    VerifyEmailDto,
} from './dto/auth.dto.js';
@Injectable()
export class AuthService {
    // Hash giả để bcrypt.compare luôn chạy khi user không tồn tại (chống timing attack)
    private readonly dummyHash = bcrypt.hashSync('no-user', 12);
    private readonly audit: AuditService;
    constructor(
        private readonly prisma: PrismaService,
        private readonly mail: MailService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) { }
    private hash(code: string) {
        return crypto.createHash('sha256').update(code).digest('hex');
    }
    // Tạo mã 6 số, lưu BĂM của mã, gửi mã gốc qua email
    private async issueCode(
        userId: number,
        email: string,
        type: TokenType,
        subject: string = 'Mã xác thực',
    ) {
        await this.prisma.authToken.updateMany({
            where: { userId, type, usedAt: null },
            data: { usedAt: new Date() }, // vô hiệu hóa mã cũ
        });
        const code = crypto.randomInt(100000, 1000000).toString();
        await this.prisma.authToken.create({
            data: {
                userId,
                type,
                codeHash: this.hash(code),
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        });
        await this.mail.sendCode(email, subject, code);
    }

    async register(dto: RegisterDto) {
        const email = dto.email.toLowerCase().trim();
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email }, { username: dto.username }] },
        });
        if (existing) throw new ConflictException('Email hoặc username đã được sử dụng');

        const role = await this.prisma.setting.findFirstOrThrow({
            where: { type: 'ROLE', name: 'STUDENT' },
        });
        const user = await this.prisma.user.create({
            data: {
                email,
                username: dto.username,
                fullName: dto.fullName,
                passwordHash: await bcrypt.hash(dto.password, 12),
                roleId: role.id,
            },
        });
        await this.issueCode(user.id, user.email, 'VERIFY_EMAIL');
        return { message: 'Đăng ký thành công. Vui lòng kiểm tra email để lấy mã xác thực.' };
    }

    async verifyEmail(dto: VerifyEmailDto) {
        const invalid = new BadRequestException('Mã không hợp lệ hoặc đã hết hạn');
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase().trim() },
        });
        if (!user) throw invalid;
        if (user.emailVerified) return { message: 'Email đã được xác thực' };

        const token = await this.prisma.authToken.findFirst({
            where: { userId: user.id, type: 'VERIFY_EMAIL', usedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        if (!token || token.expiresAt < new Date() || token.attempts >= 5) throw invalid;

        if (token.codeHash !== this.hash(dto.code)) {
            await this.prisma.authToken.update({
                where: { id: token.id },
                data: { attempts: { increment: 1 } },
            });
            throw invalid;
        }

        await this.prisma.$transaction([
            this.prisma.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
            this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } }),
        ]);
        return { message: 'Xác thực email thành công' };
    }

    async resendCode(dto: ResendCodeDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase().trim() },
        });
        if (user && !user.emailVerified) {
            await this.issueCode(user.id, user.email, 'VERIFY_EMAIL');
        }
        // Luôn trả cùng một thông báo để không lộ email nào đã đăng ký
        return { message: 'Nếu email hợp lệ, mã mới đã được gửi.' };
    }

    // Tạo access token (JWT) + refresh token (chuỗi ngẫu nhiên, chỉ lưu BĂM trong DB)
    private async issueTokens(user: { id: number; role: { name: string } }) {
        const access = await this.jwt.signAsync(
            { sub: user.id, role: user.role.name },
            { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: 15 * 60 },
        );
        const refresh = crypto.randomBytes(48).toString('hex');
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash: this.hash(refresh),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
        return { access, refresh };
    }

    async login(dto: LoginDto, ip?: string) {
        const id = dto.identifier.trim();
        const user = await this.prisma.user.findFirst({
            where: { OR: [{ email: id.toLowerCase() }, { username: id }] },
            include: { role: true },
        });

        // Luôn chạy bcrypt.compare, kể cả khi user không tồn tại, để thời gian phản hồi giống nhau
        const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? this.dummyHash);
        if (!user || !ok) {
            await this.audit.log({
                userId: user?.id ?? null,
                action: 'LOGIN_FAILED',
                entity: 'Auth',
                ip,
                metadata: { reason: user ? 'BAD_PASSWORD' : 'UNKNOWN_USER' },
            });
            throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
        }

        if (!user.isActive || !user.emailVerified) {
            await this.audit.log({
                userId: user.id,
                action: 'LOGIN_FAILED',
                entity: 'Auth',
                ip,
                metadata: { reason: !user.isActive ? 'INACTIVE' : 'UNVERIFIED' }
            });
            if (!user.isActive)
                throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');
            throw new ForbiddenException('Vui lòng xác thực email trước khi đăng nhập');

        };


        const tokens = await this.issueTokens(user);
        if (user.role.name !== 'STUDENT') {
            await this.audit.log({ userId: user.id, action: 'LOGIN_SUCCESS', entity: 'Auth', ip })
        }
        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                fullName: user.fullName,
                role: user.role.name,
            },
        };
    }

    // Refresh token rotation: mỗi lần làm mới, token cũ bị thu hồi và cấp cặp mới
    async refresh(token?: string) {
        const unauthorized = new UnauthorizedException('Phiên đăng nhập không hợp lệ');
        if (!token) throw unauthorized;

        const stored = await this.prisma.refreshToken.findUnique({
            where: { tokenHash: this.hash(token) },
            include: { user: { include: { role: true } } },
        });
        if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive) {
            throw unauthorized;
        }

        await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
        });
        return this.issueTokens(stored.user);
    }

    async logout(token?: string) {
        if (!token) return;
        await this.prisma.refreshToken.updateMany({
            where: { tokenHash: this.hash(token), revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase().trim() },
        });
        if (user && user.isActive) {
            await this.issueCode(user.id, user.email, 'RESET_PASSWORD', 'Mã đặt lại mật khẩu');
        }
        return { message: 'Nếu email hợp lệ, mã đặt lại mật khẩu đã được gửi.' };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const invalid = new BadRequestException('Mã không hợp lệ hoặc đã hết hạn');
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase().trim() },
        });
        if (!user || !user.isActive) throw invalid;

        const token = await this.prisma.authToken.findFirst({
            where: { userId: user.id, type: 'RESET_PASSWORD', usedAt: null },
            orderBy: { createdAt: 'desc' },
        });
        if (!token || token.expiresAt < new Date() || token.attempts >= 5) throw invalid;

        if (token.codeHash !== this.hash(dto.code)) {
            await this.prisma.authToken.update({
                where: { id: token.id },
                data: { attempts: { increment: 1 } },
            });
            throw invalid;
        }

        const passwordHash = await bcrypt.hash(dto.newPassword, 12);
        await this.prisma.$transaction([
            // 1. Đánh dấu mã đã dùng: chỉ có usedAt, KHÔNG có passwordHash
            this.prisma.authToken.update({
                where: { id: token.id },
                data: { usedAt: new Date() },
            }),
            // 2. Đổi mật khẩu: passwordHash nằm ở đây, trên bảng user
            this.prisma.user.update({
                where: { id: user.id },
                data: { passwordHash },
            }),
            // 3. Thu hồi toàn bộ phiên đăng nhập cũ
            this.prisma.refreshToken.updateMany({
                where: { userId: user.id, revokedAt: null },
                data: { revokedAt: new Date() },
            }),
        ]);
    }
}