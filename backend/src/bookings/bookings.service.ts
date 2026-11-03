import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { BookingStatus, Role, RoomBlockStatus, RoomStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { getZonedDayRange, validateBookingWindow } from './booking-policy.js';
import type { CalendarQueryDto } from './dto/calendar-query.dto.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';
import type { ListBookingsDto } from './dto/list-bookings.dto.js';
import type { ManagerDayQueryDto } from './dto/manager-day-query.dto.js';

const activeBookingStatuses = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.KEY_CHECKED_OUT,
] as const;

const bookingInclude = {
  room: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      studentProfile: { select: { studentCode: true } },
    },
  },
  reviewedBy: { select: { id: true, fullName: true } },
  keyCheckedOutBy: { select: { id: true, fullName: true } },
  keyReturnedBy: { select: { id: true, fullName: true } },
} as const;

type BookingUserRecord = {
  id: string;
  fullName: string;
  email: string;
  studentProfile: { studentCode: string } | null;
};

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBookingDto, userId: string) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.room.updateMany({
        where: { id: dto.roomId },
        data: { scheduleVersion: { increment: 1 } },
      });
      if (locked.count !== 1) throw new NotFoundException('Room not found');

      const room = await tx.room.findUniqueOrThrow({ where: { id: dto.roomId } });
      if (room.status === RoomStatus.INACTIVE) throw new NotFoundException('Room not found');
      if (room.status !== RoomStatus.AVAILABLE) {
        throw new ConflictException('Room is not currently available for booking');
      }
      if (dto.attendeeCount > room.capacity) {
        throw new BadRequestException(`Room capacity is ${room.capacity}`);
      }

      const settings = await tx.systemSetting.findUniqueOrThrow({ where: { id: 'default' } });
      validateBookingWindow(startTime, endTime, settings);

      const activeCount = await tx.booking.count({
        where: {
          userId,
          status: { in: [...activeBookingStatuses] },
          endTime: { gt: new Date() },
        },
      });
      if (activeCount >= settings.maxActiveBookingsPerUser) {
        throw new ConflictException(
          `You can only have ${settings.maxActiveBookingsPerUser} active bookings`,
        );
      }

      const bookingConflict = await tx.booking.findFirst({
        where: {
          roomId: dto.roomId,
          status: { in: [...activeBookingStatuses] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { id: true },
      });
      if (bookingConflict) {
        throw new ConflictException('This room is already reserved for that time range');
      }

      const isBlocked =
        room.blockStatus === RoomBlockStatus.ACTIVE &&
        room.blockStartTime !== null &&
        room.blockEndTime !== null &&
        room.blockStartTime < endTime &&
        room.blockEndTime > startTime;
      if (isBlocked) throw new ConflictException('This room is blocked for that time range');

      const initialStatus = room.autoApprove ? BookingStatus.APPROVED : BookingStatus.PENDING;
      const created = await tx.booking.create({
        data: {
          roomId: dto.roomId,
          userId,
          title: dto.title.trim(),
          purpose: dto.purpose.trim(),
          attendeeCount: dto.attendeeCount,
          passCode: randomBytes(8).toString('hex').toUpperCase(),
          startTime,
          endTime,
          status: initialStatus,
          reviewNote: room.autoApprove ? 'Automatically approved by room policy' : undefined,
          history: {
            create: {
              toStatus: initialStatus,
              changedById: userId,
              note: room.autoApprove ? 'Automatically approved by room policy' : undefined,
            },
          },
        },
        select: { id: true },
      });
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: created.id },
        include: bookingInclude,
      });
      return this.toApiBooking(booking);
    });
  }

  async calendar(query: CalendarQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to <= from) throw new BadRequestException('to must be later than from');
    if (to.getTime() - from.getTime() > 31 * 86_400_000) {
      throw new BadRequestException('Calendar range cannot exceed 31 days');
    }
    const [bookings, blockedRooms] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          status: {
            in: [BookingStatus.APPROVED, BookingStatus.KEY_CHECKED_OUT, BookingStatus.COMPLETED],
          },
          roomId: query.roomId,
          startTime: { lt: to },
          endTime: { gt: from },
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          status: true,
          room: { select: { id: true, name: true } },
        },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.room.findMany({
        where: {
          id: query.roomId,
          blockStatus: RoomBlockStatus.ACTIVE,
          blockStartTime: { lt: to },
          blockEndTime: { gt: from },
        },
        select: {
          id: true,
          name: true,
          blockReason: true,
          blockStartTime: true,
          blockEndTime: true,
        },
        orderBy: { blockStartTime: 'asc' },
      }),
    ]);
    const blocks = blockedRooms.map((room) => ({
      id: room.id,
      roomId: room.id,
      reason: room.blockReason,
      startTime: room.blockStartTime,
      endTime: room.blockEndTime,
      room: { id: room.id, name: room.name },
    }));
    return { bookings, blocks };
  }

  async mine(userId: string, query: ListBookingsDto) {
    return this.paginatedList({ userId, status: query.status, roomId: query.roomId }, query);
  }

  async managerList(query: ListBookingsDto) {
    return this.paginatedList(
      { status: query.status ?? BookingStatus.PENDING, roomId: query.roomId },
      query,
    );
  }

  async managerDay(query: ManagerDayQueryDto) {
    const settings = await this.prisma.systemSetting.findUniqueOrThrow({
      where: { id: 'default' },
    });
    const range = getZonedDayRange(query.date, settings.timezone);
    const items = await this.prisma.booking.findMany({
      where: {
        status: {
          in: [BookingStatus.APPROVED, BookingStatus.KEY_CHECKED_OUT, BookingStatus.COMPLETED],
        },
        startTime: { gte: range.from, lt: range.to },
      },
      include: bookingInclude,
      orderBy: { startTime: 'asc' },
    });
    return {
      date: range.date,
      timezone: settings.timezone,
      items: items.map((booking) => this.toApiBooking(booking)),
    };
  }

  async overdueKeys() {
    const checkedAt = new Date();
    const items = await this.prisma.booking.findMany({
      where: { status: BookingStatus.KEY_CHECKED_OUT, endTime: { lt: checkedAt } },
      include: bookingInclude,
      orderBy: { endTime: 'asc' },
    });
    return {
      checkedAt,
      count: items.length,
      items: items.map((booking) => this.toApiBooking(booking)),
    };
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        ...bookingInclude,
        history: {
          include: { changedBy: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (actor.role === Role.USER && booking.userId !== actor.id) {
      throw new ForbiddenException('You cannot access this booking');
    }
    return this.toApiBooking(booking);
  }

  async digitalPass(id: string, actor: AuthenticatedUser) {
    const booking = await this.findOne(id, actor);
    if (
      booking.status !== BookingStatus.APPROVED &&
      booking.status !== BookingStatus.KEY_CHECKED_OUT
    ) {
      throw new ConflictException('Digital pass is only available for active approved bookings');
    }
    return {
      bookingId: booking.id,
      passCode: booking.passCode,
      holder: booking.user,
      room: booking.room,
      title: booking.title,
      attendeeCount: booking.attendeeCount,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
    };
  }

  approve(id: string, actorId: string, note?: string) {
    return this.transition(id, BookingStatus.PENDING, BookingStatus.APPROVED, actorId, note);
  }

  reject(id: string, actorId: string, note: string) {
    return this.transition(id, BookingStatus.PENDING, BookingStatus.REJECTED, actorId, note);
  }

  async cancel(id: string, actor: AuthenticatedUser, note?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (actor.role === Role.USER && booking.userId !== actor.id) {
      throw new ForbiddenException('You cannot cancel this booking');
    }
    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.APPROVED) {
      throw new ConflictException('Only pending or approved bookings can be cancelled');
    }
    if (booking.endTime <= new Date()) {
      throw new ConflictException('Past bookings cannot be cancelled');
    }
    return this.transition(id, booking.status, BookingStatus.CANCELLED, actor.id, note);
  }

  async checkoutKey(id: string, actorId: string, note?: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.booking.updateMany({
        where: { id, status: BookingStatus.APPROVED, endTime: { gt: now } },
        data: {
          status: BookingStatus.KEY_CHECKED_OUT,
          keyCheckedOutAt: now,
          keyCheckedOutById: actorId,
        },
      });
      if (changed.count !== 1) {
        const booking = await tx.booking.findUnique({ where: { id }, select: { status: true } });
        if (!booking) throw new NotFoundException('Booking not found');
        throw new ConflictException('Only an active approved booking can receive a key');
      }
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: BookingStatus.APPROVED,
          toStatus: BookingStatus.KEY_CHECKED_OUT,
          changedById: actorId,
          note: note?.trim() ?? 'Room key checked out',
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'BOOKING_KEY_CHECKED_OUT',
          targetType: 'Booking',
          targetId: id,
          metadata: note ? { note: note.trim() } : undefined,
        },
      });
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: bookingInclude,
      });
      return this.toApiBooking(booking);
    });
  }

  async returnKey(id: string, actorId: string, note?: string) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.booking.updateMany({
        where: { id, status: BookingStatus.KEY_CHECKED_OUT },
        data: {
          status: BookingStatus.COMPLETED,
          keyReturnedAt: now,
          keyReturnedById: actorId,
        },
      });
      if (changed.count !== 1) {
        const exists = await tx.booking.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new NotFoundException('Booking not found');
        throw new ConflictException('Only a checked-out key can be returned');
      }
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: BookingStatus.KEY_CHECKED_OUT,
          toStatus: BookingStatus.COMPLETED,
          changedById: actorId,
          note: note?.trim() ?? 'Room key returned',
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'BOOKING_KEY_RETURNED',
          targetType: 'Booking',
          targetId: id,
          metadata: note ? { note: note.trim() } : undefined,
        },
      });
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: bookingInclude,
      });
      return this.toApiBooking(booking);
    });
  }

  private async transition(
    id: string,
    from: BookingStatus,
    to: BookingStatus,
    actorId: string,
    note?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const isReview = to === BookingStatus.APPROVED || to === BookingStatus.REJECTED;
      const changed = await tx.booking.updateMany({
        where: { id, status: from },
        data: {
          status: to,
          reviewedById: isReview ? actorId : undefined,
          reviewedAt: isReview ? new Date() : undefined,
          reviewNote: note?.trim(),
        },
      });
      if (changed.count !== 1) {
        const exists = await tx.booking.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new NotFoundException('Booking not found');
        throw new ConflictException(`Booking is no longer ${from.toLowerCase()}`);
      }
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: from,
          toStatus: to,
          changedById: actorId,
          note: note?.trim(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: `BOOKING_${to}`,
          targetType: 'Booking',
          targetId: id,
          metadata: note ? { note: note.trim() } : undefined,
        },
      });
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: bookingInclude,
      });
      return this.toApiBooking(booking);
    });
  }

  private async paginatedList(where: object, query: ListBookingsDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: bookingInclude,
        orderBy: { startTime: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items: items.map((booking) => this.toApiBooking(booking)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  private toApiBooking<T extends { user: BookingUserRecord }>(
    booking: T,
  ): Omit<T, 'user'> & {
    user: {
      id: string;
      fullName: string;
      email: string;
      studentCode: string | null;
    };
  } {
    const { user: rawUser, ...rest } = booking;
    const { studentProfile, ...user } = rawUser;
    return {
      ...rest,
      user: { ...user, studentCode: studentProfile?.studentCode ?? null },
    };
  }
}
