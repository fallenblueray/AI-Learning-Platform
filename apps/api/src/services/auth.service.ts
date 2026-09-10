import { Service } from 'typedi';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Transaction } from 'sequelize';
import { ActionToken, Session, User, UserRow } from '../models';
import { atomic } from '../database/connection';
import { env } from '../config/env.config';
import { HttpException, requireThat } from '../exceptions/http.exception';
import { decrypt, encrypt, hash, newTotpSecret, opaque, verifyTotp } from '../utils/security';
import { enqueue, audit } from './job.service';
export const publicUser = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  verified: u.verified,
  demo_access: u.demo_access,
  mfa_enabled: !!u.totp_secret,
});
@Service()
export class AuthService {
  async issue(user: UserRow, mfa: boolean, transaction?: Transaction, family: string = randomUUID()) {
    const refresh = opaque();
    await Session.create(
      {
        id: randomUUID(),
        user_id: user.id,
        token_hash: hash(refresh),
        family,
        expires_at: new Date(Date.now() + 7 * 86400000),
        revoked: false,
        mfa,
      },
      { transaction },
    );
    const access = jwt.sign({ ver: user.token_version, mfa, kind: 'access' }, env.JWT_SECRET, {
      subject: user.id,
      expiresIn: '15m',
      issuer: 'pt-academy',
      audience: 'pt-web',
      algorithm: 'HS256',
    });
    return { access, refresh, user: publicUser(user) };
  }
  async actionToken(user: UserRow, kind: 'verify' | 'reset', transaction: Transaction) {
    const token = opaque();
    await ActionToken.create(
      {
        id: randomUUID(),
        user_id: user.id,
        token_hash: hash(token),
        kind,
        expires_at: new Date(Date.now() + (kind === 'reset' ? 3600000 : 86400000)),
        consumed: false,
      },
      { transaction },
    );
    await enqueue(
      'mail',
      { to: user.email, template: kind, name: user.name, url: `${env.APP_URL}/?action=${kind}&token=${token}` },
      transaction,
    );
  }
  async register(input: { email: string; name: string; password: string }) {
    requireThat(Buffer.byteLength(input.password) <= 72, 400, 'PASSWORD_TOO_LONG', '密碼不可超過 72 bytes');
    const password_hash = await bcrypt.hash(input.password, 12);
    const email = input.email.trim().toLowerCase();
    requireThat(input.name.trim(), 400, 'NAME_REQUIRED', '請填寫證書姓名');
    try {
      await atomic(async (tx) => {
        const user = await User.create(
          {
            id: randomUUID(),
            email,
            name: input.name.trim(),
            password_hash,
            role: 'student',
            verified: false,
            demo_access: false,
          },
          { transaction: tx },
        );
        await this.actionToken(user.get(), 'verify', tx);
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'SequelizeUniqueConstraintError')
        throw new HttpException(409, 'EMAIL_EXISTS', '此電郵已註冊，請登入或重設密碼');
      throw error;
    }
    return { message: '帳戶已建立，請查收驗證電郵後登入。' };
  }
  async login(input: { email: string; password: string; code?: string }) {
    const row = await User.findOne({ where: { email: input.email.trim().toLowerCase() } });
    const valid = await bcrypt.compare(
      input.password,
      row?.get('password_hash') || '$2b$12$PTTRMJHEAJKvySKbteSKNeSpkhQylqSppPTDZSbbONWSIab93JUdK',
    );
    requireThat(row && valid, 401, 'INVALID_CREDENTIALS', '電郵或密碼不正確');
    return atomic(async (tx) => {
      const locked = (await User.findByPk(row.get('id'), { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      let mfa = false;
      if (locked.get('role') === 'admin' && locked.get('totp_secret')) {
        const counter = verifyTotp(decrypt(locked.get('totp_secret')!), input.code || '', locked.get('totp_counter'));
        requireThat(counter !== null, 401, 'MFA_REQUIRED', '請輸入有效的驗證器代碼');
        await locked.update({ totp_counter: counter }, { transaction: tx });
        mfa = true;
      }
      return this.issue(locked.get(), mfa, tx);
    });
  }
  async refresh(token?: string) {
    requireThat(token, 401, 'SESSION_EXPIRED', '請重新登入');
    const outcome = await atomic(async (tx) => {
      // 所有帳戶操作先鎖 user，避免與重設密碼產生相反鎖序。
      const found = await Session.findOne({ where: { token_hash: hash(token) }, transaction: tx });
      if (!found) return null;
      const user = await User.findByPk(found.get('user_id'), { transaction: tx, lock: tx.LOCK.UPDATE });
      const session = await Session.findByPk(found.get('id'), { transaction: tx, lock: tx.LOCK.UPDATE });
      if (!user || !session) return null;
      if (session.get('revoked')) {
        await Session.update({ revoked: true }, { where: { family: session.get('family') }, transaction: tx });
        await user.increment('token_version', { transaction: tx });
        return null;
      }
      if (session.get('expires_at').getTime() < Date.now()) return null;
      await session.update({ revoked: true }, { transaction: tx });
      return this.issue(user.get(), session.get('mfa'), tx, session.get('family'));
    });
    requireThat(outcome, 401, 'SESSION_EXPIRED', '登入已過期，請重新登入');
    return outcome;
  }
  async logout(userId: string) {
    await atomic(async (tx) => {
      const user = await User.findByPk(userId, { transaction: tx, lock: tx.LOCK.UPDATE });
      if (user) await user.increment('token_version', { transaction: tx });
      await Session.update({ revoked: true }, { where: { user_id: userId }, transaction: tx });
    });
    return { message: '已登出所有裝置' };
  }
  async requestToken(email: string, kind: 'verify' | 'reset') {
    const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
    if (user && (kind === 'reset' || !user.get('verified')))
      await atomic((tx) => this.actionToken(user.get(), kind, tx));
    return { message: '如帳戶符合條件，我們會寄出電郵。' };
  }
  async consume(token: string, kind: 'verify' | 'reset', password?: string) {
    if (password) requireThat(Buffer.byteLength(password) <= 72, 400, 'PASSWORD_TOO_LONG', '密碼不可超過 72 bytes');
    const password_hash = password ? await bcrypt.hash(password, 12) : undefined;
    await atomic(async (tx) => {
      const found = await ActionToken.findOne({ where: { token_hash: hash(token), kind }, transaction: tx });
      requireThat(found, 400, 'INVALID_TOKEN', '連結無效或已過期');
      const user = (await User.findByPk(found.get('user_id'), { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      const action = (await ActionToken.findByPk(found.get('id'), { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      requireThat(
        !action.get('consumed') && action.get('expires_at').getTime() > Date.now(),
        400,
        'INVALID_TOKEN',
        '連結無效或已過期',
      );
      await ActionToken.update({ consumed: true }, { where: { user_id: user.get('id'), kind }, transaction: tx });
      if (kind === 'verify') await user.update({ verified: true }, { transaction: tx });
      else {
        await user.update({ password_hash, token_version: user.get('token_version') + 1 }, { transaction: tx });
        await Session.update({ revoked: true }, { where: { user_id: user.get('id') }, transaction: tx });
      }
    });
    return { message: kind === 'verify' ? '電郵已驗證，現在可以登入。' : '密碼已重設，請重新登入。' };
  }
  async setupTotp(userId: string) {
    const secret = newTotpSecret();
    await atomic(async (tx) => {
      const user = (await User.findByPk(userId, { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      requireThat(
        user.get('role') === 'admin' && !user.get('totp_secret'),
        403,
        'MFA_SETUP_DENIED',
        '無法設定雙重驗證',
      );
      await user.update({ totp_pending: encrypt(secret) }, { transaction: tx });
    });
    return {
      secret,
      uri: `otpauth://totp/PTAcademy:${userId}?secret=${secret}&issuer=PTAcademy&algorithm=SHA1&digits=6&period=30`,
    };
  }
  async confirmTotp(userId: string, code: string) {
    return atomic(async (tx) => {
      const user = (await User.findByPk(userId, { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      requireThat(
        user.get('role') === 'admin' && user.get('totp_pending') && !user.get('totp_secret'),
        400,
        'MFA_SETUP_DENIED',
        '請先設定驗證器',
      );
      const counter = verifyTotp(decrypt(user.get('totp_pending')!), code, -1);
      requireThat(counter !== null, 400, 'INVALID_CODE', '驗證代碼不正確');
      await user.update(
        {
          totp_secret: user.get('totp_pending'),
          totp_pending: null,
          totp_counter: counter,
          token_version: user.get('token_version') + 1,
        },
        { transaction: tx },
      );
      await Session.update({ revoked: true }, { where: { user_id: userId }, transaction: tx });
      await audit(userId, 'mfa.enabled', userId, {}, tx);
      return this.issue(user.get(), true, tx);
    });
  }
}
