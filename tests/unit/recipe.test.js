import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecipe, createRecipe, duplicateRecipe, SCHEMA_VERSION } from '../../src/recipe.js';
import { renderPoster } from '../../src/poster.js';
import { SAMPLES } from '../../src/samples.js';

test('a new poster is complete and valid', () => {
  const r = createRecipe();
  assert.equal(r.schemaVersion, SCHEMA_VERSION);
  assert.match(r.id, /^p-/);
  assert.equal(r.lettering.title, 'Destination');
  assert.equal(normalizeRecipe(r).id, r.id);
  assert.notEqual(createRecipe().id, r.id);
});

test('damaged or empty recipes are repaired, not rejected', () => {
  const r = normalizeRecipe({ peak: 'volcano', time: 'noon', style: 'neon', lettering: { title: 42, layout: 'sideways', font: 'comic' }, peakSeed: -5 });
  assert.equal(r.peak, 'spire');
  assert.equal(r.time, 'alpenglow');
  assert.equal(r.style, 'flat');
  assert.equal(r.lettering.title, '');
  assert.equal(r.lettering.layout, 'top');
  assert.equal(r.lettering.font, 'limelight');
  assert.equal(r.peakSeed, 1);
  assert.doesNotThrow(() => renderPoster(normalizeRecipe(null)));
});

test('over-long text is trimmed to the editor limits', () => {
  const r = normalizeRecipe({ lettering: { title: 'x'.repeat(50), tagline: 'y'.repeat(90) } });
  assert.equal(r.lettering.title.length, 24);
  assert.equal(r.lettering.tagline.length, 40);
});

test('older recipes keep their look after normalising', () => {
  for (const sample of SAMPLES) {
    const n = normalizeRecipe({ ...sample, id: 'x' });
    assert.equal(renderPoster({ ...n, id: 'x' }), renderPoster({ ...sample, id: 'x' }), sample.id);
  }
});

test('fields from future versions survive', () => {
  const r = normalizeRecipe({ series: { name: 'Summer 2027', index: 3, total: 7 } });
  assert.deepEqual(r.series, { name: 'Summer 2027', index: 3, total: 7 });
});

test('a duplicate is a separate poster with the same design', () => {
  const original = createRecipe({ time: 'night', peak: 'massif' });
  const copy = duplicateRecipe(original);
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.time, 'night');
  copy.lettering.title = 'changed';
  assert.equal(original.lettering.title, 'Destination');
});

test('surprise me changes the look but keeps the words and identity', async () => {
  const { surpriseRecipe } = await import('../../src/recipe.js');
  const { createRng } = await import('../../src/rng.js');
  const base = normalizeRecipe({ id: 'p-keep', createdAt: 5, updatedAt: 6, lettering: { title: 'Zermatt', tagline: 'Summer 1936' } });
  const rng = createRng(7);
  const looks = new Set();
  for (let i = 0; i < 20; i++) {
    const r = surpriseRecipe(base, rng);
    assert.equal(r.id, 'p-keep');
    assert.equal(r.createdAt, 5);
    assert.equal(r.lettering.title, 'Zermatt');
    assert.equal(r.lettering.tagline, 'Summer 1936');
    assert.ok(Object.values(r.layers).some(Boolean), 'at least one scenery layer');
    assert.deepEqual(normalizeRecipe(r), r, 'result is already valid');
    looks.add(JSON.stringify([r.peak, r.time, r.style, r.lettering.font, r.lettering.layout]));
  }
  assert.ok(looks.size >= 15, `expected varied results, got ${looks.size}`);
});
