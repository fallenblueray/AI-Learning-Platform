import type { Request, Response } from 'express';
import Container from 'typedi';
import { CourseService } from '../services/course.service';
import { AssessmentService } from '../services/assessment.service';
import { StorageService } from '../services/storage.service';
import { Attempt } from '../models';
import { ownedEnrollment } from '../services/course.service';
import { page } from '../middlewares/http';
export class CourseController {
  service = Container.get(CourseService);
  assessment = Container.get(AssessmentService);
  storage = Container.get(StorageService);
  list = async (req: Request, res: Response) => {
    res.json(
      await this.service.list(req.actor, {
        ...page(req.query),
        level: typeof req.query.level === 'string' ? req.query.level : undefined,
        ai_tool: typeof req.query.ai_tool === 'string' ? req.query.ai_tool : undefined,
      }),
    );
  };
  unlock = async (req: Request, res: Response) => {
    res.json(await this.service.unlock(req.actor!.id, String(req.params.id), req.body.source));
  };
  mine = async (req: Request, res: Response) => {
    res.json(await this.service.mine(req.actor!.id, page(req.query)));
  };
  learn = async (req: Request, res: Response) => {
    res.json(await this.service.learning(req.actor!.id, String(req.params.id)));
  };
  progress = async (req: Request, res: Response) => {
    res.json(await this.service.progress(req.actor!.id, String(req.params.id), req.body));
  };
  asset = async (req: Request, res: Response) => {
    res.json(await this.storage.lesson(req.actor!.id, String(req.params.id), String(req.params.lesson)));
  };
  exam = async (req: Request, res: Response) => {
    res.json(await this.assessment.submit(req.actor!.id, String(req.params.id), req.body.answers));
  };
  attempts = async (req: Request, res: Response) => {
    await ownedEnrollment(req.actor!.id, String(req.params.id));
    res.json(
      await Attempt.findAndCountAll({
        where: { enrollment_id: String(req.params.id) },
        ...page(req.query),
        attributes: ['id', 'score', 'passed', 'created_at'],
        order: [['created_at', 'DESC']],
      }),
    );
  };
  certificates = async (req: Request, res: Response) => {
    res.json({ items: await this.assessment.certificates(req.actor!.id) });
  };
  verify = async (req: Request, res: Response) => {
    res.json(await this.assessment.verify(String(req.params.id)));
  };
  download = async (req: Request, res: Response) => {
    res.json(await this.storage.certificate(req.actor!.id, String(req.params.id)));
  };
}
