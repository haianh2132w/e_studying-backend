import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsString, Length, ValidateNested,
} from 'class-validator';

export class AnswerInputDto {
  @IsString() @Length(1, 1000)
  content: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class CreateQuestionDto {
  @IsString() @Length(1, 2000)
  content: string;

  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDto)
  answers: AnswerInputDto[];
}