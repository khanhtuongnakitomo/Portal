import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { generatePassCode } from '../src/bookings/bookings.service.js';
import { validateEnvironment } from '../src/config/environment.js';
import { Role } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

const api = '/api/v1';
const devEmails = ['dev.student@dev.local', 'dev.manager@dev.local', 'dev.admin@dev.local'];
const mockEmails = { endsWith: '@mock.dev.local' };

type Session = { accessToken: string; user: { id: string; role: Role } };
type Booking = {
  id: string;
  status: string;
  kind: string;
  roomId: string;
  startTime: string;
  endTime: string;
  user: { id: string; email: string };
};
type Calendar = { bookings: Booking[]; blocks: Array<{ id: string; reason: string }> };
type ManagerList = { items: Booking[] };

describe('developer tools (e2e)', () => {
  const options = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
    DEV_TOOLS_ENABLED: 'true',
  };
  let app: Express;
  let prisma: PrismaService;
  let roomIds: string[] = [];
  let newDevEmails: string[] = [];
  let canClear = false;

  beforeAll(async () => {
    ({ app, prisma } = createApp(undefined, validateEnvironment(options)));
    await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    // The delete API is intentionally global for the reserved accounts. Never clear somebody's fixtures.
    const [mockCount, bookingCount, existing] = await Promise.all([
      prisma.user.count({ where: { email: mockEmails } }),
      prisma.booking.count({ where: { user: { email: { in: devEmails } } } }),
      prisma.user.findMany({ where: { email: { in: devEmails } }, select: { email: true } }),
    ]);
    if (mockCount || bookingCount)
      throw new Error('Developer e2e tests require a clean test database');
    newDevEmails = devEmails.filter(
      (email) => !existing.some((account) => account.email === email),
    );
    canClear = true;
    const rooms = await prisma.room.createManyAndReturn({
      data: Array.from({ length: 4 }, () => ({
        name: `Dev e2e ${randomUUID()}`,
        capacity: 12,
        location: 'TNE Floor',
      })),
      select: { id: true },
    });
    roomIds = rooms.map(({ id }) => id);
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      if (canClear) await request(app).delete(`${api}/dev/mock-data`).expect(200);
      await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
      await prisma.user.deleteMany({ where: { email: { in: newDevEmails } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('issues the normal access token for each role and audits developer sign-ins', async () => {
    await request(app).get(`${api}/dev/status`).expect(200, { enabled: true });
    for (const role of Object.values(Role)) {
      const session = await signIn(role);
      const me = await request(app)
        .get(`${api}/users/me`)
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);
      expect(me.body).toMatchObject({ id: session.user.id, role });
      expect(
        await prisma.auditLog.count({
          where: { action: 'DEV_LOGIN', actorId: session.user.id, targetId: session.user.id },
        }),
      ).toBeGreaterThan(0);
    }
  });

  it('rejects any non-loopback forwarded hop and Cloudflare traffic before handling the request', async () => {
    await request(app)
      .get(`${api}/dev/status`)
      .set('X-Forwarded-For', '::1, ::ffff:127.0.0.1, 127.0.0.1')
      .expect(200);
    await request(app)
      .post(`${api}/dev/login`)
      .set('X-Forwarded-For', '203.0.113.5, 127.0.0.1')
      .send({ role: Role.ADMIN })
      .expect(403);
    await request(app).get(`${api}/dev/accounts`).set('cf-connecting-ip', '127.0.0.1').expect(403);
    await request(app)
      .options(`${api}/dev/login`)
      .set('X-Forwarded-For', '203.0.113.5')
      .expect(403);
    await request(app)
      .post(`${api}/dev/mock-data`)
      .set('Origin', 'https://example.com')
      .expect(403);
  });

  it('generates competing requests, an official event, a room block and an overdue key, then clears them', async () => {
    const { accessToken } = await signIn(Role.MANAGER);
    const authorization = `Bearer ${accessToken}`;
    const generated = await request(app).post(`${api}/dev/mock-data`).send({ days: 1 }).expect(200);
    expect(generated.body).toMatchObject({ created: { students: 6, blocks: 1 } });
    const now = Date.now();
    const range = {
      from: new Date(now - 7 * 86_400_000).toISOString(),
      to: new Date(now + 7 * 86_400_000).toISOString(),
    };
    const calendar = () =>
      request(app)
        .get(`${api}/bookings/calendar`)
        .set('Authorization', authorization)
        .query(range)
        .expect(200);
    const overdue = () =>
      request(app)
        .get(`${api}/manager/bookings/overdue-keys`)
        .set('Authorization', authorization)
        .expect(200);
    const isMock = (booking: Booking) => booking.user.email.endsWith(mockEmails.endsWith);
    const before = (await calendar()).body as Calendar;
    const pending = before.bookings.filter(
      (booking) => isMock(booking) && booking.status === 'PENDING',
    );
    expect(
      pending.some((a) =>
        pending.some(
          (b) =>
            a.user.id !== b.user.id &&
            a.roomId === b.roomId &&
            a.startTime < b.endTime &&
            b.startTime < a.endTime,
        ),
      ),
    ).toBe(true);
    expect(before.bookings.filter(isMock)).toContainEqual(
      expect.objectContaining({ kind: 'OFFICIAL', status: 'APPROVED' }),
    );
    const block = before.blocks.find(({ reason }) => reason === 'AV equipment inspection');
    expect(block).toBeDefined();
    const overdueItems = ((await overdue()).body as ManagerList).items.filter(isMock);
    expect(overdueItems).toHaveLength(1);
    expect(overdueItems[0]).toMatchObject({ status: 'KEY_CHECKED_OUT' });
    expect(Date.parse(overdueItems[0].endTime)).toBeLessThan(now);

    const cleared = await request(app).delete(`${api}/dev/mock-data`).expect(200);
    expect(cleared.body).toMatchObject({ deleted: { users: 7, blocks: 1 } });
    const after = (await calendar()).body as Calendar;
    expect(after.bookings.filter(isMock)).toHaveLength(0);
    expect(after.blocks.map(({ id }) => id)).not.toContain(block?.id);
    expect(((await overdue()).body as ManagerList).items.filter(isMock)).toHaveLength(0);
  });

  it('preserves non-mock booking history and blocks linked to deleted mock actors', async () => {
    await request(app).post(`${api}/dev/mock-data`).send({ days: 1 }).expect(200);
    const mockStaff = await prisma.user.findUniqueOrThrow({
      where: { email: 'mock.staff@mock.dev.local' },
    });
    const owner = await prisma.user.create({
      data: {
        email: `dev-e2e-${randomUUID()}@tne.local`,
        fullName: 'Non-mock staff',
        passwordHash: randomBytes(32).toString('hex'),
        role: Role.MANAGER,
        managerProfile: { create: {} },
      },
    });
    let roomId: string | undefined;
    try {
      const startTime = new Date(Date.now() - 86_400_000);
      const endTime = new Date(+startTime + 3_600_000);
      const room = await prisma.room.create({
        data: {
          name: `Dev e2e ${randomUUID()}`,
          capacity: 12,
          location: 'TNE Floor',
          blockStatus: 'CANCELLED',
          blockCreatedById: owner.id,
          blockCancelledById: mockStaff.id,
          blockCancelledAt: startTime,
          blockStartTime: startTime,
          blockEndTime: endTime,
          blockReason: 'Non-mock block',
        },
      });
      roomId = room.id;
      const booking = await prisma.booking.create({
        data: {
          title: 'Non-mock booking',
          purpose: 'TNE workshop',
          attendeeCount: 2,
          roomId,
          userId: owner.id,
          passCode: generatePassCode(),
          startTime,
          endTime,
          status: 'REJECTED',
          reviewedById: mockStaff.id,
          history: { create: { toStatus: 'REJECTED', changedById: mockStaff.id } },
        },
      });
      await request(app).delete(`${api}/dev/mock-data`).expect(200);
      const admin = await prisma.user.findUniqueOrThrow({
        where: { email: 'dev.admin@dev.local' },
      });
      expect(
        await prisma.booking.findUnique({ where: { id: booking.id }, include: { history: true } }),
      ).toMatchObject({
        reviewedById: admin.id,
        history: [{ toStatus: 'REJECTED', changedById: admin.id }],
      });
      expect(await prisma.room.findUnique({ where: { id: roomId } })).toMatchObject({
        blockStatus: 'CANCELLED',
        blockCreatedById: owner.id,
        blockCancelledById: admin.id,
      });
    } finally {
      await prisma.booking.deleteMany({ where: { userId: owner.id } });
      if (roomId) await prisma.room.delete({ where: { id: roomId } });
      await prisma.user.delete({ where: { id: owner.id } });
    }
  });

  it('leaves the endpoints unmounted when disabled and refuses to enable them in production', async () => {
    const disabled = createApp(prisma, {
      ...validateEnvironment(options),
      devToolsEnabled: false,
    }).app;
    await request(disabled).get(`${api}/dev/status`).expect('Content-Type', /json/).expect(404);
    expect(() => validateEnvironment({ ...options, NODE_ENV: 'production' })).toThrow(
      'DEV_TOOLS_ENABLED cannot be true in production',
    );
  });

  async function signIn(role: Role) {
    const response = await request(app).post(`${api}/dev/login`).send({ role }).expect(200);
    return response.body as Session;
  }
});
