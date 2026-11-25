import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const CACHE_TTL_MS = 2 * 60 * 1000; // dashboard chấp nhận số liệu cũ tối đa 2 phút

@Injectable()
export class AdminDashboardService {
  private cache: { at: number; data: Record<string, unknown> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return { ...this.cache.data, cached: true };
    }
    const data = await this.compute();
    this.cache = { at: Date.now(), data };
    return { ...data, cached: false };
  }

  private async compute(): Promise<Record<string, unknown>> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      students,
      instructors,
      admins,
      activeCourses,
      activeClasses,
      revenueAll,
      revenue30,
      perCourse,
      topClassRows,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: { name: 'STUDENT' } } }),
      this.prisma.user.count({ where: { role: { name: 'INSTRUCTOR' } } }),
      this.prisma.user.count({ where: { role: { name: 'ADMIN' } } }),
      this.prisma.course.count({ where: { isActive: true } }),
      this.prisma.class.count({ where: { isActive: true } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS', paidAt: { gte: since } },
      }),
      // Số đăng ký ACTIVE của từng khóa (số dòng = số khóa, nhỏ)
      this.prisma.enrollment.groupBy({
        by: ['courseId'],
        where: { courseId: { not: null }, status: 'ACTIVE' },
        _count: { _all: true },
      }),
      // Top 3 lớp: để database sắp xếp và cắt
      this.prisma.enrollment.groupBy({
        by: ['classId'],
        where: { classId: { not: null }, status: 'ACTIVE' },
        _count: { _all: true },
        orderBy: { _count: { classId: 'desc' } },
        take: 3,
      }),
    ]);

    // Lấy thông tin khóa một lần, dùng cho cả "top khóa" lẫn "top giảng viên"
    const courseIds = perCourse.map((p) => p.courseId as number);
    const courses = courseIds.length
      ? await this.prisma.course.findMany({
          where: { id: { in: courseIds } },
          select: {
            id: true,
            title: true,
            instructor: { select: { id: true, fullName: true } },
          },
        })
      : [];
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    const topCourses = [...perCourse]
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 3)
      .map((p) => ({
        id: p.courseId,
        title: courseMap.get(p.courseId as number)?.title ?? '',
        enrollments: p._count._all,
      }));

    // Top giảng viên: cộng số đăng ký của các khóa họ phụ trách
    const byInstructor = new Map<
      number,
      { id: number; fullName: string; enrollments: number }
    >();
    for (const p of perCourse) {
      const course = courseMap.get(p.courseId as number);
      if (!course) continue;
      const cur = byInstructor.get(course.instructor.id) ?? {
        id: course.instructor.id,
        fullName: course.instructor.fullName,
        enrollments: 0,
      };
      cur.enrollments += p._count._all;
      byInstructor.set(course.instructor.id, cur);
    }
    const topInstructors = [...byInstructor.values()]
      .sort((a, b) => b.enrollments - a.enrollments)
      .slice(0, 3);

    const classIds = topClassRows.map((p) => p.classId as number);
    const classes = classIds.length
      ? await this.prisma.class.findMany({
          where: { id: { in: classIds } },
          select: { id: true, title: true },
        })
      : [];
    const classMap = new Map(classes.map((c) => [c.id, c.title]));
    const topClasses = topClassRows.map((p) => ({
      id: p.classId,
      title: classMap.get(p.classId as number) ?? '',
      enrollments: p._count._all,
    }));

    return {
      users: { total: totalUsers, students, instructors, admins },
      activeCourses,
      activeClasses,
      // Decimal chuyển thành chuỗi để không mất độ chính xác
      revenue: {
        total: revenueAll._sum.amount?.toString() ?? '0',
        last30Days: revenue30._sum.amount?.toString() ?? '0',
      },
      topCourses,
      topClasses,
      topInstructors,
      generatedAt: new Date().toISOString(),
    };
  }
}
