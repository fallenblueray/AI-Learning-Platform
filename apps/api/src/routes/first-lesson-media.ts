import { Router } from 'express';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { env } from '../config/env.config';
import { admin, auth } from '../middlewares/http';
import { requireThat } from '../exceptions/http.exception';

// Private review only. No published-course, enrollment or free-pick semantics.
export const firstLessonAssets = {
  video: {
    file: 'lesson01-juno-cantonese-clean.mp4',
    mime: 'video/mp4',
    bytes: 14454534,
    sha256: 'bea2b42f8ff61a3a0f2fab3240b8650da678b342fd0a96d2fa30ee4f16f7b326',
  },
  captions: {
    file: 'lesson01.zh-Hant.vtt',
    mime: 'text/vtt',
    bytes: 11238,
    sha256: '03ccc18109df07613ea6c442cae58951eafa9b5a325b989befa5746a8da3b76a',
  },
  poster: {
    file: 'lesson01-poster.jpg',
    mime: 'image/jpeg',
    bytes: 178130,
    sha256: '4680d0517f2a23dc2e16d1a7d681cf0d7cf704efa2c231d6c442b692064881cc',
  },
  chapters: {
    file: 'lesson01.chapters.vtt',
    mime: 'text/vtt',
    bytes: 764,
    sha256: '11e7936538159d746d4f335d671244d2c3e4df8aa7aec89a971b88be3d9ab46f',
  },
};
export const PRIVATE_MEDIA_ROOT =
  env.NODE_ENV === 'test'
    ? path.join(os.tmpdir(), 'pt-academy-private-media-test')
    : '/workspace/pt-course-dev/private-media';
type Options = { enabled: boolean; directory: string; production: boolean; assets?: typeof firstLessonAssets };
export function firstLessonMediaRoutes(options: Options) {
  const r = Router();
  const assets = options.assets ?? firstLessonAssets;
  r.use(
    (_req, _res, next) => {
      requireThat(
        options.enabled && !options.production && path.isAbsolute(options.directory),
        404,
        'NOT_FOUND',
        '媒體審核尚未開放',
      );
      next();
    },
    auth,
    admin,
  );
  async function verifiedFiles() {
    try {
      const approved = await fs.realpath(PRIVATE_MEDIA_ROOT);
      const root = await fs.realpath(options.directory);
      const relative = path.relative(approved, root);
      const repositoryRelative = path.relative(path.resolve(__dirname, '../../../..'), root);
      requireThat(
        approved === PRIVATE_MEDIA_ROOT &&
          (repositoryRelative.startsWith('..') || path.isAbsolute(repositoryRelative)) &&
          root === path.resolve(options.directory) &&
          !options.directory.split(path.sep).includes('..') &&
          relative !== '' &&
          !relative.startsWith('..') &&
          !path.isAbsolute(relative),
        503,
        'MEDIA_UNAVAILABLE',
        '媒體目錄不在授權範圍',
      );
      const buffers: Record<string, Buffer> = {};
      for (const [kind, asset] of Object.entries(assets)) {
        requireThat(
          /^[a-f0-9]{64}$/.test(asset.sha256) && path.basename(asset.file) === asset.file,
          503,
          'MEDIA_UNAVAILABLE',
          '媒體驗證資料未完成',
        );
        const file = path.join(root, asset.file);
        const stat = await fs.lstat(file);
        requireThat(
          stat.isFile() && !stat.isSymbolicLink() && stat.size === asset.bytes && (await fs.realpath(file)) === file,
          503,
          'MEDIA_UNAVAILABLE',
          '媒體尚未完成本機驗證',
        );
        const bytes = await fs.readFile(file);
        requireThat(
          createHash('sha256').update(bytes).digest('hex') === asset.sha256,
          503,
          'MEDIA_UNAVAILABLE',
          '媒體尚未完成本機驗證',
        );
        if (asset.mime === 'text/vtt')
          requireThat(bytes.toString('utf8').startsWith('WEBVTT'), 503, 'MEDIA_UNAVAILABLE', '字幕格式無效');
        buffers[kind] = bytes;
      }
      return buffers;
    } catch {
      requireThat(false, 503, 'MEDIA_UNAVAILABLE', '媒體尚未完成本機驗證');
    }
  }
  r.get('/v1', async (_req, res) => {
    await verifiedFiles();
    const base = '/api/v1/first-lesson-media/v1';
    res.set('Cache-Control', 'private, no-store').json({
      version: 'v1',
      access: 'admin-mfa-preview',
      duration: 379.583,
      video: `${base}/video`,
      captions: `${base}/captions`,
      poster: `${base}/poster`,
      chapters: `${base}/chapters`,
    });
  });
  r.get('/v1/:kind', async (req, res) => {
    requireThat(Object.hasOwn(assets, req.params.kind), 404, 'NOT_FOUND', '找不到媒體');
    const buffers = await verifiedFiles();
    const bytes = buffers![req.params.kind];
    const asset = assets[req.params.kind as keyof typeof assets];
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Accept-Ranges': 'bytes',
    });
    res.type(asset.mime);
    // Serve the exact verified bytes; never re-open a mutable path after hashing.
    const ranges = req.range(bytes.length);
    if (ranges !== undefined) {
      if (!Array.isArray(ranges) || ranges.type !== 'bytes' || ranges.length !== 1) {
        res.set('Content-Range', `bytes */${bytes.length}`).status(416).end();
        return;
      }
      const { start, end } = ranges[0];
      res
        .set('Content-Range', `bytes ${start}-${end}/${bytes.length}`)
        .status(206)
        .send(bytes.subarray(start, end + 1));
      return;
    }
    res.send(bytes);
  });
  return r;
}
