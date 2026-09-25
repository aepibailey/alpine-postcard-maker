import { test, expect } from '@playwright/test';

import { PALETTES } from '../../src/palettes.js';

const SHOTS = 'docs/screenshots/m2';
const posterMarkup = (page) => page.locator('#preview').innerHTML();

test('picker switches between the four mountains', async ({ page }) => {
  await page.goto('./');
  const preview = page.locator('#preview');
  await expect(preview.locator('svg')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const seen = new Set();
  for (const [name, kind] of [['Jagged spire', 'spire'], ['Broad massif', 'massif'], ['Lone pyramid', 'pyramid'], ['Random ridgeline', 'random']]) {
    await page.getByRole('radio', { name }).click();
    await expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
    await expect(preview).toHaveAttribute('data-peak', kind);
    seen.add(await posterMarkup(page));
  }
  expect(seen.size).toBe(4);
});

test('🎲 rolls a new ridgeline each time', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('radio', { name: 'Random ridgeline' }).click();
  const roll = page.getByRole('button', { name: /New ridgeline/ });
  await expect(roll).toBeVisible();
  const seeds = new Set([await page.locator('#preview').getAttribute('data-seed')]);
  for (let i = 0; i < 3; i++) {
    await roll.click();
    seeds.add(await page.locator('#preview').getAttribute('data-seed'));
  }
  expect(seeds.size).toBe(4);
  await expect(page.locator('#peak-label')).toHaveText(/Random ridgeline No\. \d+ · /);

  await page.getByRole('radio', { name: 'Jagged spire' }).click();
  await expect(roll).toBeHidden();
});

test('swiping the poster steps through the mountains', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('radio', { name: 'Jagged spire' }).click();
  const box = await page.locator('#preview').boundingBox();
  const y = box.y + box.height / 2;
  const swipe = async (from, to) => {
    await page.mouse.move(from, y);
    await page.mouse.down();
    await page.mouse.move(to, y, { steps: 5 });
    await page.mouse.up();
  };
  await swipe(box.x + box.width * 0.8, box.x + box.width * 0.2);
  await expect(page.locator('#preview')).toHaveAttribute('data-peak', 'massif');
  await swipe(box.x + box.width * 0.2, box.x + box.width * 0.8);
  await expect(page.locator('#preview')).toHaveAttribute('data-peak', 'spire');
  await swipe(box.x + box.width * 0.2, box.x + box.width * 0.8);
  await expect(page.locator('#preview')).toHaveAttribute('data-peak', 'random');
});

test('time of day recolours the whole poster', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('radio', { name: 'Jagged spire' }).click();
  await page.evaluate(() => document.fonts.ready);
  for (const [name, time] of [['Dawn', 'dawn'], ['Midday', 'midday'], ['Alpenglow', 'alpenglow'], ['Starry night', 'night']]) {
    await page.getByRole('radio', { name }).click();
    await expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
    const preview = page.locator('#preview');
    await expect(preview).toHaveAttribute('data-time', time);
    // The poster is drawn in this time's inks: its sky, peak and snow colours all appear.
    const markup = await preview.innerHTML();
    for (const ink of [PALETTES[time].sky[0], PALETTES[time].peak, PALETTES[time].snow]) expect(markup).toContain(ink);
    expect(markup.includes('-moon')).toBe(time === 'night');
    await expect(page.locator('#peak-label')).toContainText(name);
    await page.screenshot({ path: `${SHOTS}/app-${time}.png` });
  }
});

test('the chosen mountain and time are remembered after reopening', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('radio', { name: 'Random ridgeline' }).click();
  await page.getByRole('radio', { name: 'Starry night' }).click();
  const seed = await page.locator('#preview').getAttribute('data-seed');
  await page.reload();
  await expect(page.locator('#preview')).toHaveAttribute('data-peak', 'random');
  await expect(page.locator('#preview')).toHaveAttribute('data-seed', seed);
  await expect(page.locator('#preview')).toHaveAttribute('data-time', 'night');
});

test('editor and fonts work offline', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.locator('#offline-status')).toHaveText('Ready to work offline.');
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('radio', { name: 'Random ridgeline' }).click();
  await page.getByRole('button', { name: /New ridgeline/ }).click();
  await expect(page.locator('#preview svg')).toBeVisible();
  const loaded = await page.evaluate(async () => {
    const faces = [...await document.fonts.load("100px 'Limelight'"), ...await document.fonts.load("700 100px 'Josefin Sans'")];
    return faces.length >= 2 && faces.every((f) => f.status === 'loaded');
  });
  expect(loaded).toBe(true);
});

test('full-size posters for review: every time of day', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1800 }, deviceScaleFactor: 1 });
  const shots = [['spire', 0, 'dawn'], ['spire', 0, 'midday'], ['spire', 0, 'alpenglow'], ['spire', 0, 'night'], ['random', 44, 'dawn'], ['massif', 0, 'night']];
  for (const [peak, seed, time] of shots) {
    await page.goto(`tests/e2e/pages/poster.html?i=0&peak=${peak}&seed=${seed}&time=${time}`);
    await page.waitForSelector('body[data-ready="true"]');
    await page.screenshot({ path: `${SHOTS}/poster-${peak}${seed ? `-${seed}` : ''}-${time}.png` });
  }
  await page.close();
});
