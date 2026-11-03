import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { Prisma, PrismaClient, Role, UserStatus } from '../src/generated/prisma/client.js';

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
      data: { role: account.role, status: UserStatus.ACTIVE, fullName: account.fullName },
    });
    if (account.role === Role.USER) {
      await tx.studentProfile.create({
        data: { userId: existing.id, studentCode: account.studentCode! },
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
  const email = (process.env.ADMIN_EMAIL ?? 'admin@tne.local').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'ChangeMe123!';
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters');

  await upsertAccount({
    email,
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    fullName: process.env.ADMIN_FULL_NAME ?? 'TNE Administrator',
    role: Role.ADMIN,
  });

  if (process.env.SEED_DEMO_USERS === 'true') {
    const demoPassword = process.env.DEMO_PASSWORD ?? 'Demo12345678!';
    if (demoPassword.length < 12) {
      throw new Error('DEMO_PASSWORD must contain at least 12 characters');
    }
    const demoPasswordHash = await argon2.hash(demoPassword, { type: argon2.argon2id });
    await upsertAccount({
      email: 'manager@tne.local',
      passwordHash: demoPasswordHash,
      fullName: 'Demo Student Manager',
      role: Role.MANAGER,
    });
    await upsertAccount({
      email: 'student@tne.local',
      passwordHash: demoPasswordHash,
      fullName: 'Demo Student',
      role: Role.USER,
      studentCode: 'DEMO001',
    });
  }

  const rooms = [
    { name: 'Room 1', location: 'TNE Floor', capacity: 12 },
    { name: 'Room 2', location: 'TNE Floor', capacity: 20 },
    { name: 'Room 3', location: 'TNE Floor', capacity: 30 },
  ];
  for (const room of rooms) {
    await prisma.room.upsert({
      where: { name: room.name },
      update: room,
      create: room,
    });
  }

  await prisma.systemSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
}

await main()
  .then(() => console.info('Seed completed'))
  .finally(() => prisma.$disconnect());
