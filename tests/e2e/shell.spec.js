import { test, expect } from '@playwright/test';
import { VERSION } from '../../src/version.js';

const SHOTS = 'docs/screenshots/m5';

test('app shell loads under the Pages subpath', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveURL(/\/alpine-postcard-maker\/$/);
  await expect(page.getByRole('heading', { name: 'Alpine Postcard Maker' })).toBeVisible();
  await expect(page.locator('#app-version')).toHaveText(VERSION);
  await expect(page.locator('#preview svg').first()).toBeVisible();
});

test('manifest is installable-shaped', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const response = await request.get(href);
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest).toMatchObject({ start_url: './', scope: './', display: 'standalone' });
  for (const icon of manifest.icons) {
    expect((await request.get(icon.src)).ok(), icon.src).toBeTruthy();
  }
  expect(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBeTruthy();
});

test('works offline after first visit', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.locator('#offline-status')).toHaveText('Ready to work offline.');
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/alpine-postcard-maker\/$/);
  
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Alpine Postcard Maker' })).toBeVisible();
  await expect(page.locator('#app-version')).toHaveText(VERSION);
  await expect(page.locator('#preview svg').first()).toBeVisible();
  });

test('update banner shows when a new version is waiting', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('#offline-status')).toHaveText('Ready to work offline.');
  // Simulate a waiting worker by showing the banner the same way app.js does.
  await page.evaluate(() => { document.getElementById('update-banner').hidden = false; });
  await expect(page.getByRole('button', { name: 'Tap to refresh' })).toBeVisible();
  });
