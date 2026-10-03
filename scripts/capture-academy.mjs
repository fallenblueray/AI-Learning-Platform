// Run against the isolated local API/web/worker. Never pass production credentials.
// E2E_URL, E2E_EXECUTABLE_PATH and optional E2E_EMAIL/E2E_PASSWORD match Playwright config.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.E2E_URL || 'http://localhost:5173';
const destination = path.resolve('.local/qa');
await fs.mkdir(destination, { recursive: true });
const browser = await chromium.launch(
  process.env.E2E_EXECUTABLE_PATH
    ? { executablePath: process.env.E2E_EXECUTABLE_PATH, headless: true }
    : { channel: process.env.E2E_BROWSER || 'chrome', headless: true },
);
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
const captures = [];
page.on('pageerror', (error) => errors.push(error.message));
async function capture(name, fullPage = true) {
  await page.evaluate(() => document.fonts.ready);
  if (await page.getByRole('button', { name: '關閉通知' }).isVisible())
    await page.getByRole('button', { name: '關閉通知' }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw new Error(`Horizontal overflow: ${name}`);
  await page.screenshot({ path: path.join(destination, `${name}.png`), fullPage });
  captures.push({ name, viewport: page.viewportSize(), overflow });
}
try {
  for (const [label, viewport] of [
    ['desktop', { width: 1440, height: 1000 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(baseURL);
    await page.locator('main h1').waitFor();
    await page.getByText('正在載入課程…').waitFor({ state: 'hidden' });
    await capture(`home-${label}`);
    await capture(`home-${label}-viewport`, false);
    await page.goto(`${baseURL}/?page=first-lesson`);
    await page.locator('main h1').waitFor();
    await page.getByText('正在載入課程…').waitFor({ state: 'hidden' });
    await capture(`lesson-${label}`);
    await capture(`lesson-${label}-viewport`, false);
    await page.getByRole('textbox', { name: '作者 選填' }).fill('創科學苑');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: '下載我的分享卡' }).click();
    await (await download).saveAs(path.join(destination, `share-card-${label}.png`));
    await page.goto(`${baseURL}/?page=catalog`);
    await page.locator('main h1').waitFor();
    await page.getByText('正在載入課程…').waitFor({ state: 'hidden' });
    await capture(`catalog-${label}`, false);
    await page.locator('.top-actions').getByRole('button', { name: '登入 / 註冊' }).click();
    await capture(`login-${label}`, false);
    await page.keyboard.press('Escape');
  }
  if (process.env.E2E_EMAIL && process.env.E2E_PASSWORD) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(baseURL);
    await page.locator('.top-actions').getByRole('button', { name: '登入 / 註冊' }).click();
    await page.getByLabel('電郵地址').fill(process.env.E2E_EMAIL);
    await page.getByLabel('密碼', { exact: true }).fill(process.env.E2E_PASSWORD);
    await page.getByRole('button', { name: '登入', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.locator('.desktop-platform-nav').getByRole('button', { name: '探索課程', exact: true }).click();
    await page
      .locator('.course-card')
      .filter({ hasText: '示範課 · 未公開' })
      .filter({ hasText: '設計可重用的 AI 工作流程' })
      .first()
      .getByRole('button', { name: '查看 設計可重用的 AI 工作流程' })
      .click();
    await capture('course-detail-desktop', false);
    await page.setViewportSize({ width: 390, height: 844 });
    await capture('course-detail-mobile', false);
    await page.keyboard.press('Escape');
    for (const [label, viewport] of [
      ['desktop', { width: 1440, height: 1000 }],
      ['mobile', { width: 390, height: 844 }],
    ]) {
      await page.setViewportSize(viewport);
      await page.goto(`${baseURL}/?page=learning`);
      await page.locator('main h1').waitFor();
      await page.getByText('正在載入課程…').waitFor({ state: 'hidden' });
      await capture(`my-learning-${label}`, false);
      await page.getByRole('button', { name: '重溫課程' }).first().click();
      await page.getByRole('button', { name: '標記已閱讀' }).waitFor();
      await capture(`lms-lesson-${label}`, false);
      await page.getByRole('button', { name: '課程測驗', exact: true }).click();
      await capture(`lms-quiz-${label}`, false);
      await page.goto(`${baseURL}/?page=certificates`);
      await page.locator('main h1').waitFor();
      await page.getByText('正在載入課程…').waitFor({ state: 'hidden' });
      await capture(`certificates-${label}`, false);
      await page.goto(`${baseURL}/?page=wallet`);
      await page.locator('main h1').waitFor();
      await page.getByText('正在載入課程…').waitFor({ state: 'hidden' });
      await capture(`wallet-${label}`, false);
    }
  }
  await fs.writeFile(
    path.join(destination, 'capture-report.json'),
    JSON.stringify({ baseURL, capturedAt: new Date().toISOString(), errors, captures }, null, 2),
  );
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    `Captured ${captures.length} real browser views in ${destination}; no page errors or horizontal overflow.`,
  );
} finally {
  await browser.close();
}
