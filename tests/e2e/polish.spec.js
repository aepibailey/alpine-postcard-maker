import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SHOTS = 'docs/screenshots/m8';
const title = (page) => page.getByRole('textbox', { name: 'Destination' });

// Accessibility problems that would stop someone from using the app.
async function expectAccessible(page, include) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  const serious = violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
}

test('a first-time welcome appears once', async ({ page }) => {
  await page.goto('./');
  const welcome = page.getByRole('note');
  await expect(welcome).toBeVisible();
  await expect(welcome).toContainText('Welcome');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/welcome.png` });
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(welcome).toBeHidden();
  await expect(page.getByRole('button', { name: '✨ Surprise me' })).toBeFocused();
  await page.reload();
  await expect(title(page)).toBeVisible();
  await expect(welcome).toBeHidden();
});

test('surprise me changes the whole look but keeps the words', async ({ page }) => {
  await page.goto('./');
  await title(page).fill('Grindelwald');
  await page.getByRole('textbox', { name: 'Tagline' }).fill('Winter 1934');
  const preview = page.locator('#preview');
  const looks = new Set();
  const look = async () => JSON.stringify(await preview.evaluate((el) => ({ ...el.dataset })));
  looks.add(await look());
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: '✨ Surprise me' }).click();
    looks.add(await look());
  }
  expect(looks.size).toBeGreaterThanOrEqual(5);
  await expect(title(page)).toHaveValue('Grindelwald');
  await expect(preview.locator('svg')).toHaveAttribute('aria-label', 'Grindelwald poster');
  await expect(preview.locator('text').first()).toHaveText(/Grindelwald/i);

  // The surprise is saved like any other edit.
  const saved = await preview.evaluate((el) => ({ ...el.dataset }));
  await page.reload();
  await expect(preview).toHaveAttribute('data-peak', saved.peak);
  await expect(preview).toHaveAttribute('data-time', saved.time);
  await expect(preview).toHaveAttribute('data-style', saved.style);
  await expect(title(page)).toHaveValue('Grindelwald');
});

test('a mini poster stays in view while using the lower controls', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Got it' }).click();
  const mini = page.getByRole('button', { name: 'Back up to the poster' });
  await expect(mini).toBeHidden();

  await page.getByRole('radio', { name: 'Aged paper' }).scrollIntoViewIfNeeded();
  await expect(mini).toBeVisible();
  await expect(mini.locator('svg')).toHaveAttribute('data-style', 'flat');
  // Edits made down here show up in the mini poster straight away.
  await page.getByRole('radio', { name: 'Aged paper' }).click();
  await expect(mini.locator('svg')).toHaveAttribute('data-style', 'aged');
  await page.getByRole('radio', { name: 'Starry night' }).scrollIntoViewIfNeeded();
  await page.getByRole('radio', { name: 'Starry night' }).click();
  await expect(page.locator('#preview')).toHaveAttribute('data-time', 'night');
  await page.getByRole('radio', { name: 'Aged paper' }).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/mini-preview.png` });

  await mini.click();
  await expect(page.locator('#preview')).toBeInViewport();
  await expect(mini).toBeHidden();

  // Not shown on the gallery page.
  await page.getByRole('radio', { name: 'Aged paper' }).scrollIntoViewIfNeeded();
  await expect(mini).toBeVisible();
  await page.getByRole('tab', { name: /Gallery/ }).click();
  await expect(mini).toBeHidden();
});

test('About shows the version, font credits and storage', async ({ page }) => {
  await page.goto('./');
  await expect(title(page)).toBeVisible();
  const version = await page.locator('#app-version').textContent();
  await page.getByRole('button', { name: 'About' }).click();
  const about = page.getByRole('dialog', { name: 'About Alpine Postcard Maker' });
  await expect(about).toBeVisible();
  await expect(about).toContainText(`Version ${version}`);
  for (const credit of ['Limelight', 'Sorkin Type Co', 'Josefin Sans', 'Poiret One', 'Bebas Neue', 'Dharma Type', 'SIL Open Font License']) {
    await expect(about).toContainText(credit);
  }
  await expect(page.locator('#about-storage')).toContainText(/1 poster in your gallery, using about \d+ KB/);
  await page.screenshot({ path: `${SHOTS}/about.png` });
  await expectAccessible(page, '#about-dialog');
  await about.getByRole('button', { name: 'Close' }).click();
  await expect(about).toBeHidden();
});

test('version 1.0.0 is shown', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#app-version')).toHaveText('1.0.0');
});

test('no serious accessibility problems in the editor or gallery', async ({ page }) => {
  await page.goto('./');
  await expect(title(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expectAccessible(page);
  await page.getByRole('button', { name: 'Got it' }).click();
  await page.getByRole('radio', { name: 'Random ridgeline' }).click();
  await expectAccessible(page);
  await page.getByRole('tab', { name: /Gallery/ }).click();
  await expect(page.locator('#gallery-grid .card')).toHaveCount(1);
  await expectAccessible(page);
});

test('controls can be reached and used with a keyboard', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('button', { name: '✨ Surprise me' })).toBeFocused();
  const before = await page.locator('#preview').getAttribute('data-seed');
  const markup = await page.locator('#preview').innerHTML();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.locator('#preview').innerHTML()).not.toBe(markup);
  expect(before).toBeTruthy();
  // The focused control has a clearly visible outline.
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  expect(outline).toBe('solid');
});
