import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '../../common/constants/password.js';

export class LoginDto {
  @IsString()
  @Length(3, 255)
  identifier: string;

  @IsString()
  @Length(8, 64)
  password: string;
}

export class RegisterDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username chỉ gồm chữ, số và dấu gạch dưới',
  })
  username: string;

  @IsString()
  @Length(2, 100)
  fullName: string;

  @IsString()
  @Length(8, 64)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  password: string;
}

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  @Matches(/^[0-9]{6}$/, { message: 'Mã gồm đúng 6 chữ số' })
  code: string;
}

export class ResendCodeDto {
  @IsEmail()
  email: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @Matches(/^[0-9]{6}$/, { message: 'Mã xác thực gồm 6 chữ số' })
  code: string;

  @IsString()
  @Length(8, 64)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
  newPassword: string;
}
