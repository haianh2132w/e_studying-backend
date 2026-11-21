import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CourseQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  categoryId?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  instructorId?: number;

  @IsOptional() @Type(() => Number) @Min(0) @Max(100000000)
  minPrice?: number;

  @IsOptional() @Type(() => Number) @Min(0) @Max(100000000)
  maxPrice?: number;
}