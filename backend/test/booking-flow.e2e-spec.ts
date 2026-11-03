import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter.js';
import { Role, UserStatus } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const managerEmail = 'e2e-manager@tne.local';
const studentEmail = 'e2e-student@tne.local';
const password = 'E2ePassword123!';
const roomName = 'E2E Verification Room';

type AuthResponse = { accessToken: string };
type BookingResponse = { id: string; status: string };
type BlockResponse = { status: string };

describe('booking lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let roomId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new PrismaExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);

    await cleanup();
    await prisma.systemSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    const room = await prisma.room.create({
      data: { name: roomName, location: 'TNE Floor', capacity: 10 },
    });
    roomId = room.id;
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
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('runs register → approve → checkout → return and embedded room blocking', async () => {
    const studentSession = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: studentEmail,
        fullName: 'E2E Student',
        studentCode: 'E2E-STUDENT-001',
        password,
      })
      .expect(201);
    const managerSession = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: managerEmail, password })
      .expect(200);

    const studentToken = (studentSession.body as AuthResponse).accessToken;
    const managerToken = (managerSession.body as AuthResponse).accessToken;
    const firstSlot = futureVietnamSlot(2);
    const booking = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        roomId,
        title: 'E2E booking',
        purpose: 'Verify the complete booking lifecycle',
        attendeeCount: 2,
        ...firstSlot,
      })
      .expect(201);

    const bookingBody = booking.body as BookingResponse;

    const approved = await request(app.getHttpServer())
      .patch(`/api/v1/manager/bookings/${bookingBody.id}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
      .expect(200);
    expect((approved.body as BookingResponse).status).toBe('APPROVED');

    const checkedOut = await request(app.getHttpServer())
      .patch(`/api/v1/manager/bookings/${bookingBody.id}/key-checkout`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
      .expect(200);
    expect((checkedOut.body as BookingResponse).status).toBe('KEY_CHECKED_OUT');

    const completed = await request(app.getHttpServer())
      .patch(`/api/v1/manager/bookings/${bookingBody.id}/key-return`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
      .expect(200);
    expect((completed.body as BookingResponse).status).toBe('COMPLETED');

    const blockedSlot = futureVietnamSlot(3);
    await request(app.getHttpServer())
      .post('/api/v1/manager/room-blocks')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ roomId, reason: 'E2E block', ...blockedSlot })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        roomId,
        title: 'Blocked booking',
        purpose: 'This request must conflict',
        attendeeCount: 2,
        ...blockedSlot,
      })
      .expect(409);
    const cancelled = await request(app.getHttpServer())
      .patch(`/api/v1/manager/room-blocks/${roomId}/cancel`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({})
      .expect(200);
    expect((cancelled.body as BlockResponse).status).toBe('CANCELLED');
  });

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { email: { in: [managerEmail, studentEmail] } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    if (userIds.length) {
      await prisma.bookingStatusHistory.deleteMany({
        where: { booking: { userId: { in: userIds } } },
      });
      await prisma.booking.deleteMany({ where: { userId: { in: userIds } } });
    }
    await prisma.room.deleteMany({ where: { name: roomName } });
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
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
  const end = new Date(target.getTime() + 60 * 60 * 1000);
  return { startTime: target.toISOString(), endTime: end.toISOString() };
}
