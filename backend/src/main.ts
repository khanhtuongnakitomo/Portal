import 'reflect-metadata';
import 'dotenv/config';
import { createApp } from './app.js';
import { validateEnvironment } from './config/environment.js';

const environment = validateEnvironment(process.env);
const { port, apiPrefix } = environment;
const { app, prisma } = createApp(undefined, environment);

const server = app.listen(port, () => {
  console.info(`Express API listening on http://localhost:${port}${apiPrefix}`);
});

function shutdown() {
  server.close(() => {
    void prisma
      .$disconnect()
      .catch((err: unknown) => {
        console.error('Error during database disconnect', err);
      })
      .finally(() => {
        process.exit(0);
      });
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
