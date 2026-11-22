import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminRefsService } from './admin-refs.service.js';
import { AdminListQueryDto, CreateCourseDto, UpdateCourseDto } from './dto/admin-course-class.dto.js';

const COURSE_DETAIL = {
    id: true,
    title: true,
    description: true,
    objectives: true,
    thumbnailUrl: true,
    durationHours: true,
    price: true,
    salePrice: true,
    isFeatured: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    category: { select: { id: true, name: true } },
    instructor: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.CourseSelect;

@Injectable()
export class AdminCoursesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly refs: AdminRefsService,
    ) { }

    // danh sách (gồm cả khóa đang bị ẩn)
    async list(query: AdminListQueryDto) {
        const { page, limit, q, categoryId, instructorId, isActive } = query;
        const where: Prisma.CourseWhereInput = {
            ...(q && { title: { contains: q } }),
            ...(categoryId && { categoryId }),
            ...(instructorId && { instructorId }),
            ...(isActive !== undefined && { isActive }),
        };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.course.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    thumbnailUrl: true,
                    price: true,
                    salePrice: true,
                    isFeatured: true,
                    isActive: true,
                    createdAt: true,
                    category: { select: { id: true, name: true } },
                    instructor: { select: { id: true, fullName: true } },
                    _count: { select: { chapters: true, enrollments: { where: { status: 'ACTIVE' } } } },
                },
            }),
            this.prisma.course.count({ where }),
        ]);
        const items = rows.map(({ _count, ...c }) => ({
            ...c,
            chaptersCount: _count.chapters,
            activeEnrollments: _count.enrollments,
        }));
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getOne(id: number) {
        const course = await this.prisma.course.findUnique({ where: { id }, select: COURSE_DETAIL });
        if (!course) throw new NotFoundException('Không tìm thấy khóa học');
        return course;
    }

    //tạo khóa học (kèm gán giảng viên)
    async create(dto: CreateCourseDto) {
        await this.refs.assertCategory(dto.categoryId);
        await this.refs.assertInstructor(dto.instructorId);
        this.refs.assertPrices(dto.price, dto.salePrice);

        return this.prisma.course.create({
            data: {
                title: dto.title,
                description: dto.description,
                objectives: dto.objectives,
                thumbnailUrl: dto.thumbnailUrl,
                durationHours: dto.durationHours ?? 0,
                price: dto.price,
                salePrice: dto.salePrice,
                isFeatured: dto.isFeatured ?? false,
                categoryId: dto.categoryId,
                instructorId: dto.instructorId,
            },
            select: COURSE_DETAIL,
        });
    }

    //sửa khóa học 
    async update(id: number, dto: UpdateCourseDto) {
        const current = await this.prisma.course.findUnique({
            where: { id },
            select: { price: true, salePrice: true },
        });
        if (!current) throw new NotFoundException('Không tìm thấy khóa học');

        if (dto.categoryId !== undefined) await this.refs.assertCategory(dto.categoryId);
        if (dto.instructorId !== undefined) await this.refs.assertInstructor(dto.instructorId);

        // Kiểm tra giá SAU KHI gộp giá trị cũ và mới
        const price = dto.price ?? current.price.toNumber();
        const salePrice =
            dto.salePrice === undefined ? (current.salePrice?.toNumber() ?? null) : dto.salePrice;
        this.refs.assertPrices(price, salePrice);

        return this.prisma.course.update({
            where: { id },
            data: {
                title: dto.title,
                description: dto.description,
                objectives: dto.objectives,
                thumbnailUrl: dto.thumbnailUrl,
                durationHours: dto.durationHours,
                price: dto.price,
                salePrice: dto.salePrice,
                isFeatured: dto.isFeatured,
                categoryId: dto.categoryId,
                instructorId: dto.instructorId,
            },
            select: COURSE_DETAIL,
        });
    }

    //ẩn hoặc hiện khóa học 
    async setStatus(id: number, isActive: boolean) {
        const result = await this.prisma.course.updateMany({ where: { id }, data: { isActive } });
        if (result.count === 0) throw new NotFoundException('Không tìm thấy khóa học');
        return this.getOne(id);
    }
}