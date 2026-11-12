import 'reflect-metadata';
import './config/load-environment.js';
import { createApp } from './app.js';
import { validateEnvironment } from './config/environment.js';
import { NotificationWorkerService } from './notifications/notification-worker.service.js';
import { ResendEmailProvider } from './notifications/resend-email.provider.js';

const config = validateEnvironment(process.env);
const port = config.PORT;
const prefix = (process.env.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '');

const { app, prisma } = createApp();
const notificationWorker = config.EMAIL_NOTIFICATIONS_ENABLED
  ? new NotificationWorkerService(
      prisma,
      new ResendEmailProvider({
        apiKey: config.RESEND_API_KEY,
        from: config.EMAIL_FROM,
        replyTo: config.EMAIL_REPLY_TO,
      }),
      {
        frontendUrl: config.FRONTEND_URL,
        batchSize: config.EMAIL_BATCH_SIZE,
        maxAttempts: config.EMAIL_MAX_ATTEMPTS,
      },
    )
  : null;

const server = app.listen(port, () => {
  console.info(`Express API listening on http://localhost:${port}/${prefix}`);
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
