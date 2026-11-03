import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  location!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  capacity!: number;

  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean;
}
