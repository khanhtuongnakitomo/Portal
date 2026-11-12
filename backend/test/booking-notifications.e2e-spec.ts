import 'reflect-metadata';
import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { BookingsService } from '../src/bookings/bookings.service.js';
import { Role } from '../src/generated/prisma/client.js';
import type { SendEmailInput } from '../src/notifications/email-provider.interface.js';
import { NotificationWorkerService } from '../src/notifications/notification-worker.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const emails = [
  'notice-manager@tne.local',
  'notice-student1@tne.local',
  'notice-student2@tne.local',
];
const password = 'NoticeTest123!';
const roomName = 'Notification E2E Room';
type BookingResponse = { id: string; status: string };

describe('booking decision notifications (PostgreSQL e2e)', () => {
  let app: Express;
  let prisma: PrismaService;
  let roomId: string;
  let managerId: string;
  const tokens: string[] = [];

  beforeAll(async () => {
    ({ app, prisma } = createApp());
    await cleanup();
    await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    roomId = (
      await prisma.room.create({ data: { name: roomName, location: 'TNE Floor', capacity: 10 } })
    ).id;
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    for (const [index, email] of emails.entries()) {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: `Notification User ${index}`,
          role: index === 0 ? Role.MANAGER : Role.USER,
          ...(index === 0
            ? { managerProfile: { create: {} } }
            : { studentProfile: { create: { studentCode: `NOTICE-${index}` } } }),
        },
      });
      if (index === 0) managerId = user.id;
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      tokens[index] = (login.body as { accessToken: string }).accessToken;
    }
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany({ where: { roomId } });
    await prisma.room.update({
      where: { id: roomId },
      data: {
        blockStatus: null,
        blockStartTime: null,
        blockEndTime: null,
        blockReason: null,
        blockCreatedById: null,
        blockCancelledById: null,
        blockCancelledAt: null,
      },
    });
  });

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await prisma.$disconnect();
    }
  });

  it('queues one approval email for the booking owner, including the review note', async () => {
    const booking = await book(1);
    await review(booking.id, 'approve', 'Vui lòng đến đúng giờ').expect(200);
    const rows = await studentEmails(booking.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      eventType: 'BOOKING_APPROVED',
      recipientEmail: emails[1],
      status: 'PENDING',
      payload: { status: 'APPROVED', reviewNote: 'Vui lòng đến đúng giờ' },
    });
    await review(booking.id, 'approve').expect(409);
    expect(await studentEmails(booking.id)).toHaveLength(1);
  });

  it('queues one rejection email with the manager reason and rejects repeated decisions', async () => {
    const booking = await book(1);
    await review(booking.id, 'reject', 'Phòng đang bảo trì').expect(200);
    expect(await studentEmails(booking.id)).toMatchObject([
      {
        eventType: 'BOOKING_REJECTED',
        recipientEmail: emails[1],
        payload: { status: 'REJECTED', reviewNote: 'Phòng đang bảo trì' },
      },
    ]);
    await review(booking.id, 'reject', 'Again').expect(409);
    await review(booking.id, 'approve').expect(409);
    expect(await studentEmails(booking.id)).toHaveLength(1);
  });

  it('notifies displaced students when staff assigns an official activity, without emailing staff as a student', async () => {
    const booking = await book(1);
    const activity = await book(0);
    expect(await studentEmails(booking.id)).toMatchObject([
      {
        eventType: 'BOOKING_REJECTED',
        payload: { reviewNote: 'Slot assigned to an official room activity' },
      },
    ]);
    expect(await prisma.notificationOutbox.count({ where: { bookingId: activity.id } })).toBe(0);
  });

  it.each(['PENDING', 'APPROVED'])(
    'notifies the student when a room block rejects a %s booking',
    async (status) => {
      const booking = await book(1);
      if (status === 'APPROVED') await review(booking.id, 'approve').expect(200);
      await request(app)
        .post('/api/v1/manager/room-blocks')
        .set('Authorization', `Bearer ${tokens[0]}`)
        .send({ roomId, reason: 'University event', ...slot() })
        .expect(201);
      const rejected = (await studentEmails(booking.id)).filter(
        (row) => row.eventType === 'BOOKING_REJECTED',
      );
      expect(rejected).toMatchObject([
        {
          recipientEmail: emails[1],
          payload: { reviewNote: 'Displaced by university event: University event' },
        },
      ]);
    },
  );

  it('does not send a decision email for a student cancellation', async () => {
    const booking = await book(1);
    await request(app)
      .patch(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${tokens[1]}`)
      .send({})
      .expect(200);
    expect(await studentEmails(booking.id)).toHaveLength(0);
  });

  it('commits only one decision and one email when approval and rejection race', async () => {
    const booking = await book(1);
    const results = await Promise.all([
      review(booking.id, 'approve'),
      review(booking.id, 'reject', 'Not available'),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    const current = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    const rows = await studentEmails(booking.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe(`BOOKING_${current.status}`);
  });

  it('rolls back the approval when writing its notification fails', async () => {
    class UnavailableNotifications extends NotificationsService {
      enqueueBookingDecision(): Promise<never> {
        return Promise.reject(new Error('Outbox unavailable'));
      }
    }
    const booking = await book(1);
    const service = new BookingsService(prisma, new UnavailableNotifications());
    await expect(service.approve(booking.id, managerId)).rejects.toThrow('Outbox unavailable');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
      'PENDING',
    );
    expect(await studentEmails(booking.id)).toHaveLength(0);
  });

  it('delivers the correct templates, retries failures with the same key and skips already sent emails', async () => {
    const approved = await book(1);
    const rejected = await book(2, 11);
    await review(approved.id, 'approve').expect(200);
    await review(rejected.id, 'reject', 'Thiếu thông tin').expect(200);
    const deliveries: SendEmailInput[] = [];
    let failStudentOnce = true;
    const worker = new NotificationWorkerService(
      prisma,
      {
        send: (input) => {
          deliveries.push(input);
          if (input.to === emails[2] && failStudentOnce) {
            failStudentOnce = false;
            return Promise.reject(new Error('Temporary provider failure'));
          }
          return Promise.resolve({ messageId: `provider-${deliveries.length}` });
        },
      },
      { frontendUrl: 'https://portal.example.edu.vn', batchSize: 100, maxAttempts: 5 },
    );
    await worker.processPending();
    expect(deliveries.find((item) => item.to === emails[1])?.subject).toContain('đã được duyệt');
    expect(deliveries.find((item) => item.to === emails[2])?.text).toContain(
      'Lý do: Thiếu thông tin',
    );
    const [retry] = await studentEmails(rejected.id);
    expect(retry).toMatchObject({
      status: 'PENDING',
      attempts: 1,
      lastError: 'Temporary provider failure',
    });
    await prisma.notificationOutbox.update({
      where: { id: retry.id },
      data: { nextAttemptAt: new Date(0) },
    });
    await worker.processPending();
    const before = deliveries.length;
    await worker.processPending();
    expect(deliveries).toHaveLength(before);
    const studentAttempts = deliveries.filter((item) => item.to === emails[2]);
    expect(studentAttempts).toHaveLength(2);
    expect(studentAttempts[0].idempotencyKey).toBe(studentAttempts[1].idempotencyKey);
    expect((await studentEmails(rejected.id))[0]).toMatchObject({ status: 'SENT', attempts: 2 });
  });

  async function book(index: number, hour = 9): Promise<BookingResponse> {
    const response = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${tokens[index]}`)
      .send({
        roomId,
        title: 'Notification test',
        purpose: 'Test booking decision emails',
        attendeeCount: 2,
        ...slot(hour),
      })
      .expect(201);
    return response.body as BookingResponse;
  }
  function review(id: string, action: 'approve' | 'reject', note?: string) {
    return request(app)
      .patch(`/api/v1/manager/bookings/${id}/${action}`)
      .set('Authorization', `Bearer ${tokens[0]}`)
      .send({ note });
  }
  function studentEmails(bookingId: string) {
    return prisma.notificationOutbox.findMany({
      where: { bookingId, recipientEmail: { in: emails.slice(1) } },
      orderBy: { createdAt: 'asc' },
    });
  }
  async function cleanup() {
    const room = await prisma.room.findUnique({ where: { name: roomName } });
    if (room) {
      await prisma.booking.deleteMany({ where: { roomId: room.id } });
      await prisma.room.delete({ where: { id: room.id } });
    }
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  }
});

function slot(hour = 9) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const start = new Date(`${today}T02:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() + 2);
  while ([0, 6].includes(start.getUTCDay())) start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(hour - 7);
  return {
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + 3600000).toISOString(),
  };
}
