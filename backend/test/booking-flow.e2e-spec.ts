import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { validateEnvironment } from '../src/config/environment.js';
import {
  NotificationEventType,
  NotificationStatus,
  Role,
  UserStatus,
} from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const runId = randomUUID();
const managerEmail = `manager-${runId}@tne.local`;
const studentEmail = `student-${runId}@tne.local`;
const competitorEmail = `competitor-${runId}@tne.local`;
const password = 'E2ePassword123!';

type AuthResponse = { accessToken: string };
type BookingResponse = { id: string; status: string; passCode: string | null; kind: string };
type CalendarResponse = { bookings: Array<Record<string, unknown>> };
type Slot = { startTime: string; endTime: string };

describe('booking lifecycle (e2e)', () => {
  let app: Express;
  let prisma: PrismaService;
  let roomId: string;
  let slot: Slot;
  let managerToken: string;
  let studentToken: string;
  let competitorToken: string;

  beforeAll(async () => {
    const created = createApp(
      undefined,
      validateEnvironment({
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
      }),
    );
    app = created.app;
    prisma = created.prisma;

    await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    await prisma.user.create({
      data: {
        email: managerEmail,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        fullName: 'E2E Manager',
        role: Role.MANAGER,
        status: UserStatus.ACTIVE,
        managerProfile: { create: {} },
      },
    });
    studentToken = await registerStudent(studentEmail, `A-${runId}`);
    competitorToken = await registerStudent(competitorEmail, `B-${runId}`);
    const managerSession = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: managerEmail, password })
      .expect(200);
    managerToken = (managerSession.body as AuthResponse).accessToken;
  });

  beforeEach(async () => {
    const room = await prisma.room.create({
      data: { name: `E2E ${randomUUID()}`, location: 'TNE Floor', capacity: 10 },
    });
    roomId = room.id;
    slot = futureVietnamSlot(2);
  });

  afterEach(async () => {
    if (!roomId) return;
    const bookings = await prisma.booking.findMany({ where: { roomId }, select: { id: true } });
    await prisma.auditLog.deleteMany({
      where: { targetId: { in: [roomId, ...bookings.map(({ id }) => id)] } },
    });
    await prisma.booking.deleteMany({ where: { roomId } });
    await prisma.room.delete({ where: { id: roomId } });
    roomId = '';
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.user.deleteMany({
        where: { email: { in: [managerEmail, studentEmail, competitorEmail] } },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('only updates the authenticated user’s display name and records the change', async () => {
    const patch = (body: object) =>
      request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(body);
    await patch({ fullName: 'Updated Student', studentCode: 'NOT-EDITABLE' }).expect(400);
    await patch({ fullName: ' x ' }).expect(400);
    await patch({ fullName: 12345 }).expect(400);
    const updated = await patch({ fullName: '  Updated Student  ' }).expect(200);
    const profile = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(updated.body).toEqual(profile.body);
    expect(profile.body).toMatchObject({ fullName: 'Updated Student', email: studentEmail });
    expect(profile.body).not.toHaveProperty('passwordHash');
    const { id } = profile.body as { id: string };
    expect(
      await prisma.auditLog.count({
        where: { actorId: id, targetId: id, action: 'USER_PROFILE_UPDATED' },
      }),
    ).toBe(1);
    await prisma.auditLog.deleteMany({ where: { targetId: id, action: 'USER_PROFILE_UPDATED' } });
  });

  it('allows only one approval and records a single approval before key checkout and return', async () => {
    const pending = await createBooking(studentToken).expect(201);
    const bookingBody = pending.body as BookingResponse;
    expect(bookingBody).toMatchObject({ status: 'PENDING', passCode: null, kind: 'STUDENT' });
    const notification = await prisma.notificationOutbox.findFirstOrThrow({
      where: { bookingId: bookingBody.id, recipientEmail: managerEmail },
    });
    expect(notification.eventType).toBe(NotificationEventType.BOOKING_CREATED);
    expect(notification.status).toBe(NotificationStatus.PENDING);
    expect(notification.attempts).toBe(0);
    const responses = await Promise.all([approve(bookingBody.id), approve(bookingBody.id)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const approved = responses.find((response) => response.status === 200);
    const passCode = (approved?.body as BookingResponse | undefined)?.passCode;
    expect(passCode).toEqual(expect.any(String));
    expect(
      await prisma.bookingStatusHistory.count({
        where: { bookingId: bookingBody.id, fromStatus: 'PENDING', toStatus: 'APPROVED' },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { targetId: bookingBody.id, action: 'BOOKING_APPROVED' },
      }),
    ).toBe(1);

    const denied = await request(app)
      .patch(`/api/v1/manager/bookings/${bookingBody.id}/key-checkout`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ passCode: 'WRONG' })
      .expect(400);
    expect(denied.body).toMatchObject({ message: 'Pass code does not match' });

    const checkedOut = await request(app)
      .patch(`/api/v1/manager/bookings/${bookingBody.id}/key-checkout`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ passCode: passCode?.toLowerCase() })
      .expect(200);
    expect((checkedOut.body as BookingResponse).status).toBe('KEY_CHECKED_OUT');
    await block(slot, { displaceBookings: true }).expect(409);

    const completed = await request(app)
      .patch(`/api/v1/manager/bookings/${bookingBody.id}/key-return`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
      .expect(200);
    expect(completed.body).toMatchObject({ status: 'COMPLETED', passCode: null });
    const ledger = await request(app)
      .get('/api/v1/bookings/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(ledger.body).toMatchObject({
      items: [{ id: bookingBody.id, status: 'COMPLETED', passCode: null, kind: 'STUDENT' }],
    });
  });

  it('allows competing pending requests but exposes personal details only to staff and the owner', async () => {
    const studentRequest = await createBooking(studentToken, '[EVENT] Student request').expect(201);
    const { id } = studentRequest.body as BookingResponse;
    await prisma.room.update({ where: { id: roomId }, data: { autoApprove: true } });
    const rival = (await createBooking(competitorToken).expect(201)).body as BookingResponse;
    expect(rival.status).toBe('PENDING');
    const anonymous = await calendar();
    const publicBooking = {
      id,
      roomId,
      title: '[EVENT] Student request',
      ...slot,
      room: { id: roomId, name: expect.any(String) as string },
      status: 'PENDING',
      kind: 'STUDENT',
      isMine: false,
    };
    expect(anonymous.find((b) => b.id === id)).toEqual(publicBooking);
    expect(await calendar(competitorToken)).toContainEqual(publicBooking);
    for (const [token, isMine] of [
      [studentToken, true],
      [managerToken, false],
    ] as const) {
      const row = (await calendar(token)).find((b) => b.id === id);
      expect(row).toMatchObject({
        isMine,
        kind: 'STUDENT',
        purpose: 'E2E booking purpose',
        attendeeCount: 2,
        user: { role: 'USER', email: studentEmail, studentCode: `A-${runId}`.toUpperCase() },
      });
      expect(row).not.toHaveProperty('passCode');
    }
    await approve(id).expect(200);
    const rejected = await request(app)
      .get(`/api/v1/bookings/${rival.id}`)
      .set('Authorization', `Bearer ${competitorToken}`)
      .expect(200);
    expect(rejected.body).toMatchObject({ status: 'REJECTED', passCode: null, kind: 'STUDENT' });
  });

  it('auto-approves a free slot but queues a competing request', async () => {
    await prisma.room.update({ where: { id: roomId }, data: { autoApprove: true } });
    const approved = (await createBooking(studentToken).expect(201)).body as BookingResponse;
    expect(approved).toMatchObject({ status: 'APPROVED', passCode: expect.any(String) as string });
    expect(
      await prisma.auditLog.count({
        where: { targetId: approved.id, action: 'BOOKING_APPROVED' },
      }),
    ).toBe(1);
    expect(
      await prisma.bookingStatusHistory.count({
        where: { bookingId: approved.id, toStatus: 'APPROVED' },
      }),
    ).toBe(1);
    expect(
      await prisma.notificationOutbox.count({
        where: {
          bookingId: approved.id,
          recipientEmail: studentEmail,
          eventType: 'BOOKING_APPROVED',
        },
      }),
    ).toBe(1);
    const waiting = await createBooking(competitorToken).expect(201);
    expect(waiting.body).toMatchObject({ status: 'PENDING', passCode: null });
  });

  it('requires explicit displacement and preserves an active block until cancelled', async () => {
    const { id } = (await createBooking(studentToken).expect(201)).body as BookingResponse;
    const denied = await block(slot).expect(409);
    expect(denied.body).toMatchObject({ message: expect.stringContaining(id) as string });
    await block(slot, { displaceBookings: 'false' }).expect(400);
    await block(slot, { displaceBookings: true }).expect(201);
    expect(
      await prisma.bookingStatusHistory.count({
        where: { bookingId: id, fromStatus: 'PENDING', toStatus: 'REJECTED' },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { targetId: id, action: 'BOOKING_REJECTED' } }),
    ).toBe(1);
    await block(futureVietnamSlot(9), { reason: 'A different block' }).expect(409);
    await createBooking(studentToken).expect(409);
    const stale = await request(app)
      .patch(`/api/v1/manager/room-blocks/${roomId}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ ...slot, startTime: '2026-01-01T00:00:00.000Z' })
      .expect(409);
    expect(stale.body).toMatchObject({ message: 'Room block has changed; refresh and try again' });
    const cancelled = await request(app)
      .patch(`/api/v1/manager/room-blocks/${roomId}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send(slot)
      .expect(200);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED' });
    await createBooking(studentToken).expect(201);
  });

  it('serializes a displacing block with key checkout on the same approved booking', async () => {
    const { id, passCode } = (await createBooking(managerToken).expect(201))
      .body as BookingResponse;
    expect(await calendar()).toContainEqual(expect.objectContaining({ id, kind: 'OFFICIAL' }));
    const [checkout, displacement] = await Promise.all([
      request(app)
        .patch(`/api/v1/manager/bookings/${id}/key-checkout`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ passCode }),
      block(slot, { displaceBookings: true }),
    ]);
    const stored = await prisma.booking.findUniqueOrThrow({ where: { id } });
    if (checkout.status === 200) {
      expect(displacement.status).toBe(409);
      expect(stored.status).toBe('KEY_CHECKED_OUT');
    } else {
      expect([checkout.status, displacement.status]).toEqual([409, 201]);
      expect(stored.status).toBe('REJECTED');
    }
  });

  async function registerStudent(email: string, studentCode: string) {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, fullName: 'E2E Student', studentCode, password })
      .expect(201);
    return (response.body as AuthResponse).accessToken;
  }

  function createBooking(token: string, title = 'E2E booking') {
    return request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ roomId, title, purpose: 'E2E booking purpose', attendeeCount: 2, ...slot });
  }

  function approve(id: string) {
    return request(app)
      .patch(`/api/v1/manager/bookings/${id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({});
  }

  function block(blockSlot: Slot, options: { reason?: string; displaceBookings?: unknown } = {}) {
    return request(app)
      .post('/api/v1/manager/room-blocks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ roomId, reason: 'E2E block', ...blockSlot, ...options });
  }

  async function calendar(token?: string) {
    const req = request(app)
      .get('/api/v1/bookings/calendar')
      .query({ roomId, from: slot.startTime, to: slot.endTime });
    if (token) req.set('Authorization', `Bearer ${token}`);
    const response = await req.expect(200);
    return (response.body as CalendarResponse).bookings;
  }
});

function futureVietnamSlot(daysAhead: number) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localToday = formatter.format(new Date());
  const target = new Date(`${localToday}T02:00:00.000Z`);
  target.setUTCDate(target.getUTCDate() + daysAhead);
  while (target.getUTCDay() === 0 || target.getUTCDay() === 6) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  const end = new Date(target.getTime() + 60 * 60 * 1000);
  return { startTime: target.toISOString(), endTime: end.toISOString() };
}
