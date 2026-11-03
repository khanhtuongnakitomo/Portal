import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Prisma, UserStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

const safeUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  studentProfile: { select: { studentCode: true } },
} as const;

type SafeUserRecord = Prisma.UserGetPayload<{ select: typeof safeUserSelect }>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const studentCode = dto.studentCode.trim().toUpperCase();
    const [emailExists, studentCodeExists] = await Promise.all([
      this.prisma.user.findUnique({ where: { email }, select: { id: true } }),
      this.prisma.studentProfile.findUnique({
        where: { studentCode },
        select: { userId: true },
      }),
    ]);
    if (emailExists || studentCodeExists) {
      throw new ConflictException('Email or student code is already registered');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName.trim(),
        passwordHash,
        studentProfile: { create: { studentCode } },
        auditLogs: {
          create: { action: 'USER_REGISTERED', targetType: 'User', targetId: email },
        },
      },
      select: safeUserSelect,
    });
    return this.issueAccess(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      include: { studentProfile: { select: { studentCode: true } } },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is suspended');
    }
    return this.issueAccess(user);
  }

  private async issueAccess(user: SafeUserRecord) {
    const publicUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      studentCode: user.studentProfile?.studentCode ?? null,
      role: user.role,
      status: user.status,
    };
    const payload: JwtPayload = { sub: user.id, email: user.email, type: 'access' };
    const expiresIn = this.config.get<number>('JWT_ACCESS_TTL_SECONDS', 28_800);
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn,
      issuer: this.config.get<string>('JWT_ISSUER', 'tne-portal-api'),
      audience: this.config.get<string>('JWT_AUDIENCE', 'tne-portal-client'),
    });
    return { accessToken, expiresIn, user: publicUser };
  }
}
