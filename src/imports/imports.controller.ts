import {
    applyDecorators, Body, Controller, ForbiddenException, Get, NotFoundException, Param,
    ParseIntPipe, Post, Res, StreamableFile, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthUser } from '../common/types/auth-user.js';
import { CreateQuizDto } from '../instructor/dto/instructor-quiz.dto.js';
import { ADMIN_ONLY_TEMPLATES } from './import-schemas.js';
import { ImportsService } from './imports.service.js';
import { XLSX_MIME } from './xlsx-reader.js';

// Giới hạn: 1 file, 2MB, 10 lần mỗi phút. Không khai báo storage nên multer giữ file trong bộ nhớ
const UploadXlsx = () =>
    applyDecorators(
        Throttle({ default: { limit: 10, ttl: 60000 } }),
        UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } })),
    );

@Controller()
export class ImportsController {
    constructor(private readonly imports: ImportsService) { }

    @Roles('ADMIN') @UploadXlsx() @Post('admin/users/import')
    users(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
        return this.imports.importUsers(user, file);
    }

    @Roles('ADMIN') @UploadXlsx() @Post('admin/courses/import')
    courses(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
        return this.imports.importCourses(user, file);
    }

    @Roles('ADMIN') @UploadXlsx() @Post('admin/classes/import')
    classes(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
        return this.imports.importClasses(user, file);
    }

    @Roles('INSTRUCTOR', 'ADMIN') @UploadXlsx() @Post('instructor/classes/:id/students/import')
    classStudents(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.imports.importClassStudents(user, id, file);
    }

    // Form: field text "title", "instructions" và field file "file"
    @Roles('INSTRUCTOR', 'ADMIN') @UploadXlsx() @Post('instructor/chapters/:id/quizzes/import')
    quiz(
        @CurrentUser() user: AuthUser,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CreateQuizDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.imports.importQuiz(user, id, dto, file);
    }

    @Roles('INSTRUCTOR', 'ADMIN') @Get('imports/templates/:type')
    async template(
        @CurrentUser() user: AuthUser,
        @Param('type') type: string,
        @Res({ passthrough: true }) res: Response,
    ) {
        if (ADMIN_ONLY_TEMPLATES.has(type) && user.role !== 'ADMIN') {
            throw new ForbiddenException('Mẫu này chỉ dành cho admin');
        }
        const buf = await this.imports.buildTemplate(type);
        if (!buf) throw new NotFoundException('Không có mẫu này');
        res.set({
            'Content-Type': XLSX_MIME,
            'Content-Disposition': `attachment; filename="mau-${type}.xlsx"`, // type đã được bảng tra xác nhận
            'Cache-Control': 'no-store',
        });
        return new StreamableFile(buf);
    }
}