import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BookingStatus } from '../../generated/prisma/client.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class ListBookingsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsUUID()
  roomId?: string;
}
