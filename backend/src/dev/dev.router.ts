import { Router } from 'express';
import type { AuthService } from '../auth/auth.service.js';
import { BadRequestException } from '../common/http-exceptions.js';
import { validateUuid } from '../common/validate.js';
import { Role } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DevService } from './dev.service.js';

function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException('Expected a JSON object');
  }
  return value as Record<string, unknown>;
}

export function createDevRouter(prisma: PrismaService, auth: AuthService): Router {
  const router = Router();
  const dev = new DevService(prisma, auth);

  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/status', (_req, res) => {
    res.json({ enabled: true });
  });

  router.get('/accounts', async (_req, res) => {
    res.json({ accounts: await dev.accounts() });
  });

  router.post('/login', async (req, res) => {
    const body = parseObject(req.body);
    const { role, userId } = body;
    if (Object.keys(body).length === 1) {
      if (role === Role.USER || role === Role.MANAGER || role === Role.ADMIN) {
        res.json(await dev.login({ role }));
        return;
      }
      if (typeof userId === 'string') {
        res.json(await dev.login({ userId: validateUuid(userId, 'userId') }));
        return;
      }
    }
    throw new BadRequestException('Provide either a valid role or a userId');
  });

  router.post('/mock-data', async (req, res) => {
    const body = parseObject(req.body === undefined ? {} : req.body);
    const { days = 5 } = body;
    if (
      Object.keys(body).some((key) => key !== 'days') ||
      typeof days !== 'number' ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 10
    ) {
      throw new BadRequestException('days must be an integer from 1 to 10');
    }
    res.json(await dev.generateMockData(days));
  });

  router.delete('/mock-data', async (_req, res) => {
    res.json(await dev.clearMockData());
  });

  return router;
}
