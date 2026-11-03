import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users/me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.me(user.id);
  }

  @Roles(Role.ADMIN)
  @Get('admin/users')
  list(@Query() query: ListUsersDto) {
    return this.users.list(query);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/users/:id/role')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.updateRole(id, dto, actor.id);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/users/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.updateStatus(id, dto, actor.id);
  }
}
