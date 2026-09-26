import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPoster } from '../../src/poster.js';
import { PRINT_STYLES } from '../../src/styles/print.js';
import { SAMPLES } from '../../src/samples.js';

const base = { ...SAMPLES[0], sun: undefined, id: 't', layers: { village: true, forest: true, lake: true } };

test('three print styles', () => {
  assert.deepEqual(PRINT_STYLES, ['flat', 'screenprint', 'aged']);
});

test('flat adds no filters; the others do', () => {
  assert.doesNotMatch(renderPoster({ ...base, style: 'flat' }), /<filter/);
  assert.match(renderPoster({ ...base, style: 'screenprint' }), /feDisplacementMap/);
  assert.match(renderPoster({ ...base, style: 'aged' }), /feColorMatrix/);
});

test('posters from before print styles render flat, unchanged', () => {
  assert.equal(renderPoster({ ...base }), renderPoster({ ...base, style: 'flat' }));
  assert.match(renderPoster({ ...base, style: 'nonsense' }), /data-style="flat"/);
});

test('every style x time renders cleanly with unique ids and stable grain', () => {
  for (const style of PRINT_STYLES) {
    for (const time of ['dawn', 'midday', 'alpenglow', 'night']) {
      const svg = renderPoster({ ...base, style, time });
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${style}/${time}`);
      const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(new Set(ids).size, ids.length, `duplicate ids ${style}/${time}`);
      // Every filter the poster references is defined in it.
      for (const [, ref] of svg.matchAll(/filter="url\(#([^)]+)\)"/g)) assert.ok(ids.includes(ref), `missing filter ${ref}`);
      assert.equal(svg, renderPoster({ ...base, style, time }), 'grain must be the same every render');
    }
  }
});
