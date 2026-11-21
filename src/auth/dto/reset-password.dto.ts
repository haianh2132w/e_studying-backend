import { IsEmail,IsString,Length,Matches } from "class-validator";
import {PASSWORD_MESSAGE, PASSWORD_REGEX} from "../../common/constants/password.js";

export class ResetPasswordDto {
    @IsEmail()
    email: string;
    
    @Matches(/^[0-9]{6}$/,{message:'Mã xác thực gồm 6 chữ số'})
    code: string;

    @IsString() @Length(8, 64)
    @Matches(PASSWORD_REGEX, { message: PASSWORD_MESSAGE })
    newPassword:string;
}