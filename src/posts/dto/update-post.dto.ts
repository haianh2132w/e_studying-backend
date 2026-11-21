import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class UpdatePostDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @Length(3, 200)
  @Matches(/^[^<>]*$/, { message: 'Tiêu đề không được chứa ký tự < hoặc >' })
  title?: string;

  @IsOptional() @IsString() @Length(1, 50000)
  content?: string;

  // gửi null để bỏ danh mục
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  categoryId?: number | null;

  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';
}