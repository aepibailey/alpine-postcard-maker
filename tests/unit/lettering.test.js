import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPoster } from '../../src/poster.js';
import { TYPEFACES, LAYOUTS, letteringOf } from '../../src/layers/lettering.js';
import { SAMPLES } from '../../src/samples.js';

const base = { ...SAMPLES[0], sun: undefined, id: 't', time: 'midday' };
const poster = (lettering) => renderPoster({ ...base, lettering: { ...base.lettering, ...lettering } });

test('every typeface in every placement renders cleanly', () => {
  for (const font of Object.keys(TYPEFACES)) {
    for (const layout of LAYOUTS) {
      const svg = poster({ font, layout });
      assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${font}/${layout}`);
      assert.ok(svg.includes(TYPEFACES[font].family), `${font} family missing`);
      assert.ok(svg.includes('HOCHWALD'), `${font}/${layout} title missing`);
    }
  }
});

test('text is escaped so any name is safe', () => {
  const svg = poster({ title: 'Café <Bar> & "Grill"', tagline: "Tom's hut" });
  assert.ok(svg.includes('CAFÉ &lt;BAR&gt; &amp; &quot;GRILL&quot;'));
  assert.ok(!svg.includes('<BAR>'));
});

test('empty title and tagline leave no stray text elements', () => {
  const svg = poster({ title: '', tagline: '' });
  assert.ok(!svg.includes('data-role="lettering"'));
  assert.match(svg, /aria-label="Untitled poster"/);
});

test('long names get pinned to the safe width; short ones keep their natural width', () => {
  const titleEl = (svg) => svg.match(/<text [^>]*>[^<]*<\/text>/)[0];
  assert.match(titleEl(poster({ title: 'WWWWWWWWWWWWWWWWWWWWWWWW' })), /textLength="1040"/);
  assert.doesNotMatch(titleEl(poster({ title: 'Alp' })), /textLength/);
});

test('older recipes keep their look', () => {
  assert.deepEqual(letteringOf({ lettering: { title: 'a', tagline: 'b', layout: 'spaced' } }), { title: 'A', tagline: 'B', layout: 'top', font: 'josefin' });
  assert.deepEqual(letteringOf({ lettering: { title: 'a', tagline: 'b', layout: 'banner' } }), { title: 'A', tagline: 'B', layout: 'banner', font: 'limelight' });
  assert.equal(letteringOf({ lettering: { layout: 'nonsense', font: 'nonsense' } }).layout, 'top');
});
