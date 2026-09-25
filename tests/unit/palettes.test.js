import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTES, INK_ROLES, mix, reflected } from '../../src/palettes.js';

const HEX = /^#[0-9a-f]{6}$/;

test('four times of day exist', () => {
  assert.deepEqual(Object.keys(PALETTES).sort(), ['alpenglow', 'dawn', 'midday', 'night']);
});

test('every palette defines every ink role with valid colors', () => {
  for (const [name, palette] of Object.entries(PALETTES)) {
    for (const role of INK_ROLES) {
      const value = palette[role];
      assert.ok(value, `${name} is missing ${role}`);
      for (const color of [value].flat()) assert.match(color, HEX, `${name}.${role}`);
    }
  }
});

test('mix blends endpoints exactly', () => {
  assert.equal(mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(mix('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
});

test('reflected palette keeps every role and valid colors', () => {
  const r = reflected(PALETTES.midday);
  for (const role of INK_ROLES) for (const c of [r[role]].flat()) assert.match(c, HEX);
});
