import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { grade, maskName } from '../src/services/assessment.service';
import { courseSchema } from '../src/services/course.service';
import { demoContent } from '../src/database/seed';
import { encrypt, decrypt, totp, verifyTotp } from '../src/utils/security';
test('80% is sufficient and missing/invalid/extra answers are rejected', () => {
  const c = demoContent('beginner');
  const answers = Object.fromEntries(c.questions.map((q) => [q.id, q.answer]));
  assert.equal(grade(c.questions, answers), 100);
  answers.q1 = 0;
  assert.equal(grade(c.questions, answers), 80);
  answers.q2 = 0;
  assert.equal(grade(c.questions, answers), 60);
  assert.throws(() => grade(c.questions, { q1: 1 }));
  assert.throws(() => grade(c.questions, { ...answers, unexpected: 1 }));
  assert.throws(() => grade(c.questions, { ...answers, q1: -1 }));
});
test('public verification masks Unicode names', () => {
  assert.equal(maskName('陳大文'), '陳**');
  assert.equal(maskName('陳'), '*');
  assert.equal(maskName('𠮷田'), '𠮷*');
});
test('TOTP matches RFC 6238 SHA-1 fixture and refuses replay', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(totp(secret, 1), '287082');
  const counter = Math.floor(Date.now() / 30000),
    code = totp(secret, counter);
  assert.equal(verifyTotp(secret, code, -1), counter);
  assert.equal(verifyTotp(secret, code, counter), null);
  assert.equal(verifyTotp(secret, 'abc123', -1), null);
});
test('MFA secrets are authenticated and encrypted at rest', () => {
  const encrypted = encrypt('example-secret');
  assert.notEqual(encrypted, 'example-secret');
  assert.equal(decrypt(encrypted), 'example-secret');
  const b = Buffer.from(encrypted, 'base64');
  b[30] ^= 1;
  assert.throws(() => decrypt(b.toString('base64')));
});
test('course validation rejects false CPD points, duplicate IDs, and incorrect answers', () => {
  const c = demoContent('beginner');
  assert.ok(courseSchema.safeParse(c).success);
  assert.equal(courseSchema.safeParse({ ...c, cpd: { status: 'unaccredited', points: 5 } }).success, false);
  assert.equal(courseSchema.safeParse({ ...c, cpd: { status: 'accredited', points: 5 } }).success, false);
  assert.equal(courseSchema.safeParse({ ...c, questions: [c.questions[0], c.questions[0]] }).success, false);
  assert.equal(courseSchema.safeParse({ ...c, questions: [{ ...c.questions[0], answer: 99 }] }).success, false);
});

test('caption schema accepts optional versioned VTT and rejects invalid keys, duplicate ids or multiple defaults', () => {
  const content = demoContent('beginner');
  content.lessons[0] = {
    ...content.lessons[0],
    kind: 'video',
    asset_key: 'media/example.mp4',
    captions: [{ id: 'zh', language: 'zh-Hant', label: '繁體中文', asset_key: 'media/caption.vtt', default: true }],
  };
  assert.equal(courseSchema.safeParse(content).success, true);
  for (const bad of ['https://example.test/caption.vtt', 'media/../caption.vtt', 'media/caption.mp4']) {
    const copy = structuredClone(content);
    copy.lessons[0].captions![0].asset_key = bad;
    assert.equal(courseSchema.safeParse(copy).success, false);
  }
  const duplicate = structuredClone(content);
  duplicate.lessons[0].captions!.push({ ...duplicate.lessons[0].captions![0] });
  assert.equal(courseSchema.safeParse(duplicate).success, false);
  duplicate.lessons[0].captions![1].id = 'en';
  assert.equal(courseSchema.safeParse(duplicate).success, false);
  const text = structuredClone(content);
  text.lessons[0].kind = 'text';
  delete text.lessons[0].asset_key;
  assert.equal(courseSchema.safeParse(text).success, false);
});
