import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ForbiddenException, UnauthorizedException } from '../common/http-exceptions.js';
import type { Environment } from '../config/environment.js';
import { Role, UserStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

export function createAuthMiddleware(prisma: PrismaService, jwtConfig: Environment['jwt']) {
  const { secret, issuer, audience } = jwtConfig;
  const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Unauthorized');
      }

      const token = authHeader.slice(7).trim();

      let payload: unknown;
      try {
        payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer, audience });
      } catch {
        throw new UnauthorizedException('Unauthorized');
      }

      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('type' in payload) ||
        payload.type !== 'access' ||
        !('exp' in payload) ||
        typeof payload.exp !== 'number' ||
        !('sub' in payload) ||
        typeof payload.sub !== 'string' ||
        !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(payload.sub)
      ) {
        throw new UnauthorizedException('Unauthorized');
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, fullName: true, role: true, status: true },
      });

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Unauthorized');
      }

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };

  const optionalAuthenticate = (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization === undefined) return next();
    return authenticate(req, res, next);
  };

  const requireRoles = (...roles: Role[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return next(new ForbiddenException('Insufficient role permissions'));
      }
      next();
    };
  };

  return { authenticate, optionalAuthenticate, requireRoles };
}
