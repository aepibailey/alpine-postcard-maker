import { createRng } from '../rng.js';

// Turns a photo into a few flat "inks", like a screen-printed poster. Works on ImageData-like
// objects ({ width, height, data: RGBA bytes }) so it runs the same on the phone and in tests.

export const MIN_COLORS = 4;
export const MAX_COLORS = 6;

// sRGB byte → CIE Lab, so "nearest colour" matches what the eye sees.
const lin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const LIN = Float32Array.from({ length: 256 }, (_, i) => lin(i));
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

export function toLab(r, g, b) {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// k-means++ on a sample of Lab pixels. Seeded, so the same photo always gives the same inks.
export function kmeans(samples, k, rng, iterations = 14) {
  const centres = [samples[Math.floor(rng() * samples.length)].slice()];
  const d = new Float64Array(samples.length);
  while (centres.length < k) {
    let total = 0;
    for (let i = 0; i < samples.length; i++) {
      d[i] = Math.min(...centres.map((c) => dist2(samples[i], c)));
      total += d[i];
    }
    let pick = rng() * total;
    let i = 0;
    while (i < samples.length - 1 && (pick -= d[i]) > 0) i++;
    centres.push(samples[i].slice());
  }
  const label = new Uint8Array(samples.length);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < samples.length; i++) label[i] = nearest(samples[i], centres);
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < samples.length; i++) {
      const s = sums[label[i]];
      s[0] += samples[i][0]; s[1] += samples[i][1]; s[2] += samples[i][2]; s[3]++;
    }
    sums.forEach((s, j) => { if (s[3]) centres[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  return centres;
}

function nearest(lab, centres) {
  let best = 0;
  let bestD = Infinity;
  for (let j = 0; j < centres.length; j++) {
    const dd = dist2(lab, centres[j]);
    if (dd < bestD) { bestD = dd; best = j; }
  }
  return best;
}

// About `count` evenly spread pixels, as Lab.
export function samplePixels(image, count = 20000) {
  const { width, height, data } = image;
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / count)));
  const out = [];
  for (let y = Math.floor(step / 2); y < height; y += step) {
    for (let x = Math.floor(step / 2); x < width; x += step) {
      const i = (y * width + x) * 4;
      out.push(toLab(data[i], data[i + 1], data[i + 2]));
    }
  }
  return out;
}

// Each pixel's nearest centre. A small cache keeps this fast on photos with large even areas.
export function assign(image, centres) {
  const { width, height, data } = image;
  const labels = new Uint8Array(width * height);
  const cache = new Map();
  for (let p = 0; p < labels.length; p++) {
    const i = p * 4;
    const key = ((data[i] >> 2) << 12) | ((data[i + 1] >> 2) << 6) | (data[i + 2] >> 2);
    let l = cache.get(key);
    if (l === undefined) {
      l = nearest(toLab(data[i], data[i + 1], data[i + 2]), centres);
      cache.set(key, l);
    }
    labels[p] = l;
  }
  return labels;
}

// Gentle blur (three box passes ≈ Gaussian) so gradients like a sky break into clean bands
// instead of speckle when they are split into inks.
export function blur(image, radius) {
  const { width, height } = image;
  if (radius < 1) return image;
  let src = Float32Array.from(image.data);
  let tmp = new Float32Array(src.length);
  const pass = (from, to, horizontal) => {
    const len = horizontal ? width : height;
    const lines = horizontal ? height : width;
    const span = 2 * radius + 1;
    for (let line = 0; line < lines; line++) {
      const at = (k) => (horizontal ? (line * width + k) * 4 : (k * width + line) * 4);
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) sum += from[at(Math.min(len - 1, Math.max(0, k))) + c];
        for (let k = 0; k < len; k++) {
          to[at(k) + c] = sum / span;
          sum += from[at(Math.min(len - 1, k + radius + 1)) + c] - from[at(Math.max(0, k - radius)) + c];
        }
      }
    }
  };
  for (let i = 0; i < 3; i++) {
    pass(src, tmp, true);
    pass(tmp, src, false);
  }
  const data = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i++) data[i] = (i & 3) === 3 ? 255 : src[i];
  return { width, height, data };
}

// Majority filter: each pixel takes the most common ink around it, which melts away speckle
// and leaves the flat shapes a screen printer would cut.
export function smooth(labels, width, height, radius = 2, passes = 2) {
  let src = labels;
  for (let pass = 0; pass < passes; pass++) {
    const out = new Uint8Array(src.length);
    const counts = new Uint16Array(256);
    for (let y = 0; y < height; y++) {
      const y0 = Math.max(0, y - radius), y1 = Math.min(height - 1, y + radius);
      for (let x = 0; x < width; x++) {
        const x0 = Math.max(0, x - radius), x1 = Math.min(width - 1, x + radius);
        let best = src[y * width + x];
        let bestN = 0;
        for (let yy = y0; yy <= y1; yy++) {
          const row = yy * width;
          for (let xx = x0; xx <= x1; xx++) {
            const l = src[row + xx];
            if (++counts[l] > bestN) { bestN = counts[l]; best = l; }
          }
        }
        for (let yy = y0; yy <= y1; yy++) {
          const row = yy * width;
          for (let xx = x0; xx <= x1; xx++) counts[src[row + xx]] = 0;
        }
        out[y * width + x] = best;
      }
    }
    src = out;
  }
  return src;
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lightness = (rgb) => toLab(...rgb)[0];
const labToRgb = ([L, a, b]) => {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
  const R = X * 3.2406 - Y * 1.5372 - Z * 0.4986;
  const G = -X * 0.9689 + Y * 1.8758 + Z * 0.0415;
  const B = X * 0.0557 - Y * 0.204 + Z * 1.057;
  const g = (v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)));
  return [g(R), g(G), g(B)];
};

// The inks a palette offers a photo, darkest first.
export function inkLadder(palette) {
  const roles = [palette.fore, palette.shadow, palette.peak, palette.far, palette.sky[1], palette.sky[3], palette.snowShadow, palette.snow];
  return [...new Set(roles)].map(hex).sort((a, b) => lightness(a) - lightness(b));
}

// "Poster inks": the photo's colours, darkest to lightest, become the palette's inks in the same order.
export function toInks(centres, palette) {
  const ladder = inkLadder(palette);
  const order = centres.map((c, i) => [c[0], i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  const inks = new Array(centres.length);
  order.forEach((ci, rank) => {
    const at = centres.length === 1 ? ladder.length - 1 : Math.round((rank * (ladder.length - 1)) / (centres.length - 1));
    inks[ci] = ladder[at];
  });
  return inks;
}

// "Photo colours": the photo's own colours, a touch richer, like fresh ink.
export function photoInks(centres) {
  return centres.map(([L, a, b]) => labToRgb([L, a * 1.15, b * 1.15]));
}

// Photo → flat-ink poster image. Returns { width, height, data, inks }.
// Softening and smoothing scale with the image, so the preview and a big export look alike.
export function posterize(image, { colors = 5, inks = 'poster', palette, seed = 1, detail = 1 } = {}) {
  const k = Math.min(MAX_COLORS, Math.max(MIN_COLORS, Math.round(colors)));
  const scale = Math.max(image.width, image.height) / 1800;
  const soft = blur(image, Math.round(3 * scale / detail));
  const centres = kmeans(samplePixels(soft), k, createRng(seed));
  const labels = smooth(assign(soft, centres), image.width, image.height, Math.max(1, Math.round(3 * scale / detail)), 2);
  const colours = inks === 'poster' && palette ? toInks(centres, palette) : photoInks(centres);
  const data = new Uint8ClampedArray(image.width * image.height * 4);
  for (let p = 0; p < labels.length; p++) {
    const c = colours[labels[p]];
    data[p * 4] = c[0]; data[p * 4 + 1] = c[1]; data[p * 4 + 2] = c[2]; data[p * 4 + 3] = 255;
  }
  return { width: image.width, height: image.height, data, inks: colours };
}
