import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRecipe, createRecipe, duplicateRecipe, surpriseRecipe, normalizePhoto } from '../../src/recipe.js';
import { renderPoster, styleOf } from '../../src/poster.js';
import { cropRect, panCrop, letteringInks } from '../../src/photo/photo-poster.js';
import { makeBackup, readBackup, parseBackup, planRestore } from '../../src/backup.js';
import { createRng } from '../../src/rng.js';

const withPhoto = (photo = { id: 'ph-1' }, extra = {}) => createRecipe({ photo, ...extra });

test('a photo field is filled in and clamped', () => {
  assert.deepEqual(normalizePhoto({ id: 'ph-1' }), { id: 'ph-1', x: 0.5, y: 0.5, zoom: 1, colors: 5, inks: 'photo' });
  assert.deepEqual(normalizePhoto({ id: 'ph-1', x: -3, y: 9, zoom: 40, colors: 9, inks: 'neon' }),
    { id: 'ph-1', x: 0, y: 1, zoom: 3, colors: 5, inks: 'photo' });
  assert.equal(normalizePhoto({ id: 'ph-1', colors: 4, inks: 'poster' }).colors, 4);
});

test('a broken photo field is dropped; drawn posters are unchanged', () => {
  for (const photo of [null, 'ph-1', { x: 0.2 }, { id: '' }, { id: 7 }]) {
    assert.equal('photo' in normalizeRecipe({ photo }), false, JSON.stringify(photo));
  }
  const drawn = createRecipe();
  assert.equal('photo' in drawn, false);
  assert.deepEqual(normalizeRecipe(drawn), drawn);
});

test('a copy of a photo poster shares the photo', () => {
  const r = withPhoto({ id: 'ph-1', x: 0.3, colors: 6 });
  const copy = duplicateRecipe(r);
  assert.notEqual(copy.id, r.id);
  assert.deepEqual(copy.photo, r.photo);
});

test('Surprise me on a photo poster keeps the photo and its framing', () => {
  const r = withPhoto({ id: 'ph-1', x: 0.3, y: 0.6, zoom: 1.5 }, { layers: { village: false, forest: false } });
  const rng = createRng(5);
  for (let i = 0; i < 20; i++) {
    const s = surpriseRecipe(r, rng);
    assert.equal(s.photo.id, 'ph-1');
    assert.deepEqual([s.photo.x, s.photo.y, s.photo.zoom], [0.3, 0.6, 1.5]);
    assert.deepEqual(s.layers, r.layers);
    assert.equal(s.lettering.title, r.lettering.title);
  }
});

test('photo posters render without their art yet, flat and without scenery', () => {
  const r = withPhoto({ id: 'ph-1' }, { style: 'aged' });
  assert.equal(styleOf(r), 'flat');
  const svg = renderPoster(r, { id: 'x' });
  assert.match(svg, /data-style="photo"/);
  assert.match(svg, /Destination/i);
  const art = { url: 'data:image/png;base64,AAAA', inks: [[10, 10, 10], [240, 240, 240]], rows: new Float32Array(60).fill(90) };
  assert.match(renderPoster(r, { id: 'x', art }), /<image href="data:image\/png;base64,AAAA"/);
});

test('lettering on a photo stands out from what is behind it', () => {
  const dark = [[20, 20, 30], [200, 190, 180], [250, 248, 240]];
  const onLight = letteringInks({ inks: dark, rows: new Float32Array(60).fill(90) }, 'midday', 'top');
  const onDark = letteringInks({ inks: dark, rows: new Float32Array(60).fill(10) }, 'midday', 'top');
  assert.equal(onLight.title, '#14141e');
  assert.equal(onDark.title, '#faf8f0');
});

test('dragging moves the framing but never past the photo edge', () => {
  const crop = { x: 0.5, y: 0.5, zoom: 1 };
  const right = panCrop(1200, 800, crop, 0.2, 0); // drag right → see more of the left
  assert.ok(right.x < 0.5);
  const far = panCrop(1200, 800, crop, 5, 5);
  const r = cropRect(1200, 800, far);
  assert.ok(Math.abs(r.left) < 1e-9);
  assert.ok(Math.abs(far.x - r.width / 2 / 1200) < 1e-9, 'stored centre is the reachable one');
  assert.equal(far.y, 0.5); // a landscape photo already fills the poster's height
  const zoomed = panCrop(1200, 800, { x: 0.5, y: 0.5, zoom: 2 }, 0, 0.3);
  assert.ok(zoomed.y < 0.5);
});

const blob = (text, type) => new Blob([text], { type });

test('backups carry the photos their posters use', async () => {
  const a = withPhoto({ id: 'ph-1' });
  const b = duplicateRecipe(a);
  const c = createRecipe();
  const entries = [a, b, c].map((recipe) => ({ id: recipe.id, recipe, thumbnail: null, updatedAt: recipe.updatedAt }));
  const text = await makeBackup(entries, new Date(), async (id) => (id === 'ph-1' ? blob('jpeg-bytes', 'image/jpeg') : null));
  const { posters, photos } = readBackup(text);
  assert.equal(posters.length, 3);
  assert.deepEqual(photos.map((p) => p.id), ['ph-1']);
  assert.match(photos[0].dataUrl, /^data:image\/jpeg;base64,/);
  assert.equal(JSON.parse(text).version, 2);
});

test('version 1 backups still restore, and unsafe photos are dropped', () => {
  const v1 = JSON.stringify({ format: 'alpine-postcard-maker-backup', version: 1, posters: [{ recipe: createRecipe() }] });
  assert.equal(parseBackup(v1).length, 1);
  assert.deepEqual(readBackup(v1).photos, []);
  const bad = JSON.stringify({ format: 'alpine-postcard-maker-backup', version: 2, posters: [], photos: [
    { id: 'ph-1', dataUrl: 'javascript:alert(1)' }, { id: 'ph-2', dataUrl: 'data:text/html;base64,AAAA' }, { dataUrl: 'data:image/jpeg;base64,AAAA' },
    { id: 'ph-3', dataUrl: 'data:image/jpeg;base64,AAAA' }] });
  assert.deepEqual(readBackup(bad).photos.map((p) => p.id), ['ph-3']);
});

test('restore brings over only the photos that are missing', () => {
  const a = withPhoto({ id: 'ph-1' });
  const b = withPhoto({ id: 'ph-2' });
  const c = withPhoto({ id: 'ph-3' });
  const photos = ['ph-1', 'ph-2', 'ph-3'].map((id) => ({ id, dataUrl: 'data:image/jpeg;base64,AAAA' }));
  const existing = [{ id: c.id, updatedAt: c.updatedAt + 10 }];
  const plan = planRestore(existing, [{ recipe: a }, { recipe: b }, { recipe: c }], photos, ['ph-2']);
  assert.deepEqual(plan.photos.map((p) => p.id), ['ph-1']); // ph-2 is on the phone; c isn't restored
});
