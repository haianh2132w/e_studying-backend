import {IsOptional, IsString, Length} from 'class-validator';

export class UpdateProfileDto{
    @IsOptional() @IsString() @Length(3, 32)
    fullName?:string;

    @IsOptional() @IsString() @Length(1000)
    bio?:string;
}