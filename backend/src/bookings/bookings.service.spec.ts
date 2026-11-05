import { jest } from '@jest/globals';
import { ConflictException } from '../common/http-exceptions.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { BookingStatus, Role, RoomStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { BookingsService } from './bookings.service.js';

type AsyncMock<T> = jest.Mock<Promise<T>, [unknown]>;

function asyncMock<T>(value: T): AsyncMock<T> {
  return jest.fn<Promise<T>, [unknown]>(() => Promise.resolve(value));
}

type PendingLookup = {
  id: string;
  roomId?: string;
  status: BookingStatus;
  startTime?: Date;
  endTime?: Date;
};

describe('BookingsService - Competing Pending & Auto-Decline', () => {
  const mockSettings = {
    id: 'default',
    timezone: 'Asia/Ho_Chi_Minh',
    openTime: '07:00',
    closeTime: '21:00',
    maxDurationMinutes: 240,
    maxAdvanceDays: 90,
    maxActiveBookingsPerUser: 5,
  };

  const mockRoom = {
    id: 'room-1',
    name: 'Seminar Hall 601',
    capacity: 40,
    status: RoomStatus.AVAILABLE,
    autoApprove: false,
    blockStatus: null,
    blockStartTime: null,
    blockEndTime: null,
  };

  const student1: AuthenticatedUser = {
    id: 'student-1',
    email: 'student1@tne.edu.vn',
    role: Role.USER,
  };

  const student2: AuthenticatedUser = {
    id: 'student-2',
    email: 'student2@tne.edu.vn',
    role: Role.USER,
  };

  const manager: AuthenticatedUser = {
    id: 'manager-1',
    email: 'manager@tne.edu.vn',
    role: Role.MANAGER,
  };

  // Compute a future Tuesday within 1-14 days so it is strictly in the future on a workday
  const now = new Date();
  const daysUntilNextMonday = (1 - now.getDay() + 7) % 7 || 7;
  const nextTuesday = new Date(now.getTime() + (daysUntilNextMonday + 1) * 86400000);
  nextTuesday.setUTCHours(2, 0, 0, 0); // 09:00 VN
  const startTime = new Date(nextTuesday);
  const endTime = new Date(nextTuesday.getTime() + 2 * 3600000); // 11:00 VN

  const baseBookingDto = {
    roomId: 'room-1',
    title: 'Study Session',
    purpose: 'Exam preparation',
    attendeeCount: 10,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };

  type BookingRecord = {
    id: string;
    roomId: string;
    userId: string;
    title: string;
    purpose: string;
    attendeeCount: number;
    passCode: string;
    startTime: Date;
    endTime: Date;
    status: BookingStatus;
    reviewNote: string | null;
    reviewedById: string | null;
    reviewedAt: Date | null;
    keyCheckedOutAt: null;
    keyCheckedOutById: null;
    keyReturnedAt: null;
    keyReturnedById: null;
    createdAt: Date;
    updatedAt: Date;
    room: typeof mockRoom;
    user: {
      id: string;
      fullName: string;
      email: string;
      studentProfile: null;
    };
    reviewedBy: { id: string; fullName: string } | null;
    keyCheckedOutBy: null;
    keyReturnedBy: null;
  };

  function bookingRecord(status: BookingStatus, reviewNote: string | null): BookingRecord {
    return {
      id: 'new-booking',
      roomId: 'room-1',
      userId: 'student-1',
      title: 'Study Session',
      purpose: 'Exam preparation',
      attendeeCount: 10,
      passCode: 'PASS1234',
      startTime,
      endTime,
      status,
      reviewNote,
      reviewedById: status === BookingStatus.APPROVED ? manager.id : null,
      reviewedAt: status === BookingStatus.APPROVED ? new Date() : null,
      keyCheckedOutAt: null,
      keyCheckedOutById: null,
      keyReturnedAt: null,
      keyReturnedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      room: mockRoom,
      user: {
        id: 'student-1',
        fullName: 'Student One',
        email: 's1@tne.edu.vn',
        studentProfile: null,
      },
      reviewedBy:
        status === BookingStatus.APPROVED ? { id: manager.id, fullName: 'Manager' } : null,
      keyCheckedOutBy: null,
      keyReturnedBy: null,
    };
  }

  let service: BookingsService;
  let mockTx: {
    room: {
      updateMany: AsyncMock<{ count: number }>;
      findUniqueOrThrow: AsyncMock<typeof mockRoom>;
    };
    systemSetting: {
      findUniqueOrThrow: AsyncMock<typeof mockSettings>;
    };
    booking: {
      count: AsyncMock<number>;
      findFirst: AsyncMock<{ id: string } | null>;
      findMany: AsyncMock<Array<{ id: string }>>;
      updateMany: AsyncMock<{ count: number }>;
      update: AsyncMock<{ id: string }>;
      create: AsyncMock<{ id: string }>;
      findUnique: AsyncMock<PendingLookup | null>;
      findUniqueOrThrow: AsyncMock<BookingRecord>;
    };
    bookingStatusHistory: {
      create: AsyncMock<object>;
      createMany: AsyncMock<{ count: number }>;
    };
    auditLog: {
      create: AsyncMock<object>;
    };
  };

  beforeEach(() => {
    mockTx = {
      room: {
        updateMany: asyncMock({ count: 1 }),
        findUniqueOrThrow: asyncMock(mockRoom),
      },
      systemSetting: {
        findUniqueOrThrow: asyncMock(mockSettings),
      },
      booking: {
        count: asyncMock(0),
        findFirst: asyncMock<{ id: string } | null>(null),
        findMany: asyncMock<Array<{ id: string }>>([]),
        updateMany: asyncMock({ count: 1 }),
        update: asyncMock({ id: 'booking-1' }),
        create: asyncMock({ id: 'new-booking' }),
        findUnique: jest.fn<Promise<PendingLookup | null>, [unknown]>(),
        findUniqueOrThrow: asyncMock(bookingRecord(BookingStatus.PENDING, null)),
      },
      bookingStatusHistory: {
        create: asyncMock<object>({}),
        createMany: asyncMock({ count: 1 }),
      },
      auditLog: {
        create: asyncMock<object>({}),
      },
    };

    const mockPrisma = {
      $transaction: jest.fn((callback: (tx: typeof mockTx) => Promise<unknown>) =>
        callback(mockTx),
      ),
      booking: {
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };

    service = new BookingsService(mockPrisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('allows competing PENDING requests from different students for the same time slot', async () => {
      mockTx.booking.findFirst.mockResolvedValue(null);

      const result = await service.create(baseBookingDto, student2);
      expect(result.status).toBe(BookingStatus.PENDING);
      expect(mockTx.booking.create.mock.calls[0]?.[0]).toMatchObject({
        data: {
          userId: student2.id,
          status: BookingStatus.PENDING,
        },
      });
    });

    it('rejects student request if the same student already has an overlapping PENDING request', async () => {
      mockTx.booking.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-pending' });

      await expect(service.create(baseBookingDto, student1)).rejects.toThrow(
        new ConflictException('You already have a pending request for this time slot'),
      );
    });

    it('rejects student request if there is an overlapping APPROVED booking', async () => {
      mockTx.booking.findFirst.mockResolvedValueOnce({ id: 'approved-booking' });

      await expect(service.create(baseBookingDto, student1)).rejects.toThrow(
        new ConflictException('This room is already reserved for that time range'),
      );
    });

    it('auto-rejects overlapping PENDING student requests when manager creates scheduled activity', async () => {
      mockTx.booking.findFirst.mockResolvedValue(null);
      mockTx.booking.findMany.mockResolvedValue([{ id: 'pending-1' }, { id: 'pending-2' }]);

      await service.create(baseBookingDto, manager);

      expect(mockTx.booking.updateMany.mock.calls[0]?.[0]).toMatchObject({
        where: { id: { in: ['pending-1', 'pending-2'] } },
        data: {
          status: BookingStatus.REJECTED,
          reviewNote: 'Slot assigned to an official room activity',
        },
      });
      expect(mockTx.bookingStatusHistory.createMany.mock.calls[0]?.[0]).toMatchObject({
        data: [
          {
            bookingId: 'pending-1',
            toStatus: BookingStatus.REJECTED,
            note: 'Slot assigned to an official room activity',
          },
          {
            bookingId: 'pending-2',
            toStatus: BookingStatus.REJECTED,
            note: 'Slot assigned to an official room activity',
          },
        ],
      });
    });
  });

  describe('approve', () => {
    it('approves target booking and auto-declines competing PENDING bookings', async () => {
      mockTx.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        roomId: 'room-1',
        status: BookingStatus.PENDING,
        startTime,
        endTime,
      });
      mockTx.booking.findFirst.mockResolvedValue(null);
      mockTx.booking.findMany.mockResolvedValue([{ id: 'competing-pending-2' }]);
      mockTx.booking.findUniqueOrThrow.mockResolvedValue(
        bookingRecord(BookingStatus.APPROVED, 'Looks good'),
      );

      const result = await service.approve('booking-1', manager.id, 'Looks good');
      expect(result.status).toBe(BookingStatus.APPROVED);

      expect(mockTx.booking.updateMany.mock.calls[0]?.[0]).toMatchObject({
        where: { id: { in: ['competing-pending-2'] } },
        data: {
          status: BookingStatus.REJECTED,
          reviewedById: manager.id,
          reviewNote: 'Slot awarded to another approved reservation',
        },
      });

      expect(mockTx.bookingStatusHistory.createMany.mock.calls[0]?.[0]).toMatchObject({
        data: [
          {
            bookingId: 'competing-pending-2',
            fromStatus: BookingStatus.PENDING,
            toStatus: BookingStatus.REJECTED,
            changedById: manager.id,
            note: 'Slot awarded to another approved reservation',
          },
        ],
      });
    });

    it('rejects approval if another booking is already APPROVED for the same time slot', async () => {
      mockTx.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        roomId: 'room-1',
        status: BookingStatus.PENDING,
        startTime,
        endTime,
      });
      mockTx.booking.findFirst.mockResolvedValue({ id: 'already-approved' });

      await expect(service.approve('booking-1', manager.id)).rejects.toThrow(
        new ConflictException('This room is already reserved for that time range'),
      );
    });

    it('throws ConflictException if booking is not PENDING', async () => {
      mockTx.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.APPROVED,
      });

      await expect(service.approve('booking-1', manager.id)).rejects.toThrow(
        new ConflictException('Booking is no longer pending'),
      );
    });
  });
});
