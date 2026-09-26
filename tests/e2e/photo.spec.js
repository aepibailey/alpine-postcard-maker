import { test, expect } from '@playwright/test';
import { readFile, copyFile, mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

const SHOTS = 'docs/screenshots/v2b';
const PHOTO = 'tests/fixtures/photos/peak.jpg';
const title = (page) => page.getByRole('textbox', { name: 'Destination' });
const preview = (page) => page.locator('#preview');
const art = (page) => page.locator('#preview svg > image');
const cards = (page) => page.locator('#gallery-grid .card');

test.beforeAll(() => mkdir(SHOTS, { recursive: true }));

// Pick a photo the way the phone's file picker would hand it over, then wait for the poster.
async function usePhoto(page, file = PHOTO) {
  await page.locator('#photo-input').setInputFiles(file);
  await posterReady(page);
}

async function posterReady(page) {
  await expect(art(page)).toHaveCount(1, { timeout: 15000 });
  await expect(preview(page)).not.toHaveClass(/working/);
}

const artUrl = (page) => art(page).getAttribute('href');

// How many inks the poster art uses (ignoring the soft pixels along edges).
function inkCount(page) {
  return art(page).evaluate(async (image) => {
    const img = new Image();
    img.src = image.getAttribute('href');
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    const counts = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.values()].filter((n) => n > data.length / 4 / 400).length;
  });
}

async function pngSize(path) {
  const bytes = await readFile(path);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('pick a photo and it becomes a poster', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Got it' }).click();
  await title(page).fill('Zermatt');
  await usePhoto(page);
  await expect(preview(page)).toHaveAttribute('data-colors', '5');
  await expect(preview(page)).toHaveAttribute('data-inks', 'photo');
  await expect(page.locator('#peak-label')).toHaveText(/Your photo · 5 colours/i);
  // Photo posters have their own controls instead of the mountain, scenery and print styles.
  await expect(page.getByRole('radiogroup', { name: 'Colours' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Zoom' })).toBeVisible();
  for (const name of ['Mountain', 'Scenery', 'Print style']) await expect(page.getByRole('heading', { name })).toBeHidden();
  await expect(page.getByRole('button', { name: '📷 Change photo' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/editor-photo.png` });
  await page.getByRole('heading', { name: 'Colours' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/photo-controls.png` });

  await page.getByRole('button', { name: /Back to drawn mountain/ }).click();
  await expect(page.getByRole('heading', { name: 'Mountain' })).toBeVisible();
  await expect(art(page)).toHaveCount(0);
  await expect(preview(page)).not.toHaveAttribute('data-photo', /./);
  await expect(page.getByRole('button', { name: '📷 Use your photo' })).toBeVisible();
});

test('colours and inks change the poster', async ({ page }) => {
  await page.goto('./');
  await usePhoto(page);
  await page.getByRole('radio', { name: '4 colours' }).click();
  await posterReady(page);
  const four = await inkCount(page);
  await page.getByRole('radio', { name: '6 colours' }).click();
  await posterReady(page);
  const six = await inkCount(page);
  expect(four).toBeLessThanOrEqual(4);
  expect(six).toBeGreaterThan(four);

  const photoInks = await artUrl(page);
  await page.getByRole('radio', { name: 'Poster inks' }).click();
  await expect(preview(page)).toHaveAttribute('data-inks', 'poster');
  await posterReady(page);
  expect(await artUrl(page)).not.toBe(photoInks);
  // Poster inks follow the time of day.
  const alpenglow = await artUrl(page);
  await page.getByRole('radio', { name: 'Starry night' }).click();
  await posterReady(page);
  expect(await artUrl(page)).not.toBe(alpenglow);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/poster-inks-night.png` });
});

test('drag and zoom frame the photo', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Got it' }).click();
  await usePhoto(page);
  const before = await artUrl(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const box = await preview(page).boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, y, { steps: 6 });
  // While dragging, the plain photo shows so it can follow the finger.
  await expect(page.locator('#preview svg svg image')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/dragging.png` });
  await page.mouse.up();
  await posterReady(page);
  expect(Number(await preview(page).getAttribute('data-x'))).toBeLessThan(0.45);
  expect(await artUrl(page)).not.toBe(before);

  await page.getByRole('slider', { name: 'Zoom' }).fill('2');
  await expect(preview(page)).toHaveAttribute('data-zoom', '2.00');
  await posterReady(page);

  // It's all kept after closing and reopening the app.
  const framing = await preview(page).evaluate((el) => [el.dataset.photo, el.dataset.x, el.dataset.zoom]);
  await page.reload();
  await posterReady(page);
  expect(await preview(page).evaluate((el) => [el.dataset.photo, el.dataset.x, el.dataset.zoom])).toEqual(framing);
});

test('Surprise me keeps the photo', async ({ page }) => {
  await page.goto('./');
  await usePhoto(page);
  const id = await preview(page).getAttribute('data-photo');
  await page.getByRole('button', { name: '✨ Surprise me' }).click();
  await posterReady(page);
  await expect(preview(page)).toHaveAttribute('data-photo', id);
});

test('a photo poster exports at full size', async ({ page }) => {
  await page.goto('./');
  await title(page).fill('Zermatt');
  await usePhoto(page);
  await page.getByRole('radio', { name: 'Phone wallpaper' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save to phone' }).click()]);
  const path = await download.path();
  expect(await pngSize(path)).toEqual({ width: 1440, height: 3200 });
  await copyFile(path, `${SHOTS}/export-wallpaper.png`);
});

test('gallery: photo posters get thumbnails; copies share the photo', async ({ page }) => {
  await page.goto('./');
  await title(page).fill('Zermatt');
  await usePhoto(page);
  await page.getByRole('tab', { name: /Gallery/ }).click();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first().locator('img')).toBeVisible();
  await page.getByRole('button', { name: 'Duplicate Zermatt' }).click();
  await expect(cards(page)).toHaveCount(2);
  await page.screenshot({ path: `${SHOTS}/gallery.png` });

  // Delete the one being edited: the copy still has its photo.
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.card.current').getByRole('button', { name: 'Delete Zermatt' }).click();
  await expect(cards(page)).toHaveCount(1);
  await page.getByRole('button', { name: 'Open Zermatt' }).click();
  await posterReady(page);
});

test('backup and restore bring the photo back', async ({ page }) => {
  await page.goto('./');
  await title(page).fill('Zermatt');
  await usePhoto(page);
  await page.getByRole('tab', { name: /Gallery/ }).click();
  await expect(cards(page)).toHaveCount(1);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Back up gallery' }).click()]);
  const backupPath = await download.path();
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(backup.version).toBe(2);
  expect(backup.photos).toHaveLength(1);
  expect(backup.photos[0].dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  expect(backup.posters[0].recipe.photo.id).toBe(backup.photos[0].id);

  // Lose everything: delete the poster (which also clears its photo), then restore.
  await page.getByRole('button', { name: '+ New' }).click();
  await page.getByRole('tab', { name: /Gallery/ }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Zermatt' }).click();
  await expect(cards(page)).toHaveCount(1);
  expect(await page.evaluate(() => new Promise((resolve) => {
    const open = indexedDB.open('alpine-postcard-maker');
    open.onsuccess = () => { const req = open.result.transaction('photos').objectStore('photos').count(); req.onsuccess = () => resolve(req.result); };
  }))).toBe(0);

  await page.locator('#restore-input').setInputFiles(backupPath);
  await expect(page.locator('#gallery-status')).toContainText('Restored: 1 added');
  await page.getByRole('button', { name: 'Open Zermatt' }).click();
  await posterReady(page);
});

test('photo mode works offline', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.locator('#offline-status')).toHaveText('Ready to work offline.');
  await context.setOffline(true);
  await page.reload();
  await expect(title(page)).toBeVisible();
  await usePhoto(page, 'tests/fixtures/photos/dusk.jpg');
  await context.setOffline(false);
});

test('a file that is not a photo is refused politely', async ({ page }) => {
  await page.goto('./');
  await page.locator('#photo-input').setInputFiles({ name: 'notes.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not a photo') });
  await expect(page.locator('#photo-status')).toHaveText("Couldn't open that photo. Try a JPEG or PNG.");
  await expect(page.getByRole('heading', { name: 'Mountain' })).toBeVisible();
});

test('no serious accessibility problems with photo controls', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Got it' }).click();
  await usePhoto(page);
  await page.evaluate(() => document.fonts.ready);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`)).toEqual([]);
});
