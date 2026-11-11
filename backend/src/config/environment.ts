const REQUIRED = ['DATABASE_URL', 'JWT_ACCESS_SECRET'] as const;

type BaseEnvironment = {
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  PORT: number;
  JWT_ACCESS_TTL_SECONDS: number;
  EMAIL_BATCH_SIZE: number;
  EMAIL_MAX_ATTEMPTS: number;
};

type EmailEnvironment =
  | { EMAIL_NOTIFICATIONS_ENABLED: false }
  | {
      EMAIL_NOTIFICATIONS_ENABLED: true;
      RESEND_API_KEY: string;
      EMAIL_FROM: string;
      EMAIL_REPLY_TO?: string;
      FRONTEND_URL: string;
    };

export type ValidatedEnvironment = BaseEnvironment & EmailEnvironment;

function parseBoolean(value: unknown, key: string) {
  if (value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' && ['true', 'false'].includes(value.toLowerCase())) {
    return value.toLowerCase() === 'true';
  }
  throw new Error(`${key} must be true or false`);
}

function parseInteger(value: unknown, fallback: number, key: string, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${key} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function validateEnvironment(config: Record<string, unknown>): ValidatedEnvironment {
  for (const key of REQUIRED) {
    if (typeof config[key] !== 'string' || !config[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  if ((config.JWT_ACCESS_SECRET as string).length < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters');
  }

  const port = Number(config.PORT ?? 3000);
  const accessTtl = Number(config.JWT_ACCESS_TTL_SECONDS ?? 28_800);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid');
  if (!Number.isInteger(accessTtl) || accessTtl < 60) {
    throw new Error('JWT_ACCESS_TTL_SECONDS must be at least 60');
  }

  const emailNotificationsEnabled = parseBoolean(
    config.EMAIL_NOTIFICATIONS_ENABLED,
    'EMAIL_NOTIFICATIONS_ENABLED',
  );
  const emailBatchSize = parseInteger(config.EMAIL_BATCH_SIZE, 10, 'EMAIL_BATCH_SIZE', 1, 100);
  const emailMaxAttempts = parseInteger(config.EMAIL_MAX_ATTEMPTS, 5, 'EMAIL_MAX_ATTEMPTS', 1, 10);

  if (emailNotificationsEnabled) {
    for (const key of ['RESEND_API_KEY', 'EMAIL_FROM', 'FRONTEND_URL'] as const) {
      if (typeof config[key] !== 'string' || !config[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }
    try {
      new URL(config.FRONTEND_URL as string);
    } catch {
      throw new Error('FRONTEND_URL must be a valid absolute URL');
    }
  }

  const base: BaseEnvironment = {
    DATABASE_URL: config.DATABASE_URL as string,
    JWT_ACCESS_SECRET: config.JWT_ACCESS_SECRET as string,
    PORT: port,
    JWT_ACCESS_TTL_SECONDS: accessTtl,
    EMAIL_BATCH_SIZE: emailBatchSize,
    EMAIL_MAX_ATTEMPTS: emailMaxAttempts,
  };
  if (!emailNotificationsEnabled) {
    return { ...base, EMAIL_NOTIFICATIONS_ENABLED: false };
  }
  return {
    ...base,
    EMAIL_NOTIFICATIONS_ENABLED: true,
    RESEND_API_KEY: config.RESEND_API_KEY as string,
    EMAIL_FROM: config.EMAIL_FROM as string,
    EMAIL_REPLY_TO:
      typeof config.EMAIL_REPLY_TO === 'string' && config.EMAIL_REPLY_TO.trim()
        ? config.EMAIL_REPLY_TO.trim()
        : undefined,
    FRONTEND_URL: config.FRONTEND_URL as string,
  };
}
