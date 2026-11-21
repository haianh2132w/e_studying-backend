import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDateString, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';

export class SessionInputDto {
  @IsString() @Length(1, 2000)
  objective: string;
}

export class UpdateClassSyllabusDto {
  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsString() @MaxLength(500)
  schedule?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000)
  totalHours?: number;

  @IsOptional() @IsString() @MaxLength(5000)
  objectives?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  assessment?: string;

  // Gửi lên thì GHI ĐÈ toàn bộ buổi học; số thứ tự buổi do server đánh (1, 2, 3...)
  @IsOptional() @IsArray() @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SessionInputDto)
  sessions?: SessionInputDto[];
}