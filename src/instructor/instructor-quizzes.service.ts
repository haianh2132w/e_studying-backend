import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { OwnershipService } from '../ownership/ownership.service.js';
import { AuthUser } from '../common/types/auth-user.js';
import { CreateQuizDto } from './dto/create-quiz.dto.js';
import { UpdateQuizDto } from './dto/update-quiz.dto.js';
import { CreateQuestionDto } from './dto/create-question.dto.js';

const QUIZ_SELECT = {
  id: true,
  chapterId: true,
  title: true,
  instructions: true,
  status: true,
} satisfies Prisma.QuizSelect;

@Injectable()
export class InstructorQuizzesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) { }

  // Quiz chỉ xuất bản được khi có câu hỏi và mỗi câu có đúng 1 đáp án đúng
  private async assertPublishable(quizId: number) {
    const questions = await this.prisma.question.findMany({
      where: { quizId },
      select: { answers: { select: { isCorrect: true } } },
    });
    if (questions.length === 0) {
      throw new BadRequestException('Cần ít nhất 1 câu hỏi trước khi xuất bản');
    }
    if (questions.some((q) => q.answers.filter((a) => a.isCorrect).length !== 1)) {
      throw new BadRequestException('Mỗi câu hỏi phải có đúng 1 đáp án đúng');
    }
  }

  // tạo quiz, luôn bắt đầu là nháp (chưa có câu hỏi nên chưa thể xuất bản)
  async create(user: AuthUser, chapterId: number, dto: CreateQuizDto) {
    await this.ownership.assertOwnsChapter(user, chapterId);
    return this.prisma.quiz.create({
      data: { chapterId, title: dto.title, instructions: dto.instructions, status: 'DRAFT' },
      select: QUIZ_SELECT,
    });
  }

  // UC 37: sửa quiz
  async update(user: AuthUser, quizId: number, dto: UpdateQuizDto) {
    await this.ownership.assertOwnsQuiz(user, quizId);
    if (dto.status === 'PUBLISHED') await this.assertPublishable(quizId);
    return this.prisma.quiz.update({
      where: { id: quizId },
      data: { title: dto.title, instructions: dto.instructions, status: dto.status },
      select: QUIZ_SELECT,
    });
  }

  // Giảng viên được xem isCorrect (khác hẳn API của học viên)
  async getOne(user: AuthUser, quizId: number) {
    await this.ownership.assertOwnsQuiz(user, quizId);
    const quiz = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: {
        ...QUIZ_SELECT,
        questions: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            content: true,
            position: true,
            answers: { select: { id: true, content: true, isCorrect: true } },
          },
        },
        _count: { select: { attempts: true } },
      },
    });
    const { _count, ...rest } = quiz;
    return { ...rest, attemptsCount: _count.attempts };
  }

  // thêm câu hỏi kèm đáp án (một lần, trong một transaction ngầm của nested create)
  async addQuestion(user: AuthUser, quizId: number, dto: CreateQuestionDto) {
    await this.ownership.assertOwnsQuiz(user, quizId);

    const correct = dto.answers.filter((a) => a.isCorrect).length;
    if (correct !== 1) throw new BadRequestException('Câu hỏi phải có đúng 1 đáp án đúng');

    const texts = dto.answers.map((a) => a.content.trim().toLowerCase());
    if (texts.some((t) => !t)) throw new BadRequestException('Đáp án không được để trống');
    if (new Set(texts).size !== texts.length) {
      throw new BadRequestException('Các đáp án không được trùng nhau');
    }

    const last = await this.prisma.question.aggregate({
      where: { quizId },
      _max: { position: true },
    });
    return this.prisma.question.create({
      data: {
        quizId,
        content: dto.content.trim(),
        position: (last._max.position ?? 0) + 1,
        answers: {
          create: dto.answers.map((a) => ({ content: a.content.trim(), isCorrect: a.isCorrect })),
        },
      },
      select: {
        id: true,
        content: true,
        position: true,
        answers: { select: { id: true, content: true, isCorrect: true } },
      },
    });
  }

  async removeQuestion(user: AuthUser, questionId: number) {
    const { quizId } = await this.ownership.assertOwnsQuestion(user, questionId);
    const quiz = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: { status: true, _count: { select: { questions: true, attempts: true } } },
    });
    // Quiz đang xuất bản: không được xóa câu cuối cùng, và không đổi đề khi đã có người làm
    if (quiz.status === 'PUBLISHED' && (quiz._count.questions <= 1 || quiz._count.attempts > 0)) {
      throw new ConflictException(
        'Quiz đang xuất bản và đã có lượt làm hoặc chỉ còn 1 câu. Hãy chuyển về nháp trước.',
      );
    }
    await this.prisma.question.delete({ where: { id: questionId } }); // đáp án xóa theo (Cascade)
    return { message: 'Đã xóa câu hỏi' };
  }

  async remove(user: AuthUser, quizId: number) {
    await this.ownership.assertOwnsQuiz(user, quizId);
    const attempts = await this.prisma.quizAttempt.count({ where: { quizId } });
    if (attempts > 0) {
      throw new ConflictException('Quiz đã có lượt làm. Hãy chuyển về nháp thay vì xóa.');
    }
    await this.prisma.quiz.delete({ where: { id: quizId } });
    return { message: 'Đã xóa bài kiểm tra' };
  }
}