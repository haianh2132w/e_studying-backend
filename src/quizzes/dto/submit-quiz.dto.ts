import { Type } from "class-transformer";
import { ArrayMaxSize,ArrayMinSize,IsArray,Min,IsInt,ValidateNested } from "class-validator";

export class AnswerItemDto{
    @IsInt() @Min(1)
    questionId:number;

    @IsInt() @Min(1)
    answerId:number;

}
export class SubmitQuizDto{
    @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
    @ValidateNested({each:true})
    @Type(()=>AnswerItemDto)
    answers:AnswerItemDto[];
}