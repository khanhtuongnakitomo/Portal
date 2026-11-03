import { IsEnum } from 'class-validator';
import { RoomStatus } from '../../generated/prisma/client.js';

export class UpdateRoomStatusDto {
  @IsEnum(RoomStatus)
  status!: RoomStatus;
}
