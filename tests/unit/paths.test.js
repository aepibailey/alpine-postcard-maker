// The app is served from /alpine-postcard-maker/ on GitHub Pages, so every URL must be relative.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, appFiles, precacheList } from './helpers.js';

test('manifest start_url, scope and id are "./"', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.id, './');
});

test('manifest icon paths are relative', () => {
  for (const icon of JSON.parse(read('manifest.webmanifest')).icons) {
    assert.ok(!icon.src.startsWith('/'), `absolute icon path: ${icon.src}`);
  }
});

test('precache entries are relative', () => {
  for (const entry of precacheList()) assert.ok(!entry.startsWith('/'), `absolute precache path: ${entry}`);
});

test('no leading-slash URLs in app source', () => {
  const patterns = [
    /\b(?:href|src)=["']\/(?!\/)/,               // HTML attributes
    /\b(?:register|fetch|import)\(\s*["']\/(?!\/)/, // JS calls
    /\bfrom\s+["']\/(?!\/)/,                    // ES module imports
    /url\(\s*["']?\/(?!\/)/,                    // CSS url()
  ];
  for (const file of appFiles().filter((f) => /\.(html|js|css)$/.test(f))) {
    const text = read(file);
    for (const pattern of patterns) assert.ok(!pattern.test(text), `${file} has a leading-slash URL (${pattern})`);
  }
});

test('service worker is registered relatively with scope "./"', () => {
  assert.match(read('src/app.js'), /register\('\.\/sw\.js', \{ scope: '\.\/' \}\)/);
});
