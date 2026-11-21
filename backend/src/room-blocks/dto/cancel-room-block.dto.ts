import { Type } from 'class-transformer';
import { IsDateString, ValidateIf } from 'class-validator';

export class CancelRoomBlockDto {
  @Type(() => Object)
  @ValidateIf((dto: CancelRoomBlockDto) => dto.startTime !== undefined || dto.endTime !== undefined)
  @IsDateString({ strict: true })
  startTime?: string;

  @Type(() => Object)
  @ValidateIf((dto: CancelRoomBlockDto) => dto.startTime !== undefined || dto.endTime !== undefined)
  @IsDateString({ strict: true })
  endTime?: string;
}
