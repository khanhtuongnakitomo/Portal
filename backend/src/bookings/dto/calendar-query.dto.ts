import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CalendarQueryDto {
  @IsDateString({ strict: true })
  from!: string;

  @IsDateString({ strict: true })
  to!: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;
}
