import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const SHOTS = 'docs/screenshots/m7';
const title = (page) => page.getByRole('textbox', { name: 'Destination' });
const cards = (page) => page.locator('#gallery-grid .card');
const openGallery = (page) => page.getByRole('tab', { name: /Gallery/ }).click();

async function makePoster(page, name, timeOfDay) {
  await page.getByRole('button', { name: '+ New' }).click();
  await expect(title(page)).toHaveValue('Destination');
  await title(page).fill(name);
  if (timeOfDay) await page.getByRole('radio', { name: timeOfDay }).click();
}

test('posters are kept, reopened and edited across restarts', async ({ page }) => {
  await page.goto('./');
  await title(page).fill('Zermatt');
  await makePoster(page, 'Lac Bleu', 'Midday');
  await page.getByRole('button', { name: 'Lake' }).click();
  await makePoster(page, 'Nachtfeld', 'Starry night');

  await page.reload(); // like closing and reopening the app
  await expect(title(page)).toHaveValue('Nachtfeld');
  await expect(page.getByRole('tab', { name: /Gallery \(3\)/ })).toBeVisible();

  await openGallery(page);
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).locator('strong')).toHaveText(['Nachtfeld', 'Lac Bleu', 'Zermatt']);
  await expect(cards(page).first().locator('img')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/gallery.png` });

  await page.getByRole('button', { name: 'Open Lac Bleu' }).click();
  await expect(title(page)).toHaveValue('Lac Bleu');
  await expect(page.locator('#preview')).toHaveAttribute('data-time', 'midday');
  await expect(page.locator('#preview')).toHaveAttribute('data-layers', /lake/);
  await title(page).fill('Lac Bleu Supérieur');
  await page.reload();
  await expect(title(page)).toHaveValue('Lac Bleu Supérieur');
});

test('duplicate and delete', async ({ page }) => {
  await page.goto('./');
  await title(page).fill('Zermatt');
  await openGallery(page);
  await expect(cards(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Duplicate Zermatt' }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(page.getByRole('tab', { name: /Gallery \(2\)/ })).toBeVisible();

  page.once('dialog', (dialog) => dialog.dismiss()); // "Cancel" keeps it
  await page.getByRole('button', { name: 'Delete Zermatt' }).first().click();
  await expect(cards(page)).toHaveCount(2);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Zermatt' }).first().click();
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator('#gallery-status')).toContainText('Deleted');
});

test('back up, lose everything, restore', async ({ page }) => {
  await page.goto('./');
  await title(page).fill('Zermatt');
  await makePoster(page, 'Lac Bleu', 'Midday');
  await openGallery(page);
  await expect(cards(page)).toHaveCount(2);

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up gallery' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^alpine-posters-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backupPath = await download.path();
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.posters.map((p) => p.recipe.lettering.title).sort()).toEqual(['Lac Bleu', 'Zermatt']);
  expect(backup.posters.every((p) => p.thumbnail?.startsWith('data:image/jpeg'))).toBe(true);

  for (const name of ['Zermatt', 'Lac Bleu']) {
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: `Delete ${name}` }).click();
  }
  await expect(cards(page).locator('strong')).not.toContainText(['Zermatt']);

  await page.locator('#restore-input').setInputFiles(backupPath);
  await expect(page.locator('#gallery-status')).toContainText('Restored: 2 added');
  await expect(cards(page).locator('strong')).toContainText(['Lac Bleu', 'Zermatt']);

  // Restoring the same file again changes nothing.
  await page.locator('#restore-input').setInputFiles(backupPath);
  await expect(page.locator('#gallery-status')).toContainText('0 added, 0 updated, 2 already here');
  await page.screenshot({ path: `${SHOTS}/restored.png` });
});

test('a wrong file is refused politely', async ({ page }) => {
  await page.goto('./');
  await openGallery(page);
  await page.locator('#restore-input').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"shopping":["milk"]}') });
  await expect(page.locator('#gallery-status')).toHaveText('That file is not a poster backup.');
});

test('an edit made just before the app is closed is not lost', async ({ page }) => {
  await page.goto('./');
  await title(page).fill('Last second');
  await page.reload(); // no time for the gallery save; the mirror keeps it
  await expect(title(page)).toHaveValue('Last second');
  await openGallery(page);
  await expect(cards(page).locator('strong')).toContainText(['Last second']);
});

test('the poster from earlier versions moves into the gallery', async ({ page }) => {
  // Set up a phone that only ever ran v0.7: the old single-poster save, and no gallery yet.
  // (Done on a page that isn't the app, so the app can't write anything in the meantime.)
  await page.goto('tests/e2e/pages/poster.html');
  await page.evaluate(() => {
    localStorage.setItem('apm.editor', JSON.stringify({ peak: 'pyramid', time: 'night', lettering: { title: 'From v0.7', tagline: 'kept', layout: 'arched', font: 'bebas' }, style: 'aged' }));
  });
  await page.goto('./');
  await expect(title(page)).toHaveValue('From v0.7');
  await expect(page.locator('#preview')).toHaveAttribute('data-peak', 'pyramid');
  await expect(page.locator('#preview')).toHaveAttribute('data-style', 'aged');
  await expect(page.getByRole('tab', { name: /Gallery \(1\)/ })).toBeVisible();
  // The old save is tidied away once it is in the gallery.
  expect(await page.evaluate(() => localStorage.getItem('apm.editor'))).toBeNull();
});

test('the gallery works offline', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.locator('#offline-status')).toHaveText('Ready to work offline.');
  await context.setOffline(true);
  await page.reload();
  await makePoster(page, 'Offline peak', 'Dawn');
  await openGallery(page);
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first().locator('img')).toBeVisible();
});
