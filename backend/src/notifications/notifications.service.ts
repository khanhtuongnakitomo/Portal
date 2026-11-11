import {
  BookingStatus,
  NotificationEventType,
  Prisma,
  Role,
  UserStatus,
} from '../generated/prisma/client.js';
import type { BookingCreatedEmailPayload } from './booking-created-email.js';

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
