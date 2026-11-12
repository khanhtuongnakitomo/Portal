import {
  IsDateString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBookingDto {
  @IsOptional()
  @IsBoolean()
  isEvent?: boolean;

  @IsUUID()
  roomId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  purpose!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  attendeeCount!: number;

  @IsDateString({ strict: true })
  startTime!: string;

  @IsDateString({ strict: true })
  endTime!: string;
}
