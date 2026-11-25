import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
    SettingQueryDto,
    CreateSettingDto,
    UpdateSettingDto,
} from './dto/admin-setting.dto.js';

const SETTING_SELECT = {
    id: true,
    type: true,
    name: true,
    description: true,
    isActive: true,
    createdAt: true,
} satisfies Prisma.SettingSelect;

@Injectable()
export class AdminSettingsService {
    constructor(private readonly prisma: PrismaService) { }

    private async findOrThrow(id: number) {
        const setting = await this.prisma.setting.findUnique({
            where: { id },
            select: SETTING_SELECT,
        });
        if (!setting) throw new NotFoundException('Không tìm thấy cài đặt');
        return setting;
    }

    // danh sách, kèm số nơi đang sử dụng
    async list(query: SettingQueryDto) {
        const { page, limit, q, type, isActive } = query;
        const where: Prisma.SettingWhereInput = {
            ...(type && { type }),
            ...(isActive !== undefined && { isActive }),
            ...(q && {
                OR: [{ name: { contains: q } }, { description: { contains: q } }],
            }),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.setting.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [{ type: 'asc' }, { name: 'asc' }],
                select: {
                    ...SETTING_SELECT,
                    _count: {
                        select: { users: true, courses: true, classes: true, posts: true },
                    },
                },
            }),
            this.prisma.setting.count({ where }),
        ]);
        const items = rows.map(({ _count, ...s }) => ({ ...s, usage: _count }));
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    getOne(id: number) {
        return this.findOrThrow(id);
    }

    //  thêm danh mục
    async create(dto: CreateSettingDto) {
        const dup = await this.prisma.setting.findFirst({
            where: { type: dto.type, name: dto.name },
            select: { id: true },
        });
        if (dup) throw new ConflictException('Tên này đã tồn tại');
        return this.prisma.setting.create({
            data: { type: dto.type, name: dto.name, description: dto.description },
            select: SETTING_SELECT,
        });
    }

    //  sửa
    async update(id: number, dto: UpdateSettingDto) {
        const current = await this.findOrThrow(id);

        if (dto.name !== undefined && dto.name !== current.name) {
            if (current.type === 'ROLE') {
                throw new BadRequestException('Không thể đổi tên role hệ thống');
            }
            const dup = await this.prisma.setting.findFirst({
                where: { type: current.type, name: dto.name, id: { not: id } },
                select: { id: true },
            });
            if (dup) throw new ConflictException('Tên này đã tồn tại');
        }

        return this.prisma.setting.update({
            where: { id },
            data: { name: dto.name, description: dto.description },
            select: SETTING_SELECT,
        });
    }

    //  bật hoặc tắt
    async setStatus(id: number, isActive: boolean) {
        const current = await this.findOrThrow(id);
        if (current.type === 'ROLE') {
            throw new BadRequestException('Không thể bật hoặc tắt role hệ thống');
        }
        return this.prisma.setting.update({
            where: { id },
            data: { isActive },
            select: SETTING_SELECT,
        });
    }
}
