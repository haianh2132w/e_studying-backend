import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import {
  PASSWORD_MESSAGE,
  PASSWORD_REGEX,
} from '../../common/constants/password.js';

//  Create
export class CreateUserDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username chỉ gồm chữ, số và dấu gạch dưới',
  })
  username: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  @Matches(/^[^<>]*$/, { message: 'Họ tên không được chứa ký tự < hoặc >' })
  fullName: string;

  @IsString()
  @Length(8, 64)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;

  @IsIn(['STUDENT', 'INSTRUCTOR', 'ADMIN'])
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
}

//  Update
export class UpdateUserDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  @Matches(/^[^<>]*$/, { message: 'Họ tên không được chứa ký tự < hoặc >' })
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username chỉ gồm chữ, số và dấu gạch dưới',
  })
  username?: string;

  @IsOptional()
  @IsIn(['STUDENT', 'INSTRUCTOR', 'ADMIN'])
  role?: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
}

//  Update status
export class UpdateUserStatusDto {
  @IsBoolean()
  isActive: boolean;
}

//  Query
export class UserQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(['STUDENT', 'INSTRUCTOR', 'ADMIN'])
  role?: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}
