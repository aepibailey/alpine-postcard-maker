import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRidgeline } from '../../src/layers/ridgeline.js';
import { peakShape, PEAK_KINDS } from '../../src/layers/mountains.js';

const SEEDS = Array.from({ length: 200 }, (_, i) => i * 7919 + 1);

test('same seed gives the same ridgeline', () => {
  assert.deepEqual(generateRidgeline(1234), generateRidgeline(1234));
});

test('different seeds give different ridgelines', () => {
  assert.notDeepEqual(generateRidgeline(1), generateRidgeline(2));
});

test('every generated peak is a sane poster shape', () => {
  for (const seed of SEEDS) {
    const { outline, shadow, snowEdge } = generateRidgeline(seed);
    for (const [x, y] of [...outline, ...shadow, ...snowEdge]) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y), `seed ${seed}: bad point`);
      assert.ok(x >= 0 && x <= 1200, `seed ${seed}: x=${x} off the poster`);
      assert.ok(y >= 300 && y <= 1300, `seed ${seed}: y=${y} out of range`);
    }
    // Outline runs left to right, and its single highest point is the summit.
    const xs = outline.map(([x]) => x);
    assert.deepEqual(xs, [...xs].sort((a, b) => a - b), `seed ${seed}: outline not left-to-right`);
    const top = Math.min(...outline.map(([, y]) => y));
    assert.ok(top <= 480, `seed ${seed}: summit too low (${top})`);
    // Snow edge is drawn right to left.
    const sx = snowEdge.map(([x]) => x);
    assert.deepEqual(sx, [...sx].sort((a, b) => b - a), `seed ${seed}: snow edge order`);
  }
});

test('peakShape serves all four kinds', () => {
  for (const kind of PEAK_KINDS) assert.ok(peakShape(kind, 42).outline.length > 5, kind);
});
