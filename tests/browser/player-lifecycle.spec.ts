import { test, expect, type Page } from '@playwright/test';

async function openFixture(page: Page) {
  const email = process.env.E2E_CAPTION_EMAIL,
    password = process.env.E2E_CAPTION_PASSWORD;
  test.skip(!email || !password, 'Requires isolated two-lesson synthetic caption fixture.');
  await page.goto('/');
  await page.locator('.top-actions').getByRole('button', { name: '登入 / 註冊' }).click();
  await page.getByLabel('電郵地址').fill(email!);
  await page.getByLabel('密碼', { exact: true }).fill(password!);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/?page=learning');
  await page.getByRole('button', { name: '繼續學習' }).first().click();
  await expect(page.locator('video')).toBeVisible();
  await expect
    .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
}

test('exam round trip restores selected captions and native change listener', async ({ page }) => {
  await openFixture(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByLabel('選擇字幕').selectOption('en');
    await page.locator('.lesson-nav').getByRole('button', { name: '課程測驗', exact: true }).click();
    await expect(page.locator('video')).toHaveCount(0);
    await page.locator('.lesson-nav').getByRole('button', { name: '合成影片與雙語字幕', exact: true }).click();
    await expect(page.getByLabel('選擇字幕')).toHaveValue('en');
    await expect
      .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.textTracks[1].mode))
      .toBe('showing');
    await page.locator('video').evaluate((v: HTMLVideoElement) => {
      v.textTracks[1].mode = 'disabled';
      v.textTracks[0].mode = 'showing';
    });
    await expect(page.getByLabel('選擇字幕')).toHaveValue('zh');
    await page.getByLabel('選擇字幕').selectOption('off');
    await page.locator('.lesson-nav').getByRole('button', { name: '課程測驗', exact: true }).click();
    await page.locator('.lesson-nav').getByRole('button', { name: '合成影片與雙語字幕', exact: true }).click();
    expect(
      await page
        .locator('video')
        .evaluate((v: HTMLVideoElement) => Array.from(v.textTracks).every((t) => t.mode === 'disabled')),
    ).toBe(true);
  }
});

test('late refresh from lesson A cannot replace B media or contaminate B progress', async ({ page }) => {
  await openFixture(page);
  let release!: () => void, started!: () => void, settled!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  const finished = new Promise<void>((resolve) => {
    settled = resolve;
  });
  await page.route('**/lessons/fixture-video/asset', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    started();
    await gate;
    try {
      await route.fulfill({ json });
    } catch {
      /* A cancelled request cannot be fulfilled. */
    } finally {
      settled();
    }
  });
  await page.getByRole('button', { name: '重新載入教材' }).click();
  await pending;
  const bResponse = page.waitForResponse((r) => r.url().includes('/lessons/fixture-video-b/asset'));
  await page.locator('.lesson-nav').getByRole('button', { name: '第二個合成影片', exact: true }).click();
  const b = await (await bResponse).json();
  await expect.poll(() => page.locator('video').evaluate((v, url) => v.getAttribute('src') === url, b.url)).toBe(true);
  release();
  await finished;
  await expect.poll(() => page.locator('video').evaluate((v, url) => v.getAttribute('src') === url, b.url)).toBe(true);
  await expect
    .poll(() =>
      page
        .locator('track')
        .first()
        .evaluate((t, url) => t.getAttribute('src') === url, b.captions[0].url),
    )
    .toBe(true);
  const progress = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith('/progress'));
  await page.getByRole('button', { name: '標記已閱讀' }).click();
  expect((await progress).postDataJSON().lesson_id).toBe('fixture-video-b');
});

test('leaving a lesson cancels refresh and ignores a late error', async ({ page }) => {
  await openFixture(page);
  let release!: () => void, started!: () => void, settled!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  const finished = new Promise<void>((resolve) => {
    settled = resolve;
  });
  await page.route('**/lessons/fixture-video/asset', async (route) => {
    started();
    await gate;
    try {
      await route.fulfill({ status: 503, json: { error: { message: 'obsolete refresh error' } } });
    } catch {
      /* Cancelled browser request. */
    } finally {
      settled();
    }
  });
  const cancelled = page.waitForEvent('requestfailed', (r) => r.url().includes('/lessons/fixture-video/asset'));
  await page.getByRole('button', { name: '重新載入教材' }).click();
  await pending;
  await page.getByRole('button', { name: '返回我的學習' }).click();
  release();
  await Promise.all([cancelled, finished]);
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.getByText('obsolete refresh error')).toHaveCount(0);
  await expect(page.getByText('未能連接平台伺服器，請重新啟動本機平台後再試。')).toHaveCount(0);
});

test('expired media and a renewed session refresh the current lesson while preserving selection', async ({ page }) => {
  await openFixture(page);
  await page.getByLabel('選擇字幕').selectOption('en');
  await page.route('**/api/v1/assets/local?*', (route) =>
    route.request().resourceType() === 'media'
      ? route.fulfill({ status: 403, body: 'Synthetic expired media response' })
      : route.continue(),
  );
  await page.locator('video').evaluate((v: HTMLVideoElement) => v.load());
  await expect(page.getByText('影片連結可能已過期，請按「重新載入教材」。')).toBeVisible();
  await page.unroute('**/api/v1/assets/local?*');
  let attempts = 0;
  await page.route('**/lessons/fixture-video/asset', (route) =>
    ++attempts === 1
      ? route.fulfill({ status: 401, json: { error: { message: 'Synthetic expired access response' } } })
      : route.continue(),
  );
  const renewal = page.waitForResponse((r) => r.url().endsWith('/auth/refresh'));
  await page.getByRole('button', { name: '重新載入教材' }).click();
  expect((await renewal).status()).toBe(200);
  await expect.poll(() => attempts).toBe(2);
  await expect
    .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2);
  await expect(page.getByLabel('選擇字幕')).toHaveValue('en');
  await expect
    .poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.textTracks[1].mode))
    .toBe('showing');
  await page.locator('video').evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await expect.poll(() => page.locator('video').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.1);
});
