import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '../common/http-exceptions.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { BookingStatus, Role, RoomStatus } from '../generated/prisma/client.js';
import { BookingsService } from './bookings.service.js';

describe('BookingsService - Competing Pending & Auto-Decline', () => {
  let service: BookingsService;
  let mockTx: any;
  let mockPrisma: any;

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
  const daysUntilNextMonday = ((1 - now.getDay() + 7) % 7) || 7;
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

  beforeEach(() => {
    mockTx = {
      room: {
        updateMany: jest.fn().mockReturnValue(Promise.resolve({ count: 1 })),
        findUniqueOrThrow: jest.fn().mockReturnValue(Promise.resolve(mockRoom)),
      },
      systemSetting: {
        findUniqueOrThrow: jest.fn().mockReturnValue(Promise.resolve(mockSettings)),
      },
      booking: {
        count: jest.fn().mockReturnValue(Promise.resolve(0)),
        findFirst: jest.fn().mockReturnValue(Promise.resolve(null)),
        findMany: jest.fn().mockReturnValue(Promise.resolve([])),
        updateMany: jest.fn().mockReturnValue(Promise.resolve({ count: 1 })),
        update: jest.fn().mockReturnValue(Promise.resolve({ id: 'booking-1' })),
        create: jest.fn().mockReturnValue(Promise.resolve({ id: 'new-booking' })),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockReturnValue(
          Promise.resolve({
            id: 'new-booking',
            roomId: 'room-1',
            userId: 'student-1',
            title: 'Study Session',
            purpose: 'Exam preparation',
            attendeeCount: 10,
            passCode: 'PASS1234',
            startTime,
            endTime,
            status: BookingStatus.PENDING,
            reviewNote: null,
            reviewedById: null,
            reviewedAt: null,
            keyCheckedOutAt: null,
            keyCheckedOutById: null,
            keyReturnedAt: null,
            keyReturnedById: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            room: mockRoom,
            user: { id: 'student-1', fullName: 'Student One', email: 's1@tne.edu.vn', studentProfile: null },
            reviewedBy: null,
            keyCheckedOutBy: null,
            keyReturnedBy: null,
          }),
        ),
      },
      bookingStatusHistory: {
        create: jest.fn().mockReturnValue(Promise.resolve({})),
        createMany: jest.fn().mockReturnValue(Promise.resolve({ count: 1 })),
      },
      auditLog: {
        create: jest.fn().mockReturnValue(Promise.resolve({})),
      },
    };

    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockTx)),
      booking: {
        findUnique: jest.fn(),
      },
    };

    service = new BookingsService(mockPrisma as any);
  });

  describe('create', () => {
    it('allows competing PENDING requests from different students for the same time slot', async () => {
      // No approved conflict, and student-2 has no pending request
      mockTx.booking.findFirst.mockResolvedValue(null);

      const result = await service.create(baseBookingDto, student2);
      expect(result.status).toBe(BookingStatus.PENDING);
      expect(mockTx.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: student2.id,
            status: BookingStatus.PENDING,
          }),
        }),
      );
    });

    it('rejects student request if the same student already has an overlapping PENDING request', async () => {
      // First findFirst check for approved: null. Second findFirst check for own pending: returns existing booking.
      mockTx.booking.findFirst
        .mockResolvedValueOnce(null) // no APPROVED/KEY_CHECKED_OUT conflict
        .mockResolvedValueOnce({ id: 'existing-pending' }); // own pending conflict

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
      mockTx.booking.findFirst.mockResolvedValue(null); // no approved conflict
      mockTx.booking.findMany.mockResolvedValue([{ id: 'pending-1' }, { id: 'pending-2' }]);

      await service.create(baseBookingDto, manager);

      expect(mockTx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['pending-1', 'pending-2'] } },
        data: expect.objectContaining({
          status: BookingStatus.REJECTED,
          reviewNote: 'Slot assigned to an official room activity',
        }),
      });
      expect(mockTx.bookingStatusHistory.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            bookingId: 'pending-1',
            toStatus: BookingStatus.REJECTED,
            note: 'Slot assigned to an official room activity',
          }),
        ]),
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
      mockTx.booking.findFirst.mockResolvedValue(null); // no firm conflict
      mockTx.booking.findMany.mockResolvedValue([{ id: 'competing-pending-2' }]); // competing pending

      mockTx.booking.findUniqueOrThrow.mockResolvedValue({
        id: 'booking-1',
        roomId: 'room-1',
        userId: 'student-1',
        title: 'Study Session',
        purpose: 'Exam preparation',
        attendeeCount: 10,
        passCode: 'PASS1234',
        startTime,
        endTime,
        status: BookingStatus.APPROVED,
        reviewNote: 'Looks good',
        reviewedById: manager.id,
        reviewedAt: new Date(),
        keyCheckedOutAt: null,
        keyCheckedOutById: null,
        keyReturnedAt: null,
        keyReturnedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        room: mockRoom,
        user: { id: 'student-1', fullName: 'Student One', email: 's1@tne.edu.vn', studentProfile: null },
        reviewedBy: { id: manager.id, fullName: 'Manager' },
        keyCheckedOutBy: null,
        keyReturnedBy: null,
      });

      const result = await service.approve('booking-1', manager.id, 'Looks good');
      expect(result.status).toBe(BookingStatus.APPROVED);

      // Verify competing pending was auto-rejected with required note
      expect(mockTx.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['competing-pending-2'] } },
        data: expect.objectContaining({
          status: BookingStatus.REJECTED,
          reviewedById: manager.id,
          reviewNote: 'Slot awarded to another approved reservation',
        }),
      });

      expect(mockTx.bookingStatusHistory.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            bookingId: 'competing-pending-2',
            fromStatus: BookingStatus.PENDING,
            toStatus: BookingStatus.REJECTED,
            changedById: manager.id,
            note: 'Slot awarded to another approved reservation',
          }),
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
