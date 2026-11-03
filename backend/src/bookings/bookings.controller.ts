import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../generated/prisma/client.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';
import { BookingsService } from './bookings.service.js';
import { CalendarQueryDto } from './dto/calendar-query.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { ListBookingsDto } from './dto/list-bookings.dto.js';
import { ManagerDayQueryDto } from './dto/manager-day-query.dto.js';
import { RejectBookingDto, ReviewBookingDto } from './dto/review-booking.dto.js';

@ApiTags('bookings')
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Public()
  @Get('bookings/calendar')
  calendar(@Query() query: CalendarQueryDto) {
    return this.bookings.calendar(query);
  }

  @ApiBearerAuth()
  @Post('bookings')
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.create(dto, user.id);
  }

  @ApiBearerAuth()
  @Get('bookings/me')
  mine(@CurrentUser() user: AuthenticatedUser, @Query() query: ListBookingsDto) {
    return this.bookings.mine(user.id, query);
  }

  @ApiBearerAuth()
  @Get('bookings/:id/pass')
  digitalPass(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.digitalPass(id, user);
  }

  @ApiBearerAuth()
  @Get('bookings/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.findOne(id, user);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Patch('bookings/:id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.cancel(id, user, dto.note);
  }

  @ApiBearerAuth()
  @Roles(Role.MANAGER, Role.ADMIN)
  @Get('manager/bookings/today')
  managerDay(@Query() query: ManagerDayQueryDto) {
    return this.bookings.managerDay(query);
  }

  @ApiBearerAuth()
  @Roles(Role.MANAGER, Role.ADMIN)
  @Get('manager/bookings/overdue-keys')
  overdueKeys() {
    return this.bookings.overdueKeys();
  }

  @ApiBearerAuth()
  @Roles(Role.MANAGER, Role.ADMIN)
  @Get('manager/bookings')
  managerList(@Query() query: ListBookingsDto) {
    return this.bookings.managerList(query);
  }

  @ApiBearerAuth()
  @Roles(Role.MANAGER, Role.ADMIN)
  @Patch('manager/bookings/:id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewBookingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookings.approve(id, actor.id, dto.note);
  }

  @ApiBearerAuth()
  @Roles(Role.MANAGER, Role.ADMIN)
  @Patch('manager/bookings/:id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectBookingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookings.reject(id, actor.id, dto.note);
  }

  @ApiBearerAuth()
  @Roles(Role.MANAGER, Role.ADMIN)
  @Patch('manager/bookings/:id/key-checkout')
  checkoutKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewBookingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookings.checkoutKey(id, actor.id, dto.note);
  }

  @ApiBearerAuth()
  @Roles(Role.MANAGER, Role.ADMIN)
  @Patch('manager/bookings/:id/key-return')
  returnKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewBookingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.bookings.returnKey(id, actor.id, dto.note);
  }
}
