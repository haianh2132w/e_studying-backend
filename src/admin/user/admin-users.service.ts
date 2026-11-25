import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthUser } from '../../common/types/auth-user.js';
import {
    CreateUserDto,
    UpdateUserDto,
    UpdateUserStatusDto,
    UserQueryDto,
} from '../dto/admin-user.dto.js';
import { AuditService } from '../../audit/audit.service.js';



// Chỉ chọn trường an toàn. TUYỆT ĐỐI không có passwordHash
const USER_SELECT = {
    id: true,
    email: true,
    username: true,
    fullName: true,
    avatarUrl: true,
    bio: true,
    isActive: true,
    emailVerified: true,
    createdAt: true,
    role: { select: { name: true } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;
const toDto = ({ role, ...u }: UserRow) => ({ ...u, role: role.name });

@Injectable()
export class AdminUsersService {
    constructor(private readonly prisma: PrismaService,private readonly audit: AuditService) { }

    private async findOrThrow(id: number) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: USER_SELECT,
        });
        if (!user) throw new NotFoundException('Không tìm thấy người dùng');
        return user;
    }

    private async roleId(name: string) {
        const role = await this.prisma.setting.findFirst({
            where: { type: 'ROLE', name, isActive: true },
            select: { id: true },
        });
        if (!role) throw new BadRequestException('Role không hợp lệ');
        return role.id;
    }

    //danh sách
    async list(query: UserQueryDto) {
        const { page, limit, q, role, isActive } = query;
        const where: Prisma.UserWhereInput = {
            ...(q && {
                OR: [
                    { fullName: { contains: q } },
                    { email: { contains: q } },
                    { username: { contains: q } },
                ],
            }),
            ...(role && { role: { name: role } }),
            ...(isActive !== undefined && { isActive }),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: USER_SELECT,
            }),
            this.prisma.user.count({ where }),
        ]);
        return {
            items: rows.map(toDto),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getOne(id: number) {
        return toDto(await this.findOrThrow(id));
    }

    //tạo tài khoản
    async create(dto: CreateUserDto) {
        const email = dto.email.toLowerCase().trim();
        const dup = await this.prisma.user.findFirst({
            where: { OR: [{ email }, { username: dto.username }] },
            select: { id: true },
        });
        if (dup) throw new ConflictException('Email hoặc username đã được sử dụng');

        const roleId = await this.roleId(dto.role);
        const user = await this.prisma.user.create({
            data: {
                email,
                username: dto.username,
                fullName: dto.fullName,
                passwordHash: await bcrypt.hash(dto.password, 12),
                roleId,
                emailVerified: true, // admin tạo thì không cần xác thực email
            },
            select: USER_SELECT,
        });
        return toDto(user);
    }

    //sửa tài khoản
    async update(actor: AuthUser, id: number, dto: UpdateUserDto) {
        const target = await this.findOrThrow(id);

        // Admin không được tự đổi quyền của chính mình
        if (dto.role && dto.role !== target.role.name && actor.id === id) {
            throw new BadRequestException('Không thể tự đổi quyền của chính mình');
        }

        const email = dto.email?.toLowerCase().trim();
        const emailChanged = email !== undefined && email !== target.email;
        const usernameChanged =
            dto.username !== undefined && dto.username !== target.username;
        if (emailChanged || usernameChanged) {
            const dup = await this.prisma.user.findFirst({
                where: {
                    id: { not: id },
                    OR: [
                        ...(emailChanged ? [{ email }] : []),
                        ...(usernameChanged ? [{ username: dto.username }] : []),
                    ],
                },
                select: { id: true },
            });
            if (dup)
                throw new ConflictException('Email hoặc username đã được sử dụng');
        }

        const user = await this.prisma.user.update({
            where: { id },
            data: {
                fullName: dto.fullName,
                bio: dto.bio,
                email: emailChanged ? email : undefined,
                username: usernameChanged ? dto.username : undefined,
                roleId:
                    dto.role && dto.role !== target.role.name
                        ? await this.roleId(dto.role)
                        : undefined,
            },
            select: USER_SELECT,
        });
        if (dto.role && dto.role !== target.role.name) {
            await this.audit.log({
                userId: user.id,
                action: 'USER_ROLE_CHANGED',
                entity: 'User',
                entityId: String(id),
                metadata: { from: target.role.name, to: dto.role }
            })
        }
        return toDto(user);
    }

    //kích hoạt hoặc vô hiệu hóa
    async setStatus(actor: AuthUser, id: number, dto: UpdateUserStatusDto) {
        if (actor.id === id && !dto.isActive) {
            throw new BadRequestException(
                'Không thể tự vô hiệu hóa tài khoản của chính mình',
            );
        }
        await this.findOrThrow(id);

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({ where: { id }, data: { isActive: dto.isActive } });
            if (!dto.isActive) {
                // Thu hồi mọi phiên đăng nhập: không thể làm mới token nữa
                await tx.refreshToken.updateMany({
                    where: { userId: id, revokedAt: null },
                    data: { revokedAt: new Date() },
                });
            }
        });
        await this.audit.log({
            userId: actor.id,
            action: 'USER_STATUS_CHANGED',
            entity: 'User',
            entityId: String(id),
            metadata: { isActive: dto.isActive }
        })

        return toDto(await this.findOrThrow(id));
    }
}
