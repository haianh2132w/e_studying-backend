import { Type } from "class-transformer";
import { IsIn,IsInt,Min } from "class-validator";

export class CreatePaymentDto{
    @Type(()=>Number) 
    @IsInt()
    @Min(1)
    enrollmentId:number;

    @IsIn(['VNPAY'])
    method:'VNPAY';
}