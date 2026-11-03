import { Module } from '@nestjs/common';
import { RoomBlocksController } from './room-blocks.controller.js';
import { RoomBlocksService } from './room-blocks.service.js';

@Module({ controllers: [RoomBlocksController], providers: [RoomBlocksService] })
export class RoomBlocksModule {}
