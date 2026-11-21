import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthUser } from '../common/types/auth-user.js';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  // Người này có được xem nội dung của khóa học này không?
  async canAccessCourse(user: AuthUser, courseId: number): Promise<boolean> {
    // Admin xem tất cả
    if (user.role === 'ADMIN') return true;

    // Giảng viên xem khóa của chính mình
    if (user.role === 'INSTRUCTOR') {
      const own = await this.prisma.course.findFirst({
        where: { id: courseId, instructorId: user.id },
        select: { id: true },
      });
      if (own) return true;
    }

    // Đăng ký trực tiếp khóa học (giảng viên cũng có thể là học viên của khóa khác)
    const direct = await this.prisma.enrollment.findFirst({
      where: { userId: user.id, courseId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (direct) return true;

    // Đăng ký qua lớp học: lớp có chứa khóa này, mình là học viên ACTIVE,
    // và đăng ký lớp của mình cũng ACTIVE (đã thanh toán)
    const viaClass = await this.prisma.classStudent.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        class: {
          isActive: true,
          courses: { some: { courseId } },
          enrollments: { some: { userId: user.id, status: 'ACTIVE' } },
        },
      },
      select: { classId: true },
    });
    return !!viaClass;
  }
}