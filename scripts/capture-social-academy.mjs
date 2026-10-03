// Public UI screenshots only. The API must point to an isolated local database.
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const baseURL = process.env.E2E_URL || 'http://localhost:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw Error('Local QA only');
const destination = 'docs/screenshots/social-academy';
await fs.mkdir(destination, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.E2E_EXECUTABLE_PATH || '/usr/bin/chromium',
  headless: true,
});
const page = await browser.newPage();
const errors = [],
  captures = [];
page.on('pageerror', (error) => errors.push(error.message));
async function capture(name, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  if (await page.locator('.toast').isVisible()) throw Error(`Unexpected notification during capture: ${name}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (overflow) throw Error(`Horizontal overflow: ${name}`);
  await page.screenshot({ path: `${destination}/${name}.jpg`, type: 'jpeg', quality: 85, fullPage });
  captures.push({ name, viewport: page.viewportSize(), fullPage, horizontalOverflow: overflow });
}
try {
  const health = await page.request.get(`${baseURL}/api/v1/config`);
  if (!health.ok()) throw Error(`Local API unavailable: ${health.status()}`);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const route of ['home', 'catalog', 'social-course']) {
      await page.goto(`${baseURL}/?page=${route}`);
      await page.locator('main h1').waitFor();
      await page.getByText('正在載入課程…').waitFor({ state: 'hidden' });
      await capture(`${route}-${width}`);
      if (route === 'catalog' && width === 768) {
        const card = await page.locator('.featured-social').boundingBox();
        await page.setViewportSize({ width, height: Math.ceil(card.height + card.y) + 200 });
        await page
          .locator('.featured-social')
          .screenshot({ path: `${destination}/featured-card-768.jpg`, type: 'jpeg', quality: 85 });
        captures.push({ name: 'featured-card-768', viewport: page.viewportSize(), element: '.featured-social' });
        await page.setViewportSize({ width, height: 844 });
      }
      if (route === 'social-course' && [1440, 390].includes(width)) await capture(`${route}-${width}-full`, true);
    }
    const action =
      width === 1440
        ? page.getByRole('button', { name: '查看完整課程規劃' })
        : page.locator('.course-mobile-action').getByRole('button', { name: '查看課綱' });
    await action.click();
    await page.waitForFunction(() => {
      const node = document.querySelector('#course-curriculum');
      return Math.abs(node.getBoundingClientRect().top - parseFloat(getComputedStyle(node).scrollMarginTop)) < 2;
    });
    await page.getByRole('button', { name: '展開全部', exact: true }).click();
    await action.click();
    await page.waitForFunction(() => {
      const node = document.querySelector('#course-curriculum');
      return Math.abs(node.getBoundingClientRect().top - parseFloat(getComputedStyle(node).scrollMarginTop)) < 2;
    });
    await capture(`curriculum-${width}`);
    if (width === 390) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.getByRole('button', { name: '開啟選單' }).click();
      await page.waitForFunction(() => {
        const drawer = document.querySelector('.sidebar');
        const rect = drawer.getBoundingClientRect();
        const transform = new DOMMatrixReadOnly(getComputedStyle(drawer).transform);
        return Math.abs(rect.left) < 0.5 && Math.abs(transform.m41) < 0.5;
      });
      await capture('navigation-mobile');
    }
  }
  await fs.writeFile(
    `${destination}/capture-manifest.json`,
    JSON.stringify({ capturedAt: new Date().toISOString(), browser: 'Chromium', baseURL, captures, errors }, null, 2) +
      '\n',
  );
  if (errors.length) throw Error(JSON.stringify(errors));
  console.log(`Captured ${captures.length} screenshots; no page exceptions or horizontal overflow.`);
} finally {
  await browser.close();
}
