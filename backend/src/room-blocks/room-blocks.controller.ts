import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { Role } from '../generated/prisma/client.js';
import { CreateRoomBlockDto } from './dto/create-room-block.dto.js';
import { ListRoomBlocksDto } from './dto/list-room-blocks.dto.js';
import { RoomBlocksService } from './room-blocks.service.js';

@ApiTags('room-blocks')
@ApiBearerAuth()
@Roles(Role.MANAGER, Role.ADMIN)
@Controller('manager/room-blocks')
export class RoomBlocksController {
  constructor(private readonly roomBlocks: RoomBlocksService) {}

  @Get()
  list(@Query() query: ListRoomBlocksDto) {
    return this.roomBlocks.list(query);
  }

  @Post()
  create(@Body() dto: CreateRoomBlockDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.roomBlocks.create(dto, actor.id);
  }

  @Patch(':roomId/cancel')
  cancel(@Param('roomId', ParseUUIDPipe) roomId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.roomBlocks.cancel(roomId, actor.id);
  }
}
