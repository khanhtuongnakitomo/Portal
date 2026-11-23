import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateRoomBlockDto {
  @IsUUID()
  roomId!: string;

  @IsDateString({ strict: true })
  startTime!: string;

  @IsDateString({ strict: true })
  endTime!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  // The global implicit converter treats the string "false" as true. Require a JSON boolean.
  @Type(() => Object)
  @ValidateIf((_dto, value: unknown) => value !== undefined)
  @IsBoolean()
  displaceBookings?: boolean;
}
