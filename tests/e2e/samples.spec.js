import { test, expect } from '@playwright/test';
import { SAMPLES } from '../../src/samples.js';

const SHOTS = 'docs/screenshots/m1a';

test('the app shows all 3 sample posters and swipes between them', async ({ page }) => {
  await page.goto('./');
  const frames = page.locator('#carousel .poster-frame');
  await expect(frames).toHaveCount(3);
  for (const recipe of SAMPLES) {
    await expect(page.getByRole('img', { name: `${recipe.lettering.title} poster` })).toBeAttached();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/app-1.png` });

  await frames.nth(1).scrollIntoViewIfNeeded();
  await expect(page.locator('#carousel-hint')).toHaveText(/^2 of 3/);
  await page.screenshot({ path: `${SHOTS}/app-2.png` });
});

test('bundled fonts load offline', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.locator('#offline-status')).toHaveText('Ready to work offline.');
  await context.setOffline(true);
  await page.reload();
  const loaded = await page.evaluate(async () => {
    const limelight = await document.fonts.load("100px 'Limelight'");
    const josefin = await document.fonts.load("700 100px 'Josefin Sans'");
    return [limelight, josefin].map((faces) => faces.length > 0 && faces.every((f) => f.status === 'loaded'));
  });
  expect(loaded).toEqual([true, true]);
});

test('full-size sample posters (1200×1800) for art review', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1800 }, deviceScaleFactor: 1 });
  for (let i = 0; i < SAMPLES.length; i++) {
    await page.goto(`tests/e2e/pages/poster.html?i=${i}`);
    await page.waitForSelector('body[data-ready="true"]');
    await page.screenshot({ path: `${SHOTS}/poster-${i + 1}.png` });
  }
  await page.close();
});
