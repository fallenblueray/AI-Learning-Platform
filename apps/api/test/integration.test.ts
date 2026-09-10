import 'reflect-metadata';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import Container from 'typedi';
import Stripe from 'stripe';
import { sequelize } from '../src/database/connection';
import { migrate } from '../src/database/migrate';
import { createApp } from '../src/app';
import { env } from '../src/config/env.config';
import {
  Course,
  Version,
  Enrollment,
  User,
  FreePick,
  Batch,
  Pack,
  Order,
  Ledger,
  Certificate,
  Job,
  Session,
  Progress,
  Refund,
} from '../src/models';
import { CourseService } from '../src/services/course.service';
import { AssessmentService } from '../src/services/assessment.service';
import { AuthService } from '../src/services/auth.service';
import { PaymentService } from '../src/services/payment.service';
import { WorkerService } from '../src/services/worker.service';
import { demoContent } from '../src/database/seed';
import { hash, totp } from '../src/utils/security';
if (!new URL(env.DATABASE_URL).pathname.endsWith('_test'))
  throw new Error('Integration tests require a database name ending in _test');
const cs = Container.get(CourseService),
  as = Container.get(AssessmentService),
  ps = Container.get(PaymentService),
  auth = Container.get(AuthService),
  app = createApp();
const password = 'Test-password-2026!';
let passHash = '';
async function user() {
  return User.create({
    id: randomUUID(),
    email: `${randomUUID()}@example.test`,
    name: '陳大文',
    password_hash: passHash,
    role: 'student',
    verified: true,
    demo_access: true,
  });
}
async function course(level: 'beginner' | 'advanced' | 'master' = 'beginner', cost = 10) {
  const id = randomUUID(),
    vid = randomUUID(),
    content = { ...demoContent(level), credit_cost: cost };
  await Course.create({ id, draft: content, is_demo: false });
  await Version.create({ id: vid, course_id: id, number: 1, content });
  await Course.update({ published_version_id: vid }, { where: { id } });
  return { id, vid, content };
}
async function paidOrder(userId: string, credits = 20) {
  const pack = await Pack.create({ id: randomUUID(), name: '測試套裝', credits, amount: 10000, active: true });
  return Order.create({
    id: randomUUID(),
    user_id: userId,
    pack_id: pack.id,
    credits,
    amount: 10000,
    status: 'pending',
  });
}
function checkout(o: { id: string; amount: number }): Stripe.Checkout.Session {
  return {
    id: `cs_test_${o.id}`,
    client_reference_id: o.id,
    metadata: { order_id: o.id },
    payment_status: 'paid',
    currency: 'hkd',
    amount_total: o.amount,
    payment_intent: `pi_${o.id}`,
  } as Stripe.Checkout.Session;
}
async function cookie(id: string) {
  const u = (await User.findByPk(id))!;
  return `access_token=${(await auth.issue(u.get(), false)).access}`;
}
before(async () => {
  await migrate();
  passHash = await bcrypt.hash(password, 10);
});
after(async () => {
  await sequelize.close();
});
test('concurrent free picks across two courses consume exactly one level allowance', async () => {
  const u = await user(),
    a = await course(),
    b = await course();
  const results = await Promise.allSettled([cs.unlock(u.id, a.id, 'free'), cs.unlock(u.id, b.id, 'free')]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await FreePick.count({ where: { user_id: u.id } }), 1);
  assert.equal(await Enrollment.count({ where: { user_id: u.id } }), 1);
  const enrolled = (await Enrollment.findOne({ where: { user_id: u.id } }))!;
  assert.equal((await cs.unlock(u.id, enrolled.course_id, 'free')).id, enrolled.id);
});
test('20 concurrent paid unlocks charge once; FIFO uses unfrozen batches', async () => {
  const u = await user(),
    c = await course();
  const a = await Batch.create({
    id: randomUUID(),
    user_id: u.id,
    original: 7,
    remaining: 7,
    frozen: false,
    created_at: new Date(Date.now() - 10000),
  });
  const b = await Batch.create({ id: randomUUID(), user_id: u.id, original: 20, remaining: 20, frozen: false });
  const frozen = await Batch.create({ id: randomUUID(), user_id: u.id, original: 50, remaining: 50, frozen: true });
  const all = await Promise.all(Array.from({ length: 20 }, () => cs.unlock(u.id, c.id, 'credits')));
  assert.equal(new Set(all.map((e) => e.id)).size, 1);
  assert.equal((await a.reload()).remaining, 0);
  assert.equal((await b.reload()).remaining, 17);
  assert.equal((await frozen.reload()).remaining, 50);
  assert.equal(await Ledger.sum('delta', { where: { user_id: u.id } }), -10);
});
test('insufficient credits rolls back enrollment and ledger', async () => {
  const u = await user(),
    c = await course();
  await assert.rejects(cs.unlock(u.id, c.id, 'credits'));
  assert.equal(await Enrollment.count({ where: { user_id: u.id } }), 0);
  assert.equal(await Ledger.count({ where: { user_id: u.id } }), 0);
});
test('exam-only completion is idempotent and private answers never reach learning API', async () => {
  const u = await user(),
    c = await course(),
    e = await cs.unlock(u.id, c.id, 'free');
  assert.equal(await Progress.count({ where: { enrollment_id: e.id } }), 0);
  const learning = await cs.learning(u.id, e.id);
  assert.equal('answer' in learning.content.questions[0], false);
  assert.equal('explanation' in learning.content.questions[0], false);
  const answers = Object.fromEntries(c.content.questions.map((q) => [q.id, q.answer]));
  answers.q1 = 0;
  const results = await Promise.all([as.submit(u.id, e.id, answers), as.submit(u.id, e.id, answers)]);
  assert.ok(results.every((r) => r.passed && r.score === 80));
  assert.equal(await Certificate.count({ where: { enrollment_id: e.id } }), 1);
  const certificate = (await Certificate.findOne({ where: { enrollment_id: e.id } }))!;
  assert.equal(certificate.cpd.status, 'unaccredited');
  assert.equal((await as.verify(certificate.id)).name, '陳**');
  await Container.get(WorkerService).certificate(certificate.id);
  assert.ok((await certificate.reload()).pdf_key);
  await as.revoke(u.id, certificate.id, '測試撤銷');
  assert.equal((await as.verify(certificate.id)).status, 'revoked');
  await as.submit(u.id, e.id, answers);
  assert.equal(await Certificate.count({ where: { enrollment_id: e.id } }), 1);
  await u.update({ name: '陳新名' });
  const replacement = await as.reissue(u.id, certificate.id, '更改姓名');
  assert.equal((await Certificate.findByPk(replacement.id))!.name, '陳新名');
  assert.equal((await as.verify(certificate.id)).status, 'revoked');
});
test('republishing cannot overwrite existing enrollment or change level', async () => {
  const u = await user(),
    c = await course(),
    e = await cs.unlock(u.id, c.id, 'free');
  await cs.save(u.id, c.id, { ...c.content, title: '更新課程' });
  await cs.publish(u.id, c.id);
  assert.equal((await cs.learning(u.id, e.id)).content.title, c.content.title);
  await assert.rejects(cs.save(u.id, c.id, { ...c.content, level: 'master' }));
});
test('payment events grant once, and amount mismatch never grants', async () => {
  const u = await user(),
    o = await paidOrder(u.id);
  const s = checkout(o);
  await Promise.all([ps.fulfill(s, `evt_${randomUUID()}`), ps.fulfill(s, `evt_${randomUUID()}`)]);
  assert.equal(await Batch.count({ where: { order_id: o.id } }), 1);
  assert.equal((await ps.wallet(u.id, { limit: 20, offset: 0 })).balance, 20);
  const bad = await paidOrder(u.id);
  await assert.rejects(ps.fulfill({ ...checkout(bad), amount_total: 1 }, `evt_${randomUUID()}`));
  assert.equal(await Batch.count({ where: { order_id: bad.id } }), 0);
});
test('refund freezes unspent batch; success debits once; failed refund unfreezes', async () => {
  const u = await user(),
    o = await paidOrder(u.id);
  await ps.fulfill(checkout(o), `evt_${randomUUID()}`);
  const r = await ps.refund(u.id, o.id, '測試整單退款');
  assert.equal((await ps.wallet(u.id, { limit: 20, offset: 0 })).balance, 0);
  const c = await course();
  await assert.rejects(cs.unlock(u.id, c.id, 'credits'));
  const event = {
    id: `re_${randomUUID()}`,
    metadata: { refund_id: r.id, request_key: r.request_key },
    amount: o.amount,
    currency: 'hkd',
    payment_intent: `pi_${o.id}`,
    status: 'succeeded',
  } as Stripe.Refund;
  await Promise.all([ps.settleRefund(event), ps.settleRefund(event)]);
  assert.equal(await Ledger.count({ where: { user_id: u.id, kind: 'refund' } }), 1);
  assert.equal((await o.reload()).status, 'refunded');
  const o2 = await paidOrder(u.id);
  await ps.fulfill(checkout(o2), `evt_${randomUUID()}`);
  const r2 = await ps.refund(u.id, o2.id, '測試失敗恢復');
  await ps.failRefund(r2.id);
  assert.equal((await ps.wallet(u.id, { limit: 20, offset: 0 })).balance, 20);
});
test('racing refund and unlock cannot spend refunded credits', async () => {
  const u = await user(),
    o = await paidOrder(u.id),
    c = await course();
  await ps.fulfill(checkout(o), `evt_${randomUUID()}`);
  const results = await Promise.allSettled([ps.refund(u.id, o.id, '並行退款測試'), cs.unlock(u.id, c.id, 'credits')]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const batch = (await Batch.findOne({ where: { order_id: o.id } }))!;
  assert.ok((batch.frozen && batch.remaining === 20) || (!batch.frozen && batch.remaining === 10));
});
test('HTTP ownership, CSRF, admin permissions and invalid webhook signatures', async () => {
  const u = await user(),
    other = await user(),
    c = await course(),
    e = await cs.unlock(u.id, c.id, 'free');
  const otherCookie = await cookie(other.id);
  assert.equal((await request(app).get(`/api/v1/enrollments/${e.id}`).set('Cookie', otherCookie)).status, 404);
  assert.equal((await request(app).get('/api/v1/admin/orders').set('Cookie', otherCookie)).status, 403);
  assert.equal(
    (await request(app).post(`/api/v1/courses/${c.id}/unlock`).set('Cookie', otherCookie).send({ source: 'free' }))
      .status,
    403,
  );
  assert.equal(
    (await request(app).post('/api/v1/webhooks/stripe').send({ id: 'fake' })).status,
    env.STRIPE_WEBHOOK_SECRET ? 400 : 503,
  );
});
test('refresh rotation detects replay and revokes family', async () => {
  const u = await user(),
    first = await auth.issue(u.get(), false),
    second = await auth.refresh(first.refresh);
  await assert.rejects(auth.refresh(first.refresh));
  await assert.rejects(auth.refresh(second.refresh));
  assert.ok((await User.findByPk(u.id))!.token_version >= 1);
});
test('management endpoints reject admin session until MFA confirmed', async () => {
  const u = await user();
  await u.update({ role: 'admin' });
  const before = await auth.issue(u.get(), false);
  assert.equal(
    (await request(app).get('/api/v1/admin/summary').set('Cookie', `access_token=${before.access}`)).status,
    403,
  );
  const setup = await auth.setupTotp(u.id);
  const confirmed = await auth.confirmTotp(u.id, totp(setup.secret));
  assert.equal(
    (await request(app).get('/api/v1/admin/summary').set('Cookie', `access_token=${confirmed.access}`)).status,
    200,
  );
});
test('public catalog never reveals private demo content', async () => {
  const id = randomUUID();
  await Course.create({ id, draft: demoContent('master'), is_demo: true });
  const r = await request(app).get('/api/v1/courses?limit=100');
  assert.equal(r.status, 200);
  assert.ok(!r.body.items.some((c: { id: string }) => c.id === id));
  assert.ok(r.body.items.every((c: Record<string, unknown>) => !('questions' in c) && !('lessons' in c)));
});

test('stale failed refund callback cannot unfreeze a newer attempt', async () => {
  const u = await user(),
    o = await paidOrder(u.id);
  await ps.fulfill(checkout(o), `evt_${randomUUID()}`);
  const first = await ps.refund(u.id, o.id, '第一輪退款');
  await ps.failRefund(first.id, first.request_key);
  const second = await ps.refund(u.id, o.id, '重試退款');
  assert.notEqual(first.request_key, second.request_key);
  await ps.settleRefund({
    id: 're_stale',
    status: 'failed',
    metadata: { refund_id: first.id, request_key: first.request_key },
  } as Stripe.Refund);
  assert.equal((await Batch.findOne({ where: { order_id: o.id } }))!.frozen, true);
  assert.equal((await Refund.findByPk(first.id))!.status, 'pending');
});

test('registration, verification and reset tokens are single use and revoke sessions', async () => {
  const email = `${randomUUID()}@example.test`;
  const response = await request(app)
    .post('/api/v1/auth/register')
    .set('Origin', env.APP_URL)
    .send({ email, name: '新學員', password });
  assert.equal(response.status, 201);
  const u = (await User.findOne({ where: { email } }))!;
  assert.equal(u.verified, false);
  const jobs = await Job.findAll({ where: { kind: 'mail' }, order: [['created_at', 'DESC']] });
  const verifyJob = jobs.find((j) => j.payload.to === email && j.payload.template === 'verify')!;
  const token = new URL(String(verifyJob.payload.url)).searchParams.get('token')!;
  await auth.consume(token, 'verify');
  await assert.rejects(auth.consume(token, 'verify'));
  assert.equal((await u.reload()).verified, true);
  const session = await auth.issue(u.get(), false);
  await auth.requestToken(email, 'reset');
  const resetJob = (await Job.findAll({ where: { kind: 'mail' }, order: [['created_at', 'DESC']] })).find(
    (j) => j.payload.to === email && j.payload.template === 'reset',
  )!;
  const resetToken = new URL(String(resetJob.payload.url)).searchParams.get('token')!;
  await auth.consume(resetToken, 'reset', 'A-new-test-password!');
  await assert.rejects(auth.refresh(session.refresh));
  await assert.rejects(auth.login({ email, password }));
  assert.ok((await auth.login({ email, password: 'A-new-test-password!' })).user.verified);
});

test('20 active learners finish independent authenticated HTTP journeys', async (context) => {
  const c = await course('advanced');
  const learners = await Promise.all(Array.from({ length: 20 }, () => user()));
  const started = Date.now();
  const cookies = await Promise.all(learners.map((u) => cookie(u.id)));
  await Promise.all(
    cookies.map(async (session) => {
      const enrollment = await request(app)
        .post(`/api/v1/courses/${c.id}/unlock`)
        .set('Origin', env.APP_URL)
        .set('Cookie', session)
        .send({ source: 'free' });
      assert.equal(enrollment.status, 200);
      const content = await request(app).get(`/api/v1/enrollments/${enrollment.body.id}`).set('Cookie', session);
      assert.equal(content.status, 200);
      const answers = Object.fromEntries(c.content.questions.map((q) => [q.id, q.answer]));
      const result = await request(app)
        .post(`/api/v1/enrollments/${enrollment.body.id}/attempts`)
        .set('Origin', env.APP_URL)
        .set('Cookie', session)
        .send({ answers });
      assert.equal(result.status, 200);
      assert.equal(result.body.passed, true);
      assert.equal((await request(app).get('/api/v1/wallet').set('Cookie', session)).status, 200);
    }),
  );
  context.diagnostic(
    `20 learners / 80 authenticated requests completed in ${Date.now() - started}ms; local database only.`,
  );
});

test('signed Stripe webhook grants once and tampered raw body is rejected', async () => {
  const originalKey = env.STRIPE_SECRET_KEY,
    originalSecret = env.STRIPE_WEBHOOK_SECRET;
  env.STRIPE_SECRET_KEY = 'sk_test_local_fixture';
  env.STRIPE_WEBHOOK_SECRET = 'whsec_local_fixture';
  try {
    const u = await user(),
      o = await paidOrder(u.id);
    const payload = JSON.stringify({
      id: `evt_${randomUUID()}`,
      object: 'event',
      type: 'checkout.session.completed',
      livemode: false,
      data: { object: checkout(o) },
    });
    const signature = new Stripe(env.STRIPE_SECRET_KEY).webhooks.generateTestHeaderString({
      payload,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await request(app)
            .post('/api/v1/webhooks/stripe')
            .set('Content-Type', 'application/json')
            .set('Stripe-Signature', signature)
            .send(payload)
        ).status,
        200,
      );
    assert.equal(await Batch.count({ where: { order_id: o.id } }), 1);
    assert.equal(
      (
        await request(app)
          .post('/api/v1/webhooks/stripe')
          .set('Content-Type', 'application/json')
          .set('Stripe-Signature', signature)
          .send(payload.replace('10000', '20000'))
      ).status,
      400,
    );
  } finally {
    env.STRIPE_SECRET_KEY = originalKey;
    env.STRIPE_WEBHOOK_SECRET = originalSecret;
  }
});
