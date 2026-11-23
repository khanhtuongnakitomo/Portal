import 'reflect-metadata';
import './config/load-environment.js';
import { createApp } from './app.js';
import { validateEnvironment } from './config/environment.js';
import { NotificationWorkerService } from './notifications/notification-worker.service.js';
import { ResendEmailProvider } from './notifications/resend-email.provider.js';

const environment = validateEnvironment(process.env);
const { port, apiPrefix } = environment;
const { app, prisma } = createApp(undefined, environment);
const notificationWorker = environment.email
  ? new NotificationWorkerService(
      prisma,
      new ResendEmailProvider(environment.email.provider),
      environment.email.worker,
    )
  : null;

const server = app.listen(port, () => {
  console.info(`Express API listening on http://localhost:${port}${apiPrefix}`);
  if (notificationWorker) notificationWorker.start();
  else console.info('Email notifications are disabled');
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  void (async () => {
    await notificationWorker?.stop();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
    process.exit(0);
  })().catch((error: unknown) => {
    console.error('Error during shutdown', error);
    process.exit(1);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
