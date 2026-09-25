// Every bundled font must ship with its license, and must be precached for offline use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, existsSync } from 'node:fs';
import { precacheList } from './helpers.js';

const fonts = readdirSync('fonts').filter((f) => f.endsWith('.woff2'));

test('fonts are bundled', () => {
  assert.ok(fonts.length >= 2);
});

test('each font has an OFL license file beside it', () => {
  for (const font of fonts) {
    const family = font.split('-')[0];
    assert.ok(existsSync(`fonts/${family}-OFL.txt`), `missing license for ${font}`);
  }
});

test('each font is precached', () => {
  const precached = new Set(precacheList());
  for (const font of fonts) assert.ok(precached.has(`fonts/${font}`), `${font} not in PRECACHE`);
});
