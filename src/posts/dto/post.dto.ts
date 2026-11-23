import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

// Query (Danh sách bài viết) 
export class PostQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;
}

// Create (Tạo bài viết mới) 
export class CreatePostDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 200)
  @Matches(/^[^<>]*$/, { message: 'Tiêu đề không được chứa ký tự < hoặc >' })
  title: string;

  @IsString()
  @Length(1, 50000)
  content: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';
}

//Update (Cập nhật bài viết) 
export class UpdatePostDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 200)
  @Matches(/^[^<>]*$/, { message: 'Tiêu đề không được chứa ký tự < hoặc >' })
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50000)
  content?: string;

  // Gửi null để gỡ danh mục khỏi bài viết
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number | null;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';
}
