import { Sequelize, Transaction } from 'sequelize';
import { env } from '../config/env.config';
import { logger } from '../utils/logger';
export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'mysql',
  timezone: '+00:00',
  benchmark: true,
  logging: (_sql, ms) => {
    if (typeof ms === 'number' && ms > 500) logger.warn('slow_query', { duration_ms: ms });
  },
  pool: { max: 10, min: 0 },
  dialectOptions: env.DB_SSL ? { ssl: { rejectUnauthorized: true } } : {},
  define: { timestamps: false, underscored: true },
});
// 所有業務交易均明確 commit / rollback；外部 API 呼叫須放在交易之外。
export async function atomic<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  const tx = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
