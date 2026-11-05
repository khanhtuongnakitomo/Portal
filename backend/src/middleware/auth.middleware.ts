import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ForbiddenException, UnauthorizedException } from '../common/http-exceptions.js';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface.js';
import { Role, UserStatus } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';

export function createAuthMiddleware(prisma: PrismaService) {
  const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnauthorizedException('Unauthorized');
      }

      const token = authHeader.slice(7).trim();
      const secret =
        process.env.JWT_ACCESS_SECRET || 'replace-with-at-least-32-random-characters-access';
      const issuer = process.env.JWT_ISSUER || 'tne-portal-api';
      const audience = process.env.JWT_AUDIENCE || 'tne-portal-client';

      let payload: JwtPayload;
      try {
        payload = jwt.verify(token, secret, { issuer, audience }) as JwtPayload;
      } catch {
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

  const requireRoles = (...roles: Role[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return next(new ForbiddenException('Insufficient role permissions'));
      }
      next();
    };
  };

  return { authenticate, requireRoles };
}
