import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class CreatePostDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @Length(3, 200)
  @Matches(/^[^<>]*$/, { message: 'Tiêu đề không được chứa ký tự < hoặc >' })
  title: string;

  @IsString() @Length(1, 50000)
  content: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  categoryId?: number;

  @IsOptional() @IsIn(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';
}