import { test, expect } from '@playwright/test';
import { readFile, copyFile } from 'node:fs/promises';

const SHOTS = 'docs/screenshots/m6';

// Width and height straight from the PNG header.
async function pngSize(path) {
  const bytes = await readFile(path);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function exportAs(page, sizeName) {
  await page.getByRole('radio', { name: sizeName }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Save to phone' }).click(),
  ]);
  const path = await download.path();
  return { path, name: download.suggestedFilename() };
}

test('each export size saves a PNG at exactly the right size', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Destination').fill('Zermatt');
  const screen = await page.evaluate(() => ({
    width: Math.round(Math.min(screen.width, screen.height) * devicePixelRatio),
    height: Math.round(Math.max(screen.width, screen.height) * devicePixelRatio),
  }));
  // The test phone is a Pixel 7: 412 × 915 at 2.625× → 1082 × 2402.
  expect(screen).toEqual({ width: 1082, height: 2402 });

  const expected = [
    ['Phone wallpaper', { width: 1440, height: 3200 }, 'wallpaper'],
    ['Match my screen', screen, 'screen'],
    ['10×15 print', { width: 1200, height: 1800 }, 'print'],
    ['Square post', { width: 2160, height: 2160 }, 'square'],
  ];
  for (const [label, size, key] of expected) {
    const { path, name } = await exportAs(page, label);
    expect(name).toBe(`zermatt-${key}.png`);
    expect(await pngSize(path)).toEqual(size);
    await copyFile(path, `${SHOTS}/export-${key}.png`);
  }
  await expect(page.locator('#export-status')).toContainText('Saved zermatt-square.png');
  await page.screenshot({ path: `${SHOTS}/app-export.png` });
});

test('the chosen export size is remembered', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('radio', { name: 'Square post' }).click();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Square post' })).toHaveAttribute('aria-checked', 'true');
});

// Exports the same poster three ways and compares the pixels of the title area.
async function titlePixels(page, variants) {
  return page.evaluate(async (variants) => {
    const { exportPoster } = await import(new URL('src/export.js', document.baseURI).href);
    const { SAMPLES } = await import(new URL('src/samples.js', document.baseURI).href);
    const out = [];
    for (const { font, embedFonts } of variants) {
      const recipe = { ...SAMPLES[0], sun: undefined, time: 'midday', lettering: { title: 'Zermatt', tagline: 'Test', layout: 'top', font } };
      const blob = await exportPoster(recipe, { width: 600, height: 900, embedFonts });
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(600, 180);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0, 600, 180, 0, 0, 600, 180); // top 20%: where the title sits
      out.push(Array.from(ctx.getImageData(0, 0, 600, 180).data));
    }
    return out;
  }, variants);
}

const difference = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;

async function expectFontsEmbedded(page) {
  const [limelight, bebas, fallback] = await titlePixels(page, [
    { font: 'limelight', embedFonts: true },
    { font: 'bebas', embedFonts: true },
    { font: 'limelight', embedFonts: false }, // what you'd get if the font were lost
  ]);
  expect(difference(limelight, bebas), 'Limelight vs Bebas').toBeGreaterThan(2);
  expect(difference(limelight, fallback), 'Limelight vs fallback font').toBeGreaterThan(2);
  expect(difference(bebas, fallback), 'Bebas vs fallback font').toBeGreaterThan(2);
}

test('exported images use the chosen typeface, not a fallback', async ({ page }) => {
  await page.goto('./');
  await expectFontsEmbedded(page);
});

test('export works offline, fonts included', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.locator('#offline-status')).toHaveText('Ready to work offline.');
  await context.setOffline(true);
  await page.reload();
  await expectFontsEmbedded(page);
  const { path } = await exportAs(page, '10×15 print');
  expect(await pngSize(path)).toEqual({ width: 1200, height: 1800 });
});
