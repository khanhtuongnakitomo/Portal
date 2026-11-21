import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '../common/http-exceptions.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { BookingStatus, Role, RoomBlockStatus, RoomStatus } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  getZonedDayRange,
  validateStaffBookingWindow,
  validateBookingWindow,
} from './booking-policy.js';
import type { CalendarQueryDto } from './dto/calendar-query.dto.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';
import type { ListBookingsDto } from './dto/list-bookings.dto.js';
import type { ManagerDayQueryDto } from './dto/manager-day-query.dto.js';
import { lockRoomSchedule, overlappingSlot, rejectOverlaps } from './room-schedule.js';

export function generatePassCode() {
  return randomBytes(8).toString('hex').toUpperCase();
}

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
      role: true,
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
  role: Role;
  studentProfile: { studentCode: string } | null;
};

function bookingKind(isEvent: boolean) {
  return isEvent ? 'OFFICIAL' : 'STUDENT';
}

const calendarSelect = {
  id: true,
  roomId: true,
  room: { select: { id: true, name: true } },
  title: true,
  startTime: true,
  endTime: true,
  status: true,
  isEvent: true,
} as const;

export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications?: NotificationsService,
  ) {}

  async create(dto: CreateBookingDto, actor: AuthenticatedUser | string) {
    const userId = typeof actor === 'string' ? actor : actor.id;
    const actorRole = typeof actor === 'string' ? Role.USER : actor.role;
    const isStaff = actorRole === Role.MANAGER || actorRole === Role.ADMIN;
    if (dto.isEvent === true && !isStaff) {
      throw new ForbiddenException('Only managers or admins can assign official activities');
    }
    // Keep legacy staff API calls as official; personal mode must be explicit.
    const isOfficialActivity = isStaff && dto.isEvent !== false;

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    return this.prisma.$transaction(async (tx) => {
      await lockRoomSchedule(tx, dto.roomId);

      const room = await tx.room.findUniqueOrThrow({ where: { id: dto.roomId } });
      if (room.status === RoomStatus.INACTIVE) throw new NotFoundException('Room not found');
      if (room.status !== RoomStatus.AVAILABLE) {
        throw new ConflictException('Room is not currently available for booking');
      }
      if (dto.attendeeCount > room.capacity) {
        throw new BadRequestException(`Room capacity is ${room.capacity}`);
      }

      const settings = await tx.systemSetting.findUniqueOrThrow({ where: { id: 'default' } });
      if (isOfficialActivity) {
        validateStaffBookingWindow(startTime, endTime, settings);
      } else {
        validateBookingWindow(startTime, endTime, settings);
      }

      if (!isOfficialActivity) {
        const activeCount = await tx.booking.count({
          where: {
            userId,
            isEvent: false,
            status: { in: [...activeBookingStatuses] },
            endTime: { gt: new Date() },
          },
        });
        if (activeCount >= settings.maxActiveBookingsPerUser) {
          throw new ConflictException(
            `You can only have ${settings.maxActiveBookingsPerUser} active bookings`,
          );
        }
      }

      const isBlocked =
        room.blockStatus === RoomBlockStatus.ACTIVE &&
        room.blockStartTime !== null &&
        room.blockEndTime !== null &&
        room.blockStartTime < endTime &&
        room.blockEndTime > startTime;
      if (isBlocked) throw new ConflictException('This room is blocked for that time range');

      const slot = overlappingSlot(room.id, startTime, endTime);
      const firmConflict = await tx.booking.findFirst({
        where: { ...slot, status: { in: [BookingStatus.APPROVED, BookingStatus.KEY_CHECKED_OUT] } },
        select: { id: true },
      });
      if (firmConflict && (isOfficialActivity || !room.autoApprove)) {
        throw new ConflictException('This room is already reserved for that time range');
      }

      let autoApproved = false;
      if (isOfficialActivity) {
        const displaced = await rejectOverlaps(
          tx,
          slot,
          BookingStatus.PENDING,
          userId,
          'Slot assigned to an official room activity',
          { reason: 'OFFICIAL_ACTIVITY' },
        );
        await this.notifications?.enqueueBookingDecision(
          tx,
          displaced.map(({ id }) => id),
        );
      } else {
        const pending = { ...slot, status: BookingStatus.PENDING };
        const ownPending = await tx.booking.findFirst({
          where: { ...pending, userId },
          select: { id: true },
        });
        if (ownPending) {
          throw new ConflictException('You already have a pending request for this time slot');
        }
        if (room.autoApprove && !firmConflict) {
          autoApproved = !(await tx.booking.findFirst({ where: pending, select: { id: true } }));
        }
      }

      const initialStatus =
        isOfficialActivity || autoApproved ? BookingStatus.APPROVED : BookingStatus.PENDING;
      const reviewNote = isOfficialActivity
        ? 'Scheduled room activity / event assigned by Manager'
        : autoApproved
          ? 'Automatically approved by room policy'
          : undefined;
      const reviewedById = isOfficialActivity ? userId : undefined;
      const reviewedAt = initialStatus === BookingStatus.APPROVED ? new Date() : undefined;

      const created = await tx.booking.create({
        data: {
          roomId: dto.roomId,
          userId,
          title: dto.title.trim(),
          purpose: dto.purpose.trim(),
          attendeeCount: dto.attendeeCount,
          isEvent: isOfficialActivity,
          passCode: generatePassCode(),
          startTime,
          endTime,
          status: initialStatus,
          reviewNote,
          reviewedById,
          reviewedAt,
          history: {
            create: {
              toStatus: initialStatus,
              changedById: userId,
              note: reviewNote,
            },
          },
        },
        select: { id: true },
      });
      if (autoApproved) {
        await tx.auditLog.create({
          data: {
            action: 'BOOKING_APPROVED',
            targetType: 'Booking',
            targetId: created.id,
            metadata: { reason: 'ROOM_AUTO_APPROVE', requestedById: userId },
          },
        });
      }
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: created.id },
        include: bookingInclude,
      });
      if (autoApproved) {
        await this.notifications?.enqueueBookingDecision(tx, [booking.id]);
      } else {
        await this.notifications?.enqueueBookingCreated(tx, booking, settings.timezone);
      }
      return this.toApiBooking(booking);
    });
  }

  async calendar(query: CalendarQueryDto, viewer: AuthenticatedUser | null) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to <= from) throw new BadRequestException('to must be later than from');
    if (to.getTime() - from.getTime() > 90 * 86_400_000) {
      throw new BadRequestException('Calendar range cannot exceed 90 days');
    }
    const where = {
      status: { in: [...activeBookingStatuses, BookingStatus.COMPLETED] },
      roomId: query.roomId,
      startTime: { lt: to },
      endTime: { gt: from },
    };
    const staff = viewer?.role === Role.ADMIN || viewer?.role === Role.MANAGER;
    const [publicRows, privateRows, blockedRooms] = await Promise.all([
      staff
        ? []
        : this.prisma.booking.findMany({
            where: { ...where, userId: viewer ? { not: viewer.id } : undefined },
            select: calendarSelect,
            orderBy: { startTime: 'asc' },
          }),
      viewer
        ? this.prisma.booking.findMany({
            where: { ...where, userId: staff ? undefined : viewer.id },
            select: {
              ...calendarSelect,
              userId: true,
              purpose: true,
              attendeeCount: true,
              reviewNote: true,
              createdAt: true,
              keyCheckedOutAt: true,
              keyReturnedAt: true,
              user: bookingInclude.user,
            },
            orderBy: { startTime: 'asc' },
          })
        : [],
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
    const bookings = [
      ...publicRows.map(({ isEvent, ...row }) => ({
        ...row,
        kind: bookingKind(isEvent),
        isMine: false,
      })),
      ...privateRows.map(({ isEvent, user: { studentProfile, ...user }, ...row }) => ({
        ...row,
        kind: bookingKind(isEvent),
        isMine: row.userId === viewer?.id,
        user: { ...user, studentCode: studentProfile?.studentCode ?? null },
      })),
    ];
    if (publicRows.length && privateRows.length) {
      bookings.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
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
      holder: {
        id: booking.user.id,
        fullName: booking.user.fullName,
        email: booking.user.email,
        studentCode: booking.user.studentCode,
      },
      room: booking.room,
      title: booking.title,
      attendeeCount: booking.attendeeCount,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
    };
  }

  async approve(id: string, actorId: string, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        select: { roomId: true, startTime: true, endTime: true, status: true },
      });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status !== BookingStatus.PENDING) {
        throw new ConflictException('Booking is no longer pending');
      }
      await lockRoomSchedule(tx, booking.roomId);
      const slot = overlappingSlot(booking.roomId, booking.startTime, booking.endTime);

      const firmConflict = await tx.booking.findFirst({
        where: {
          ...slot,
          status: { in: [BookingStatus.APPROVED, BookingStatus.KEY_CHECKED_OUT] },
        },
        select: { id: true },
      });
      if (firmConflict) {
        throw new ConflictException('This room is already reserved for that time range');
      }

      const now = new Date();
      const changed = await tx.booking.updateMany({
        where: { id, status: BookingStatus.PENDING },
        data: {
          status: BookingStatus.APPROVED,
          reviewedById: actorId,
          reviewedAt: now,
          reviewNote: note?.trim(),
        },
      });
      if (changed.count !== 1) throw new ConflictException('Booking is no longer pending');

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: BookingStatus.PENDING,
          toStatus: BookingStatus.APPROVED,
          changedById: actorId,
          note: note?.trim(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'BOOKING_APPROVED',
          targetType: 'Booking',
          targetId: id,
          metadata: note ? { note: note.trim() } : undefined,
        },
      });

      const displaced = await rejectOverlaps(
        tx,
        slot,
        BookingStatus.PENDING,
        actorId,
        'Slot awarded to another approved reservation',
        { reason: 'AUTO_DECLINE_COMPETING_PENDING', approvedBookingId: id },
      );

      await this.notifications?.enqueueBookingDecision(tx, [id, ...displaced.map(({ id }) => id)]);
      const updated = await tx.booking.findUniqueOrThrow({
        where: { id },
        include: bookingInclude,
      });
      return this.toApiBooking(updated);
    });
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

  async checkoutKey(id: string, actorId: string, passCode: string, note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.booking.findUnique({
        where: { id },
        select: { roomId: true, passCode: true },
      });
      if (!target) throw new NotFoundException('Booking not found');
      await lockRoomSchedule(tx, target.roomId);
      if (passCode.toUpperCase() !== target.passCode.toUpperCase()) {
        throw new BadRequestException('Pass code does not match');
      }
      const now = new Date();
      const changed = await tx.booking.updateMany({
        where: { id, status: BookingStatus.APPROVED, endTime: { gt: now } },
        data: {
          status: BookingStatus.KEY_CHECKED_OUT,
          keyCheckedOutAt: now,
          keyCheckedOutById: actorId,
        },
      });
      if (changed.count !== 1) {
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
      if (isReview) await this.notifications?.enqueueBookingDecision(tx, [id]);
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

  private toApiBooking<
    T extends {
      user: BookingUserRecord;
      status: BookingStatus;
      passCode: string;
      isEvent: boolean;
    },
  >(booking: T) {
    const { user: rawUser, passCode, ...rest } = booking;
    const { studentProfile, ...user } = rawUser;
    return {
      ...rest,
      kind: bookingKind(booking.isEvent),
      passCode:
        booking.status === BookingStatus.APPROVED ||
        booking.status === BookingStatus.KEY_CHECKED_OUT
          ? passCode
          : null,
      user: { ...user, studentCode: studentProfile?.studentCode ?? null },
    };
  }
}
