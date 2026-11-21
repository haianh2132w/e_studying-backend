import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsIn, IsOptional, IsString, IsUrl, Length, Max,Matches, MaxLength, Min } from "class-validator";
export class CreateLessonDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString() @Length(2, 200)
    @Matches(/^[^<>]*$/, { message: 'Tiêu đề không được chứa ký tự < hoặc >' })
    title: string;

    @IsOptional() @IsIn(['VIDEO', 'DOCUMENT', 'LINK'])
    type?: 'VIDEO' | 'DOCUMENT' | 'LINK';

    @IsOptional()
    @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
    @MaxLength(500)
    resourceUrl?: string;

    @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000)
    durationMin?: number;

    @IsOptional() @IsBoolean()
    isPreview?: boolean;

    @IsOptional() @IsIn(['DRAFT', 'PUBLISHED'])
    status?: 'DRAFT' | 'PUBLISHED';
}