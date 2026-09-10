import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { User } from '../models';
import { sequelize } from './connection';
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(),
    password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12 || Buffer.byteLength(password) > 72)
    throw new Error('請以環境變數提供 ADMIN_EMAIL 及 12 字元以上的 ADMIN_PASSWORD');
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error('帳戶已存在，拒絕覆寫');
  await User.create({
    id: randomUUID(),
    email,
    name: process.env.ADMIN_NAME || '平台管理員',
    password_hash: await bcrypt.hash(password, 12),
    role: 'admin',
    verified: true,
    demo_access: true,
  });
  console.log('管理員已建立。首次登入後必須設定驗證器，才可使用後台。');
  await sequelize.close();
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
