// Renders the SVG icons to the PNG sizes Android needs.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const OUTPUTS = [
  { svg: 'icons/icon.svg', png: 'icons/icon-192.png', size: 192 },
  { svg: 'icons/icon.svg', png: 'icons/icon-512.png', size: 512 },
  { svg: 'design/maskable.svg', png: 'icons/maskable-512.png', size: 512 },
];

const browser = await chromium.launch();
for (const { svg, png, size } of OUTPUTS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const markup = await readFile(svg, 'utf8');
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`
  );
  await page.screenshot({ path: png, omitBackground: true });
  await page.close();
  console.log(`Wrote ${png}`);
}
await browser.close();
