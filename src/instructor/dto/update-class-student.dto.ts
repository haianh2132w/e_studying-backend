import { IsIn } from 'class-validator';

export class UpdateClassStudentDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status: 'ACTIVE' | 'INACTIVE';
}