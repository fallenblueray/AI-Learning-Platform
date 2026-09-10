import { Service } from 'typedi';
import { Op, Transaction } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { atomic } from '../database/connection';
import {
  Course,
  Version,
  User,
  Enrollment,
  FreePick,
  Progress,
  Batch,
  Ledger,
  CourseContent,
  VersionRow,
} from '../models';
import { env } from '../config/env.config';
import { requireThat } from '../exceptions/http.exception';
import { audit } from './job.service';
const lessonSchema = z
  .object({
    id: z.string().min(1).max(64),
    title: z.string().min(1).max(200),
    kind: z.enum(['text', 'video', 'attachment']),
    content: z.string().max(50000),
    asset_key: z
      .string()
      .regex(/^media\/[a-zA-Z0-9-]+\.(mp4|pdf|png|jpg)$/)
      .optional(),
  })
  .refine(
    (l) =>
      !l.asset_key || (l.kind === 'text' ? /\.(png|jpg)$/ : l.kind === 'video' ? /\.mp4$/ : /\.pdf$/).test(l.asset_key),
    '教材類型與檔案不符',
  );
export const courseSchema = z
  .object({
    title: z.string().min(1).max(200),
    subtitle: z.string().max(250),
    description: z.string().min(1).max(5000),
    level: z.enum(['beginner', 'advanced', 'master']),
    ai_tool: z.enum(['general', 'gemini', 'chatgpt', 'claude']),
    duration_minutes: z.number().int().min(1).max(10000),
    credit_cost: z.number().int().min(1).max(100000),
    pass_score: z.literal(80),
    lessons: z.array(lessonSchema).min(1).max(100),
    questions: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            prompt: z.string().min(1).max(2000),
            options: z.array(z.string().min(1).max(1000)).min(2).max(6),
            answer: z.number().int().min(0),
            explanation: z.string().max(2000),
          })
          .refine((q) => q.answer < q.options.length),
      )
      .min(1)
      .max(100),
    cpd: z
      .object({
        status: z.enum(['unaccredited', 'pending']),
        authority: z.string().optional(),
        code: z.string().optional(),
        points: z.number().nonnegative().optional(),
        valid_from: z.string().optional(),
        valid_until: z.string().optional(),
        requirements: z.string().optional(),
      })
      .refine((c) => !c.points, '未認可課程不能設定正式學分'),
  })
  .superRefine((c, ctx) => {
    if (
      new Set(c.lessons.map((v) => v.id)).size !== c.lessons.length ||
      new Set(c.questions.map((v) => v.id)).size !== c.questions.length
    )
      ctx.addIssue({ code: 'custom', message: '單元及題目編號不可重複' });
  });
export const summary = (id: string, content: CourseContent, is_demo: boolean, enrolled = false) => ({
  id,
  title: content.title,
  subtitle: content.subtitle,
  description: content.description,
  level: content.level,
  ai_tool: content.ai_tool,
  duration_minutes: content.duration_minutes,
  credit_cost: content.credit_cost,
  lesson_count: content.lessons.length,
  cpd: content.cpd,
  is_demo,
  enrolled,
});
export async function lockUser(id: string, tx: Transaction) {
  const user = await User.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE });
  requireThat(user, 404, 'NOT_FOUND', '找不到帳戶');
  return user;
}
export async function ownedEnrollment(userId: string, id: string, transaction?: Transaction) {
  const e = await Enrollment.findOne({ where: { id, user_id: userId }, transaction });
  requireThat(e, 404, 'NOT_FOUND', '找不到已解鎖課程');
  return e;
}
@Service()
export class CourseService {
  async list(
    actor: Express.Request['actor'],
    filters: { level?: string; ai_tool?: string; limit: number; offset: number },
  ) {
    const demo = env.DEMO_MODE && !!actor?.demo_access;
    const where: Record<string, unknown> = {
      archived: false,
      [Op.or]: [{ published_version_id: { [Op.ne]: null } }, ...(demo ? [{ is_demo: true }] : [])],
    };
    if (!demo) where.is_demo = false;
    // SQL JSON paths ensure filtering is performed before pagination. Published metadata comes from its immutable version below.
    if (filters.level) where['draft.level'] = filters.level;
    if (filters.ai_tool) where['draft.ai_tool'] = filters.ai_tool;
    const { rows, count } = await Course.findAndCountAll({
      where,
      limit: filters.limit,
      offset: filters.offset,
      order: [['created_at', 'ASC']],
    });
    const enrollments = actor
      ? await Enrollment.findAll({ where: { user_id: actor.id, course_id: rows.map((c) => c.get('id')) } })
      : [];
    const items = [];
    for (const c of rows) {
      const v = c.get('published_version_id') ? await Version.findByPk(c.get('published_version_id')!) : null;
      items.push(
        summary(
          c.get('id'),
          v?.get('content') || c.get('draft'),
          c.get('is_demo'),
          enrollments.some((e) => e.get('course_id') === c.get('id')),
        ),
      );
    }
    return { items, total: count };
  }
  async unlock(userId: string, courseId: string, source: 'free' | 'credits') {
    return atomic(async (tx) => {
      const user = await lockUser(userId, tx);
      requireThat(user.get('verified'), 403, 'EMAIL_UNVERIFIED', '請先驗證電郵');
      const existing = await Enrollment.findOne({ where: { user_id: userId, course_id: courseId }, transaction: tx });
      if (existing) return existing.get();
      const course = await Course.findByPk(courseId, { transaction: tx, lock: tx.LOCK.UPDATE });
      requireThat(course && !course.get('archived'), 404, 'NOT_FOUND', '找不到課程');
      const demo = env.DEMO_MODE && user.get('demo_access') && course.get('is_demo');
      requireThat(
        demo || (!course.get('is_demo') && course.get('published_version_id')),
        404,
        'NOT_FOUND',
        '課程尚未開放',
      );
      requireThat(!(demo && source === 'credits'), 400, 'DEMO_NOT_FOR_SALE', '示範課只供免費驗收，不作銷售');
      let version = course.get('published_version_id')
        ? await Version.findByPk(course.get('published_version_id')!, { transaction: tx })
        : null;
      if (!version && demo) {
        version = await Version.create(
          { id: randomUUID(), course_id: courseId, number: 1, content: course.get('draft') },
          { transaction: tx },
        );
        // Internal immutable demo snapshot is not a public publication.
        await course.update({ published_version_id: version.get('id') }, { transaction: tx });
      }
      requireThat(version, 409, 'VERSION_UNAVAILABLE', '課程版本未就緒');
      const content = version.get('content');
      const enrollmentId = randomUUID();
      if (source === 'free') {
        const pick = await FreePick.findOne({ where: { user_id: userId, level: content.level }, transaction: tx });
        requireThat(!pick, 409, 'FREE_PICK_USED', '此級別的免費名額已使用');
        await FreePick.create(
          { id: randomUUID(), user_id: userId, level: content.level, course_id: courseId },
          { transaction: tx },
        );
      } else {
        const batches = await Batch.findAll({
          where: { user_id: userId, frozen: false, remaining: { [Op.gt]: 0 } },
          order: [
            ['created_at', 'ASC'],
            ['id', 'ASC'],
          ],
          transaction: tx,
          lock: tx.LOCK.UPDATE,
        });
        requireThat(
          batches.reduce((n, b) => n + b.get('remaining'), 0) >= content.credit_cost,
          409,
          'INSUFFICIENT_CREDITS',
          '點數不足，請先購買點數',
        );
        let remaining = content.credit_cost;
        for (const batch of batches) {
          if (!remaining) break;
          const spend = Math.min(remaining, batch.get('remaining'));
          await batch.decrement('remaining', { by: spend, transaction: tx });
          await Ledger.create(
            {
              id: randomUUID(),
              user_id: userId,
              batch_id: batch.get('id'),
              delta: -spend,
              kind: 'course_unlock',
              reference_id: enrollmentId,
            },
            { transaction: tx },
          );
          remaining -= spend;
        }
      }
      const e = await Enrollment.create(
        { id: enrollmentId, user_id: userId, course_id: courseId, version_id: version.get('id'), source },
        { transaction: tx },
      );
      await audit(userId, 'course.unlocked', courseId, { source }, tx);
      return e.get();
    });
  }
  async mine(userId: string, pagination: { limit: number; offset: number }) {
    const { rows, count } = await Enrollment.findAndCountAll({
      where: { user_id: userId },
      ...pagination,
      order: [['created_at', 'DESC']],
    });
    const items = [];
    for (const e of rows) {
      const v = (await Version.findByPk(e.get('version_id')))!;
      const p = await Progress.findAll({ where: { enrollment_id: e.get('id') } });
      items.push({
        ...e.get(),
        course: summary(e.get('course_id'), v.get('content'), false, true),
        progress: p.map((v) => v.get()),
      });
    }
    return { items, total: count };
  }
  async learning(userId: string, id: string) {
    const e = await ownedEnrollment(userId, id);
    const v = (await Version.findByPk(e.get('version_id')))!;
    const { questions, lessons, ...content } = v.get('content');
    return {
      ...e.get(),
      content: {
        ...content,
        lessons: lessons.map(({ asset_key, ...l }) => ({ ...l, has_asset: !!asset_key })),
        questions: questions.map(({ answer, explanation, ...q }) => q),
      },
      progress: await Progress.findAll({ where: { enrollment_id: id } }),
    };
  }
  async progress(userId: string, id: string, input: { lesson_id: string; position_seconds: number; read: boolean }) {
    return atomic(async (tx) => {
      await lockUser(userId, tx);
      const e = await ownedEnrollment(userId, id, tx);
      const v = (await Version.findByPk(e.get('version_id'), { transaction: tx }))!;
      requireThat(
        v.get('content').lessons.some((l) => l.id === input.lesson_id),
        404,
        'NOT_FOUND',
        '找不到單元',
      );
      const row = await Progress.findOne({ where: { enrollment_id: id, lesson_id: input.lesson_id }, transaction: tx });
      if (row)
        await row.update(
          { ...input, read: row.get('read') || input.read, updated_at: new Date() },
          { transaction: tx },
        );
      else
        await Progress.create(
          { id: randomUUID(), enrollment_id: id, ...input, updated_at: new Date() },
          { transaction: tx },
        );
      return { saved: true };
    });
  }
  async save(actorId: string, id: string | null, raw: unknown) {
    const parsed = courseSchema.safeParse(raw);
    requireThat(parsed.success, 400, 'INVALID_COURSE', '課程資料不完整，請檢查教材及題庫');
    return atomic(async (tx) => {
      const course = id ? await Course.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE }) : null;
      requireThat(!id || course, 404, 'NOT_FOUND', '找不到課程');
      if (course?.get('published_version_id')) {
        const old = (await Version.findByPk(course.get('published_version_id')!, { transaction: tx }))!;
        requireThat(
          old.get('content').level === parsed.data.level && old.get('content').ai_tool === parsed.data.ai_tool,
          409,
          'CLASSIFICATION_LOCKED',
          '已發布課程不可更改級別或工具分類，請建立新課程',
        );
      }
      const row = course
        ? await course.update({ draft: parsed.data }, { transaction: tx })
        : await Course.create(
            { id: randomUUID(), draft: parsed.data, is_demo: false, archived: false },
            { transaction: tx },
          );
      await audit(actorId, 'course.saved', row.get('id'), {}, tx);
      return row.get();
    });
  }
  async publish(actorId: string, id: string) {
    return atomic(async (tx) => {
      const course = await Course.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE });
      requireThat(course && !course.get('is_demo'), 400, 'DEMO_NOT_PUBLISHABLE', '示範課不可公開發布，請建立正式課程');
      const content = courseSchema.parse(course.get('draft'));
      requireThat(
        content.lessons.every((l) => l.kind === 'text' || !!l.asset_key),
        400,
        'ASSET_REQUIRED',
        '請先上載影片或附件',
      );
      const number =
        (((await Version.max('number', { where: { course_id: id }, transaction: tx })) as number) || 0) + 1;
      const v = await Version.create({ id: randomUUID(), course_id: id, number, content }, { transaction: tx });
      await course.update({ published_version_id: v.get('id'), archived: false }, { transaction: tx });
      await audit(actorId, 'course.published', id, { version_id: v.get('id') }, tx);
      return course.get();
    });
  }
}
