import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import type { AuthService } from '../auth/auth.service.js';
import { ConflictException, NotFoundException } from '../common/http-exceptions.js';
import { type Prisma, Role, UserStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { generateMockSchedule } from './mock-schedule.js';

const devAccounts = {
  [Role.USER]: { email: 'dev.student@dev.local', fullName: 'Dev Student', studentCode: 'DEV0001' },
  [Role.MANAGER]: { email: 'dev.manager@dev.local', fullName: 'Dev Manager' },
  [Role.ADMIN]: { email: 'dev.admin@dev.local', fullName: 'Dev Admin' },
};
const devEmails = Object.values(devAccounts).map(({ email }) => email);
const mockDomain = '@mock.dev.local';
const mockStaff = { email: `mock.staff${mockDomain}`, fullName: 'Nguyễn Minh — Mock Staff' };
const mockStudents = [
  'Nguyễn Hà Linh',
  'Trần Đức Minh',
  'Lê Phương Anh',
  'Phạm Tuấn Kiệt',
  'Võ Ngọc Mai',
  'Đặng Hoàng Nam',
].map((fullName, index) => {
  const number = String(index + 1).padStart(3, '0');
  return { fullName, email: `student${number}${mockDomain}`, studentCode: `MOCK${number}` };
});
const accountSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  studentProfile: { select: { studentCode: true } },
} as const;

type AccountSpec = { email: string; fullName: string; studentCode?: string };
type LoginTarget = { role: Role } | { userId: string };

function unusablePasswordHash() {
  return argon2.hash(randomBytes(32), { type: argon2.argon2id });
}

function createAccount(
  tx: Prisma.TransactionClient,
  account: AccountSpec,
  role: Role,
  passwordHash: string,
) {
  return tx.user.create({
    data: {
      email: account.email,
      fullName: account.fullName,
      role,
      passwordHash,
      studentProfile: account.studentCode
        ? { create: { studentCode: account.studentCode } }
        : undefined,
      managerProfile: role === Role.MANAGER ? { create: {} } : undefined,
      adminProfile: role === Role.ADMIN ? { create: {} } : undefined,
    },
    select: accountSelect,
  });
}

// Serialize local mutations across app instances. The room schedule locks are separate.
async function lockDevTools(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(1728607214)::text`;
}

async function getDevAccount(tx: Prisma.TransactionClient, role: Role) {
  const account: AccountSpec = devAccounts[role];
  const existing = await tx.user.findUnique({
    where: { email: account.email },
    select: accountSelect,
  });
  if (!existing) return createAccount(tx, account, role, await unusablePasswordHash());
  if (existing.role !== role || existing.studentProfile?.studentCode !== account.studentCode) {
    throw new ConflictException('Developer account identity is already in use');
  }
  return existing;
}

export class DevService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async accounts() {
    const mockStudentsFilter = { email: { endsWith: mockDomain }, role: Role.USER };
    const active = { status: UserStatus.ACTIVE };
    const [dev, mock, other] = await Promise.all([
      this.prisma.user.findMany({
        where: { ...active, email: { in: devEmails } },
        orderBy: { email: 'asc' },
        select: accountSelect,
      }),
      this.prisma.user.findMany({
        where: { ...active, ...mockStudentsFilter },
        orderBy: { email: 'asc' },
        select: accountSelect,
      }),
      this.prisma.user.findMany({
        where: { ...active, email: { notIn: devEmails }, NOT: mockStudentsFilter },
        orderBy: { email: 'asc' },
        take: 50,
        select: accountSelect,
      }),
    ]);
    return [...dev, ...mock, ...other].map(({ id, email, fullName, role, studentProfile }) => ({
      id,
      email,
      fullName,
      role,
      studentCode: studentProfile?.studentCode ?? null,
      kind: devEmails.includes(email) ? 'DEV' : email.endsWith(mockDomain) ? 'MOCK' : 'USER',
    }));
  }

  async login(target: LoginTarget) {
    return this.prisma.$transaction(async (tx) => {
      await lockDevTools(tx);
      const user =
        'role' in target
          ? await getDevAccount(tx, target.role)
          : await tx.user.findUnique({ where: { id: target.userId }, select: accountSelect });
      if (user?.status !== UserStatus.ACTIVE)
        throw new NotFoundException('Active account not found');

      await tx.auditLog.create({
        data: { actorId: user.id, action: 'DEV_LOGIN', targetType: 'User', targetId: user.id },
      });
      return this.auth.issueAccess(user);
    });
  }

  async generateMockData(days: number) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockDevTools(tx);
        const known = await tx.user.findMany({
          where: { email: { in: [...mockStudents.map(({ email }) => email), mockStaff.email] } },
          select: accountSelect,
        });
        const byEmail = new Map(known.map((user) => [user.email, user]));
        let passwordHash: string | undefined;
        let students = 0;
        const ensureMock = async (account: AccountSpec, role: Role) => {
          const existing = byEmail.get(account.email);
          if (existing) {
            if (
              existing.role !== role ||
              existing.status !== UserStatus.ACTIVE ||
              existing.studentProfile?.studentCode !== account.studentCode
            ) {
              throw new ConflictException(
                `Mock account identity is not available: ${account.email}`,
              );
            }
            return existing.id;
          }
          passwordHash ??= await unusablePasswordHash();
          const user = await createAccount(tx, account, role, passwordHash);
          if (role === Role.USER) students += 1;
          return user.id;
        };
        const studentIds: string[] = [];
        for (const student of mockStudents) studentIds.push(await ensureMock(student, Role.USER));
        const staffId = await ensureMock(mockStaff, Role.MANAGER);
        const { skipped, ...schedule } = await generateMockSchedule(tx, days, studentIds, staffId);
        return { created: { students, ...schedule }, skipped };
      },
      { timeout: 30_000 },
    );
  }

  async clearMockData() {
    return this.prisma.$transaction(async (tx) => {
      await lockDevTools(tx);
      const mock = await tx.user.findMany({
        where: { email: { endsWith: mockDomain } },
        select: { id: true },
      });
      const mockIds = mock.map(({ id }) => id);
      const bookings = await tx.booking.deleteMany({
        where: { user: { OR: [{ email: { in: devEmails } }, { id: { in: mockIds } }] } },
      });
      const blocks = await tx.room.updateMany({
        where: { blockCreatedById: { in: mockIds } },
        data: {
          blockStartTime: null,
          blockEndTime: null,
          blockReason: null,
          blockStatus: null,
          blockCreatedById: null,
          blockCancelledById: null,
          blockCancelledAt: null,
          scheduleVersion: { increment: 1 },
        },
      });
      const referenced = await tx.user.findFirst({
        where: {
          id: { in: mockIds },
          OR: [
            { statusHistory: { some: {} } },
            { roomBlocksCancelled: { some: {} } },
            { reviewedBookings: { some: {} } },
            { keyCheckouts: { some: {} } },
            { keyReturns: { some: {} } },
            { auditLogs: { some: {} } },
            { settingsUpdates: { some: {} } },
          ],
        },
        select: { id: true },
      });
      // Preserve surviving records while releasing their references to disposable accounts.
      if (referenced) {
        const { id: adminId } = await getDevAccount(tx, Role.ADMIN);
        const mock = { in: mockIds };
        await tx.bookingStatusHistory.updateMany({
          where: { changedById: mock },
          data: { changedById: adminId },
        });
        await tx.room.updateMany({
          where: { blockCancelledById: mock },
          data: { blockCancelledById: adminId },
        });
        await tx.booking.updateMany({
          where: { reviewedById: mock },
          data: { reviewedById: adminId },
        });
        await tx.booking.updateMany({
          where: { keyCheckedOutById: mock },
          data: { keyCheckedOutById: adminId },
        });
        await tx.booking.updateMany({
          where: { keyReturnedById: mock },
          data: { keyReturnedById: adminId },
        });
        await tx.auditLog.updateMany({
          where: { actorId: mock },
          data: { actorId: adminId },
        });
        await tx.systemSetting.updateMany({
          where: { updatedById: mock },
          data: { updatedById: adminId },
        });
      }
      const users = await tx.user.deleteMany({ where: { id: { in: mockIds } } });
      return { deleted: { bookings: bookings.count, users: users.count, blocks: blocks.count } };
    });
  }
}
