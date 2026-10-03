import { test, expect } from '@playwright/test';

test('planned course navigation, chapters and FAQ work without enrollment or payment writes', async ({ page }) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (
      /\/api\/v1\/(enrollments|courses|checkout|orders|wallet)/.test(request.url()) &&
      !['GET', 'HEAD'].includes(request.method())
    )
      writes.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: '探索主題課程', exact: true }).click();
  await expect(page).toHaveURL(/page=social-course/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('社群行銷 × AI 副業實作課');
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('.course-enrollment-card')).toContainText('尚未開放報名');
  await expect(page.locator('.course-enrollment-card')).toContainText('港幣 HKD');
  await expect(page.locator('.chapter')).toHaveCount(7);
  await expect(page.locator('.chapter li:visible')).toHaveCount(4);
  await page.getByRole('button', { name: '查看完整課程規劃' }).click();
  await expect(page.locator('.course-anchor-nav .active')).toHaveText('課程章節');
  await page.getByRole('button', { name: '展開全部', exact: true }).click();
  await expect(page.locator('.chapter li:visible')).toHaveCount(28);
  await expect(page.locator('.chapter li:visible').first()).toContainText('筆記寫好了，怎樣變成帖文和配圖？');
  await page.getByRole('button', { name: '收合全部', exact: true }).click();
  await expect(page.locator('.chapter li:visible')).toHaveCount(0);
  await page.locator('.chapter h3 button').nth(6).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.chapter h3 button').nth(6)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.chapter li:visible')).toHaveCount(4);
  await expect(page.locator('.resource-groups li')).toHaveCount(18);
  await page.getByText('現在可以報名或觀看全部課程嗎？', { exact: true }).click();
  await expect(page.locator('.social-faq details[open]')).toContainText('並非已開放報名的商品');
  await page.getByText('課程使用甚麼語言？', { exact: true }).click();
  await expect(page.locator('.social-faq details[open]').last()).toContainText('普通話版本尚未提供');
  expect(writes).toEqual([]);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('下班後的想法');
});

test('course sticky navigation and mobile primary action are usable at four viewport sizes', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?page=social-course');
    if (width <= 900) {
      await expect(page.locator('.course-mobile-action')).toBeVisible();
      await expect(page.locator('.mobile-bottom-nav')).toBeHidden();
      await page.locator('.course-mobile-action').getByRole('button', { name: '查看課綱' }).click();
    } else {
      await expect(page.locator('.course-mobile-action')).toBeHidden();
      await page.getByRole('button', { name: '查看完整課程規劃' }).click();
    }
    await expect
      .poll(() =>
        page.locator('#course-curriculum').evaluate((element) => Math.round(element.getBoundingClientRect().top)),
      )
      .toBeLessThan(100);
    await expect
      .poll(() =>
        page.locator('.course-anchor-nav').evaluate((element) => Math.round(element.getBoundingClientRect().top)),
      )
      .toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: '常見問題', exact: true }).click();
    await expect
      .poll(() => page.locator('#course-faq').evaluate((element) => Math.round(element.getBoundingClientRect().top)))
      .toBeLessThan(250);
    await page.getByText('課程使用甚麼語言？', { exact: true }).click();
    await expect(page.locator('.social-faq details[open]')).toContainText('普通話版本尚未提供');
  }
});
