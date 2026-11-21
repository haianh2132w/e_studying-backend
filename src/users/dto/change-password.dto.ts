import {IsString, Length, Matches} from 'class-validator';
import {PASSWORD_MESSAGE, PASSWORD_REGEX} from '../../common/constants/password.js';

export class ChangePasswordDto {
    @IsString() @Length(8, 64)
    currentPassword: string;

    @IsString() @Length(8, 64)
    @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
    newPassword: string;
}