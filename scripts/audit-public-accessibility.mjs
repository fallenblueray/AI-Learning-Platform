import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const axeSource = process.env.AXE_SOURCE;
if (!axeSource) throw Error('Set AXE_SOURCE to a local axe-core/axe.min.js from the official npm package.');
const baseURL = process.env.E2E_URL || 'http://localhost:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw Error('Isolated local QA only');
await fs.mkdir('.local/qa', { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
const output = [];
for (const width of [390, 768, 320, 1440]) {
  for (const route of ['home', 'catalog', 'social-course']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const runtime = [],
      network = [];
    page.on('pageerror', (error) => runtime.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('status of 401'))
        runtime.push({ text: message.text(), location: message.location() });
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && !(/\/auth\/(me|refresh)$/.test(response.url()) && response.status() === 401))
        network.push({ url: response.url(), status: response.status() });
    });
    page.on('requestfailed', (request) => {
      if (request.failure()?.errorText !== 'net::ERR_ABORTED')
        network.push({ url: request.url(), failure: request.failure()?.errorText });
    });
    const ready = Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/v1/config')),
      page.waitForResponse((r) => r.url().includes('/api/v1/courses?')),
    ]);
    await page.goto(baseURL + '/?page=' + route);
    await ready;
    await page.locator('main h1').waitFor();
    await page.getByText('正在載入課程…').waitFor({ state: 'hidden' });
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ path: axeSource });
    async function audit(state) {
      const result = await page.evaluate(() =>
        axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }),
      );
      output.push({
        width,
        route,
        state,
        runtime: [...runtime],
        network: [...network],
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, summary: n.failureSummary })),
        })),
        incomplete: result.incomplete.map((v) => ({
          id: v.id,
          count: v.nodes.length,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
        passes: result.passes.length,
      });
    }
    console.log('Auditing', width, route);
    await audit('initial');
    if (route === 'social-course') {
      await page.getByRole('button', { name: '展開全部', exact: true }).click();
      await page.getByText('課程使用甚麼語言？', { exact: true }).click();
      await audit('expanded-curriculum-faq');
    }
    if (width === 390 || width === 768) {
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      await page.getByRole('button', { name: '開啟選單' }).click();
      await page.waitForFunction(() => Math.abs(document.querySelector('.sidebar').getBoundingClientRect().left) < 0.5);
      await audit('drawer');
    }
    await page.close();
  }
}
await fs.writeFile('.local/qa/public-accessibility.json', JSON.stringify(output, null, 2));
console.log(
  JSON.stringify(
    output.map((r) => ({
      width: r.width,
      route: r.route,
      state: r.state,
      violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, count: v.nodes.length })),
      runtime: r.runtime,
      network: r.network,
    })),
    null,
    2,
  ),
);
await browser.close();
if (output.some((r) => r.violations.length || r.runtime.length || r.network.length)) process.exitCode = 1;
