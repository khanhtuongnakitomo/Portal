import { IsDateString, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

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
}
