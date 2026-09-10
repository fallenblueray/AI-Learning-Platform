import 'reflect-metadata';
import { createApp } from './app';
import { sequelize } from './database/connection';
import { env } from './config/env.config';
import { logger } from './utils/logger';
async function main() {
  await sequelize.authenticate();
  const server = createApp().listen(env.PORT, () => logger.info('api_started', { port: env.PORT }));
  const shutdown = () => {
    server.close(() => {
      void sequelize.close().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
main().catch(() => {
  logger.error('api_start_failed');
  process.exitCode = 1;
});
