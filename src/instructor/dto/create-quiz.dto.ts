import { Transform } from "class-transformer";
import { IsOptional, IsString, Length, Matches, MaxLength } from "class-validator";

export class CreateQuizDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString() @Length(2, 200)
    @Matches(/^[^<>]*$/, { message: 'Tiêu đề không được chứa ký tự < hoặc >' })
    title:string;

    @IsOptional() @IsString() @MaxLength(2000)
    instructions?:string;
}
