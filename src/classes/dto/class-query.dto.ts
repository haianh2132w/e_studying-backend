import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class ClassQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  categoryId?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  instructorId?: number;
}