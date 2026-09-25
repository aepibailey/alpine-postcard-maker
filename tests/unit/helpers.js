import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ENTRIES } from '../../scripts/app-files.mjs';

export const read = (path) => readFileSync(path, 'utf8');

// Every file that ships in the app, as a repo-relative path.
export function appFiles() {
  const files = [];
  const walk = (path) => {
    if (statSync(path).isDirectory()) readdirSync(path).forEach((name) => walk(join(path, name)));
    else files.push(path);
  };
  APP_ENTRIES.filter(existsSync).forEach(walk);
  return files;
}

export function precacheList() {
  const match = read('sw.js').match(/const PRECACHE = \[([\s\S]*?)\];/);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}
