// Copies only the app files into _site/ for GitHub Pages.
import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { APP_ENTRIES } from './app-files.mjs';

await rm('_site', { recursive: true, force: true });
await mkdir('_site');
for (const entry of APP_ENTRIES) {
  if (existsSync(entry)) await cp(entry, `_site/${entry}`, { recursive: true });
}
console.log('Built _site/');
