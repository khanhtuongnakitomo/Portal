import '../src/config/load-environment.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { lockRoomSchedule } from '../src/bookings/room-schedule.js';
import {
  BookingStatus,
  Prisma,
  PrismaClient,
  Role,
  Room,
  RoomBlockStatus,
  UserStatus,
} from '../src/generated/prisma/client.js';

const demoAccounts = [
  { email: 'manager@tne.edu.vn', fullName: 'Duc Tran', role: Role.MANAGER },
  {
    email: 'student@tne.edu.vn',
    fullName: 'Linh Nguyen',
    role: Role.USER,
    studentCode: 'SE184022',
  },
  {
    email: 'student2@tne.edu.vn',
    fullName: 'Minh Tran',
    role: Role.USER,
    studentCode: 'SE184105',
  },
  { email: 'admin@tne.local', fullName: 'Giang Pham (Admin)', role: Role.ADMIN },
  { email: 'g.pham@uts-tne.edu.vn', fullName: 'Giang Pham', role: Role.ADMIN },
  { email: 'manager@tne.local', fullName: 'Duc Tran', role: Role.MANAGER },
  { email: 'd.tran@uts-tne.edu.vn', fullName: 'Duc Tran', role: Role.MANAGER },
  {
    email: 'student@tne.local',
    fullName: 'Linh Nguyen (Demo)',
    role: Role.USER,
    studentCode: 'DEMO001',
  },
  {
    email: 'linh.nguyen@student.uts.edu.au',
    fullName: 'Linh Nguyen',
    role: Role.USER,
    studentCode: 'SE184023',
  },
  {
    email: 'student3@tne.edu.vn',
    fullName: 'Anh Vo',
    role: Role.USER,
    studentCode: 'SE170311',
  },
  {
    email: 'student4@tne.edu.vn',
    fullName: 'Khoa Dang',
    role: Role.USER,
    studentCode: 'SE161907',
  },
];

type SeedAccount = {
  email: string;
  fullName: string;
  role: Role;
  studentCode?: string;
};

async function createAccountIfMissing(
  prisma: Prisma.TransactionClient,
  account: SeedAccount,
  password: string,
  bootstrapAdmin = false,
) {
  const existing = await prisma.user.findUnique({
    where: { email: account.email },
    select: { role: true },
  });
  if (existing) {
    if (bootstrapAdmin && existing.role !== Role.ADMIN) {
      throw new Error('ADMIN_EMAIL is already assigned to a non-ADMIN account; use another email');
    }
    return;
  }

  const profile = account.studentCode
    ? { studentProfile: { create: { studentCode: account.studentCode } } }
    : account.role === Role.MANAGER
      ? { managerProfile: { create: {} } }
      : { adminProfile: { create: {} } };
  await prisma.user.create({
    data: {
      email: account.email,
      fullName: account.fullName,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: account.role,
      status: UserStatus.ACTIVE,
      ...profile,
    },
  });
}

function seedPassword(name: 'ADMIN_PASSWORD' | 'DEMO_PASSWORD') {
  const password = process.env[name];
  if (!password || password.length < 12) {
    throw new Error(`${name} is required and must contain at least 12 characters`);
  }
  return password;
}

export async function runSeed(beforeSeed?: (tx: Prisma.TransactionClient) => Promise<void>) {
  const seedDemoUsers = process.env.SEED_DEMO_USERS === 'true';
  if (seedDemoUsers && process.env.NODE_ENV === 'production') {
    throw new Error('Demo seeding is not allowed in production');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) throw new Error('ADMIN_EMAIL is required');
  const adminPassword = seedPassword('ADMIN_PASSWORD');
  const demoPassword = seedDemoUsers ? seedPassword('DEMO_PASSWORD') : undefined;

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.$transaction(
      async (tx) => {
        await beforeSeed?.(tx);
        await seed(
          tx,
          {
            email: adminEmail,
            fullName: process.env.ADMIN_FULL_NAME ?? 'TNE Administrator',
            role: Role.ADMIN,
          },
          adminPassword,
          demoPassword,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 },
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function seed(
  prisma: Prisma.TransactionClient,
  admin: SeedAccount,
  adminPassword: string,
  demoPassword: string | undefined,
) {
  await createAccountIfMissing(prisma, admin, adminPassword, true);
  if (demoPassword) {
    for (const account of demoAccounts) {
      await createAccountIfMissing(prisma, account, demoPassword);
    }
  }

  const rooms = [
    {
      name: 'Seminar Hall 601',
      location: 'Level 6 · TNE Building',
      description: '601|6|4K Laser Projector,Dual Whiteboards,Lecture Capture,60W USB-C Pods',
      capacity: 40,
      autoApprove: false,
    },
    {
      name: 'Studio Room 602',
      location: 'Level 6 · TNE Building',
      description: '602|6|75" Interactive Display,Modular Tables,Glass Writable Wall',
      capacity: 24,
      autoApprove: false,
    },
    {
      name: 'Lecture Theatre 605',
      location: 'Level 6 · TNE Building',
      description: '605|6|Tiered Seating,Wireless Lavalier Mic,Dual Projection,Simulcast Rack',
      capacity: 80,
      autoApprove: false,
    },
  ];

  const upsertedRooms: Record<string, Room> = {};
  for (const room of rooms) {
    const res = await prisma.room.upsert({
      where: { name: room.name },
      update: {},
      create: room,
    });
    upsertedRooms[room.name] = res;
  }

  const seedSettings = {
    timezone: 'Asia/Ho_Chi_Minh',
    openTime: '08:00',
    closeTime: '17:00',
    maxDurationMinutes: 240,
    maxAdvanceDays: 7,
    maxActiveBookingsPerUser: 3,
  };
  // The init migration inserts this row. Only replace its untouched defaults.
  await prisma.systemSetting.updateMany({
    where: {
      id: 'default',
      updatedById: null,
      timezone: 'Asia/Ho_Chi_Minh',
      openTime: '07:00',
      closeTime: '21:00',
      maxDurationMinutes: 240,
      maxAdvanceDays: 90,
      maxActiveBookingsPerUser: 5,
    },
    data: seedSettings,
  });
  await prisma.systemSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', ...seedSettings },
  });

  if (demoPassword) {
    const studentUser = await prisma.user.findUnique({
      where: { email: 'student@tne.edu.vn', role: Role.USER, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    const student2User = await prisma.user.findUnique({
      where: { email: 'student2@tne.edu.vn', role: Role.USER, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    const managerUser = await prisma.user.findUnique({
      where: { email: 'manager@tne.edu.vn', role: Role.MANAGER, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    const r601 = upsertedRooms['Seminar Hall 601'];
    const r602 = upsertedRooms['Studio Room 602'];
    const r605 = upsertedRooms['Lecture Theatre 605'];

    if (studentUser && student2User && managerUser && r601 && r602 && r605) {
      const vnFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const todayStr = vnFormatter.format(new Date());
      const [year, month, day] = todayStr.split('-').map(Number);
      const vnMidnightUtc = Date.UTC(year, month - 1, day, 0, 0, 0) - 7 * 3600 * 1000;

      // Day of week in Vietnam: 0=Sun, 1=Mon, ..., 6=Sat
      const vnDow = new Date(vnMidnightUtc + 12 * 3600 * 1000).getUTCDay();
      // Anchor baseMondayUtc strictly to Monday. If today is Sat or Sun, advance to upcoming Monday.
      let baseMondayUtc = vnMidnightUtc - (vnDow - 1) * 86400000;
      if (vnDow === 0) {
        baseMondayUtc = vnMidnightUtc + 1 * 86400000;
      } else if (vnDow === 6) {
        baseMondayUtc = vnMidnightUtc + 2 * 86400000;
      }

      // workdayIndex: 0 = Mon, 1 = Tue, 2 = Wed, 3 = Thu, 4 = Fri
      const atWorkday = (workdayIndex: number, hourVn: number, minuteVn = 0) =>
        new Date(baseMondayUtc + workdayIndex * 86400000 + hourVn * 3600000 + minuteVn * 60000);

      const sampleBookings = [
        // 1. Competing PENDING booking 1 on Room 601
        {
          passCode: 'TNE-601-COMPETE01',
          roomId: r601.id,
          userId: studentUser.id,
          title: 'Capstone Sprint Review — Team Kestrel',
          purpose: 'Bi-weekly demo and sprint presentation with industry mentors',
          attendeeCount: 15,
          startTime: atWorkday(1, 9, 0), // Tuesday 09:00
          endTime: atWorkday(1, 11, 0), // Tuesday 11:00
          status: BookingStatus.PENDING,
        },
        // 2. Competing PENDING booking 2 on Room 601 (exact same Tuesday 09:00-11:00 time slot!)
        {
          passCode: 'TNE-601-COMPETE02',
          roomId: r601.id,
          userId: student2User.id,
          title: 'AI Research Group Weekly Seminar',
          purpose: 'Paper presentation on Transformer architectures and multimodal models',
          attendeeCount: 20,
          startTime: atWorkday(1, 9, 0), // Tuesday 09:00
          endTime: atWorkday(1, 11, 0), // Tuesday 11:00
          status: BookingStatus.PENDING,
        },
        // 3. 1 APPROVED booking on Room 601 on another workday slot
        {
          passCode: 'TNE-601-GUEST01',
          roomId: r601.id,
          userId: managerUser.id,
          isEvent: true,
          title: 'UTS Industry Guest Lecture: Cloud Architecture',
          purpose: 'Scheduled room activity / event assigned by Manager',
          attendeeCount: 35,
          startTime: atWorkday(2, 8, 30), // Wednesday 08:30
          endTime: atWorkday(2, 11, 30), // Wednesday 11:30
          status: BookingStatus.APPROVED,
          reviewedById: managerUser.id,
          reviewedAt: atWorkday(0, 8, 0),
          reviewNote: 'Scheduled room activity / event assigned by Manager',
        },
        // 4. PENDING booking on Room 602
        {
          passCode: 'TNE-602-TUTOR01',
          roomId: r602.id,
          userId: studentUser.id,
          title: 'Data Structures peer tutoring',
          purpose: 'Weekly study circle on trees, graphs, and dynamic programming',
          attendeeCount: 10,
          startTime: atWorkday(3, 14, 0), // Thursday 14:00
          endTime: atWorkday(3, 16, 0), // Thursday 16:00
          status: BookingStatus.PENDING,
        },
        // 5. APPROVED booking on Room 605
        {
          passCode: 'TNE-605-ROBOT01',
          roomId: r605.id,
          userId: student2User.id,
          title: 'Robotics society weekly build night',
          purpose: 'Weekly hardware sprint and chassis assembly for Robocon 2027',
          attendeeCount: 24,
          startTime: atWorkday(0, 10, 0), // Monday 10:00
          endTime: atWorkday(0, 12, 0), // Monday 12:00
          status: BookingStatus.APPROVED,
          reviewedById: managerUser.id,
          reviewedAt: atWorkday(0, 8, 0),
          reviewNote: 'Approved for robotics build session',
        },
      ];

      const demoRooms = [r601, r602, r605];

      for (const booking of sampleBookings) {
        const room = demoRooms.find((room) => room.id === booking.roomId);
        if (
          room?.blockStatus === RoomBlockStatus.ACTIVE &&
          room.blockStartTime &&
          room.blockEndTime &&
          room.blockStartTime < booking.endTime &&
          room.blockEndTime > booking.startTime
        ) {
          continue;
        }
        const existing = await prisma.booking.findFirst({
          where: {
            OR: [
              { passCode: booking.passCode },
              {
                roomId: booking.roomId,
                status: { in: [BookingStatus.APPROVED, BookingStatus.KEY_CHECKED_OUT] },
                startTime: { lt: booking.endTime },
                endTime: { gt: booking.startTime },
              },
            ],
          },
          select: { id: true },
        });
        if (!existing) {
          await lockRoomSchedule(prisma, booking.roomId);
          await prisma.booking.create({ data: booking });
        }
      }

      const blockStartTime = atWorkday(4, 8, 0); // Friday 08:00
      const blockEndTime = atWorkday(4, 12, 0); // Friday 12:00

      await prisma.room.updateMany({
        where: {
          id: r605.id,
          blockStatus: null,
          bookings: {
            none: {
              status: {
                in: [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.KEY_CHECKED_OUT],
              },
              startTime: { lt: blockEndTime },
              endTime: { gt: blockStartTime },
            },
          },
        },
        data: {
          blockStartTime,
          blockEndTime,
          blockReason: 'University Open Day - Campus Tour & Showcase',
          blockStatus: RoomBlockStatus.ACTIVE,
          blockCreatedById: managerUser.id,
          scheduleVersion: { increment: 1 },
        },
      });
    }
  }
}

if (import.meta.main) {
  await runSeed();
  console.info('Seed completed');
}
