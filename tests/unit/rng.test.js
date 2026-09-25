import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../src/rng.js';

test('same seed gives the same sequence', () => {
  const a = createRng(1931);
  const b = createRng(1931);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('different seeds give different sequences', () => {
  assert.notEqual(createRng(1)(), createRng(2)());
});

test('values stay in range', () => {
  const rng = createRng(42);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1);
    const r = rng.range(10, 20);
    assert.ok(r >= 10 && r < 20);
    const n = rng.int(1, 6);
    assert.ok(Number.isInteger(n) && n >= 1 && n <= 6);
  }
});
