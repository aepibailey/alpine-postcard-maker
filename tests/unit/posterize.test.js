import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posterize, kmeans, samplePixels, assign, smooth, toInks, inkLadder, toLab } from '../../src/photo/posterize.js';
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
    const out = posterize(fakePhoto(), { colors, inks: 'photo', seed: 2 });
    assert.ok(distinct(out) <= colors, `${colors} colours → ${distinct(out)}`);
    assert.equal(out.data.length, 90 * 135 * 4);
  }
});

test('colour count is clamped to 4–6', () => {
  assert.ok(distinct(posterize(fakePhoto(), { colors: 2, inks: 'photo' })) <= 4);
  assert.ok(distinct(posterize(fakePhoto(), { colors: 99, inks: 'photo' })) <= 6);
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
