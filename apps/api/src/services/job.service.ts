import { randomUUID } from 'node:crypto';
import { Transaction } from 'sequelize';
import { Audit, Job } from '../models';
export async function enqueue(kind: string, payload: Record<string, unknown>, transaction?: Transaction) {
  await Job.create(
    { id: randomUUID(), kind, payload, status: 'pending', attempts: 0, available_at: new Date() },
    { transaction },
  );
}
export async function audit(
  actor_id: string | null,
  action: string,
  target_id: string,
  detail: Record<string, unknown> = {},
  transaction?: Transaction,
) {
  await Audit.create({ id: randomUUID(), actor_id, action, target_id, detail }, { transaction });
}
