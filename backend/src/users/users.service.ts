import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListUsersDto } from './dto/list-users.dto.js';
import type { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import type { UpdateUserStatusDto } from './dto/update-user-status.dto.js';

const publicUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  studentProfile: { select: { studentCode: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: publicUserSelect,
    });
    return this.toPublicUser(user);
  }

  async list(query: ListUsersDto) {
    const search = query.search?.trim();
    const where = {
      role: query.role,
      status: query.status,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { fullName: { contains: search, mode: 'insensitive' as const } },
              {
                studentProfile: {
                  is: { studentCode: { contains: search, mode: 'insensitive' as const } },
                },
              },
            ],
          }
        : {}),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: users.map((user) => this.toPublicUser(user)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async updateRole(targetId: string, dto: UpdateUserRoleDto, actorId: string) {
    if (targetId === actorId) throw new BadRequestException('You cannot change your own role');
    await this.ensureExists(targetId);

    const studentCode = dto.studentCode?.trim().toUpperCase();
    if (dto.role === Role.USER && !studentCode) {
      throw new BadRequestException('studentCode is required for USER accounts');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.studentProfile.deleteMany({ where: { userId: targetId } });
      await tx.managerProfile.deleteMany({ where: { userId: targetId } });
      await tx.adminProfile.deleteMany({ where: { userId: targetId } });

      await tx.user.update({ where: { id: targetId }, data: { role: dto.role } });
      if (dto.role === Role.USER) {
        await tx.studentProfile.create({ data: { userId: targetId, studentCode: studentCode! } });
      } else if (dto.role === Role.MANAGER) {
        await tx.managerProfile.create({ data: { userId: targetId } });
      } else {
        await tx.adminProfile.create({ data: { userId: targetId } });
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'USER_ROLE_CHANGED',
          targetType: 'User',
          targetId,
          metadata: { role: dto.role, ...(studentCode ? { studentCode } : {}) },
        },
      });
      const user = await tx.user.findUniqueOrThrow({
        where: { id: targetId },
        select: publicUserSelect,
      });
      return this.toPublicUser(user);
    });
  }

  async updateStatus(targetId: string, dto: UpdateUserStatusDto, actorId: string) {
    if (targetId === actorId) throw new BadRequestException('You cannot change your own status');
    await this.ensureExists(targetId);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetId },
        data: { status: dto.status },
        select: publicUserSelect,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'USER_STATUS_CHANGED',
          targetType: 'User',
          targetId,
          metadata: { status: dto.status },
        },
      });
      return this.toPublicUser(user);
    });
  }

  private async ensureExists(id: string) {
    if (!(await this.prisma.user.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('User not found');
    }
  }

  private toPublicUser<T extends { studentProfile: { studentCode: string } | null }>(
    user: T,
  ): Omit<T, 'studentProfile'> & { studentCode: string | null } {
    const { studentProfile, ...rest } = user;
    return { ...rest, studentCode: studentProfile?.studentCode ?? null };
  }
}
