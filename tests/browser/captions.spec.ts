import { test, expect } from '@playwright/test';

test('versioned LMS captions play, switch language, turn off and refresh on desktop and phones', async ({
  page,
}, testInfo) => {
  const email = process.env.E2E_CAPTION_EMAIL,
    password = process.env.E2E_CAPTION_PASSWORD;
  test.skip(!email || !password, 'Requires an isolated learner enrolled in a synthetic two-caption video fixture.');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    if (await page.locator('.top-actions').getByRole('button', { name: '登入 / 註冊' }).isVisible()) {
      await page.locator('.top-actions').getByRole('button', { name: '登入 / 註冊' }).click();
      await page.getByLabel('電郵地址').fill(email!);
      await page.getByLabel('密碼', { exact: true }).fill(password!);
      await page.getByRole('button', { name: '登入', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.goto('/?page=learning');
    await page.getByRole('button', { name: '繼續學習' }).first().click();
    const video = page.locator('video');
    await expect(video).toBeVisible();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
    await video.evaluate(async (v: HTMLVideoElement) => {
      v.muted = true;
      await v.play();
    });
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.1);
    await video.evaluate((v: HTMLVideoElement) => v.pause());
    const select = page.getByLabel('選擇字幕');
    await expect(select).toHaveValue('zh');
    await video.evaluate((v: HTMLVideoElement) => {
      v.textTracks[0].mode = 'disabled';
      v.textTracks[1].mode = 'showing';
    });
    await expect(select).toHaveValue('en');
    await select.selectOption('en');
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => (v.textTracks[1].activeCues?.[0] as VTTCue)?.text ?? ''))
      .toBe('Synthetic test captions');
    expect(await video.evaluate((v: HTMLVideoElement) => v.textTracks[0].mode)).toBe('disabled');
    await select.selectOption('off');
    expect(
      await video.evaluate((v: HTMLVideoElement) => Array.from(v.textTracks).every((t) => t.mode === 'disabled')),
    ).toBe(true);
    await select.selectOption('zh');
    const previousVideo = await video.elementHandle();
    await page.getByRole('button', { name: '重新載入教材' }).click();
    await expect.poll(() => previousVideo!.evaluate((v) => v.isConnected)).toBe(false);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
    await expect(select).toHaveValue('zh');
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.textTracks[0].mode)).toBe('showing');
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.textTracks[0].cues?.length ?? 0)).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await video.evaluate(async (v: HTMLVideoElement) => {
      v.muted = true;
      await v.play();
    });
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2);
    await video.evaluate((v: HTMLVideoElement) => v.pause());
    await video.scrollIntoViewIfNeeded();
    const screenshot = testInfo.outputPath(`synthetic-captions-${width}.png`);
    await page.screenshot({ path: screenshot });
    await testInfo.attach(`Synthetic captions ${width}`, { path: screenshot, contentType: 'image/png' });
  }
});
