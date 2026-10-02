import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import { firstLessonMedia } from '../../apps/web/src/firstLesson';

test('home, first workshop and browser back remain usable without an account', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('你有想法');
  await page.getByRole('button', { name: '從第一課開始', exact: true }).click();
  await expect(page).toHaveURL(/page=first-lesson/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('AI新手不用怕');
  if (firstLessonMedia.video) {
    await expect(page.locator('video')).toHaveAttribute('src', firstLessonMedia.video);
    if (firstLessonMedia.captions)
      await expect(page.locator('track[kind="captions"]')).toHaveAttribute('src', firstLessonMedia.captions);
  } else {
    await expect(page.getByText('配音影片與繁體中文字幕將在驗收後開放。')).toBeVisible();
    await expect(page.locator('video')).toHaveCount(0);
  }
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('你有想法');
  expect(errors).toEqual([]);
});

test('share card exports real 1080 PNGs in all three colors and handles empty/long text', async ({
  page,
}, testInfo) => {
  await page.goto('/?page=first-lesson');
  const title = page.getByLabel('卡片標題', { exact: false });
  await title.fill('');
  await page.getByRole('button', { name: '下載我的分享卡' }).click();
  await expect(page.getByText('請先填寫標題，再下載分享卡。')).toBeVisible();
  await expect(title).toBeFocused();
  await title.fill('     ');
  await page.getByRole('button', { name: '下載我的分享卡' }).click();
  await expect(page.getByText('請先填寫標題，再下載分享卡。')).toBeVisible();
  await title.fill('學'.repeat(60));
  expect((await title.inputValue()).length).toBe(60);
  await page.getByRole('textbox', { name: '作者 選填' }).fill('');
  for (const [label, color] of [
    ['海軍藍', [21, 43, 70]],
    ['薄荷綠', [200, 237, 223]],
    ['暖橙', [247, 176, 119]],
  ] as const) {
    await page.getByLabel(label, { exact: true }).check();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '下載我的分享卡' }).click();
    const download = await downloadPromise;
    const file = testInfo.outputPath(`share-card-${label}.png`);
    await download.saveAs(file);
    const buffer = await fs.readFile(file);
    expect(buffer.subarray(1, 4).toString()).toBe('PNG');
    expect(buffer.readUInt32BE(16)).toBe(1080);
    expect(buffer.readUInt32BE(20)).toBe(1080);
    const sample = await page.evaluate(
      async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1080;
        const context = canvas.getContext('2d')!;
        context.drawImage(img, 0, 0);
        return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
      },
      `data:image/png;base64,${buffer.toString('base64')}`,
    );
    expect(sample).toEqual(color);
    await testInfo.attach(`1080 PNG ${label}`, { path: file, contentType: 'image/png' });
  }
  await page.getByRole('textbox', { name: '作者 選填' }).fill('測試作者');
  await expect(page.locator('.share-tool .artwork-bottom')).toContainText('測試作者');
});

test('40, 45 and 60 Chinese characters fit between the artwork and footer on mobile and desktop', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?page=first-lesson');
    for (const count of [40, 45, 60]) {
      const value = '學'.repeat(count);
      await page.getByLabel('卡片標題').fill(value);
      await page.getByRole('textbox', { name: '作者 選填' }).fill('    ');
      for (const theme of ['海軍藍', '薄荷綠', '暖橙']) {
        await page.getByLabel(theme, { exact: true }).check();
        const title = page.locator('.share-tool .card-title-lines');
        await expect(title).toHaveText(value);
        const bounds = await title.evaluate((element) => {
          const rect = (element as unknown as SVGGraphicsElement).getBBox();
          return { top: rect.y, bottom: rect.y + rect.height, right: rect.x + rect.width };
        });
        expect(bounds.top).toBeGreaterThan(326);
        expect(bounds.bottom).toBeLessThan(850);
        expect(bounds.right).toBeLessThanOrEqual(996);
      }
    }
  }
});

test('workshop steps, copy prompt and self-check work without mutating LMS', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const writes: string[] = [];
  page.on('request', (request) => {
    if (
      /\/api\/v1\/(enrollments|courses|checkout|orders|wallet)/.test(request.url()) &&
      !['GET', 'HEAD'].includes(request.method())
    )
      writes.push(request.url());
  });
  await page.goto('/?page=first-lesson');
  for (let step = 0; step < 4; step++) await page.getByRole('button', { name: '完成這一步，繼續' }).click();
  await page.getByRole('button', { name: '記下這一步' }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5');
  await page.getByRole('button', { name: '複製完整提示' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('1080 × 1080');
  for (const [question, answer] of [1, 2, 2].entries())
    await page.locator(`input[name="review-${question}"]`).nth(answer).check();
  await page.getByRole('button', { name: '查看自我檢查結果' }).click();
  await expect(page.getByText('你已掌握這次練習的重點！記得下載你的作品。')).toBeVisible();
  expect(writes).toEqual([]);
});

test('mobile navigation, keyboard modal and responsive layouts', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['home', 'catalog', 'first-lesson', 'learning']) {
      await page.goto(`/?page=${route}`);
      await expect(page.locator('main')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${route} width ${width}`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '開啟選單' }).click();
  await expect(page.locator('.sidebar')).toHaveClass(/open/);
  await page.locator('.sidebar').getByRole('button', { name: '探索課程', exact: true }).click();
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  await page.locator('.mobile-bottom-nav').getByRole('button', { name: '我的學習', exact: true }).click();
  await expect(page.getByRole('heading', { name: '登入，繼續你的學習旅程。' })).toBeVisible();
  await page.locator('.top-actions').getByRole('button', { name: '登入 / 註冊' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.top-actions').getByRole('button', { name: '登入 / 註冊' })).toBeFocused();
});

test('small phones show the brand and first step before the full tool, with a usable drawer', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/?page=first-lesson');
    await expect(page.locator('.mobile-brand')).toHaveText('創科學苑');
    const bounds = await page.evaluate(() =>
      Object.fromEntries(
        [
          '.mobile-brand',
          '.top-actions',
          '.workshop-video',
          '.workshop-result-preview',
          '.step-panel',
          '.step-body h2',
          '.share-tool',
          '.mobile-bottom-nav',
        ].map((selector) => {
          const rect = document.querySelector(selector)!.getBoundingClientRect();
          return [
            selector,
            { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height },
          ];
        }),
      ),
    );
    expect(bounds['.mobile-brand'].right).toBeLessThan(bounds['.top-actions'].left);
    if (!firstLessonMedia.video) expect(bounds['.workshop-video'].height).toBeLessThan(100);
    expect(bounds['.workshop-result-preview'].bottom).toBeLessThan(bounds['.step-panel'].top);
    expect(bounds['.step-panel'].bottom).toBeLessThan(bounds['.share-tool'].top);
    if (!firstLessonMedia.video) expect(bounds['.step-body h2'].bottom).toBeLessThan(bounds['.mobile-bottom-nav'].top);
    await expect(page.getByRole('link', { name: '開始第1步' })).toHaveClass('primary-shortcut');
    await expect(page.getByText('免登入開始 · 公開練習')).toBeVisible();
    await page.locator('.step-tabs button').nth(2).click();
    await page.getByRole('link', { name: '開始第1步' }).click();
    await expect(page.locator('.step-body h2')).toHaveText('先看成果，再開始');
    await page.evaluate(() => window.scrollTo(0, 0));
    for (const selector of ['.step-tag-compact', '.mobile-bottom-nav span', '.field-hint', '.tool-heading > span']) {
      expect(
        await page
          .locator(selector)
          .evaluateAll((elements) => elements.every((element) => parseFloat(getComputedStyle(element).fontSize) >= 12)),
      ).toBe(true);
    }
    await page.getByRole('button', { name: '開啟選單' }).click();
    await expect
      .poll(() => page.locator('.sidebar').evaluate((element) => Math.round(element.getBoundingClientRect().left)))
      .toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.sidebar').getByRole('button', { name: '探索課程', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  }
});

test('catalog fetch failures offer a working retry and empty search has feedback', async ({ page }) => {
  let fail = true;
  await page.route('**/api/v1/courses?*', async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: '測試暫時未能載入' }),
      });
    else await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [] }) });
  });
  await page.goto('/?page=catalog');
  await expect(page.getByRole('heading', { name: '課程暫時未能載入' })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: '重新載入課程' }).click();
  await expect(page.getByRole('heading', { name: '下一段學習旅程，準備中。' })).toBeVisible();
  await page.getByLabel('搜尋課程').fill('沒有這門課');
  await expect(page.getByRole('button', { name: '查看首課：分享卡小工具' })).toHaveCount(0);
});

test('private media preview stays unavailable on denied access or untrusted metadata', async ({ page }) => {
  for (const body of [
    null,
    {
      access: 'admin-mfa-preview',
      video: 'https://untrusted.invalid/movie.mp4',
      captions: 'https://untrusted.invalid/captions.vtt',
    },
  ]) {
    await page.route('**/api/v1/first-lesson-media/v1', (route) =>
      route.fulfill({ status: body ? 200 : 403, json: body ?? { error: 'ADMIN_MFA_REQUIRED' } }),
    );
    await page.goto('/?page=first-lesson&mediaPreview=1');
    await expect(page.getByText('私人影片尚未可用。請確認管理員雙重驗證及本機媒體驗證狀態。')).toBeVisible();
    await expect(page.locator('video')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '下載我的分享卡' })).toBeVisible();
    await page.unroute('**/api/v1/first-lesson-media/v1');
  }
});
