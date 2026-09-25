import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPoster } from '../../src/poster.js';
import { SCENERY, sceneryOf } from '../../src/scene.js';
import { SAMPLES } from '../../src/samples.js';

const base = { ...SAMPLES[0], sun: undefined, scene: undefined, id: 't', peak: 'spire', peakSeed: 3 };

// All 64 on/off combinations of the six scenery layers.
const combos = Array.from({ length: 2 ** SCENERY.length }, (_, n) =>
  Object.fromEntries(SCENERY.map((name, i) => [name, Boolean(n & (1 << i))])));

test('every scenery combination renders cleanly at every time of day', () => {
  for (const time of ['dawn', 'midday', 'alpenglow', 'night']) {
    for (const layers of combos) {
      const svg = renderPoster({ ...base, time, layers });
      const label = `${time} ${JSON.stringify(layers)}`;
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), label);
      const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${label}`);
    }
  }
});

test('each layer actually changes the poster', () => {
  const none = renderPoster({ ...base, time: 'midday', layers: {} });
  for (const name of SCENERY) {
    assert.notEqual(renderPoster({ ...base, time: 'midday', layers: { [name]: true } }), none, name);
  }
});

test('switching one layer never reshuffles another', () => {
  // The forest is drawn from its own random stream, so its pines stay put when the hut appears.
  const pines = (svg) => svg.match(/<polygon points="[^"]+" fill="#2f5a3a"\/>/g).join('');
  const withoutHut = renderPoster({ ...base, time: 'midday', layers: { forest: true } });
  const withHut = renderPoster({ ...base, time: 'midday', layers: { forest: true, hut: true } });
  assert.equal(pines(withHut), pines(withoutHut));
});

test('posters saved with an old whole-scene name still render the same', () => {
  const legacy = { village: { village: true, forest: true }, lake: { lake: true, hut: true, forest: true }, slope: { skier: true, gondola: true, forest: true } };
  for (const [scene, layers] of Object.entries(legacy)) {
    assert.deepEqual(sceneryOf({ scene }), { ...Object.fromEntries(SCENERY.map((n) => [n, false])), ...layers });
    assert.equal(renderPoster({ ...base, time: 'alpenglow', scene }), renderPoster({ ...base, time: 'alpenglow', layers }));
  }
});
