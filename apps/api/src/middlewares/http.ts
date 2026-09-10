import type { RequestHandler, ErrorRequestHandler } from 'express';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.config';
import { User } from '../models';
import { HttpException, requireThat } from '../exceptions/http.exception';
import { logger } from '../utils/logger';
declare global {
  namespace Express {
    interface Request {
      actor?: { id: string; role: string; verified: boolean; demo_access: boolean; mfa: boolean };
      requestId: string;
    }
  }
}
export function body<T extends object>(Dto: ClassConstructor<T>): RequestHandler {
  return async (req, _res, next) => {
    const data = plainToInstance(Dto, req.body);
    const errors = await validate(data, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true });
    if (errors.length) throw new HttpException(400, 'INVALID_INPUT', '資料格式不正確，請檢查所有欄位');
    req.body = data;
    next();
  };
}
export const identify: RequestHandler = async (req, _res, next) => {
  req.requestId = randomUUID();
  const token = req.cookies.access_token;
  if (token) {
    try {
      const claims = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'pt-academy',
        audience: 'pt-web',
      }) as jwt.JwtPayload;
      if (claims.kind !== 'access' || !claims.sub) throw new Error('invalid');
      const user = await User.findByPk(claims.sub);
      if (user && user.get('token_version') === claims.ver)
        req.actor = {
          id: user.get('id'),
          role: user.get('role'),
          verified: user.get('verified'),
          demo_access: user.get('demo_access'),
          mfa: claims.mfa === true,
        };
    } catch (error) {
      if (!(
        error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.TokenExpiredError ||
        (error instanceof Error && error.message === 'invalid')
      ))
        throw error;
    }
  }
  next();
};
export const auth: RequestHandler = (req, _res, next) => {
  requireThat(req.actor, 401, 'UNAUTHENTICATED', '請先登入');
  next();
};
export const verified: RequestHandler = (req, _res, next) => {
  requireThat(req.actor?.verified, 403, 'EMAIL_UNVERIFIED', '請先驗證電郵');
  next();
};
export const admin: RequestHandler = (req, _res, next) => {
  requireThat(req.actor?.role === 'admin' && req.actor.mfa, 403, 'ADMIN_MFA_REQUIRED', '此操作需要管理員雙重驗證');
  next();
};
export const csrf: RequestHandler = (req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method))
    requireThat(req.get('origin') === new URL(env.APP_URL).origin, 403, 'ORIGIN_REJECTED', '請從平台頁面提交操作');
  next();
};
export const errors: ErrorRequestHandler = (error, req, res, _next) => {
  const status =
    error instanceof HttpException
      ? error.status
      : error?.type === 'entity.too.large'
        ? 413
        : error instanceof SyntaxError
          ? 400
          : 500;
  const code = error instanceof HttpException ? error.code : 'REQUEST_FAILED';
  logger.log(status >= 500 ? 'error' : 'warn', 'request_failed', { request_id: req.requestId, status, code });
  res.status(status).json({
    error: {
      code,
      message: error instanceof HttpException ? error.message : '請求未能完成，請稍後再試',
      request_id: req.requestId,
    },
  });
};
export const page = (query: Record<string, unknown>) => {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  requireThat(
    Number.isInteger(limit) &&
      limit >= 1 &&
      limit <= 100 &&
      Number.isInteger(offset) &&
      offset >= 0 &&
      offset <= 1000000,
    400,
    'INVALID_PAGINATION',
    '分頁參數無效',
  );
  return { limit, offset };
};
