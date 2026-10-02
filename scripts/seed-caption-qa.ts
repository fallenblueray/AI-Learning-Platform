import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import Container from 'typedi';
import { User, Course, Version, Enrollment } from '../apps/api/src/models';
import { demoContent } from '../apps/api/src/database/seed';
import { sequelize } from '../apps/api/src/database/connection';
import { env } from '../apps/api/src/config/env.config';
import { StorageService } from '../apps/api/src/services/storage.service';
// Synthetic local QA only; never imports or publishes the formal Library lesson.
async function main() {
  if (
    env.NODE_ENV === 'production' ||
    !new URL(env.DATABASE_URL).pathname.endsWith('_test') ||
    env.STORAGE_DRIVER !== 'local'
  )
    throw Error('isolated local test only');
  const email = `caption-ui-${randomUUID()}@example.test`,
    password = 'Academy-caption-fixture-2026!';
  const user = await User.create({
    id: randomUUID(),
    email,
    name: '字幕合成教材測試',
    password_hash: await bcrypt.hash(password, 12),
    role: 'student',
    verified: true,
    demo_access: true,
  });
  const storage = Container.get(StorageService),
    video = `media/${randomUUID()}.mp4`,
    zh = `media/${randomUUID()}.vtt`,
    en = `media/${randomUUID()}.vtt`;
  await storage.put(video, await fs.readFile('.local/qa/media-fixture/fixture.mp4'), 'video/mp4');
  await storage.put(zh, Buffer.from('WEBVTT\n\n00:00.000 --> 00:02.900\n繁中合成測試字幕\n'), 'text/vtt');
  await storage.put(en, Buffer.from('WEBVTT\n\n00:00.000 --> 00:02.900\nSynthetic test captions\n'), 'text/vtt');
  const content = demoContent('beginner');
  content.title = '字幕選軌驗收 · 非正式教材';
  content.lessons = [
    {
      id: 'fixture-video',
      kind: 'video',
      title: '合成影片與雙語字幕',
      content: '僅供隔離測試，並非正式課程影片。',
      asset_key: video,
      captions: [
        { id: 'zh', language: 'zh-Hant', label: '繁體中文', asset_key: zh, default: true },
        { id: 'en', language: 'en', label: 'English', asset_key: en },
      ],
    },
  ];
  const course = await Course.create({ id: randomUUID(), draft: content, is_demo: true });
  const version = await Version.create({ id: randomUUID(), course_id: course.id, number: 1, content });
  await Course.update({ published_version_id: version.id }, { where: { id: course.id } });
  await Enrollment.create({
    id: randomUUID(),
    user_id: user.id,
    course_id: course.id,
    version_id: version.id,
    source: 'fixture',
  });
  await fs.writeFile('.local/qa/caption-fixture-account.json', JSON.stringify({ email, password }));
  await sequelize.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
