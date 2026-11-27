import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class AddClassStudentDto {
  @IsString()
  @Length(3, 255)
  emailOrUsername: string;
}

export class ClassStudentQueryDto extends PaginationDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class UpdateClassStudentDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status: 'ACTIVE' | 'INACTIVE';
}

export class SetClassCoursesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  courseIds: number[];
}

export class SessionInputDto {
  @IsString()
  @Length(1, 2000)
  objective: string;
}

export class UpdateClassSyllabusDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  schedule?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  totalHours?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  objectives?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  assessment?: string;

  // Gửi lên thì GHI ĐÈ toàn bộ buổi học; số thứ tự buổi do server đánh (1, 2, 3...)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SessionInputDto)
  sessions?: SessionInputDto[];
}

export class OrderItemDto {
  @IsInt()
  @Min(1)
  id: number;

  @IsInt()
  @Min(0)
  position: number;
}

export class ReorderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
