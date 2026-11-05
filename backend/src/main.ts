import 'reflect-metadata';
import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const prefix = (process.env.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '');

const { app, prisma } = createApp();

const server = app.listen(port, () => {
  console.info(`Express API listening on http://localhost:${port}/${prefix}`);
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
