import { BadRequestException } from '../common/http-exceptions.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpdateSettingsDto } from './dto/update-settings.dto.js';

export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.systemSetting.findUniqueOrThrow({ where: { id: 'default' } });
  }

  async update(dto: UpdateSettingsDto, actorId: string) {
    if (dto.timezone) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: dto.timezone }).format();
      } catch {
        throw new BadRequestException('Invalid IANA timezone');
      }
    }
    const current = await this.get();
    const openTime = dto.openTime ?? current.openTime.trim();
    const closeTime = dto.closeTime ?? current.closeTime.trim();
    if (this.toMinutes(openTime) >= this.toMinutes(closeTime)) {
      throw new BadRequestException('openTime must be earlier than closeTime');
    }

    return this.prisma.$transaction(async (tx) => {
      const settings = await tx.systemSetting.update({
        where: { id: 'default' },
        data: { ...dto, updatedById: actorId },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'SYSTEM_SETTINGS_UPDATED',
          targetType: 'SystemSetting',
          targetId: 'default',
          metadata: { ...dto },
        },
      });
      return settings;
    });
  }

  private toMinutes(value: string) {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }
}
