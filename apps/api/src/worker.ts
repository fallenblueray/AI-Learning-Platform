import 'reflect-metadata';
import Container from 'typedi';
import { sequelize } from './database/connection';
import { WorkerService } from './services/worker.service';
import { logger } from './utils/logger';
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
async function run() {
  await sequelize.authenticate();
  const worker = Container.get(WorkerService);
  while (!stopping) {
    if (!(await worker.once())) await new Promise((r) => setTimeout(r, 1000));
  }
  await sequelize.close();
}
run().catch(() => {
  logger.error('worker_stopped');
  process.exitCode = 1;
});
