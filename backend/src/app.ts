import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { AuditService } from './audit/audit.service.js';
import { ListAuditLogsDto } from './audit/dto/list-audit-logs.dto.js';
import { AuthService } from './auth/auth.service.js';
import { LoginDto } from './auth/dto/login.dto.js';
import { RegisterDto } from './auth/dto/register.dto.js';
import { BookingsService } from './bookings/bookings.service.js';
import { CalendarQueryDto } from './bookings/dto/calendar-query.dto.js';
import { CreateBookingDto } from './bookings/dto/create-booking.dto.js';
import { ListBookingsDto } from './bookings/dto/list-bookings.dto.js';
import { ManagerDayQueryDto } from './bookings/dto/manager-day-query.dto.js';
import { RejectBookingDto, ReviewBookingDto } from './bookings/dto/review-booking.dto.js';
import { ServiceUnavailableException } from './common/http-exceptions.js';
import { validateDto, validateUuid } from './common/validate.js';
import { Role } from './generated/prisma/client.js';
import { createAuthMiddleware } from './middleware/auth.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { CreateRoomBlockDto } from './room-blocks/dto/create-room-block.dto.js';
import { ListRoomBlocksDto } from './room-blocks/dto/list-room-blocks.dto.js';
import { RoomBlocksService } from './room-blocks/room-blocks.service.js';
import { CreateRoomDto } from './rooms/dto/create-room.dto.js';
import { UpdateRoomStatusDto } from './rooms/dto/update-room-status.dto.js';
import { UpdateRoomDto } from './rooms/dto/update-room.dto.js';
import { RoomsService } from './rooms/rooms.service.js';
import { UpdateSettingsDto } from './settings/dto/update-settings.dto.js';
import { SettingsService } from './settings/settings.service.js';
import { CreateManagerDto } from './users/dto/create-manager.dto.js';
import { ListUsersDto } from './users/dto/list-users.dto.js';
import { UpdateUserRoleDto } from './users/dto/update-user-role.dto.js';
import { UpdateUserStatusDto } from './users/dto/update-user-status.dto.js';
import { UsersService } from './users/users.service.js';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

function wrap(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function createApp(customPrisma?: PrismaService): { app: Express; prisma: PrismaService } {
  const prisma = customPrisma ?? new PrismaService();
  const authService = new AuthService(prisma);
  const usersService = new UsersService(prisma);
  const roomsService = new RoomsService(prisma);
  const notificationsService = new NotificationsService();
  const bookingsService = new BookingsService(prisma, notificationsService);
  const roomBlocksService = new RoomBlocksService(prisma, notificationsService);
  const settingsService = new SettingsService(prisma);
  const auditService = new AuditService(prisma);

  const { authenticate, requireRoles } = createAuthMiddleware(prisma);

  const app: Express = express();
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  const router = express.Router();

  // Health
  router.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get(
    '/health/ready',
    wrap(async (_req, res) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok', database: 'up' });
      } catch {
        throw new ServiceUnavailableException('Database is unavailable');
      }
    }),
  );

  // Auth
  router.post(
    '/auth/register',
    wrap(async (req, res) => {
      const dto = await validateDto(RegisterDto, req.body);
      const result = await authService.register(dto);
      res.status(201).json(result);
    }),
  );

  router.post(
    '/auth/login',
    wrap(async (req, res) => {
      const dto = await validateDto(LoginDto, req.body);
      const result = await authService.login(dto);
      res.status(200).json(result);
    }),
  );

  // Users
  router.get(
    '/users/me',
    authenticate,
    wrap(async (req, res) => {
      const result = await usersService.me(req.user!.id);
      res.json(result);
    }),
  );

  router.get(
    '/admin/users',
    authenticate,
    requireRoles(Role.ADMIN),
    wrap(async (req, res) => {
      const dto = await validateDto(ListUsersDto, req.query);
      const result = await usersService.list(dto);
      res.json(result);
    }),
  );

  router.post(
    '/admin/users/manager',
    authenticate,
    requireRoles(Role.ADMIN),
    wrap(async (req, res) => {
      const dto = await validateDto(CreateManagerDto, req.body);
      const result = await usersService.createManager(dto, req.user!.id);
      res.status(201).json(result);
    }),
  );

  router.patch(
    '/admin/users/:id/role',
    authenticate,
    requireRoles(Role.ADMIN),
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const dto = await validateDto(UpdateUserRoleDto, req.body);
      const result = await usersService.updateRole(id, dto, req.user!.id);
      res.json(result);
    }),
  );

  router.patch(
    '/admin/users/:id/status',
    authenticate,
    requireRoles(Role.ADMIN),
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const dto = await validateDto(UpdateUserStatusDto, req.body);
      const result = await usersService.updateStatus(id, dto, req.user!.id);
      res.json(result);
    }),
  );

  // Rooms
  router.get(
    '/rooms',
    wrap(async (_req, res) => {
      const result = await roomsService.listPublic();
      res.json(result);
    }),
  );

  router.get(
    '/rooms/:id',
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const result = await roomsService.findPublic(id);
      res.json(result);
    }),
  );

  router.get(
    '/admin/rooms',
    authenticate,
    requireRoles(Role.ADMIN),
    wrap(async (_req, res) => {
      const result = await roomsService.listAdmin();
      res.json(result);
    }),
  );

  router.post(
    '/admin/rooms',
    authenticate,
    requireRoles(Role.ADMIN),
    wrap(async (req, res) => {
      const dto = await validateDto(CreateRoomDto, req.body);
      const result = await roomsService.create(dto, req.user!.id);
      res.status(201).json(result);
    }),
  );

  router.patch(
    '/admin/rooms/:id',
    authenticate,
    requireRoles(Role.ADMIN),
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const dto = await validateDto(UpdateRoomDto, req.body);
      const result = await roomsService.update(id, dto, req.user!.id);
      res.json(result);
    }),
  );

  router.patch(
    '/admin/rooms/:id/status',
    authenticate,
    requireRoles(Role.ADMIN),
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const dto = await validateDto(UpdateRoomStatusDto, req.body);
      const result = await roomsService.updateStatus(id, dto, req.user!.id);
      res.json(result);
    }),
  );

  // Bookings
  router.get(
    '/bookings/calendar',
    wrap(async (req, res) => {
      const dto = await validateDto(CalendarQueryDto, req.query);
      const result = await bookingsService.calendar(dto);
      res.json(result);
    }),
  );

  router.post(
    '/bookings',
    authenticate,
    wrap(async (req, res) => {
      const dto = await validateDto(CreateBookingDto, req.body);
      const result = await bookingsService.create(dto, req.user!);
      res.status(201).json(result);
    }),
  );

  router.get(
    '/bookings/me',
    authenticate,
    wrap(async (req, res) => {
      const dto = await validateDto(ListBookingsDto, req.query);
      const result = await bookingsService.mine(req.user!.id, dto);
      res.json(result);
    }),
  );

  router.get(
    '/bookings/:id/pass',
    authenticate,
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const result = await bookingsService.digitalPass(id, req.user!);
      res.json(result);
    }),
  );

  router.get(
    '/bookings/:id',
    authenticate,
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const result = await bookingsService.findOne(id, req.user!);
      res.json(result);
    }),
  );

  router.patch(
    '/bookings/:id/cancel',
    authenticate,
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const dto = await validateDto(ReviewBookingDto, req.body);
      const result = await bookingsService.cancel(id, req.user!, dto.note);
      res.status(200).json(result);
    }),
  );

  router.get(
    '/manager/bookings/today',
    authenticate,
    requireRoles(Role.MANAGER, Role.ADMIN),
    wrap(async (req, res) => {
      const dto = await validateDto(ManagerDayQueryDto, req.query);
      const result = await bookingsService.managerDay(dto);
      res.json(result);
    }),
  );

  router.get(
    '/manager/bookings/overdue-keys',
    authenticate,
    requireRoles(Role.MANAGER, Role.ADMIN),
    wrap(async (_req, res) => {
      const result = await bookingsService.overdueKeys();
      res.json(result);
    }),
  );

  router.get(
    '/manager/bookings',
    authenticate,
    requireRoles(Role.MANAGER, Role.ADMIN),
    wrap(async (req, res) => {
      const dto = await validateDto(ListBookingsDto, req.query);
      const result = await bookingsService.managerList(dto);
      res.json(result);
    }),
  );

  router.patch(
    '/manager/bookings/:id/approve',
    authenticate,
    requireRoles(Role.MANAGER, Role.ADMIN),
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const dto = await validateDto(ReviewBookingDto, req.body);
      const result = await bookingsService.approve(id, req.user!.id, dto.note);
      res.json(result);
    }),
  );

  router.patch(
    '/manager/bookings/:id/reject',
    authenticate,
    requireRoles(Role.MANAGER, Role.ADMIN),
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const dto = await validateDto(RejectBookingDto, req.body);
      const result = await bookingsService.reject(id, req.user!.id, dto.note);
      res.json(result);
    }),
  );

  router.patch(
    '/manager/bookings/:id/key-checkout',
    authenticate,
    requireRoles(Role.MANAGER, Role.ADMIN),
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const dto = await validateDto(ReviewBookingDto, req.body);
      const result = await bookingsService.checkoutKey(id, req.user!.id, dto.note);
      res.json(result);
    }),
  );

  router.patch(
    '/manager/bookings/:id/key-return',
    authenticate,
    requireRoles(Role.MANAGER, Role.ADMIN),
    wrap(async (req, res) => {
      const id = validateUuid(req.params.id);
      const dto = await validateDto(ReviewBookingDto, req.body);
      const result = await bookingsService.returnKey(id, req.user!.id, dto.note);
      res.json(result);
    }),
  );

  // Room Blocks
  router.get(
    '/manager/room-blocks',
    authenticate,
    requireRoles(Role.MANAGER, Role.ADMIN),
    wrap(async (req, res) => {
      const dto = await validateDto(ListRoomBlocksDto, req.query);
      const result = await roomBlocksService.list(dto);
      res.json(result);
    }),
  );

  router.post(
    '/manager/room-blocks',
    authenticate,
    requireRoles(Role.MANAGER, Role.ADMIN),
    wrap(async (req, res) => {
      const dto = await validateDto(CreateRoomBlockDto, req.body);
      const result = await roomBlocksService.create(dto, req.user!.id);
      res.status(201).json(result);
    }),
  );

  router.patch(
    '/manager/room-blocks/:roomId/cancel',
    authenticate,
    requireRoles(Role.MANAGER, Role.ADMIN),
    wrap(async (req, res) => {
      const roomId = validateUuid(req.params.roomId, 'roomId');
      const result = await roomBlocksService.cancel(roomId, req.user!.id);
      res.json(result);
    }),
  );

  // Settings
  router.get(
    '/settings',
    wrap(async (_req, res) => {
      const result = await settingsService.get();
      res.json(result);
    }),
  );

  router.patch(
    '/admin/settings',
    authenticate,
    requireRoles(Role.ADMIN),
    wrap(async (req, res) => {
      const dto = await validateDto(UpdateSettingsDto, req.body);
      const result = await settingsService.update(dto, req.user!.id);
      res.json(result);
    }),
  );

  // Audit Logs
  router.get(
    '/admin/audit-logs',
    authenticate,
    requireRoles(Role.ADMIN),
    wrap(async (req, res) => {
      const dto = await validateDto(ListAuditLogsDto, req.query);
      const result = await auditService.list(dto);
      res.json(result);
    }),
  );

  const prefix = (process.env.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '');
  app.use(`/${prefix}`, router);

  app.use(errorMiddleware);

  return { app, prisma };
}
