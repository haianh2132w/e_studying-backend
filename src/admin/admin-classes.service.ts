import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminRefsService } from './admin-refs.service.js';
import { AdminListQueryDto, CreateClassDto, UpdateClassDto } from './dto/admin-course-class.dto.js';

const CLASS_DETAIL = {
  id: true,
  title: true,
  description: true,
  objectives: true,
  assessment: true,
  schedule: true,
  totalHours: true,
  thumbnailUrl: true,
  price: true,
  salePrice: true,
  startDate: true,
  endDate: true,
  isActive: true,
  category: { select: { id: true, name: true } },
  instructor: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ClassSelect;

@Injectable()
export class AdminClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refs: AdminRefsService,
  ) { }

  //danh sách 
  async list(query: AdminListQueryDto) {
    const { page, limit, q, categoryId, instructorId, isActive } = query;
    const where: Prisma.ClassWhereInput = {
      ...(q && { title: { contains: q } }),
      ...(categoryId && { categoryId }),
      ...(instructorId && { instructorId }),
      ...(isActive !== undefined && { isActive }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.class.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          title: true,
          thumbnailUrl: true,
          price: true,
          salePrice: true,
          startDate: true,
          endDate: true,
          isActive: true,
          category: { select: { id: true, name: true } },
          instructor: { select: { id: true, fullName: true } },
          _count: {
            select: {
              students: { where: { status: 'ACTIVE' } },
              courses: true,
            },
          },
        },
      }),
      this.prisma.class.count({ where }),
    ]);
    const items = rows.map(({ _count, ...c }) => ({
      ...c,
      activeStudents: _count.students,
      coursesCount: _count.courses,
    }));
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getOne(id: number) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      select: CLASS_DETAIL,
    });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp học');
    return cls;
  }

  //tạo lớp (kèm gán giảng viên) 
  async create(dto: CreateClassDto) {
    await this.refs.assertCategory(dto.categoryId);
    await this.refs.assertInstructor(dto.instructorId);
    this.refs.assertPrices(dto.price, dto.salePrice);
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    this.refs.assertDates(start, end);

    return this.prisma.class.create({
      data: {
        title: dto.title,
        description: dto.description,
        objectives: dto.objectives,
        assessment: dto.assessment,
        schedule: dto.schedule,
        totalHours: dto.totalHours ?? 0,
        thumbnailUrl: dto.thumbnailUrl,
        price: dto.price,
        salePrice: dto.salePrice,
        startDate: start,
        endDate: end,
        categoryId: dto.categoryId,
        instructorId: dto.instructorId,
      },
      select: CLASS_DETAIL,
    });
  }

  //sửa lớp 
  async update(id: number, dto: UpdateClassDto) {
    const current = await this.prisma.class.findUnique({
      where: { id },
      select: { price: true, salePrice: true, startDate: true, endDate: true },
    });
    if (!current) throw new NotFoundException('Không tìm thấy lớp học');

    if (dto.categoryId !== undefined)
      await this.refs.assertCategory(dto.categoryId);
    if (dto.instructorId !== undefined)
      await this.refs.assertInstructor(dto.instructorId);

    const price = dto.price ?? current.price.toNumber();
    const salePrice =
      dto.salePrice === undefined
        ? (current.salePrice?.toNumber() ?? null)
        : dto.salePrice;
    this.refs.assertPrices(price, salePrice);

    const start = dto.startDate ? new Date(dto.startDate) : current.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : current.endDate;
    this.refs.assertDates(start, end);

    return this.prisma.class.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        objectives: dto.objectives,
        assessment: dto.assessment,
        schedule: dto.schedule,
        totalHours: dto.totalHours,
        thumbnailUrl: dto.thumbnailUrl,
        price: dto.price,
        salePrice: dto.salePrice,
        startDate: dto.startDate ? start : undefined,
        endDate: dto.endDate ? end : undefined,
        categoryId: dto.categoryId,
        instructorId: dto.instructorId,
      },
      select: CLASS_DETAIL,
    });
  }

  //ẩn hoặc hiện lớp
  async setStatus(id: number, isActive: boolean) {
    const result = await this.prisma.class.updateMany({
      where: { id },
      data: { isActive },
    });
    if (result.count === 0)
      throw new NotFoundException('Không tìm thấy lớp học');
    return this.getOne(id);
  }
}
