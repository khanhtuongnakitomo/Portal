const REQUIRED = ['DATABASE_URL', 'JWT_ACCESS_SECRET'] as const;

export function validateEnvironment(config: Record<string, unknown>) {
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
  return {
    ...config,
    PORT: port,
    JWT_ACCESS_TTL_SECONDS: accessTtl,
  };
}
