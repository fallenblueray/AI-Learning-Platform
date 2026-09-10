import type { Request, Response } from 'express';
import Container from 'typedi';
import { AuthService, publicUser } from '../services/auth.service';
import { secureCookies } from '../config/env.config';
import { User } from '../models';
import { atomic } from '../database/connection';
import { lockUser } from '../services/course.service';
import { audit } from '../services/job.service';
import { requireThat } from '../exceptions/http.exception';
const cookieOptions = { httpOnly: true, secure: secureCookies, sameSite: 'strict' as const, path: '/api/v1' };
export class AuthController {
  service = Container.get(AuthService);
  respond(res: Response, result: Awaited<ReturnType<AuthService['issue']>>) {
    res.cookie('access_token', result.access, { ...cookieOptions, maxAge: 15 * 60000 });
    res.cookie('refresh_token', result.refresh, { ...cookieOptions, path: '/api/v1/auth', maxAge: 7 * 86400000 });
    return res.json({ user: result.user });
  }
  register = async (req: Request, res: Response) => {
    res.status(201).json(await this.service.register(req.body));
  };
  login = async (req: Request, res: Response) => {
    this.respond(res, await this.service.login(req.body));
  };
  refresh = async (req: Request, res: Response) => {
    this.respond(res, await this.service.refresh(req.cookies.refresh_token));
  };
  logout = async (req: Request, res: Response) => {
    const result = await this.service.logout(req.actor!.id);
    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', { ...cookieOptions, path: '/api/v1/auth' });
    res.json(result);
  };
  me = async (req: Request, res: Response) => {
    const u = await User.findByPk(req.actor!.id);
    res.json({ user: { ...publicUser(u!.get()), mfa_verified: req.actor!.mfa } });
  };
  name = async (req: Request, res: Response) => {
    requireThat(req.body.name.trim(), 400, 'NAME_REQUIRED', '請填寫證書姓名');
    await atomic(async (tx) => {
      const u = await lockUser(req.actor!.id, tx);
      await u.update({ name: req.body.name.trim() }, { transaction: tx });
      await audit(req.actor!.id, 'profile.name_changed', u.get('id'), {}, tx);
    });
    res.json({ message: '姓名已更新；已發證書請聯絡管理員重發。' });
  };
  verify = async (req: Request, res: Response) => {
    res.json(await this.service.consume(req.body.token, 'verify'));
  };
  reset = async (req: Request, res: Response) => {
    res.json(await this.service.consume(req.body.token, 'reset', req.body.password));
  };
  forgot = async (req: Request, res: Response) => {
    res.json(await this.service.requestToken(req.body.email, 'reset'));
  };
  resend = async (req: Request, res: Response) => {
    res.json(await this.service.requestToken(req.body.email, 'verify'));
  };
  setup = async (req: Request, res: Response) => {
    res.json(await this.service.setupTotp(req.actor!.id));
  };
  confirm = async (req: Request, res: Response) => {
    this.respond(res, await this.service.confirmTotp(req.actor!.id, req.body.code));
  };
}
