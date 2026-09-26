import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posterize, kmeans, samplePixels, assign, smooth, toInks, inkLadder, toLab, mergeSmall, downscale, photoInks } from '../../src/photo/posterize.js';
import { PALETTES } from '../../src/palettes.js';
import { createRng } from '../../src/rng.js';

// A small made-up "photo": sky gradient, a dark mountain, a white snowfield, plus noise.
function fakePhoto(width = 90, height = 135, seed = 3) {
  const rng = createRng(seed);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ridge = height * 0.45 + Math.abs(x - width / 2) * 0.8;
      let c;
      if (y < ridge) c = [90 + y, 140 + y * 0.6, 220];
      else if (y < height * 0.8) c = [60, 70, 80];
      else c = [240, 242, 245];
      const n = (rng() - 0.5) * 30;
      const i = (y * width + x) * 4;
      data[i] = c[0] + n; data[i + 1] = c[1] + n; data[i + 2] = c[2] + n; data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

const distinct = ({ data }) => {
  const set = new Set();
  for (let i = 0; i < data.length; i += 4) set.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  return set.size;
};

test('k-means is repeatable with the same seed', () => {
  const samples = samplePixels(fakePhoto());
  assert.deepEqual(kmeans(samples, 5, createRng(9)), kmeans(samples, 5, createRng(9)));
  assert.equal(kmeans(samples, 4, createRng(9)).length, 4);
});

test('a poster uses at most the chosen number of inks', () => {
  for (const colors of [4, 5, 6]) {
    const out = posterize(fakePhoto(), { colors, inks: 'photo', seed: 2, antialias: false });
    assert.ok(distinct(out) <= colors, `${colors} colours → ${distinct(out)}`);
    assert.equal(out.data.length, 90 * 135 * 4);
  }
});

test('colour count is clamped to 4–6', () => {
  assert.ok(distinct(posterize(fakePhoto(), { colors: 2, inks: 'photo', antialias: false })) <= 4);
  assert.ok(distinct(posterize(fakePhoto(), { colors: 99, inks: 'photo', antialias: false })) <= 6);
});

test('poster inks come only from the palette and keep dark-to-light order', () => {
  const palette = PALETTES.alpenglow;
  const ladder = new Set(inkLadder(palette).map((c) => c.join()));
  const out = posterize(fakePhoto(), { colors: 5, inks: 'poster', palette, seed: 4 });
  for (const ink of out.inks) assert.ok(ladder.has(ink.join()), `${ink} is not a palette ink`);

  const centres = [[80, 0, 0], [20, 0, 0], [50, 0, 0], [95, 0, 0]];
  const inks = toInks(centres, palette).map((rgb) => toLab(...rgb)[0]);
  const byPhoto = centres.map((c, i) => [c[0], inks[i]]).sort((a, b) => a[0] - b[0]).map(([, l]) => l);
  assert.deepEqual(byPhoto, [...byPhoto].sort((a, b) => a - b));
});

test('smoothing removes lone specks', () => {
  const w = 9, h = 9;
  const labels = new Uint8Array(w * h);
  labels[4 * w + 4] = 1;
  assert.equal(smooth(labels, w, h, 1, 1)[4 * w + 4], 0);
});

test('assign gives every pixel its nearest centre', () => {
  const image = { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]) };
  assert.deepEqual([...assign(image, [toLab(255, 255, 255), toLab(0, 0, 0)])], [1, 0]);
});

test('small islands join the ink around them; big shapes stay', () => {
  const w = 20, h = 20;
  const labels = new Uint8Array(w * h);
  labels[5 * w + 5] = 1; labels[5 * w + 6] = 1; // 2-pixel island
  for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) labels[y * w + x] = 2; // 100-pixel block
  const out = mergeSmall(labels, w, h, 10);
  assert.equal(out[5 * w + 5], 0);
  assert.equal(out[15 * w + 15], 2);
});

test('downscale keeps the aspect and averages colour', () => {
  const image = { width: 4, height: 2, data: new Uint8ClampedArray([0, 0, 0, 255, 200, 200, 200, 255, 0, 0, 0, 255, 200, 200, 200, 255, 0, 0, 0, 255, 200, 200, 200, 255, 0, 0, 0, 255, 200, 200, 200, 255]) };
  const out = downscale(image, 2);
  assert.equal(out.width, 2);
  assert.equal(out.height, 1);
  assert.equal(out.data[0], 100);
});

test('a small preview and a big export are cut into the same shapes', () => {
  const photo = fakePhoto(360, 540);
  const a = posterize(photo, { colors: 5, inks: 'photo', antialias: false, width: 600, height: 900 });
  const b = posterize(photo, { colors: 5, inks: 'photo', antialias: false, width: 1200, height: 1800 });
  assert.deepEqual(a.inks, b.inks);
  assert.equal(b.data.length, 1200 * 1800 * 4);
  let match = 0, n = 0;
  for (let y = 1; y < 900; y += 7) {
    for (let x = 1; x < 600; x += 7) {
      n++;
      const i = (y * 600 + x) * 4, j = ((2 * y) * 1200 + 2 * x) * 4;
      if (a.data[i] === b.data[j] && a.data[i + 1] === b.data[j + 1] && a.data[i + 2] === b.data[j + 2]) match++;
    }
  }
  assert.ok(match / n > 0.97, `${Math.round((100 * match) / n)}% of the poster matches`);
});

test('big plain areas leave inks for small, distinct colours', () => {
  // 90% flat sky, 10% split between white houses and dark roofs.
  const w = 200, h = 300;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const y = Math.floor(p / w), x = p % w;
    const c = y < 270 ? [70, 150, 240] : (x % 40 < 20 ? [250, 250, 245] : [40, 35, 30]);
    data.set([...c, 255], p * 4);
  }
  const out = posterize({ width: w, height: h, data }, { colors: 4, inks: 'photo', antialias: false });
  const L = out.inks.map((c) => toLab(...c)[0]);
  assert.ok(Math.max(...L) > 90, 'white houses keep a light ink');
  assert.ok(Math.min(...L) < 30, 'dark roofs keep a dark ink');
});

test('vivid colours are calmed, dull ones enriched', () => {
  const [vivid, dull] = photoInks([[60, 0, -70], [50, 8, 8]]).map((c) => toLab(...c));
  assert.ok(Math.hypot(vivid[1], vivid[2]) <= 43);
  assert.ok(Math.hypot(dull[1], dull[2]) > Math.hypot(8, 8));
});
