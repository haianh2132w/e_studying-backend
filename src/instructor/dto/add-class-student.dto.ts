import { IsString, Length } from 'class-validator';

export class AddClassStudentDto {
  @IsString() @Length(3, 255)
  emailOrUsername: string;
}