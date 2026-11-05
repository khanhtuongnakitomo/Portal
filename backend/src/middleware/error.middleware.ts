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

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (err instanceof HttpException) {
    return res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      error: err.errorName || STATUS_ERROR_NAMES[err.statusCode] || 'Error',
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
    if (err.code === 'P2004' || err.message.includes('no_active_overlap')) {
      return res.status(409).json({
        statusCode: 409,
        message: 'This room is already reserved for that time range',
        error: 'Conflict',
      });
    }
    return res.status(400).json({
      statusCode: 400,
      message: 'Database request failed',
      error: 'Bad Request',
    });
  }

  if (err instanceof Error && err.message.includes('no_active_overlap')) {
    return res.status(409).json({
      statusCode: 409,
      message: 'This room is already reserved for that time range',
      error: 'Conflict',
    });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    statusCode: 500,
    message: 'Internal server error',
    error: 'Internal Server Error',
  });
}
