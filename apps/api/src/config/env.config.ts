import { config } from 'dotenv';
import path from 'node:path';
import { z } from 'zod';
config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
export const env = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().default(3000),
    APP_URL: z.url().default('http://localhost:5173'),
    DATABASE_URL: z.string().startsWith('mysql://'),
    DB_SSL: bool.default(false),
    JWT_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z.string().min(32),
    ISSUER_NAME: z.string().min(1).max(255).default('創科學苑 / Innovate Academy（示範）'),
    DEMO_MODE: bool.default(false),
    LIVE_PAYMENTS_ENABLED: bool.default(false),
    STRIPE_SECRET_KEY: z.string().default(''),
    STRIPE_WEBHOOK_SECRET: z.string().default(''),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_STORAGE_PATH: z.string().default('../../.local/storage'),
    S3_ENDPOINT: z.string().default(''),
    S3_REGION: z.string().default('sgp1'),
    S3_BUCKET: z.string().default(''),
    S3_ACCESS_KEY: z.string().default(''),
    S3_SECRET_KEY: z.string().default(''),
    RESEND_API_KEY: z.string().default(''),
    MAIL_FROM: z.string().default(''),
    CERTIFICATE_FONT_PATH: z.string().default(''),
  })
  .parse(process.env);
if (env.NODE_ENV === 'production') {
  if (!env.APP_URL.startsWith('https://') || env.STORAGE_DRIVER !== 's3' || !env.DB_SSL)
    throw new Error('正式環境必須使用 HTTPS、S3 及資料庫 TLS');
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.CERTIFICATE_FONT_PATH)
    throw new Error('正式環境必須設定郵件服務及證書字型');
  if (env.JWT_SECRET.startsWith('replace-') || env.ENCRYPTION_KEY.startsWith('replace-'))
    throw new Error('請更換正式環境金鑰');
}
if (env.STORAGE_DRIVER === 's3' && (!env.S3_BUCKET || !env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY))
  throw new Error('S3 設定未完成');
if (env.LIVE_PAYMENTS_ENABLED && (env.DEMO_MODE || !env.STRIPE_SECRET_KEY.startsWith('sk_live_')))
  throw new Error('正式付款需要正式金鑰並關閉示範模式');
export const secureCookies = new URL(env.APP_URL).protocol === 'https:';
