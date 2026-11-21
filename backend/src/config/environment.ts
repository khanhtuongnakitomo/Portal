import { isIP } from 'node:net';

const exampleAccessSecret = 'replace-with-' + 'at-least-32-random-characters-access';

export interface Environment {
  databaseUrl: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  trustProxy: false | number | string;
  devToolsEnabled: boolean;
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
