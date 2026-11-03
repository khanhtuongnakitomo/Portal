import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { CreateRoomDto } from './dto/create-room.dto.js';
import { UpdateRoomDto } from './dto/update-room.dto.js';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto.js';
import { RoomsService } from './rooms.service.js';

@ApiTags('rooms')
@Controller()
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Public()
  @Get('rooms')
  listPublic() {
    return this.rooms.listPublic();
  }

  @Public()
  @Get('rooms/:id')
  findPublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.rooms.findPublic(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('admin/rooms')
  listAdmin() {
    return this.rooms.listAdmin();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('admin/rooms')
  create(@Body() dto: CreateRoomDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.rooms.create(dto, actor.id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('admin/rooms/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rooms.update(id, dto, actor.id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('admin/rooms/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rooms.updateStatus(id, dto, actor.id);
  }
}
