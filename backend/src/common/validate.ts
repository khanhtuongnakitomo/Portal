import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { BadRequestException } from './http-exceptions.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getFirstErrorMessage(errors: ValidationError[]): string {
  for (const error of errors) {
    if (error.constraints) {
      const keys = Object.keys(error.constraints);
      if (keys.length > 0) {
        return error.constraints[keys[0]];
      }
    }
    if (error.children && error.children.length > 0) {
      const childMessage = getFirstErrorMessage(error.children);
      if (childMessage) return childMessage;
    }
  }
  return 'Validation failed';
}

export async function validateDto<T extends object>(cls: new () => T, plain: unknown): Promise<T> {
  const instance = plainToInstance(cls, plain ?? {}, { enableImplicitConversion: true });
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: false });
  if (errors.length > 0) {
    throw new BadRequestException(getFirstErrorMessage(errors));
  }
  return instance;
}

export function validateUuid(id: string | string[] | undefined, name = 'id'): string {
  const value = Array.isArray(id) ? id[0] : id;
  if (!value || typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw new BadRequestException(`Invalid ${name} UUID`);
  }
  return value;
}
