import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    this.logger.error(`Prisma ${exception.code}: ${exception.message}`, exception.stack);
    const response = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.BAD_REQUEST;
    let message = 'Database request failed';

    if (exception.code === 'P2002') {
      status = HttpStatus.CONFLICT;
      message = 'A record with the same unique value already exists';
    } else if (exception.code === 'P2003') {
      message = 'The referenced record does not exist or is still in use';
    } else if (exception.code === 'P2025') {
      status = HttpStatus.NOT_FOUND;
      message = 'Record not found';
    } else if (exception.code === 'P2004' || exception.message.includes('no_active_overlap')) {
      const conflict = new ConflictException('This room is already reserved for that time range');
      status = conflict.getStatus();
      message = conflict.message;
    }

    response.status(status).json({ statusCode: status, message, error: HttpStatus[status] });
  }
}
