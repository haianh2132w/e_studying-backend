import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, Min } from 'class-validator';

export class SetClassCoursesDto {
  @IsArray() @ArrayMaxSize(50)
  @Type(() => Number) @IsInt({ each: true }) @Min(1, { each: true })
  courseIds: number[];
}