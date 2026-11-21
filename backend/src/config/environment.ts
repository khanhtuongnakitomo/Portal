import { isIP } from 'node:net';

const exampleAccessSecret = 'replace-with-' + 'at-least-32-random-characters-access';

export interface Environment {
  databaseUrl: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  trustProxy: false | number | string;
  devToolsEnabled: boolean;
  email: {
    provider: { apiKey: string; from: string; replyTo?: string };
    worker: { frontendUrl: string; batchSize: number; maxAttempts: number };
  } | null;
  jwt: {
    secret: string;
    expiresIn: number;
    issuer?: string;
    audience?: string;
  };
}

function parseTrustProxy(value: string): Environment['trustProxy'] {
  if (value === 'loopback') return value;
  if (value === 'false') return false;
  if (/^\d+$/.test(value) && Number.isSafeInteger(Number(value))) return Number(value);

  const addresses = value.split(',').map((address) => address.trim());
  if (
    addresses.every((address) => {
      const [ip, prefix, extra] = address.split('/');
      const family = isIP(ip);
      if (!family || extra !== undefined) return false;
      return (
        prefix === undefined ||
        (/^\d+$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128))
      );
    })
  ) {
    return addresses.join(', ');
  }

  throw new Error('TRUST_PROXY must be loopback, false, a non-negative hop count, or IPs/CIDRs');
}

function emailInteger(value: string | undefined, fallback: number, key: string, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${key} must be an integer between 1 and ${max}`);
  }
  return parsed;
}

function parseEmail(config: NodeJS.ProcessEnv): Environment['email'] {
  const enabled = (config.EMAIL_NOTIFICATIONS_ENABLED ?? 'false').toLowerCase();
  const batchSize = emailInteger(config.EMAIL_BATCH_SIZE, 10, 'EMAIL_BATCH_SIZE', 100);
  const maxAttempts = emailInteger(config.EMAIL_MAX_ATTEMPTS, 5, 'EMAIL_MAX_ATTEMPTS', 10);
  if (enabled === 'false') return null;
  if (enabled !== 'true') throw new Error('EMAIL_NOTIFICATIONS_ENABLED must be true or false');

  const required = (key: string) => {
    const value = config[key]?.trim();
    if (!value) throw new Error(`Missing required environment variable: ${key}`);
    return value;
  };
  const apiKey = required('RESEND_API_KEY');
  const from = required('EMAIL_FROM');
  const frontendUrl = required('FRONTEND_URL');
  if (!URL.canParse(frontendUrl) || !['http:', 'https:'].includes(new URL(frontendUrl).protocol)) {
    throw new Error('FRONTEND_URL must be an absolute HTTP(S) URL');
  }
  return {
    provider: { apiKey, from, replyTo: config.EMAIL_REPLY_TO?.trim() || undefined },
    worker: { frontendUrl, batchSize, maxAttempts },
  };
}

export function validateEnvironment(config: NodeJS.ProcessEnv): Environment {
  const devToolsEnabled = config.DEV_TOOLS_ENABLED === 'true';
  if (devToolsEnabled && config.NODE_ENV === 'production') {
    throw new Error('DEV_TOOLS_ENABLED cannot be true in production');
  }

  const databaseUrl = config.DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error('Missing required environment variable: DATABASE_URL');

  const secret = config.JWT_ACCESS_SECRET;
  if (!secret?.trim()) throw new Error('Missing required environment variable: JWT_ACCESS_SECRET');
  if (secret.trim().length < 32 || secret.trim() === exampleAccessSecret) {
    throw new Error('JWT_ACCESS_SECRET must be at least 32 characters and not the example value');
  }

  const port = Number(config.PORT ?? 3000);
  const expiresIn = Number(config.JWT_ACCESS_TTL_SECONDS ?? 28_800);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT is invalid');
  if (!Number.isSafeInteger(expiresIn) || expiresIn < 300) {
    throw new Error('JWT_ACCESS_TTL_SECONDS must be an integer of at least 300');
  }

  return {
    databaseUrl,
    port,
    apiPrefix: `/${(config.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '')}`,
    trustProxy: parseTrustProxy(config.TRUST_PROXY ?? 'loopback'),
    devToolsEnabled,
    email: parseEmail(config),
    corsOrigins: (config.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    jwt: {
      secret,
      expiresIn,
      issuer: config.JWT_ISSUER?.trim() || undefined,
      audience: config.JWT_AUDIENCE?.trim() || undefined,
    },
  };
}
