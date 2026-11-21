import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessService } from '../access/access.service.js';
import { AuthUser } from '../common/types/auth-user.js';
import { SubmitQuizDto } from './dto/submit-quiz.dto.js';

// Xáo trộn thứ tự đáp án để vị trí không lộ đáp án đúng (không cần mật mã, Math.random là đủ)
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

@Injectable()
export class QuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private async assertQuizAccess(quizId: number, user: AuthUser) {
    const quiz = await this.prisma.quiz.findFirst({
      where: {
        id: quizId,
        status: 'PUBLISHED',
        chapter: { status: 'PUBLISHED', course: { isActive: true } },
      },
      select: { chapter: { select: { courseId: true } } },
    });
    if (!quiz) throw new NotFoundException('Không tìm thấy bài kiểm tra');
    if (!(await this.access.canAccessCourse(user, quiz.chapter.courseId))) {
      throw new ForbiddenException('Bạn chưa đăng ký khóa học này');
    }
  }

  // Xem quiz: TUYỆT ĐỐI không chọn isCorrect
  async getQuiz(quizId: number, user: AuthUser) {
    await this.assertQuizAccess(quizId, user);
    const quiz = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: {
        id: true,
        title: true,
        instructions: true,
        questions: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            content: true,
            answers: { select: { id: true, content: true } },
          },
        },
      },
    });
    return {
      ...quiz,
      questions: quiz.questions.map((q) => ({ ...q, answers: shuffle(q.answers) })),
    };
  }

  async submit(quizId: number, user: AuthUser, dto: SubmitQuizDto) {
    await this.assertQuizAccess(quizId, user);

    // Lấy đáp án đúng từ DB (chỉ dùng trong server)
    const questions = await this.prisma.question.findMany({
      where: { quizId },
      select: { id: true, answers: { select: { id: true, isCorrect: true } } },
    });
    if (questions.length === 0) throw new BadRequestException('Bài kiểm tra chưa có câu hỏi');

    const byId = new Map(questions.map((q) => [q.id, q]));
    const chosen = new Map<number, number>(); // questionId -> answerId
    for (const item of dto.answers) {
      const q = byId.get(item.questionId);
      if (!q) throw new BadRequestException('Câu hỏi không thuộc bài kiểm tra này');
      if (!q.answers.some((a) => a.id === item.answerId)) {
        throw new BadRequestException('Đáp án không thuộc câu hỏi tương ứng');
      }
      if (chosen.has(item.questionId)) {
        throw new BadRequestException('Mỗi câu hỏi chỉ được trả lời một lần');
      }
      chosen.set(item.questionId, item.answerId);
    }

    // Câu bỏ trống tính là sai
    const results = questions.map((q) => {
      const picked = chosen.get(q.id);
      const correct = q.answers.some((a) => a.id === picked && a.isCorrect);
      return { questionId: q.id, correct };
    });
    const score = results.filter((r) => r.correct).length;
    const total = questions.length;

    const attempt = await this.prisma.quizAttempt.create({
      data: { userId: user.id, quizId, score, total },
    });
    return {
      attemptId: attempt.id,
      score,
      total,
      percent: Math.round((score / total) * 100),
      results, // chỉ đúng/sai từng câu, không tiết lộ đáp án đúng
    };
  }
}