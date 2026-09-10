import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.config';
import { User } from '../models';
import { sequelize } from './connection';
async function main() {
  const email = process.env.DEMO_EMAIL?.trim().toLowerCase(),
    password = process.env.DEMO_PASSWORD;
  if (!env.DEMO_MODE || !email || !password || password.length < 12 || Buffer.byteLength(password) > 72)
    throw new Error('需啟用 DEMO_MODE 並提供 DEMO_EMAIL、DEMO_PASSWORD（至少 12 字元）');
  if (await User.findOne({ where: { email } })) throw new Error('帳戶已存在，拒絕覆寫');
  await User.create({
    id: randomUUID(),
    email,
    name: process.env.DEMO_NAME || '測試學員',
    password_hash: await bcrypt.hash(password, 12),
    role: 'student',
    verified: true,
    demo_access: true,
  });
  console.log('受邀測試帳戶已建立。');
  await sequelize.close();
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
