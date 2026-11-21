import { ForbiddenException,Inject,Injectable,NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { AuthUser } from "../common/types/auth-user.js";

@Injectable()
export class OwnershipService{
    constructor(private readonly prisma:PrismaService){}
    private check(user:AuthUser,instructorId:number,what:string){
        if(user.role!=='ADMIN'&&instructorId!==user.id){
            throw new ForbiddenException('Bạn không phải giảng viên của ${what} này');
        }
    }
    async assertOwnsCourse(user:AuthUser,courseId:number){
        const course=await this.prisma.course.findUnique({
            where:{id:courseId},
            select:{instructorId:true},
        });
        if(!course) throw new NotFoundException('Không tìm thấy khóa học');
        this.check(user,course.instructorId,'Khóa học');
    }

    async assertOwnsChapter(user:AuthUser,chapterId:number){
        const chapter=await this.prisma.chapter.findUnique({
            where:{id:chapterId},
            select:{courseId:true,course:{select:{instructorId:true}}},
        });
        if(!chapter) throw new NotFoundException('Không tìm thấy chương');
        this.check(user,chapter.course.instructorId,'khóa học')
        return {courseId:chapter.courseId};
    }

     // Hai hàm dưới dùng ở lượt sau (bài học, quiz)
  async assertOwnsLesson(user: AuthUser, lessonId: number) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        chapterId: true,
        chapter: { select: { courseId: true, course: { select: { instructorId: true } } } },
      },
    });
    if (!lesson) throw new NotFoundException('Không tìm thấy bài học');
    this.check(user, lesson.chapter.course.instructorId, 'khóa học');
    return { chapterId: lesson.chapterId, courseId: lesson.chapter.courseId };
  }

  async assertOwnsQuiz(user: AuthUser, quizId: number) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        chapterId: true,
        chapter: { select: { courseId: true, course: { select: { instructorId: true } } } },
      },
    });
    if (!quiz) throw new NotFoundException('Không tìm thấy bài kiểm tra');
    this.check(user, quiz.chapter.course.instructorId, 'khóa học');
    return { chapterId: quiz.chapterId, courseId: quiz.chapter.courseId };
  }

  // Dùng ở lượt cuối (lớp học)
  async assertOwnsClass(user: AuthUser, classId: number) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { instructorId: true },
    });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp học');
    this.check(user, cls.instructorId, 'lớp học');
  }

  async assertOwnsQuestion(user:AuthUser,questionId:number){
    const question =await this.prisma.question.findUnique({
      where:{id:questionId},
      select:{
        quizId:true,
        quiz:{select:{chapter:{select:{course:{select:{instructorId:true}}}}}}
      }
    });
    if(!question) throw new NotFoundException('Không tìm thấy câu hỏi');
    this.check(user,question.quiz.chapter.course.instructorId,'khóa học');
    return {quizId:question.quizId};
  }
}