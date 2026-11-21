import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { OwnershipService } from '../ownership/ownership.service.js';
import { AuthUser } from '../common/types/auth-user.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { AddClassStudentDto } from './dto/add-class-student.dto.js';
import { UpdateClassStudentDto } from './dto/update-class-student.dto.js';
import { ClassStudentQueryDto } from './dto/class-student-query.dto.js';
import { UpdateClassSyllabusDto } from './dto/update-class-syllabus.dto.js';
import { SetClassCoursesDto } from './dto/set-class-courses.dto.js';

@Injectable()
export class InstructorClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  //lớp của tôi 
  async listMine(user: AuthUser, { page, limit }: PaginationDto) {
    const where: Prisma.ClassWhereInput = { instructorId: user.id };
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
          schedule: true,
          startDate: true,
          endDate: true,
          isActive: true,
          category: { select: { id: true, name: true } },
          _count: {
            select: { students: { where: { status: 'ACTIVE' } }, courses: true, syllabus: true },
          },
        },
      }),
      this.prisma.class.count({ where }),
    ]);
    const items = rows.map(({ _count, ...c }) => ({
      ...c,
      activeStudents: _count.students,
      coursesCount: _count.courses,
      sessionsCount: _count.syllabus,
    }));
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // Chi tiết lớp để đưa lên form chỉnh sửa
  async getOne(user: AuthUser, classId: number) {
    await this.ownership.assertOwnsClass(user, classId);
    const cls = await this.prisma.class.findUniqueOrThrow({
      where: { id: classId },
      select: {
        id: true,
        title: true,
        description: true,
        objectives: true,
        assessment: true,
        schedule: true,
        totalHours: true,
        startDate: true,
        endDate: true,
        isActive: true,
        syllabus: { orderBy: { sessionNo: 'asc' }, select: { sessionNo: true, objective: true } },
        courses: { select: { course: { select: { id: true, title: true, instructorId: true } } } },
      },
    });
    const { courses, ...rest } = cls;
    return { ...rest, courses: courses.map((c) => c.course) };
  }

  //học viên trong lớp ----------
  async students(user: AuthUser, classId: number, query: ClassStudentQueryDto) {
    await this.ownership.assertOwnsClass(user, classId);
    const { page, limit, status, q } = query;
    const where: Prisma.ClassStudentWhereInput = {
      classId,
      ...(status && { status }),
      ...(q && {
        user: {
          OR: [
            { fullName: { contains: q } },
            { email: { contains: q } },
            { username: { contains: q } },
          ],
        },
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.classStudent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { user: { fullName: 'asc' } },
        select: {
          status: true,
          user: { select: { id: true, fullName: true, username: true, email: true, avatarUrl: true } },
        },
      }),
      this.prisma.classStudent.count({ where }),
    ]);
    const items = rows.map((r) => ({ ...r.user, status: r.status }));
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  //đổi trạng thái học viên
  async updateStudent(user: AuthUser, classId: number, userId: number, dto: UpdateClassStudentDto) {
    await this.ownership.assertOwnsClass(user, classId);
    const result = await this.prisma.classStudent.updateMany({
      where: { classId, userId },
      data: { status: dto.status },
    });
    if (result.count === 0) throw new NotFoundException('Học viên không thuộc lớp này');
    return { classId, userId, status: dto.status };
  }

  //thêm học viên 
  async addStudent(user: AuthUser, classId: number, dto: AddClassStudentDto) {
    await this.ownership.assertOwnsClass(user, classId);
    const cls = await this.prisma.class.findUniqueOrThrow({
      where: { id: classId },
      select: { instructorId: true, isActive: true },
    });
    if (!cls.isActive) throw new BadRequestException('Lớp học đang bị ẩn');

    const key = dto.emailOrUsername.trim();
    const target = await this.prisma.user.findFirst({
      where: { isActive: true, OR: [{ email: key.toLowerCase() }, { username: key }] },
      select: { id: true, fullName: true },
    });
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');
    if (target.id === cls.instructorId) {
      throw new BadRequestException('Không thể thêm giảng viên phụ trách làm học viên');
    }

    const member = await this.prisma.classStudent.findUnique({
      where: { classId_userId: { classId, userId: target.id } },
    });
    if (member) {
      throw new ConflictException('Người này đã có trong lớp. Dùng chức năng đổi trạng thái nếu cần kích hoạt lại.');
    }

    // Phải tạo CẢ Enrollment ACTIVE lẫn ClassStudent, vì AccessService yêu cầu cả hai
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.enrollment.findFirst({ where: { userId: target.id, classId } });
      if (existing) {
        await tx.enrollment.update({ where: { id: existing.id }, data: { status: 'ACTIVE' } });
      } else {
        await tx.enrollment.create({
          data: { userId: target.id, classId, status: 'ACTIVE', pricePaid: 0 },
        });
      }
      await tx.classStudent.create({ data: { classId, userId: target.id, status: 'ACTIVE' } });
    });
    return { classId, userId: target.id, fullName: target.fullName, status: 'ACTIVE' };
  }

  //cập nhật giáo trình lớp
  async updateSyllabus(user: AuthUser, classId: number, dto: UpdateClassSyllabusDto) {
    await this.ownership.assertOwnsClass(user, classId);
    const current = await this.prisma.class.findUniqueOrThrow({
      where: { id: classId },
      select: { startDate: true, endDate: true },
    });

    // Kiểm tra sau khi gộp giá trị cũ và mới
    const start = dto.startDate ? new Date(dto.startDate) : current.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : current.endDate;
    if (start >= end) throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');

    await this.prisma.$transaction(async (tx) => {
      await tx.class.update({
        where: { id: classId },
        data: {
          startDate: dto.startDate ? start : undefined,
          endDate: dto.endDate ? end : undefined,
          schedule: dto.schedule,
          totalHours: dto.totalHours,
          objectives: dto.objectives,
          assessment: dto.assessment,
        },
      });
      if (dto.sessions) {
        await tx.classSession.deleteMany({ where: { classId } });
        if (dto.sessions.length > 0) {
          await tx.classSession.createMany({
            data: dto.sessions.map((s, i) => ({
              classId,
              sessionNo: i + 1,
              objective: s.objective.trim(),
            })),
          });
        }
      }
    });
    return this.getOne(user, classId);
  }

  //Nội dung lớp: khóa học thuộc lớp 
  async setCourses(user: AuthUser, classId: number, dto: SetClassCoursesDto) {
    await this.ownership.assertOwnsClass(user, classId);
    const isAdmin = user.role === 'ADMIN';

    // Liên kết tới khóa của người khác (do admin gắn) được GIỮ NGUYÊN, giảng viên không gỡ được
    const existing = await this.prisma.classCourse.findMany({
      where: { classId },
      select: { courseId: true, course: { select: { instructorId: true } } },
    });
    const locked = isAdmin
      ? []
      : existing.filter((e) => e.course.instructorId !== user.id).map((e) => e.courseId);

    const wanted = [...new Set(dto.courseIds)].filter((id) => !locked.includes(id));
    if (wanted.length > 0) {
      const courses = await this.prisma.course.findMany({
        where: { id: { in: wanted }, isActive: true },
        select: { id: true, instructorId: true },
      });
      if (courses.length !== wanted.length) {
        throw new BadRequestException('Có khóa học không tồn tại hoặc đang bị ẩn');
      }
      if (!isAdmin && courses.some((c) => c.instructorId !== user.id)) {
        throw new ForbiddenException('Chỉ được gắn khóa học do chính bạn phụ trách');
      }
    }

    await this.prisma.$transaction([
      this.prisma.classCourse.deleteMany({ where: { classId, courseId: { notIn: locked } } }),
      this.prisma.classCourse.createMany({
        data: wanted.map((courseId) => ({ classId, courseId })),
      }),
    ]);
    return this.getOne(user, classId);
  }
}