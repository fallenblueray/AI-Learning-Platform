import { Service } from 'typedi';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.config';
import { Certificate, Version } from '../models';
import { ownedEnrollment } from './course.service';
import { requireThat } from '../exceptions/http.exception';
@Service()
export class StorageService {
  private client() {
    return new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    });
  }
  localPath(key: string) {
    requireThat(
      /^(media|certificates)\/[a-zA-Z0-9-]+\.(mp4|pdf|png|jpg|vtt)$/.test(key),
      400,
      'INVALID_KEY',
      '檔案路徑無效',
    );
    return path.resolve(env.LOCAL_STORAGE_PATH, key);
  }
  async put(key: string, buffer: Buffer, contentType: string) {
    if (contentType === 'text/vtt')
      requireThat(
        buffer.length <= 1024 * 1024 && /^\uFEFF?WEBVTT(?:[ \t].*)?(?:\r?\n|$)/.test(buffer.toString('utf8')),
        400,
        'INVALID_VTT',
        '字幕必須是 1MB 以內的 WebVTT',
      );
    if (env.STORAGE_DRIVER === 's3')
      await this.client().send(
        new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: buffer, ContentType: contentType }),
      );
    else {
      const target = this.localPath(key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, buffer);
    }
  }
  async url(key: string) {
    if (env.STORAGE_DRIVER === 's3')
      return getSignedUrl(this.client(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn: 300 });
    const token = jwt.sign({ key, kind: 'asset' }, env.JWT_SECRET, {
      expiresIn: '5m',
      audience: 'pt-asset',
      issuer: 'pt-academy',
    });
    return `/api/v1/assets/local?token=${token}`;
  }
  async upload(name: string, contentType: string) {
    const extension: Record<string, string> = {
      'video/mp4': 'mp4',
      'application/pdf': 'pdf',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'text/vtt': 'vtt',
    };
    requireThat(extension[contentType], 400, 'INVALID_TYPE', '不支援此檔案類型');
    const key = `media/${randomUUID()}.${extension[contentType]}`;
    if (env.STORAGE_DRIVER === 's3')
      return {
        key,
        url: await getSignedUrl(
          this.client(),
          new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }),
          { expiresIn: 900 },
        ),
        method: 'PUT',
      };
    const token = jwt.sign({ key, content_type: contentType, kind: 'upload' }, env.JWT_SECRET, {
      expiresIn: '15m',
      audience: 'pt-upload',
      issuer: 'pt-academy',
    });
    return { key, url: `/api/v1/admin/assets/local?token=${token}`, method: 'PUT' };
  }
  async lesson(userId: string, enrollmentId: string, lessonId: string) {
    const e = await ownedEnrollment(userId, enrollmentId);
    const version = (await Version.findByPk(e.get('version_id')))!;
    const lesson = version.get('content').lessons.find((l) => l.id === lessonId);
    requireThat(lesson?.asset_key, 404, 'NOT_FOUND', '此單元沒有檔案');
    return {
      url: await this.url(lesson.asset_key),
      captions: await Promise.all(
        (lesson.captions ?? []).map(async ({ asset_key, ...track }) => ({ ...track, url: await this.url(asset_key) })),
      ),
    };
  }
  async caption(userId: string, enrollmentId: string, lessonId: string, captionId: string) {
    const e = await ownedEnrollment(userId, enrollmentId);
    const version = (await Version.findByPk(e.get('version_id')))!;
    const lesson = version.get('content').lessons.find((l) => l.id === lessonId);
    const track = lesson?.kind === 'video' ? lesson.captions?.find((t) => t.id === captionId) : undefined;
    requireThat(track, 404, 'NOT_FOUND', '此版本沒有這條字幕');
    return { url: await this.url(track.asset_key) };
  }
  async certificate(userId: string, id: string) {
    const c = await Certificate.findByPk(id);
    requireThat(c, 404, 'NOT_FOUND', '找不到證書');
    await ownedEnrollment(userId, c.get('enrollment_id'));
    requireThat(!c.get('revoked_at'), 410, 'CERTIFICATE_REVOKED', '此證書已撤銷');
    requireThat(c.get('pdf_key'), 409, 'CERTIFICATE_PENDING', '證書正在製作，請稍後再試');
    return { url: await this.url(c.get('pdf_key')!) };
  }
}
