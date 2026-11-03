import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../generated/prisma/client.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { AuditService } from './audit.service.js';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto.js';

@ApiTags('audit')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() query: ListAuditLogsDto) {
    return this.audit.list(query);
  }
}
