import { lockRoomSchedule, overlappingSlot, rejectOverlaps } from '../bookings/room-schedule.js';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '../common/http-exceptions.js';
import { BookingStatus, RoomBlockStatus, RoomStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateRoomBlockDto } from './dto/create-room-block.dto.js';
import type { ListRoomBlocksDto } from './dto/list-room-blocks.dto.js';

const blockRoomInclude = {
  blockCreatedBy: { select: { id: true, fullName: true } },
  blockCancelledBy: { select: { id: true, fullName: true } },
} as const;

export class RoomBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoomBlockDto, actorId: string) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (endTime <= startTime) throw new BadRequestException('endTime must be later than startTime');
    if (endTime.getTime() - startTime.getTime() > 365 * 86_400_000) {
      throw new BadRequestException('Room block cannot exceed 365 days');
    }

    return this.prisma.$transaction(async (tx) => {
      await lockRoomSchedule(tx, dto.roomId);
      const now = new Date();
      if (endTime <= now) throw new BadRequestException('Room block must end in the future');
      const room = await tx.room.findUniqueOrThrow({ where: { id: dto.roomId } });
      if (room.status === RoomStatus.INACTIVE) throw new NotFoundException('Room not found');
      if (
        room.blockStatus === RoomBlockStatus.ACTIVE &&
        room.blockEndTime &&
        room.blockEndTime > now
      ) {
        throw new ConflictException('Room already has an active block; cancel it first');
      }

      const slot = overlappingSlot(dto.roomId, startTime, endTime);
      const overlapping = await tx.booking.findMany({
        where: {
          ...slot,
          status: {
            in: [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.KEY_CHECKED_OUT],
          },
        },
        select: { id: true, status: true },
      });
      if (overlapping.some((booking) => booking.status === BookingStatus.KEY_CHECKED_OUT)) {
        throw new ConflictException(
          'Cannot block room: a key is currently checked out for this time slot',
        );
      }

      if (overlapping.length && dto.displaceBookings !== true) {
        throw new ConflictException(
          `Bookings overlap this block: ${overlapping.map((b) => b.id).join(', ')}`,
        );
      }
      for (const status of [BookingStatus.PENDING, BookingStatus.APPROVED] as const) {
        if (overlapping.some((booking) => booking.status === status)) {
          await rejectOverlaps(
            tx,
            slot,
            status,
            actorId,
            `Displaced by university event: ${dto.reason.trim()}`,
            { reason: 'ROOM_BLOCK', roomId: dto.roomId },
          );
        }
      }

      const blockedRoom = await tx.room.update({
        where: { id: dto.roomId },
        data: {
          blockStartTime: startTime,
          blockEndTime: endTime,
          blockReason: dto.reason.trim(),
          blockStatus: RoomBlockStatus.ACTIVE,
          blockCreatedById: actorId,
          blockCancelledById: null,
          blockCancelledAt: null,
        },
        include: blockRoomInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ROOM_BLOCK_SET',
          targetType: 'Room',
          targetId: dto.roomId,
          metadata: { startTime: dto.startTime, endTime: dto.endTime },
        },
      });
      return this.toBlock(blockedRoom);
    });
  }

  async list(query: ListRoomBlocksDto) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && to <= from) throw new BadRequestException('to must be later than from');
    const where = {
      id: query.roomId,
      blockStatus: RoomBlockStatus.ACTIVE,
      ...(from || to
        ? {
            blockStartTime: to ? { lt: to } : undefined,
            blockEndTime: from ? { gt: from } : undefined,
          }
        : {}),
    };
    const [rooms, total] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where,
        include: blockRoomInclude,
        orderBy: { blockStartTime: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.room.count({ where }),
    ]);
    return {
      items: rooms.map((room) => this.toBlock(room)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async cancel(roomId: string, actorId: string, expected?: { startTime: Date; endTime: Date }) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.room.updateMany({
        where: {
          id: roomId,
          blockStatus: RoomBlockStatus.ACTIVE,
          blockStartTime: expected?.startTime,
          blockEndTime: expected?.endTime,
        },
        data: {
          blockStatus: RoomBlockStatus.CANCELLED,
          blockCancelledAt: new Date(),
          blockCancelledById: actorId,
          scheduleVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        const exists = await tx.room.findUnique({ where: { id: roomId }, select: { id: true } });
        if (!exists) throw new NotFoundException('Room not found');
        if (expected) throw new ConflictException('Room block has changed; refresh and try again');
        throw new ConflictException('Room has no active block');
      }
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'ROOM_BLOCK_CANCELLED',
          targetType: 'Room',
          targetId: roomId,
        },
      });
      const room = await tx.room.findUniqueOrThrow({
        where: { id: roomId },
        include: blockRoomInclude,
      });
      return this.toBlock(room);
    });
  }

  private toBlock<
    T extends {
      id: string;
      name: string;
      blockStartTime: Date | null;
      blockEndTime: Date | null;
      blockReason: string | null;
      blockStatus: RoomBlockStatus | null;
      blockCreatedBy: { id: string; fullName: string } | null;
      blockCancelledBy: { id: string; fullName: string } | null;
      blockCancelledAt: Date | null;
    },
  >(room: T) {
    return {
      id: room.id,
      roomId: room.id,
      reason: room.blockReason,
      startTime: room.blockStartTime,
      endTime: room.blockEndTime,
      status: room.blockStatus,
      createdBy: room.blockCreatedBy,
      cancelledBy: room.blockCancelledBy,
      cancelledAt: room.blockCancelledAt,
      room: { id: room.id, name: room.name },
    };
  }
}
