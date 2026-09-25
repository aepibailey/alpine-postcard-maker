// Offline support depends on the service worker caching every app file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { read, appFiles, precacheList } from './helpers.js';
import { VERSION } from '../../src/version.js';

test('every precached file exists', () => {
  for (const entry of precacheList().filter((e) => e !== './')) {
    assert.ok(existsSync(entry), `precached file missing: ${entry}`);
  }
});

test('every app file is precached', () => {
  const precached = new Set(precacheList());
  const missing = appFiles().filter((f) => f !== 'sw.js' && !precached.has(f));
  assert.deepEqual(missing, [], 'add these to PRECACHE in sw.js');
});

test('cache name, app version and package version match', () => {
  assert.match(read('sw.js'), new RegExp(`const CACHE = 'apm-${VERSION.replaceAll('.', '\\.')}';`));
  assert.equal(JSON.parse(read('package.json')).version, VERSION);
});
