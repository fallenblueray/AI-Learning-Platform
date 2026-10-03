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
  await expect(page.locator('.lesson-preview .planning-badge')).toHaveText('第一課可審版已完成');
  await expect(page.locator('.lesson-preview')).toContainText('本網站尚未開放播放');
  await expect(page.locator('.course-enrollment-card .button')).toHaveText(['查看完整課程規劃', '查看首課製作狀態']);
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
  await expect(page.getByRole('heading', { level: 1 })).toContainText('用 AI 做好內容');
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

test('featured course CTA stays entirely inside its card across tablet breakpoints', async ({ page }) => {
  for (const width of [767, 768, 820, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?page=catalog');
    const card = page.locator('.featured-social');
    const cta = card.getByRole('button', { name: '查看課程規劃', exact: true });
    const bounds = await card.evaluate((element) => {
      const card = element.getBoundingClientRect();
      const cta = element.querySelector('.featured-bottom .button')!.getBoundingClientRect();
      const status = element.querySelector('.featured-bottom > span')!.getBoundingClientRect();
      return {
        cardBottom: card.bottom,
        cardRight: card.right,
        cardLeft: card.left,
        ctaBottom: cta.bottom,
        ctaRight: cta.right,
        ctaLeft: cta.left,
        statusBottom: status.bottom,
      };
    });
    expect(bounds.ctaBottom, `CTA bottom at ${width}`).toBeLessThanOrEqual(bounds.cardBottom);
    expect(bounds.statusBottom, `status bottom at ${width}`).toBeLessThanOrEqual(bounds.cardBottom);
    expect(bounds.ctaRight).toBeLessThanOrEqual(bounds.cardRight);
    expect(bounds.ctaLeft).toBeGreaterThanOrEqual(bounds.cardLeft);
    await cta.click();
    await expect(page).toHaveURL(/page=social-course/);
  }
});

test('mobile drawer settles fully and closes by button, escape and backdrop with restored focus', async ({ page }) => {
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const trigger = page.getByRole('button', { name: '開啟選單' }),
      drawer = page.locator('.sidebar');
    for (const method of ['button', 'escape', 'backdrop']) {
      await trigger.click();
      await expect.poll(() => drawer.evaluate((e) => Math.round(e.getBoundingClientRect().left))).toBe(0);
      await expect(drawer.getByRole('button', { name: '探索課程', exact: true })).toBeVisible();
      await expect(page.locator('.main-shell')).toHaveAttribute('inert', '');
      await expect(drawer).toHaveAttribute('aria-modal', 'true');
      expect(await page.locator('.menu-backdrop').evaluate((e) => getComputedStyle(e).zIndex)).toBe('50');
      await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('.sidebar')))).toBe(true);
      await page.keyboard.press('Shift+Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.sidebar')))).toBe(true);
      if (method === 'button') await drawer.getByRole('button', { name: '關閉選單', exact: true }).click();
      else if (method === 'escape') await page.keyboard.press('Escape');
      else await page.locator('.menu-backdrop').click({ position: { x: width - 20, y: 300 } });
      await expect(drawer).not.toHaveClass(/open/);
      await expect
        .poll(() => drawer.evaluate((e) => Math.round(e.getBoundingClientRect().right)))
        .toBeLessThanOrEqual(0);
      await expect(trigger).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    }
    await trigger.click();
    await page.setViewportSize({ width: 1024, height: 844 });
    await expect(drawer).not.toHaveClass(/open/);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    await expect(page.locator('.main-shell')).not.toHaveAttribute('inert', '');
    await page.setViewportSize({ width, height: 844 });
    await trigger.focus();
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('.sidebar')))).toBe(false);
    }
  }
});

test('important status text has readable size and contrast on phones and tablet', async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?page=social-course');
    const samples = await page
      .locator('.chapter h3 small, .chapter li small, .resource-groups li small, .course-mobile-action span')
      .evaluateAll((elements) =>
        elements
          .filter((e) => e.getClientRects().length)
          .map((e) => {
            const style = getComputedStyle(e);
            let node = e,
              background = '';
            while (node) {
              const color = getComputedStyle(node).backgroundColor;
              if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
                background = color;
                break;
              }
              node = node.parentElement!;
            }
            return { size: parseFloat(style.fontSize), foreground: style.color, background };
          }),
      );
    const luminance = (color: string) =>
      color
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    for (const sample of samples) {
      expect(sample.size).toBeGreaterThanOrEqual(12);
      const a = luminance(sample.foreground),
        b = luminance(sample.background);
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('phone headings keep meaningful phrases together', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['home', 'catalog']) {
      await page.goto('/?page=' + route);
      const lines = await page.locator('h1').evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT),
          rows = new Map<number, string>();
        let node;
        while ((node = walker.nextNode()))
          for (let i = 0; i < node.textContent!.length; i++) {
            const char = node.textContent![i];
            if (!char.trim()) continue;
            const range = document.createRange();
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            const top = Math.round(range.getBoundingClientRect().top);
            rows.set(top, (rows.get(top) || '') + char);
          }
        return [...rows.values()];
      });
      for (const line of lines) expect(line.length, `${route} ${width}: ${line}`).toBeGreaterThan(1);
    }
  }
});

test('public navigation and course guidance retain readable text contrast', async ({ page }) => {
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['home', 'catalog']) {
      await page.goto('/?page=' + route);
      await page.getByText('正在載入課程…').waitFor({ state: 'hidden' });
      const samples = await page
        .locator(
          '.social-kicker, .hero-footnote, .social-method > span, .journey-grid small, .path-item p, .path-number, .catalog-section input, .catalog-section .tabs button, .course-footer small, .trust-strip > span',
        )
        .evaluateAll((elements) =>
          elements
            .filter((e) => e.getClientRects().length)
            .map((e) => {
              let node = e,
                background = '';
              while (node) {
                const color = getComputedStyle(node).backgroundColor;
                if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
                  background = color;
                  break;
                }
                node = node.parentElement!;
              }
              return { foreground: getComputedStyle(e).color, background, text: e.textContent?.slice(0, 60) };
            }),
        );
      const luminance = (color: string) =>
        color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => v / 255)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      expect(samples.length).toBeGreaterThan(0);
      for (const sample of samples) {
        const a = luminance(sample.foreground),
          b = luminance(sample.background);
        expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), `${route}: ${sample.text}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
  }
});
