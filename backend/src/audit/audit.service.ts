import { PrismaService } from '../prisma/prisma.service.js';
import type { ListAuditLogsDto } from './dto/list-audit-logs.dto.js';

export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListAuditLogsDto) {
    const where = { action: query.action, targetType: query.targetType };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }
}
