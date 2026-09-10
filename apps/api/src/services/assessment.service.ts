import { Service } from 'typedi';
import { randomUUID } from 'node:crypto';
import { atomic } from '../database/connection';
import { Attempt, Certificate, Enrollment, Question, User, Version } from '../models';
import { env } from '../config/env.config';
import { requireThat } from '../exceptions/http.exception';
import { lockUser, ownedEnrollment } from './course.service';
import { audit, enqueue } from './job.service';
export function grade(questions: Question[], answers: Record<string, number>) {
  requireThat(
    Object.keys(answers).length === questions.length &&
      questions.every((q) => Number.isInteger(answers[q.id]) && answers[q.id] >= 0 && answers[q.id] < q.options.length),
    400,
    'INCOMPLETE_EXAM',
    '請回答所有題目',
  );
  const correct = questions.filter((q) => answers[q.id] === q.answer).length;
  return Math.floor((correct * 100) / questions.length);
}
export const maskName = (name: string) => {
  const chars = [...name];
  return chars.length < 2 ? '*' : `${chars[0]}${'*'.repeat(Math.min(6, chars.length - 1))}`;
};
@Service()
export class AssessmentService {
  async submit(userId: string, enrollmentId: string, answers: Record<string, number>) {
    return atomic(async (tx) => {
      const user = await lockUser(userId, tx);
      const e = await ownedEnrollment(userId, enrollmentId, tx);
      const version = (await Version.findByPk(e.get('version_id'), { transaction: tx }))!;
      const content = version.get('content');
      const score = grade(content.questions, answers);
      const passed = score >= content.pass_score;
      const attempt = await Attempt.create(
        { id: randomUUID(), enrollment_id: enrollmentId, score, answers, passed },
        { transaction: tx },
      );
      let certificateId = e.get('certificate_id');
      if (passed && !e.get('completed_at')) {
        const now = new Date();
        certificateId = randomUUID();
        await Certificate.create(
          {
            id: certificateId,
            enrollment_id: enrollmentId,
            name: user.get('name'),
            title: content.title,
            issuer: env.ISSUER_NAME,
            completed_at: now,
            cpd: { status: 'unaccredited' },
          },
          { transaction: tx },
        );
        await e.update({ completed_at: now, certificate_id: certificateId }, { transaction: tx });
        await enqueue('certificate', { certificate_id: certificateId }, tx);
        await audit(userId, 'exam.completed', enrollmentId, { score }, tx);
      }
      return {
        id: attempt.get('id'),
        score,
        passed,
        certificate_id: certificateId,
        feedback: content.questions.map((q) => ({
          id: q.id,
          correct: answers[q.id] === q.answer,
          explanation: q.explanation,
        })),
      };
    });
  }
  async verify(id: string) {
    const c = await Certificate.findByPk(id);
    requireThat(c, 404, 'NOT_FOUND', '找不到此證書');
    return {
      id: c.get('id'),
      name: maskName(c.get('name')),
      title: c.get('title'),
      issuer: c.get('issuer'),
      completed_at: c.get('completed_at'),
      status: c.get('revoked_at') ? 'revoked' : 'valid',
      cpd: c.get('cpd'),
    };
  }
  async certificates(userId: string) {
    const enrollmentIds = (await Enrollment.findAll({ where: { user_id: userId }, attributes: ['id'] })).map((e) =>
      e.get('id'),
    );
    return Certificate.findAll({
      where: { enrollment_id: enrollmentIds },
      order: [['created_at', 'DESC']],
      limit: 100,
    });
  }
  async revoke(actorId: string, id: string, reason: string) {
    await atomic(async (tx) => {
      const c = await Certificate.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE });
      requireThat(c, 404, 'NOT_FOUND', '找不到證書');
      if (!c.get('revoked_at')) await c.update({ revoked_at: new Date(), revoke_reason: reason }, { transaction: tx });
      await audit(actorId, 'certificate.revoked', id, { reason }, tx);
    });
    return { revoked: true };
  }
  async reissue(actorId: string, id: string, reason: string) {
    return atomic(async (tx) => {
      const found = await Certificate.findByPk(id, { transaction: tx });
      requireThat(found, 404, 'NOT_FOUND', '找不到證書');
      const enrollment = (await Enrollment.findByPk(found.get('enrollment_id'), { transaction: tx }))!;
      const user = await lockUser(enrollment.get('user_id'), tx);
      const e = (await Enrollment.findByPk(enrollment.get('id'), { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      requireThat(e.get('certificate_id') === id, 409, 'CERTIFICATE_REPLACED', '此證書已有新版本');
      const c = (await Certificate.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE }))!;
      await c.update({ revoked_at: new Date(), revoke_reason: reason }, { transaction: tx });
      const newId = randomUUID();
      await Certificate.create(
        {
          id: newId,
          enrollment_id: e.get('id'),
          name: user.get('name'),
          title: c.get('title'),
          issuer: c.get('issuer'),
          completed_at: c.get('completed_at'),
          cpd: c.get('cpd'),
          supersedes_id: id,
        },
        { transaction: tx },
      );
      await e.update({ certificate_id: newId }, { transaction: tx });
      await enqueue('certificate', { certificate_id: newId }, tx);
      await audit(actorId, 'certificate.reissued', newId, { supersedes_id: id, reason }, tx);
      return { id: newId };
    });
  }
}
