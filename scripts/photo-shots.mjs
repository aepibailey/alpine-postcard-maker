// Dev-only: renders tests/e2e/pages/photo.html for each [name, query] pair and saves JPEG screenshots.
// Usage: node scripts/photo-shots.mjs <out-dir> '[["name","photo=x.jpg&colors=5"]]'
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
const server = spawn('node', ['scripts/serve.mjs'], { env: { ...process.env, PORT: '4179' } });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 1800 } });
const out = process.argv[2];
for (const [name, qs] of JSON.parse(process.argv[3])) {
  await p.goto(`http://localhost:4179/alpine-postcard-maker/tests/e2e/pages/photo.html?${qs}`);
  await p.waitForSelector('body[data-ready]', { timeout: 60000 });
  console.log(name, await p.evaluate(() => document.body.dataset.ms), 'ms', await p.evaluate(() => document.body.dataset.frame));
  await p.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 80 });
}
await b.close(); server.kill();
