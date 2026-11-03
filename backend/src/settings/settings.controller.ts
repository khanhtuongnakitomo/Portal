import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('settings')
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('settings')
  get() {
    return this.settings.get();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('admin/settings')
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.settings.update(dto, actor.id);
  }
}
