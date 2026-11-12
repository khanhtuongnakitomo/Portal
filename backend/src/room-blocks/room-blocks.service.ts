import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '../common/http-exceptions.js';
import { BookingStatus, RoomBlockStatus, RoomStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateRoomBlockDto } from './dto/create-room-block.dto.js';
import type { ListRoomBlocksDto } from './dto/list-room-blocks.dto.js';

const blockRoomInclude = {
  blockCreatedBy: { select: { id: true, fullName: true } },
  blockCancelledBy: { select: { id: true, fullName: true } },
} as const;

export class RoomBlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications?: NotificationsService,
  ) {}

  async create(dto: CreateRoomBlockDto, actorId: string) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const now = new Date();
    if (endTime <= startTime) throw new BadRequestException('endTime must be later than startTime');
    if (endTime <= now) throw new BadRequestException('Room block must end in the future');
    if (endTime.getTime() - startTime.getTime() > 365 * 86_400_000) {
      throw new BadRequestException('Room block cannot exceed 365 days');
    }

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.room.updateMany({
        where: { id: dto.roomId },
        data: { scheduleVersion: { increment: 1 } },
      });
      if (locked.count !== 1) throw new NotFoundException('Room not found');
      const room = await tx.room.findUniqueOrThrow({ where: { id: dto.roomId } });
      if (room.status === RoomStatus.INACTIVE) throw new NotFoundException('Room not found');
      if (
        room.blockStatus === RoomBlockStatus.ACTIVE &&
        room.blockEndTime &&
        room.blockEndTime > now &&
        room.blockStartTime?.getTime() === startTime.getTime() &&
        room.blockEndTime.getTime() === endTime.getTime() &&
        room.blockReason === dto.reason.trim()
      ) {
        throw new ConflictException('Room already has an identical active block');
      }

      const keyCheckedOutConflict = await tx.booking.findFirst({
        where: {
          roomId: dto.roomId,
          status: BookingStatus.KEY_CHECKED_OUT,
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { id: true },
      });
      if (keyCheckedOutConflict) {
        throw new ConflictException(
          'Cannot block room: a key is currently checked out for this time slot',
        );
      }

      const overlappingBookings = await tx.booking.findMany({
        where: {
          roomId: dto.roomId,
          status: { in: [BookingStatus.PENDING, BookingStatus.APPROVED] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { id: true, status: true },
      });

      if (overlappingBookings.length > 0) {
        const displacementNote = `Displaced by university event: ${dto.reason.trim()}`;
        const bookingIds = overlappingBookings.map((b) => b.id);
        await tx.booking.updateMany({
          where: { id: { in: bookingIds } },
          data: {
            status: BookingStatus.REJECTED,
            reviewedById: actorId,
            reviewedAt: new Date(),
            reviewNote: displacementNote,
          },
        });
        await tx.bookingStatusHistory.createMany({
          data: overlappingBookings.map((b) => ({
            bookingId: b.id,
            fromStatus: b.status,
            toStatus: BookingStatus.REJECTED,
            changedById: actorId,
            note: displacementNote,
          })),
        });
        await this.notifications?.enqueueBookingDecision(tx, bookingIds);
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

  async cancel(roomId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.room.updateMany({
        where: { id: roomId, blockStatus: RoomBlockStatus.ACTIVE },
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
