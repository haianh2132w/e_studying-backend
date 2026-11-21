import { IsEmail, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail() email: string;
  @Matches(/^[0-9]{6}$/, { message: 'Mã gồm đúng 6 chữ số' }) code: string;
}