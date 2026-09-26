// Privacy: posters and photos never leave the phone. The app only fetches its own files
// (fonts for export, through the service worker cache) and turns data: URLs back into files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, appFiles } from './helpers.js';

const FETCH_ALLOWED = new Set(['sw.js', 'src/export.js', 'src/backup.js']);
const NEVER = [/XMLHttpRequest/, /sendBeacon/, /\bWebSocket\b/, /\bEventSource\b/, /\bRTCPeerConnection\b/];

test('no network calls in app files', () => {
  for (const file of appFiles().filter((f) => /\.(html|js|css|webmanifest)$/.test(f))) {
    const text = read(file);
    for (const pattern of NEVER) assert.ok(!pattern.test(text), `${file} matches ${pattern}`);
    if (!FETCH_ALLOWED.has(file)) assert.ok(!/\bfetch\s*\(/.test(text), `${file} calls fetch()`);
    const urls = (text.match(/https?:\/\/[^\s"'`)]+/g) ?? []).filter((u) => !u.startsWith('http://www.w3.org/'));
    assert.deepEqual(urls, [], `${file} has web addresses`);
  }
});

test('photo code never fetches or uploads', () => {
  for (const file of appFiles().filter((f) => /photo/.test(f) && f.endsWith('.js'))) {
    assert.ok(!/\bfetch\s*\(|FormData|navigator\.share/.test(read(file)), file);
  }
});
