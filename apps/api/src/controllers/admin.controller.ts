import type { Request, Response } from 'express';
import Container from 'typedi';
import { randomUUID } from 'node:crypto';
import { Op } from 'sequelize';
import { Course, Pack, Order, Job, Certificate, User, ReviewCase, Audit, Enrollment } from '../models';
import { CourseService } from '../services/course.service';
import { PaymentService } from '../services/payment.service';
import { AssessmentService } from '../services/assessment.service';
import { StorageService } from '../services/storage.service';
import { audit } from '../services/job.service';
import { page } from '../middlewares/http';
import { requireThat } from '../exceptions/http.exception';
export class AdminController {
  courses = Container.get(CourseService);
  payments = Container.get(PaymentService);
  assessment = Container.get(AssessmentService);
  storage = Container.get(StorageService);
  summary = async (_req: Request, res: Response) => {
    res.json({
      users: await User.count(),
      courses: await Course.count(),
      enrollments: await Enrollment.count(),
      certificates: await Certificate.count({ where: { revoked_at: null } }),
      failed_jobs: await Job.count({ where: { status: 'failed' } }),
      open_cases: await ReviewCase.count({ where: { status: 'open' } }),
    });
  };
  listCourses = async (req: Request, res: Response) => {
    res.json(await Course.findAndCountAll({ ...page(req.query), order: [['created_at', 'DESC']] }));
  };
  saveCourse = async (req: Request, res: Response) => {
    res.json(await this.courses.save(req.actor!.id, req.params.id ? String(req.params.id) : null, req.body));
  };
  publish = async (req: Request, res: Response) => {
    res.json(await this.courses.publish(req.actor!.id, String(req.params.id)));
  };
  archive = async (req: Request, res: Response) => {
    await Course.update({ archived: true }, { where: { id: String(req.params.id) } });
    await audit(req.actor!.id, 'course.archived', String(req.params.id));
    res.json({ archived: true });
  };
  packs = async (req: Request, res: Response) => {
    res.json(await Pack.findAndCountAll({ ...page(req.query), order: [['created_at', 'DESC']] }));
  };
  savePack = async (req: Request, res: Response) => {
    const id = String(req.params.id || randomUUID());
    const prior = await Pack.findByPk(id);
    if (prior) await prior.update(req.body);
    else await Pack.create({ id, ...req.body });
    await audit(req.actor!.id, 'pack.saved', id);
    res.json({ id });
  };
  orders = async (req: Request, res: Response) => {
    res.json(await Order.findAndCountAll({ ...page(req.query), order: [['created_at', 'DESC']] }));
  };
  refund = async (req: Request, res: Response) => {
    res.json(await this.payments.refund(req.actor!.id, String(req.params.id), req.body.reason));
  };
  reconcile = async (req: Request, res: Response) => {
    res.json(await this.payments.reconcile(String(req.params.id)));
    await audit(req.actor!.id, 'payment.reconciled', String(req.params.id));
  };
  certificates = async (req: Request, res: Response) => {
    res.json(await Certificate.findAndCountAll({ ...page(req.query), order: [['created_at', 'DESC']] }));
  };
  revoke = async (req: Request, res: Response) => {
    res.json(await this.assessment.revoke(req.actor!.id, String(req.params.id), req.body.reason));
  };
  reissue = async (req: Request, res: Response) => {
    res.json(await this.assessment.reissue(req.actor!.id, String(req.params.id), req.body.reason));
  };
  jobs = async (req: Request, res: Response) => {
    res.json(
      await Job.findAndCountAll({
        where: { status: { [Op.ne]: 'done' } },
        attributes: ['id', 'kind', 'status', 'attempts', 'last_error', 'created_at'],
        ...page(req.query),
        order: [['created_at', 'DESC']],
      }),
    );
  };
  retry = async (req: Request, res: Response) => {
    const job = await Job.findByPk(String(req.params.id));
    requireThat(job?.get('status') === 'failed', 409, 'NOT_RETRYABLE', '只能重試失敗工作');
    await job.update({ status: 'pending', attempts: 0, available_at: new Date() });
    await audit(req.actor!.id, 'job.retried', job.get('id'));
    res.json({ queued: true });
  };
  cases = async (req: Request, res: Response) => {
    res.json(await ReviewCase.findAndCountAll({ ...page(req.query), order: [['created_at', 'DESC']] }));
  };
  closeCase = async (req: Request, res: Response) => {
    const row = await ReviewCase.findByPk(String(req.params.id));
    requireThat(row, 404, 'NOT_FOUND', '找不到個案');
    await row.update({ status: 'closed' });
    await audit(req.actor!.id, 'case.closed', row.get('id'), { reason: req.body.reason });
    res.json({ closed: true });
  };
  audits = async (req: Request, res: Response) => {
    res.json(await Audit.findAndCountAll({ ...page(req.query), order: [['created_at', 'DESC']] }));
  };
  upload = async (req: Request, res: Response) => {
    res.json(await this.storage.upload(req.body.name, req.body.content_type));
  };
}
