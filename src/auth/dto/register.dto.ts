import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() @MaxLength(255)
  email: string;

  @IsString() @Length(3, 50) @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username chỉ gồm chữ, số và dấu gạch dưới',
  })
  username: string;

  @IsString() @Length(2, 100)
  fullName: string;

  @IsString() @Length(8, 64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+$/, {
    message: 'Mật khẩu cần chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  password: string;
}