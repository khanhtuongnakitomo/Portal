import type { NextFunction, Request, Response } from 'express';
import { HttpException } from '../common/http-exceptions.js';
import { Prisma } from '../generated/prisma/client.js';

const STATUS_ERROR_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

const BODY_ERRORS: Record<string, [number, string, string]> = {
  'entity.parse.failed': [400, 'Malformed JSON body', 'Bad Request'],
  'entity.too.large': [413, 'Request body is too large', 'Payload Too Large'],
  'request.aborted': [400, 'Request body was interrupted', 'Bad Request'],
  'request.size.invalid': [400, 'Invalid request body size', 'Bad Request'],
  'encoding.unsupported': [415, 'Unsupported content encoding', 'Unsupported Media Type'],
  'charset.unsupported': [415, 'Unsupported charset', 'Unsupported Media Type'],
};

const ROOM_OVERLAP_CONSTRAINT = /\b(?:bookings_no_(?:firm|active)_overlap|no_active_overlap)\b/;

function inspectDatabaseError(err: unknown) {
  const pending = [err];
  const visited = new Set<object>();
  let code: string | undefined;
  let exclusion = false;
  let prismaConstraintError = false;
  let roomOverlap = false;

  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);
    const error = value as Record<string, unknown>;

    for (const candidate of [error.code, error.originalCode]) {
      if (typeof candidate !== 'string') continue;
      if (/^[A-Z0-9]{5}$/.test(candidate)) code ??= candidate;
      if (candidate === '23P01') exclusion = true;
      if (candidate === 'P2039' || candidate === 'P2004') prismaConstraintError = true;
    }
    for (const candidate of [
      error.constraint,
      error.message,
      error.originalMessage,
      error.database_error,
    ]) {
      if (typeof candidate === 'string' && ROOM_OVERLAP_CONSTRAINT.test(candidate)) {
        roomOverlap = true;
      }
    }

    // Prisma's driver adapter preserves the PostgreSQL error in meta.driverAdapterError.cause.
    pending.push(error.cause, error.meta, error.driverAdapterError, error.database_error);
  }

  return { code, roomOverlap: roomOverlap && (exclusion || prismaConstraintError) };
}

export function errorMiddleware(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  if (err instanceof Error && 'type' in err && typeof err.type === 'string') {
    if (Object.hasOwn(BODY_ERRORS, err.type)) {
      const [statusCode, message, error] = BODY_ERRORS[err.type];
      return res.status(statusCode).json({ statusCode, message, error });
    }
  }

  if (err instanceof HttpException) {
    return res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      error: err.errorName || STATUS_ERROR_NAMES[err.statusCode] || 'Error',
    });
  }

  const databaseError = inspectDatabaseError(err);
  if (databaseError.roomOverlap) {
    return res.status(409).json({
      statusCode: 409,
      message: 'This room is already reserved for that time range',
      error: 'Conflict',
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        statusCode: 409,
        message: 'A record with the same unique value already exists',
        error: 'Conflict',
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        statusCode: 404,
        message: 'Record not found',
        error: 'Not Found',
      });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        statusCode: 409,
        message: 'Related record constraint violation',
        error: 'Conflict',
      });
    }
    return res.status(400).json({
      statusCode: 400,
      message: 'Database request failed',
      error: 'Bad Request',
    });
  }

  const routePath = (req.route as { path?: unknown } | undefined)?.path;
  console.error('Unhandled error:', {
    name: err instanceof Error ? err.name : 'NonError',
    code: databaseError.code,
    method: req.method,
    route: typeof routePath === 'string' ? routePath : undefined,
  });
  return res.status(500).json({
    statusCode: 500,
    message: 'Internal server error',
    error: 'Internal Server Error',
  });
}
