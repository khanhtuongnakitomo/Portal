export class HttpException extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errorName: string = 'Error',
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request') {
    super(400, message, 'Bad Request');
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') {
    super(401, message, 'Unauthorized');
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden') {
    super(403, message, 'Forbidden');
  }
}

export class NotFoundException extends HttpException {
  constructor(message = 'Not Found') {
    super(404, message, 'Not Found');
  }
}

export class ConflictException extends HttpException {
  constructor(message = 'Conflict') {
    super(409, message, 'Conflict');
  }
}

export class ServiceUnavailableException extends HttpException {
  constructor(message = 'Service Unavailable') {
    super(503, message, 'Service Unavailable');
  }
}
