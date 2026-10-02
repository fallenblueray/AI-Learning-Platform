import { Router, raw } from 'express';
import jwt from 'jsonwebtoken';
import Container from 'typedi';
import { rateLimit } from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { CourseController } from '../controllers/course.controller';
import { PaymentController } from '../controllers/payment.controller';
import { AdminController } from '../controllers/admin.controller';
import { auth, admin, verified, body } from '../middlewares/http';
import * as D from '../dtos';
import { env } from '../config/env.config';
import { StorageService } from '../services/storage.service';
import { requireThat } from '../exceptions/http.exception';
export function authRoutes() {
  const r = Router(),
    c = new AuthController();
  const limiter = rateLimit({
    windowMs: 15 * 60000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: '嘗試次數過多，請稍後再試' } },
  });
  r.post('/register', limiter, body(D.RegisterDto), c.register);
  r.post('/login', limiter, body(D.LoginDto), c.login);
  r.post('/refresh', c.refresh);
  r.post('/logout', auth, c.logout);
  r.get('/me', auth, c.me);
  r.patch('/profile', auth, body(D.NameDto), c.name);
  r.post('/verify', limiter, body(D.TokenDto), c.verify);
  r.post('/forgot-password', limiter, body(D.EmailDto), c.forgot);
  r.post('/reset-password', limiter, body(D.ResetDto), c.reset);
  r.post('/resend-verification', limiter, body(D.EmailDto), c.resend);
  r.post('/mfa/setup', auth, limiter, c.setup);
  r.post('/mfa/confirm', auth, limiter, body(D.TotpDto), c.confirm);
  return r;
}
export function courseRoutes() {
  const r = Router(),
    c = new CourseController();
  r.get('/courses', c.list);
  r.post('/courses/:id/unlock', auth, verified, body(D.UnlockDto), c.unlock);
  r.get('/enrollments', auth, c.mine);
  r.get('/enrollments/:id', auth, c.learn);
  r.put('/enrollments/:id/progress', auth, body(D.ProgressDto), c.progress);
  r.get('/enrollments/:id/lessons/:lesson/asset', auth, c.asset);
  r.get('/enrollments/:id/lessons/:lesson/captions/:caption', auth, c.caption);
  r.post('/enrollments/:id/attempts', auth, verified, body(D.ExamDto), c.exam);
  r.get('/enrollments/:id/attempts', auth, c.attempts);
  r.get('/certificates', auth, c.certificates);
  r.get('/certificates/:id/download', auth, c.download);
  r.get('/verify/:id', c.verify);
  return r;
}
export function paymentRoutes() {
  const r = Router(),
    c = new PaymentController();
  r.get('/credit-packs', c.packs);
  r.get('/wallet', auth, c.wallet);
  r.get('/orders', auth, c.orders);
  r.post('/checkout', auth, verified, body(D.CheckoutDto), c.checkout);
  return r;
}
export function adminRoutes() {
  const r = Router(),
    c = new AdminController();
  r.use(auth, admin);
  r.get('/summary', c.summary);
  r.get('/courses', c.listCourses);
  r.post('/courses', c.saveCourse);
  r.put('/courses/:id', c.saveCourse);
  r.post('/courses/:id/publish', c.publish);
  r.post('/courses/:id/archive', c.archive);
  r.get('/packs', c.packs);
  r.post('/packs', body(D.PackDto), c.savePack);
  r.put('/packs/:id', body(D.PackDto), c.savePack);
  r.get('/orders', c.orders);
  r.post('/orders/:id/refund', body(D.ReasonDto), c.refund);
  r.post('/orders/:id/reconcile', c.reconcile);
  r.get('/certificates', c.certificates);
  r.post('/certificates/:id/revoke', body(D.ReasonDto), c.revoke);
  r.post('/certificates/:id/reissue', body(D.ReasonDto), c.reissue);
  r.get('/jobs', c.jobs);
  r.post('/jobs/:id/retry', c.retry);
  r.get('/cases', c.cases);
  r.post('/cases/:id/close', body(D.ReasonDto), c.closeCase);
  r.get('/audits', c.audits);
  r.post('/assets', body(D.AssetDto), c.upload);
  r.put(
    '/assets/local',
    raw({ type: ['video/mp4', 'application/pdf', 'image/png', 'image/jpeg', 'text/vtt'], limit: '250mb' }),
    async (req, res) => {
      requireThat(env.STORAGE_DRIVER === 'local', 404, 'NOT_FOUND', '找不到檔案');
      let claim: jwt.JwtPayload;
      try {
        claim = jwt.verify(String(req.query.token), env.JWT_SECRET, {
          algorithms: ['HS256'],
          audience: 'pt-upload',
          issuer: 'pt-academy',
        }) as jwt.JwtPayload;
      } catch {
        requireThat(false, 403, 'INVALID_TOKEN', '上載連結已過期');
      }
      requireThat(
        claim.kind === 'upload' && req.get('content-type') === claim.content_type && Buffer.isBuffer(req.body),
        400,
        'INVALID_UPLOAD',
        '檔案格式不正確',
      );
      await Container.get(StorageService).put(claim.key, req.body, claim.content_type);
      res.json({ uploaded: true });
    },
  );
  return r;
}
