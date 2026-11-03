import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateRoomDto } from './dto/create-room.dto.js';
import type { UpdateRoomDto } from './dto/update-room.dto.js';
import type { UpdateRoomStatusDto } from './dto/update-room-status.dto.js';

const publicRoomSelect = {
  id: true,
  name: true,
  description: true,
  location: true,
  capacity: true,
  autoApprove: true,
  status: true,
  blockStartTime: true,
  blockEndTime: true,
  blockReason: true,
  blockStatus: true,
} as const;

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  listPublic() {
    return this.prisma.room.findMany({
      where: { status: { not: RoomStatus.INACTIVE } },
      select: publicRoomSelect,
      orderBy: { name: 'asc' },
    });
  }

  listAdmin() {
    return this.prisma.room.findMany({ orderBy: { name: 'asc' } });
  }

  async findPublic(id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, status: { not: RoomStatus.INACTIVE } },
      select: publicRoomSelect,
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async create(dto: CreateRoomDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim(),
          location: dto.location.trim(),
          capacity: dto.capacity,
          autoApprove: dto.autoApprove ?? false,
        },
      });
      await tx.auditLog.create({
        data: { actorId, action: 'ROOM_CREATED', targetType: 'Room', targetId: room.id },
      });
      return room;
    });
  }

  async update(id: string, dto: UpdateRoomDto, actorId: string) {
    await this.ensureExists(id);
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.update({
        where: { id },
        data: {
          ...dto,
          name: dto.name?.trim(),
          description: dto.description?.trim(),
          location: dto.location?.trim(),
        },
      });
      await tx.auditLog.create({
        data: { actorId, action: 'ROOM_UPDATED', targetType: 'Room', targetId: id },
      });
      return room;
    });
  }

  async updateStatus(id: string, dto: UpdateRoomStatusDto, actorId: string) {
    await this.ensureExists(id);
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.update({ where: { id }, data: { status: dto.status } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ROOM_STATUS_CHANGED',
          targetType: 'Room',
          targetId: id,
          metadata: { status: dto.status },
        },
      });
      return room;
    });
  }

  private async ensureExists(id: string) {
    if (!(await this.prisma.room.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Room not found');
    }
  }
}
