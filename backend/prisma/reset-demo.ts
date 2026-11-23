import { runSeed } from './seed.js';

if (process.env.NODE_ENV === 'production' || process.env.RESET_DEMO_CONFIRM !== 'yes') {
  throw new Error('Demo reset requires a non-production database and RESET_DEMO_CONFIRM=yes');
}

function requireLoopback(name: 'DATABASE_URL' | 'DIRECT_URL', value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Demo reset requires ${name} to be a valid PostgreSQL URL`);
  }

  const hostname = url.hostname.toLowerCase();
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(hostname) ||
    url.searchParams.has('host')
  ) {
    throw new Error(
      `Demo reset requires ${name} to target localhost, 127.0.0.1 or [::1] without a host override`,
    );
  }
}

requireLoopback('DATABASE_URL', process.env.DATABASE_URL ?? '');
if (process.env.DIRECT_URL) requireLoopback('DIRECT_URL', process.env.DIRECT_URL);

await runSeed(async (prisma) => {
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.auditLog.deleteMany();
});
console.info('Demo reset and seed completed');
