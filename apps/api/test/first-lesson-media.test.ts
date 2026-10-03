import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { firstLessonAssets, firstLessonMediaRoutes, PRIVATE_MEDIA_ROOT } from '../src/routes/first-lesson-media';
import { errors } from '../src/middlewares/http';

test('private first-lesson review denies guests, learners, missing MFA, disabled and production; verifies bytes and supports ranges', async () => {
  await fs.mkdir(PRIVATE_MEDIA_ROOT, { recursive: true });
  const directory = await fs.mkdtemp(path.join(PRIVATE_MEDIA_ROOT, 'qa-fixture-'));
  try {
    const assets = structuredClone(firstLessonAssets);
    for (const asset of Object.values(assets)) {
      const data = Buffer.from(
        asset.mime === 'text/vtt' ? 'WEBVTT\n\n00:00.000 --> 00:01.000\n測試字幕\n' : '0123456789abcdef',
      );
      await fs.writeFile(path.join(directory, asset.file), data);
      asset.bytes = data.length;
      asset.sha256 = createHash('sha256').update(data).digest('hex');
    }
    function app(role = '', mfa = false, enabled = true, production = false, overrideDirectory = directory) {
      const app = express();
      app.use((req, _res, next) => {
        if (role) req.actor = { id: 'fixture', role, mfa, verified: true, demo_access: false };
        next();
      });
      app.use('/media', firstLessonMediaRoutes({ enabled, production, directory: overrideDirectory, assets }));
      app.use(errors);
      return app;
    }
    for (const endpoint of ['/v1', '/v1/video', '/v1/captions', '/v1/poster', '/v1/chapters']) {
      await request(app())
        .get('/media' + endpoint)
        .expect(401);
      await request(app('student', true))
        .get('/media' + endpoint)
        .expect(403);
      await request(app('admin'))
        .get('/media' + endpoint)
        .expect(403);
      await request(app('admin', true, false))
        .get('/media' + endpoint)
        .expect(404);
      await request(app('admin', true, true, true))
        .get('/media' + endpoint)
        .expect(404);
    }
    for (const verb of ['get', 'head'] as const) {
      await request(app())[verb]('/media/v1/video').set('Range', 'bytes=0-3').expect(401);
      await request(app('student', true))[verb]('/media/v1/captions').set('Range', 'bytes=0-3').expect(403);
      await request(app('admin'))[verb]('/media/v1/video').expect(403);
    }
    const originalHash = assets.poster.sha256;
    assets.poster.sha256 = '';
    await request(app('admin', true)).get('/media/v1').expect(503);
    assets.poster.sha256 = '0'.repeat(64);
    await request(app('admin', true)).get('/media/v1/poster').expect(503);
    assets.poster.sha256 = originalHash;
    await request(app('admin', true, true, false, os.tmpdir()))
      .get('/media/v1')
      .expect(503);
    await request(app('admin', true, true, false, '/workspace/AI-Learning-Platform/apps/web/public'))
      .get('/media/v1')
      .expect(503);
    await request(app('admin', true, true, false, directory + '/../' + path.basename(directory)))
      .get('/media/v1')
      .expect(503);
    const alias = directory + '-alias';
    await fs.symlink(directory, alias);
    try {
      await request(app('admin', true, true, false, alias))
        .get('/media/v1')
        .expect(503);
    } finally {
      await fs.unlink(alias);
    }
    const poster = path.join(directory, assets.poster.file);
    await fs.unlink(poster);
    await fs.symlink(path.join(directory, assets.video.file), poster);
    await request(app('admin', true)).get('/media/v1/poster').expect(503);
    await fs.unlink(poster);
    await fs.writeFile(poster, '0123456789abcdef');
    const allowed = app('admin', true);
    const meta = await request(allowed).get('/media/v1').expect(200);
    assert.equal(meta.body.access, 'admin-mfa-preview');
    assert.equal(meta.body.video, '/api/v1/first-lesson-media/v1/video');
    assert.match(meta.headers['cache-control'], /private, no-store/);
    const range = await request(allowed).get('/media/v1/video').set('Range', 'bytes=2-5').expect(206);
    assert.equal(range.headers['content-range'], 'bytes 2-5/16');
    assert.equal(range.body.toString(), '2345');
    await request(allowed).head('/media/v1/video').expect(200).expect('Content-Length', '16');
    await request(allowed).get('/media/v1/video').set('Range', 'bytes=99-100').expect(416);
    await request(allowed).get('/media/v2/video').expect(404);
    await request(allowed).get('/media/v1/secret').expect(404);
    await request(allowed)
      .get('/media/v1/captions')
      .expect(200)
      .expect('Content-Type', /text\/vtt/);
    await fs.writeFile(path.join(directory, assets.video.file), 'fedcba9876543210');
    await request(allowed).get('/media/v1').expect(503);
    await request(allowed).get('/media/v1/video').expect(503);
    await fs.unlink(path.join(directory, assets.video.file));
    await request(allowed).get('/media/v1').expect(503);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
