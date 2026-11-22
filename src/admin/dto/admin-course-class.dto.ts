import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

// ─── Shared query (courses & classes) ────────────────────────────────────────
export class AdminListQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  categoryId?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  instructorId?: number;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;
}

// ─── Shared toggle active ─────────────────────────────────────────────────────
export class UpdateActiveDto {
  @IsBoolean()
  isActive: boolean;
}

// ─── Course: Create ───────────────────────────────────────────────────────────
export class CreateCourseDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @Length(2, 200)
  @Matches(/^[^<>]*$/, { message: 'Tiêu đề không được chứa ký tự < hoặc >' })
  title: string;

  @IsOptional() @IsString() @MaxLength(10000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  objectives?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  thumbnailUrl?: string;

  @IsOptional() @IsInt() @Min(0) @Max(1000)
  durationHours?: number;

  @IsInt() @Min(0) @Max(100000000)
  price: number;

  @IsOptional() @IsInt() @Min(0) @Max(100000000)
  salePrice?: number;

  @IsOptional() @IsBoolean()
  isFeatured?: boolean;

  @IsInt() @Min(1)
  categoryId: number;

  @IsInt() @Min(1)
  instructorId: number;
}

// ─── Course: Update ───────────────────────────────────────────────────────────
export class UpdateCourseDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @Length(2, 200)
  @Matches(/^[^<>]*$/, { message: 'Tiêu đề không được chứa ký tự < hoặc >' })
  title?: string;

  @IsOptional() @IsString() @MaxLength(10000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  objectives?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  thumbnailUrl?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(1000)
  durationHours?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100000000)
  price?: number;

  // gửi null để bỏ giá khuyến mãi
  @IsOptional() @IsInt() @Min(0) @Max(100000000)
  salePrice?: number | null;

  @IsOptional() @IsBoolean()
  isFeatured?: boolean;

  @IsOptional() @IsInt() @Min(1)
  categoryId?: number;

  @IsOptional() @IsInt() @Min(1)
  instructorId?: number;
}

// ─── Class: Create ────────────────────────────────────────────────────────────
export class CreateClassDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @Length(2, 200)
  @Matches(/^[^<>]*$/, { message: 'Tiêu đề không được chứa ký tự < hoặc >' })
  title: string;

  @IsOptional() @IsString() @MaxLength(10000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  objectives?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  assessment?: string;

  @IsOptional() @IsString() @MaxLength(500)
  schedule?: string;

  @IsOptional() @IsInt() @Min(0) @Max(1000)
  totalHours?: number;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  thumbnailUrl?: string;

  @IsInt() @Min(0) @Max(100000000)
  price: number;

  @IsOptional() @IsInt() @Min(0) @Max(100000000)
  salePrice?: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsInt() @Min(1)
  categoryId: number;

  @IsInt() @Min(1)
  instructorId: number;
}

// ─── Class: Update ────────────────────────────────────────────────────────────
export class UpdateClassDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @Length(2, 200)
  @Matches(/^[^<>]*$/, { message: 'Tiêu đề không được chứa ký tự < hoặc >' })
  title?: string;

  @IsOptional() @IsString() @MaxLength(10000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  objectives?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  assessment?: string;

  @IsOptional() @IsString() @MaxLength(500)
  schedule?: string;

  @IsOptional() @IsInt() @Min(0) @Max(1000)
  totalHours?: number;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  thumbnailUrl?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(100000000)
  price?: number;

  // gửi null để bỏ giá khuyến mãi
  @IsOptional() @IsInt() @Min(0) @Max(100000000)
  salePrice?: number | null;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsInt() @Min(1)
  categoryId?: number;

  @IsOptional() @IsInt() @Min(1)
  instructorId?: number;
}
