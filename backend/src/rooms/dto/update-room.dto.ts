import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  capacity?: number;

  @Type(() => Object)
  @ValidateIf((_dto, value: unknown) => value !== undefined)
  @IsBoolean()
  autoApprove?: boolean;
}
