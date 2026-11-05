import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import {
  BookingStatus,
  Prisma,
  PrismaClient,
  Role,
  Room,
  RoomBlockStatus,
  UserStatus,
} from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

type SeedAccount = {
  email: string;
  fullName: string;
  passwordHash: string;
  role: Role;
  studentCode?: string;
};

async function upsertAccount(account: SeedAccount) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existing = await tx.user.findUnique({
      where: { email: account.email },
      select: { id: true },
    });
    if (!existing) {
      if (account.role === Role.USER && account.studentCode) {
        await tx.studentProfile.deleteMany({
          where: { studentCode: account.studentCode },
        });
      }
      const profile =
        account.role === Role.USER
          ? { studentProfile: { create: { studentCode: account.studentCode! } } }
          : account.role === Role.MANAGER
            ? { managerProfile: { create: {} } }
            : { adminProfile: { create: {} } };
      return tx.user.create({
        data: {
          email: account.email,
          fullName: account.fullName,
          passwordHash: account.passwordHash,
          role: account.role,
          status: UserStatus.ACTIVE,
          ...profile,
        },
      });
    }

    await tx.studentProfile.deleteMany({ where: { userId: existing.id } });
    await tx.managerProfile.deleteMany({ where: { userId: existing.id } });
    await tx.adminProfile.deleteMany({ where: { userId: existing.id } });
    await tx.user.update({
      where: { id: existing.id },
      data: {
        role: account.role,
        status: UserStatus.ACTIVE,
        fullName: account.fullName,
        passwordHash: account.passwordHash,
      },
    });
    if (account.role === Role.USER && account.studentCode) {
      await tx.studentProfile.deleteMany({
        where: { studentCode: account.studentCode, userId: { not: existing.id } },
      });
      await tx.studentProfile.create({
        data: { userId: existing.id, studentCode: account.studentCode },
      });
    } else if (account.role === Role.MANAGER) {
      await tx.managerProfile.create({ data: { userId: existing.id } });
    } else {
      await tx.adminProfile.create({ data: { userId: existing.id } });
    }
    return tx.user.findUniqueOrThrow({ where: { id: existing.id } });
  });
}

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "app"."bookings" DROP CONSTRAINT IF EXISTS "bookings_no_active_overlap";
    ALTER TABLE "app"."bookings"
      ADD CONSTRAINT "bookings_no_active_overlap"
      EXCLUDE USING GIST (
        "room_id" WITH =,
        tstzrange("start_time", "end_time", '[)') WITH &&
      )
      WHERE (
        "status" IN (
          'APPROVED'::"app"."BookingStatus",
          'KEY_CHECKED_OUT'::"app"."BookingStatus"
        )
      );
  `);

  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@tne.edu.vn').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin12345678!';
  if (adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
  }
  const adminFullName = process.env.ADMIN_FULL_NAME ?? 'Giang Pham';
  const adminHash = await argon2.hash(adminPassword, { type: argon2.argon2id });

  const managerPassword = process.env.DEMO_PASSWORD ?? 'Manager123456!';
  const managerHash = await argon2.hash(managerPassword, { type: argon2.argon2id });

  const studentPassword = 'Student123456!';
  const studentHash = await argon2.hash(studentPassword, { type: argon2.argon2id });

  // 1. Primary accounts
  await upsertAccount({
    email: adminEmail,
    passwordHash: adminHash,
    fullName: adminFullName,
    role: Role.ADMIN,
  });

  await upsertAccount({
    email: 'manager@tne.edu.vn',
    passwordHash: managerHash,
    fullName: 'Duc Tran',
    role: Role.MANAGER,
  });

  await upsertAccount({
    email: 'student@tne.edu.vn',
    passwordHash: studentHash,
    fullName: 'Linh Nguyen',
    role: Role.USER,
    studentCode: 'SE184022',
  });

  await upsertAccount({
    email: 'student2@tne.edu.vn',
    passwordHash: studentHash,
    fullName: 'Minh Tran',
    role: Role.USER,
    studentCode: 'SE184105',
  });

  // 2. Demo & Alias accounts
  await upsertAccount({
    email: 'admin@tne.local',
    passwordHash: adminHash,
    fullName: 'Giang Pham (Admin)',
    role: Role.ADMIN,
  });

  await upsertAccount({
    email: 'g.pham@uts-tne.edu.vn',
    passwordHash: adminHash,
    fullName: 'Giang Pham',
    role: Role.ADMIN,
  });

  await upsertAccount({
    email: 'manager@tne.local',
    passwordHash: managerHash,
    fullName: 'Duc Tran',
    role: Role.MANAGER,
  });

  await upsertAccount({
    email: 'd.tran@uts-tne.edu.vn',
    passwordHash: managerHash,
    fullName: 'Duc Tran',
    role: Role.MANAGER,
  });

  await upsertAccount({
    email: 'student@tne.local',
    passwordHash: studentHash,
    fullName: 'Linh Nguyen (Demo)',
    role: Role.USER,
    studentCode: 'DEMO001',
  });

  await upsertAccount({
    email: 'linh.nguyen@student.uts.edu.au',
    passwordHash: studentHash,
    fullName: 'Linh Nguyen',
    role: Role.USER,
    studentCode: 'SE184023',
  });

  if (process.env.SEED_DEMO_USERS === 'true') {
    await upsertAccount({
      email: 'student3@tne.edu.vn',
      passwordHash: studentHash,
      fullName: 'Anh Vo',
      role: Role.USER,
      studentCode: 'SE170311',
    });
    await upsertAccount({
      email: 'student4@tne.edu.vn',
      passwordHash: studentHash,
      fullName: 'Khoa Dang',
      role: Role.USER,
      studentCode: 'SE161907',
    });
  }

  // 3. Rooms (Strictly 3 official rooms, no auto-approve)
  const officialRoomNames = ['Seminar Hall 601', 'Studio Room 602', 'Lecture Theatre 605'];

  await prisma.bookingStatusHistory.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.room.deleteMany({
    where: {
      name: { notIn: officialRoomNames },
    },
  });

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
      update: room,
      create: room,
    });
    upsertedRooms[room.name] = res;
  }

  // 4. System Settings
  await prisma.systemSetting.upsert({
    where: { id: 'default' },
    update: {
      openTime: '08:00',
      closeTime: '17:00',
      maxDurationMinutes: 240,
      maxAdvanceDays: 7,
      maxActiveBookingsPerUser: 3,
    },
    create: {
      id: 'default',
      openTime: '08:00',
      closeTime: '17:00',
      maxDurationMinutes: 240,
      maxAdvanceDays: 7,
      maxActiveBookingsPerUser: 3,
    },
  });

  // 5. Rich sample bookings & block
  if (process.env.SEED_DEMO_USERS === 'true') {
    const studentUser = await prisma.user.findUnique({
      where: { email: 'student@tne.edu.vn' },
    });
    const student2User = await prisma.user.findUnique({
      where: { email: 'student2@tne.edu.vn' },
    });
    const managerUser = await prisma.user.findUnique({
      where: { email: 'manager@tne.edu.vn' },
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

      for (const sb of sampleBookings) {
        await prisma.booking.upsert({
          where: { passCode: sb.passCode },
          update: sb,
          create: sb,
        });
      }

      await prisma.room.update({
        where: { id: r605.id },
        data: {
          blockStartTime: atWorkday(4, 8, 0), // Friday 08:00
          blockEndTime: atWorkday(4, 12, 0), // Friday 12:00
          blockReason: 'University Open Day - Campus Tour & Showcase',
          blockStatus: RoomBlockStatus.ACTIVE,
          blockCreatedById: managerUser.id,
          blockCancelledById: null,
          blockCancelledAt: null,
        },
      });
    }
  }
}

await main()
  .then(() => console.info('Seed completed'))
  .finally(() => prisma.$disconnect());
