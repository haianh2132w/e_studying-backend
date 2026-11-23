import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

// ─── Create ───────────────────────────────────────────────────────────────────
export class CreateSettingDto {
  // Chỉ cho tạo danh mục. Role cố định theo code nên không tạo thêm
  @IsIn(['CATEGORY'])
  type: 'CATEGORY';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @Length(2, 100)
  @Matches(/^[^<>]*$/, { message: 'Tên không được chứa ký tự < hoặc >' })
  name: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;
}

// ─── Update ───────────────────────────────────────────────────────────────────
export class UpdateSettingDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @Length(2, 100)
  @Matches(/^[^<>]*$/, { message: 'Tên không được chứa ký tự < hoặc >' })
  name?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  description?: string;
}

//  Query 
export class SettingQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @IsIn(['ROLE', 'CATEGORY'])
  type?: 'ROLE' | 'CATEGORY';

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;
}
