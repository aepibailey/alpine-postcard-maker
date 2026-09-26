import { test, expect } from '@playwright/test';

import { PALETTES } from '../../src/palettes.js';

const SHOTS = 'docs/screenshots/m6';
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
  await page.locator('#preview').scrollIntoViewIfNeeded();
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
  }
});

test('scenery switches add and remove layers', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  const preview = page.locator('#preview');
  // Start from a clean slate: everything off.
  for (const name of ['Village', 'Hut', 'Gondola', 'Forest', 'Lake', 'Skier']) {
    const button = page.getByRole('button', { name });
    if (await button.getAttribute('aria-pressed') === 'true') await button.click();
  }
  await expect(preview).toHaveAttribute('data-layers', '');
  const seen = new Set([await preview.innerHTML()]);
  for (const [name, layer] of [['Lake', 'lake'], ['Village', 'village'], ['Hut', 'hut'], ['Forest', 'forest'], ['Gondola', 'gondola'], ['Skier', 'skier']]) {
    await page.getByRole('button', { name }).click();
    await expect(page.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true');
    await expect(preview).toHaveAttribute('data-layers', new RegExp(layer));
    seen.add(await preview.innerHTML());
  }
  expect(seen.size).toBe(7);

  await page.getByRole('button', { name: 'Lake' }).click();
  await expect(page.getByRole('button', { name: 'Lake' })).toHaveAttribute('aria-pressed', 'false');
  await expect(preview).not.toHaveAttribute('data-layers', /lake/);
});

test('typing a destination and tagline updates the poster', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('textbox', { name: 'Destination' }).fill('Zermatt');
  await page.getByRole('textbox', { name: 'Tagline' }).fill('Ski the high valley');
  const lettering = page.locator('#preview [data-role="lettering"]');
  await expect(lettering.first()).toHaveText('ZERMATT');
  await expect(lettering.nth(1)).toHaveText('SKI THE HIGH VALLEY');
  await expect(page.getByRole('img', { name: 'Zermatt poster' })).toBeVisible();
  // The fields stop at their limits.
  await page.getByRole('textbox', { name: 'Destination' }).fill('A'.repeat(40));
  await expect(page.getByRole('textbox', { name: 'Destination' })).toHaveValue('A'.repeat(24));
});

test('typeface and placement pickers restyle the title', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('textbox', { name: 'Destination' }).fill('Zermatt');
  await page.evaluate(() => document.fonts.ready);
  const preview = page.locator('#preview');
  for (const [name, font, family] of [['Poiret One', 'poiret', 'Poiret One'], ['Bebas Neue', 'bebas', 'Bebas Neue'], ['Josefin Sans', 'josefin', 'Josefin Sans'], ['Limelight', 'limelight', 'Limelight']]) {
    await page.getByRole('radio', { name }).click();
    await expect(preview).toHaveAttribute('data-font', font);
    await expect(preview.locator('[data-role="lettering"]').first()).toHaveAttribute('font-family', new RegExp(family));
  }
  for (const [name, layout] of [['Bottom', 'bottom'], ['Arched', 'arched'], ['Banner', 'banner'], ['Top', 'top']]) {
    await page.getByRole('radio', { name, exact: true }).click();
    await expect(preview).toHaveAttribute('data-layout', layout);
    await expect(preview.locator('[data-role="lettering"]').first()).toContainText('ZERMATT');
    if (layout === 'arched') await expect(preview.locator('textPath')).toHaveCount(1);
  }
});

test('long names stay inside the poster in every typeface and placement', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  for (const title of ['Grindelwald-Wengen Ski', 'WWWWWWWWWWWWWWWWWWWWWWWW', 'Mmmmmmmmmmmmmmmmmmmmmmmm']) {
    await page.getByRole('textbox', { name: 'Destination' }).fill(title);
    for (const font of ['Limelight', 'Poiret One', 'Bebas Neue', 'Josefin Sans']) {
      await page.getByRole('radio', { name: font }).click();
      for (const layout of ['Top', 'Bottom', 'Arched', 'Banner']) {
        await page.getByRole('radio', { name: layout, exact: true }).click();
        await page.evaluate(() => document.fonts.ready);
        const box = await page.locator('#preview [data-role="lettering"]').first().evaluate((el) => {
          const b = el.getBBox();
          return { left: b.x, right: b.x + b.width };
        });
        const label = `${title} / ${font} / ${layout}`;
        expect(box.left, label).toBeGreaterThanOrEqual(34);
        expect(box.right, label).toBeLessThanOrEqual(1166);
      }
    }
  }
});

test('print style picker switches the finish', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => document.fonts.ready);
  const preview = page.locator('#preview');
  for (const [name, style] of [['Screen print', 'screenprint'], ['Aged paper', 'aged'], ['Flat', 'flat']]) {
    await page.getByRole('radio', { name }).click();
    await expect(page.getByRole('radio', { name })).toHaveAttribute('aria-checked', 'true');
    await expect(preview).toHaveAttribute('data-style', style);
    await expect(preview.locator('svg')).toHaveAttribute('data-style', style);
    await expect(preview.locator('filter')).toHaveCount(style === 'flat' ? 0 : style === 'screenprint' ? 3 : 3);
    await page.screenshot({ path: `${SHOTS}/app-${style}.png` });
  }
});

test('all choices are remembered after reopening', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('radio', { name: 'Random ridgeline' }).click();
  await page.getByRole('radio', { name: 'Starry night' }).click();
  await page.getByRole('button', { name: 'Gondola' }).click();
  await page.getByRole('textbox', { name: 'Destination' }).fill('Saas Fee');
  await page.getByRole('radio', { name: 'Bebas Neue' }).click();
  await page.getByRole('radio', { name: 'Arched' }).click();
  await page.getByRole('radio', { name: 'Aged paper' }).click();
  const layers = await page.locator('#preview').getAttribute('data-layers');
  const seed = await page.locator('#preview').getAttribute('data-seed');
  await page.reload();
  await expect(page.locator('#preview')).toHaveAttribute('data-peak', 'random');
  await expect(page.locator('#preview')).toHaveAttribute('data-seed', seed);
  await expect(page.locator('#preview')).toHaveAttribute('data-time', 'night');
  await expect(page.locator('#preview')).toHaveAttribute('data-layers', layers);
  await expect(page.getByRole('textbox', { name: 'Destination' })).toHaveValue('Saas Fee');
  await expect(page.locator('#preview')).toHaveAttribute('data-font', 'bebas');
  await expect(page.locator('#preview')).toHaveAttribute('data-layout', 'arched');
  await expect(page.locator('#preview')).toHaveAttribute('data-style', 'aged');
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
    const faces = [];
    for (const spec of ["100px 'Limelight'", "700 100px 'Josefin Sans'", "100px 'Poiret One'", "100px 'Bebas Neue'"]) faces.push(...await document.fonts.load(spec));
    return faces.length >= 4 && faces.every((f) => f.status === 'loaded');
  });
  expect(loaded).toBe(true);
});

test('full-size posters for review: print styles', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1800 }, deviceScaleFactor: 1 });
  const shots = [
    ['flat', 'time=alpenglow&layers=village,forest'],
    ['screenprint', 'time=alpenglow&layers=village,forest'],
    ['aged', 'time=alpenglow&layers=village,forest'],
    ['screenprint', 'time=midday&layers=lake,hut,forest&layout=banner&font=bebas&title=Seehalden&tagline=Summer%20by%20the%20lake'],
    ['aged', 'time=night&peak=pyramid&layers=skier,gondola,forest&font=josefin&title=Col%20d%27Etoile&tagline=Ski%20beneath%20the%20stars'],
    ['screenprint', 'time=dawn&peak=random&seed=44&layers=village,hut,forest&layout=arched&font=poiret&title=Sonnenberg&tagline=First%20light'],
  ];
  for (const [k, [style, q]] of shots.entries()) {
    await page.goto(`tests/e2e/pages/poster.html?i=0&style=${style}&${q}`);
    await page.waitForSelector('body[data-ready="true"]');
    await page.screenshot({ path: `${SHOTS}/poster-${k + 1}-${style}.jpg`, type: "jpeg", quality: 85 });
  }
  await page.close();
});
