import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPoster } from '../../src/poster.js';
import { SAMPLES } from '../../src/samples.js';

test('three samples with unique ids', () => {
  assert.equal(SAMPLES.length, 3);
  assert.equal(new Set(SAMPLES.map((s) => s.id)).size, 3);
});

test('rendering is deterministic', () => {
  for (const recipe of SAMPLES) assert.equal(renderPoster(recipe), renderPoster(recipe));
});

test('each poster is a 2:3 SVG containing its title', () => {
  for (const recipe of SAMPLES) {
    const svg = renderPoster(recipe);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 1200 1800"/);
    assert.ok(svg.includes(recipe.lettering.title.toUpperCase()), `${recipe.id} is missing its title`);
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${recipe.id} has bad values`);
  }
});

test('clip and mask ids are unique per poster so several can share a page', () => {
  const ids = SAMPLES.flatMap((r) => [...renderPoster(r).matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
  assert.equal(new Set(ids).size, ids.length);
});
