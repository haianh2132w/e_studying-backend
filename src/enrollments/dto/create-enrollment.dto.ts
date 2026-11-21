import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class CreateEnrollmentDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    courseId?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    classId?: number;
}