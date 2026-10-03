import { test, expect } from '@playwright/test';
test('desktop and mobile course-to-certificate flow', async ({ page }) => {
  const email = process.env.E2E_EMAIL,
    password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, 'Provide an invited demo learner through E2E_EMAIL/E2E_PASSWORD.');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: '登入 / 註冊' }).first().click();
  await page.getByLabel('電郵地址').fill(email!);
  await page.getByLabel('密碼', { exact: true }).fill(password!);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await page.locator('.desktop-platform-nav').getByRole('button', { name: '探索課程', exact: true }).click();
  const course = page
    .locator('.course-card')
    .filter({ hasText: '示範課 · 未公開' })
    .filter({ hasText: '認識生成式 AI：從第一個提示開始' })
    .first();
  await expect(course).toBeVisible();
  await course.getByRole('button', { name: '查看 認識生成式 AI：從第一個提示開始' }).click();
  const confirm = page.getByRole('button', { name: '確認使用此級免費名額' });
  if (await confirm.isVisible()) await confirm.click();
  await page.getByRole('button', { name: '課程測驗', exact: true }).click();
  for (const [i, choice] of [1, 2, 1, 0, 1].entries())
    await page
      .locator(`input[name="q${i + 1}"]`)
      .nth(choice)
      .check();
  await page.getByRole('button', { name: '提交測驗' }).click();
  await expect(page.getByRole('heading', { name: '恭喜，你已通過課程測驗！' })).toBeVisible();
  await page.getByRole('button', { name: '我的證書', exact: true }).click();
  await expect(page.getByRole('button', { name: '下載 PDF' }).first()).toBeEnabled({ timeout: 30000 });
  await page.locator('.desktop-platform-nav').getByRole('button', { name: '探索課程', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '開啟選單' }).click();
  await page.locator('.sidebar').getByRole('button', { name: '我的學習', exact: true }).click();
  await expect(page.getByRole('button', { name: '重溫課程' }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('reading progress, account settings and test wallet survive the redesign', async ({ page }) => {
  const email = process.env.E2E_EMAIL,
    password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, 'Provide an isolated invited learner.');
  await page.goto('/');
  await page.locator('.top-actions').getByRole('button', { name: '登入 / 註冊' }).click();
  await page.getByLabel('電郵地址').fill(email!);
  await page.getByLabel('密碼', { exact: true }).fill(password!);
  await page.getByRole('button', { name: '登入', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('.desktop-platform-nav').getByRole('button', { name: '我的學習', exact: true }).click();
  await page.getByRole('button', { name: '重溫課程' }).first().click();
  await page.getByRole('button', { name: '標記已閱讀' }).click();
  await expect(page.getByRole('status')).toContainText('已記下你的學習進度');
  await page.reload();
  await page.getByRole('button', { name: '重溫課程' }).first().click();
  await expect(page.locator('.lesson-progress-banner')).toContainText('1 / 2');
  await page.getByRole('button', { name: '帳戶設定', exact: true }).click();
  const name = page.getByLabel('證書姓名');
  const originalName = await name.inputValue();
  await name.fill('實作測試學員');
  await page.getByRole('button', { name: '儲存姓名' }).click();
  await expect(page.getByRole('status')).toContainText('姓名已更新');
  await page.reload();
  await expect(name).toHaveValue('實作測試學員');
  await name.fill(originalName);
  await page.getByRole('button', { name: '儲存姓名' }).click();
  await expect(page.getByRole('status')).toContainText('姓名已更新');
  await page.locator('.desktop-platform-nav').getByRole('button', { name: '學習點數', exact: true }).click();
  await expect(page.getByText('目前為測試付款模式，不會提供正式收費服務。')).toBeVisible();
  for (const button of await page.getByRole('button', { name: '前往安全付款' }).all())
    await expect(button).toBeDisabled();
});
