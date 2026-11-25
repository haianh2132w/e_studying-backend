import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessService } from '../access/access.service.js';
import { AuthUser } from '../common/types/auth-user.js';

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async getLesson(lessonId: number, user: AuthUser | null) {
    // Bước 1: tồn tại và đã xuất bản, nếu không thì 404 (chưa lấy nội dung ra ngoài)
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        status: 'PUBLISHED',
        chapter: { status: 'PUBLISHED', course: { isActive: true } },
      },
      select: {
        id: true,
        title: true,
        type: true,
        content: true,
        resourceUrl: true,
        fileName:true,
        durationMin: true,
        isPreview: true,
        chapter: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học');

    // Bước 2 đến 6: bài xem thử thì cho qua, còn lại phải có quyền
    if (!lesson.isPreview) {
      if (!user) throw new UnauthorizedException('Vui lòng đăng nhập để xem bài học');
      const allowed = await this.access.canAccessCourse(user, lesson.chapter.course.id);
      if (!allowed) throw new ForbiddenException('Bạn chưa đăng ký khóa học này');
    }

    const { chapter, ...rest } = lesson;
    return {
      ...rest,
      chapter: { id: chapter.id, title: chapter.title },
      course: chapter.course,
    };
  }
}