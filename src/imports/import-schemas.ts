import { Transform } from 'class-transformer';
import {
    IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min,
    IsDateString,
} from 'class-validator';
import type { Col } from './xlsx-reader.js';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.toUpperCase() : value);
const SAFE_TEXT = /^[^<>]*$/;
const URL_OPTS = { protocols: ['http', 'https'], require_protocol: true };

//Tài khoản 
export const USER_COLS: Col[] = [
    { key: 'email', kind: 'string', required: true, note: 'Email, không trùng với tài khoản đã có' },
    { key: 'username', kind: 'string', required: true, note: '3 đến 50 ký tự: chữ, số, gạch dưới' },
    { key: 'fullName', kind: 'string', required: true, note: 'Họ tên' },
    { key: 'role', kind: 'string', required: true, note: 'STUDENT, INSTRUCTOR hoặc ADMIN' },
];

export class UserRowDto {
    @IsEmail() @MaxLength(255) email: string;

    @IsString() @Length(3, 50) @Matches(/^[a-zA-Z0-9_]+$/, { message: 'chỉ gồm chữ, số, gạch dưới' })
    username: string;

    @IsString() @Length(2, 100) @Matches(SAFE_TEXT, { message: 'không được chứa ký tự < hoặc >' })
    fullName: string;

    @Transform(upper) @IsIn(['STUDENT', 'INSTRUCTOR', 'ADMIN'])
    role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
}

// Khóa học 
export const COURSE_COLS: Col[] = [
    { key: 'title', kind: 'string', required: true, note: 'Tiêu đề khóa học' },
    { key: 'description', kind: 'string', note: 'Mô tả' },
    { key: 'objectives', kind: 'string', note: 'Mục tiêu' },
    { key: 'thumbnailUrl', kind: 'string', note: 'Link ảnh bìa (http hoặc https)' },
    { key: 'durationHours', kind: 'number', note: 'Số giờ, 0 đến 1000' },
    { key: 'price', kind: 'number', required: true, note: 'Giá gốc (VND, số nguyên, 0 là miễn phí)' },
    { key: 'salePrice', kind: 'number', note: 'Giá khuyến mãi, phải nhỏ hơn price' },
    { key: 'isFeatured', kind: 'boolean', note: 'TRUE nếu nổi bật' },
    { key: 'category', kind: 'string', required: true, note: 'TÊN danh mục đang bật (ví dụ Backend)' },
    { key: 'instructorEmail', kind: 'string', required: true, note: 'Email giảng viên đang hoạt động' },
];

export class CourseRowDto {
    @IsString() @Length(2, 200) @Matches(SAFE_TEXT, { message: 'không được chứa ký tự < hoặc >' })
    title: string;

    @IsOptional() @IsString() @MaxLength(10000) description?: string;
    @IsOptional() @IsString() @MaxLength(5000) objectives?: string;
    @IsOptional() @IsUrl(URL_OPTS) @MaxLength(500) thumbnailUrl?: string;
    @IsOptional() @IsInt() @Min(0) @Max(1000) durationHours?: number;
    @IsInt() @Min(0) @Max(100000000) price: number;
    @IsOptional() @IsInt() @Min(0) @Max(100000000) salePrice?: number;
    @IsOptional() @IsBoolean() isFeatured?: boolean;
    @IsString() @Length(1, 100) category: string;
    @IsEmail() instructorEmail: string;
}

// Lớp học (UC 66)
export const CLASS_COLS: Col[] = [
    { key: 'title', kind: 'string', required: true, note: 'Tên lớp' },
    { key: 'description', kind: 'string', note: 'Mô tả' },
    { key: 'objectives', kind: 'string', note: 'Mục tiêu' },
    { key: 'assessment', kind: 'string', note: 'Cách đánh giá' },
    { key: 'schedule', kind: 'string', note: 'Lịch học, ví dụ Thứ 3 và thứ 5, 19:00' },
    { key: 'totalHours', kind: 'number', note: 'Tổng số giờ, 0 đến 1000' },
    { key: 'thumbnailUrl', kind: 'string', note: 'Link ảnh bìa (http hoặc https)' },
    { key: 'price', kind: 'number', required: true, note: 'Giá gốc (VND, số nguyên)' },
    { key: 'salePrice', kind: 'number', note: 'Giá khuyến mãi, phải nhỏ hơn price' },
    { key: 'startDate', kind: 'date', required: true, note: 'Ngày bắt đầu, dạng YYYY-MM-DD' },
    { key: 'endDate', kind: 'date', required: true, note: 'Ngày kết thúc, sau ngày bắt đầu' },
    { key: 'category', kind: 'string', required: true, note: 'TÊN danh mục đang bật' },
    { key: 'instructorEmail', kind: 'string', required: true, note: 'Email giảng viên đang hoạt động' },
];

export class ClassRowDto {
    @IsString() @Length(2, 200) @Matches(SAFE_TEXT, { message: 'không được chứa ký tự < hoặc >' })
    title: string;

    @IsOptional() @IsString() @MaxLength(10000) description?: string;
    @IsOptional() @IsString() @MaxLength(5000) objectives?: string;
    @IsOptional() @IsString() @MaxLength(5000) assessment?: string;
    @IsOptional() @IsString() @MaxLength(500) schedule?: string;
    @IsOptional() @IsInt() @Min(0) @Max(1000) totalHours?: number;
    @IsOptional() @IsUrl(URL_OPTS) @MaxLength(500) thumbnailUrl?: string;
    @IsInt() @Min(0) @Max(100000000) price: number;
    @IsOptional() @IsInt() @Min(0) @Max(100000000) salePrice?: number;
    @IsDateString() startDate: string;
    @IsDateString() endDate: string;
    @IsString() @Length(1, 100) category: string;
    @IsEmail() instructorEmail: string;
}

// Học viên vào lớp 
export const STUDENT_COLS: Col[] = [
    { key: 'emailOrUsername', kind: 'string', required: true, note: 'Email hoặc username của học viên' },
];

export class ClassStudentRowDto {
    @IsString() @Length(3, 255) emailOrUsername: string;
}

// =Quiz 
export const QUIZ_COLS: Col[] = [
    { key: 'question', kind: 'string', required: true, note: 'Nội dung câu hỏi' },
    { key: 'answerA', kind: 'string', required: true, note: 'Đáp án A' },
    { key: 'answerB', kind: 'string', required: true, note: 'Đáp án B' },
    { key: 'answerC', kind: 'string', note: 'Đáp án C (không bắt buộc)' },
    { key: 'answerD', kind: 'string', note: 'Đáp án D (không bắt buộc)' },
    { key: 'answerE', kind: 'string', note: 'Đáp án E (không bắt buộc)' },
    { key: 'answerF', kind: 'string', note: 'Đáp án F (không bắt buộc)' },
    { key: 'correct', kind: 'string', required: true, note: 'Chữ cái của đáp án đúng: A đến F (đúng 1 đáp án)' },
];

export class QuizRowDto {
    @IsString() @Length(1, 2000) question: string;
    @IsString() @Length(1, 1000) answerA: string;
    @IsString() @Length(1, 1000) answerB: string;
    @IsOptional() @IsString() @MaxLength(1000) answerC?: string;
    @IsOptional() @IsString() @MaxLength(1000) answerD?: string;
    @IsOptional() @IsString() @MaxLength(1000) answerE?: string;
    @IsOptional() @IsString() @MaxLength(1000) answerF?: string;

    @Transform(upper) @IsIn(['A', 'B', 'C', 'D', 'E', 'F'])
    correct: string;
}

//  Bảng tra file mẫu
export const TEMPLATES = new Map<string, Col[]>([
    ['users', USER_COLS],
    ['courses', COURSE_COLS],
    ['classes', CLASS_COLS],
    ['class-students', STUDENT_COLS],
    ['quiz', QUIZ_COLS],
]);
export const ADMIN_ONLY_TEMPLATES = new Set(['users', 'courses', 'classes']);