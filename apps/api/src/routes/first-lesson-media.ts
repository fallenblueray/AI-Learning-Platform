import { Router } from 'express';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
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
  poster: { file: 'lesson01-poster.jpg', mime: 'image/jpeg', bytes: 178130, sha256: '' },
  chapters: { file: 'lesson01.chapters.vtt', mime: 'text/vtt', bytes: 764, sha256: '' },
};
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
      const root = await fs.realpath(options.directory);
      for (const asset of Object.values(assets)) {
        const file = path.join(root, asset.file);
        const stat = await fs.lstat(file);
        requireThat(
          stat.isFile() && !stat.isSymbolicLink() && stat.size === asset.bytes,
          503,
          'MEDIA_UNAVAILABLE',
          '媒體尚未完成本機驗證',
        );
        const bytes = await fs.readFile(file);
        if (asset.sha256)
          requireThat(
            createHash('sha256').update(bytes).digest('hex') === asset.sha256,
            503,
            'MEDIA_UNAVAILABLE',
            '媒體尚未完成本機驗證',
          );
        if (asset.mime === 'text/vtt')
          requireThat(bytes.toString('utf8').startsWith('WEBVTT'), 503, 'MEDIA_UNAVAILABLE', '字幕格式無效');
      }
      return root;
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
  r.get('/v1/:kind', async (req, res, next) => {
    requireThat(Object.hasOwn(assets, req.params.kind), 404, 'NOT_FOUND', '找不到媒體');
    const root = await verifiedFiles();
    const asset = assets[req.params.kind as keyof typeof assets];
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    res
      .type(asset.mime)
      .sendFile(
        path.join(root!, asset.file),
        { cacheControl: false, lastModified: false, dotfiles: 'deny' },
        (error) => {
          if (!error) return;
          if ('status' in error && error.status === 416) {
            res.status(416).end();
            return;
          }
          next(error);
        },
      );
  });
  return r;
}
