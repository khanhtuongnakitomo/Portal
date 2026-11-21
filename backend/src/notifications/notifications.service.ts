import {
  BookingStatus,
  NotificationEventType,
  Prisma,
  Role,
  UserStatus,
} from '../generated/prisma/client.js';
import type { BookingCreatedEmailPayload } from './booking-created-email.js';
import type { BookingDecisionEmailPayload } from './booking-decision-email.js';

type BookingCreatedSource = {
  id: string;
  title: string;
  purpose: string;
  attendeeCount: number;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  room: { name: string; location: string };
  user: {
    fullName: string;
    email: string;
    studentProfile: { studentCode: string } | null;
  };
};

export class NotificationsService {
  async enqueueBookingDecision(tx: Prisma.TransactionClient, bookingIds: string[]) {
    if (!bookingIds.length) return;
    const bookings = await tx.booking.findMany({
      where: {
        id: { in: bookingIds },
        status: { in: [BookingStatus.APPROVED, BookingStatus.REJECTED] },
        isEvent: false,
      },
      include: {
        room: { select: { name: true, location: true } },
        user: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!bookings.length) return;
    const { timezone } = await tx.systemSetting.findUniqueOrThrow({ where: { id: 'default' } });
    await tx.notificationOutbox.createMany({
      data: bookings.map((booking) => {
        const status = booking.status === BookingStatus.APPROVED ? 'APPROVED' : 'REJECTED';
        const eventType =
          status === 'APPROVED'
            ? NotificationEventType.BOOKING_APPROVED
            : NotificationEventType.BOOKING_REJECTED;
        const payload: BookingDecisionEmailPayload = {
          bookingId: booking.id,
          status,
          title: booking.title,
          roomName: booking.room.name,
          roomLocation: booking.room.location,
          startTime: booking.startTime.toISOString(),
          endTime: booking.endTime.toISOString(),
          timezone,
          requesterName: booking.user.fullName,
          reviewNote: booking.reviewNote,
        };
        return {
          eventType,
          bookingId: booking.id,
          recipientUserId: booking.user.id,
          recipientEmail: booking.user.email,
          payload: payload as unknown as Prisma.InputJsonValue,
          dedupeKey: `booking-${status.toLowerCase()}:${booking.id}:${booking.user.id}`,
        };
      }),
      skipDuplicates: true,
    });
  }

  async enqueueBookingCreated(
    tx: Prisma.TransactionClient,
    booking: BookingCreatedSource,
    timezone: string,
  ) {
    if (booking.status !== BookingStatus.PENDING) return;

    const managers = await tx.user.findMany({
      where: { role: Role.MANAGER, status: UserStatus.ACTIVE },
      select: { id: true, email: true },
    });
    if (!managers.length) return;

    const payload: BookingCreatedEmailPayload = {
      bookingId: booking.id,
      title: booking.title,
      purpose: booking.purpose,
      attendeeCount: booking.attendeeCount,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      timezone,
      roomName: booking.room.name,
      roomLocation: booking.room.location,
      requesterName: booking.user.fullName,
      requesterEmail: booking.user.email,
      studentCode: booking.user.studentProfile?.studentCode ?? null,
    };

    await tx.notificationOutbox.createMany({
      data: managers.map((manager) => ({
        eventType: NotificationEventType.BOOKING_CREATED,
        bookingId: booking.id,
        recipientUserId: manager.id,
        recipientEmail: manager.email,
        payload: payload as unknown as Prisma.InputJsonValue,
        dedupeKey: `booking-created:${booking.id}:${manager.id}`,
      })),
      skipDuplicates: true,
    });
  }
}
