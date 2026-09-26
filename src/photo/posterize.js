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

// Lab with lightness counted a bit more than hue: posters are built on a clear light/dark
// structure (snow, rock, shadow), so a snowy peak doesn't melt into a pale sky of the same tint.
const L_WEIGHT = 1.5;
const toKey = (r, g, b) => {
  const [L, a, bb] = toLab(r, g, b);
  return [L * L_WEIGHT, a, bb];
};
const fromKey = ([L, a, b]) => [L / L_WEIGHT, a, b];

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// k-means++ on a sample of Lab pixels. Seeded, so the same photo always gives the same inks.
// `weights` (optional) says how much each sample counts.
export function kmeans(samples, k, rng, iterations = 14, weights = null) {
  const weight = (i) => (weights ? weights[i] : 1);
  const centres = [samples[Math.floor(rng() * samples.length)].slice()];
  const d = new Float64Array(samples.length);
  while (centres.length < k) {
    let total = 0;
    for (let i = 0; i < samples.length; i++) {
      d[i] = Math.min(...centres.map((c) => dist2(samples[i], c))) * weight(i);
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
      const wt = weight(i);
      s[0] += samples[i][0] * wt; s[1] += samples[i][1] * wt; s[2] += samples[i][2] * wt; s[3] += wt;
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
      out.push(toKey(data[i], data[i + 1], data[i + 2]));
    }
  }
  return out;
}

// A big even area (a clear blue sky, a grey roof) shouldn't use up most of the inks and leave
// none for small, telling colours (white houses, a far blue peak). Samples are grouped into
// small colour bins, and each bin counts as its size to the power `balance` (1 = plain area).
export function balancedSamples(samples, balance = 0.5) {
  const bins = new Map();
  for (const s of samples) {
    const key = `${Math.round(s[0] / 4)},${Math.round(s[1] / 5)},${Math.round(s[2] / 5)}`;
    let bin = bins.get(key);
    if (!bin) bins.set(key, (bin = [0, 0, 0, 0]));
    bin[0] += s[0]; bin[1] += s[1]; bin[2] += s[2]; bin[3]++;
  }
  const points = [];
  const weights = [];
  for (const bin of bins.values()) {
    points.push([bin[0] / bin[3], bin[1] / bin[3], bin[2] / bin[3]]);
    weights.push(bin[3] ** balance);
  }
  return { points, weights };
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
      l = nearest(toKey(data[i], data[i + 1], data[i + 2]), centres);
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

// Unsharp mask: lifts local contrast so ridges and snow edges split cleanly into inks.
export function sharpen(image, radius = 3, amount = 0.6) {
  const soft = blur(image, radius);
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < data.length; i++) {
    data[i] = (i & 3) === 3 ? 255 : image.data[i] + (image.data[i] - soft.data[i]) * amount;
  }
  return { width: image.width, height: image.height, data };
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

const MAX_CHROMA = 42;

// "Photo colours": the photo's own colours as fresh ink: richer, with a wider dark-to-light
// spread, the way a printer would mix them.
export function photoInks(centres) {
  const Ls = centres.map((c) => c[0]);
  const lo = Math.min(...Ls), hi = Math.max(...Ls);
  const newLo = Math.max(10, lo - 10), newHi = Math.min(97, hi + 6);
  const stretch = (L) => (hi - lo < 1 ? L : newLo + ((L - lo) * (newHi - newLo)) / (hi - lo));
  // Dull colours get richer; colours that are already vivid (a bright blue sky) are calmed a
  // little, like printing ink rather than a phone screen.
  return centres.map(([L, a, b]) => {
    const chroma = Math.hypot(a, b);
    let boost = 1 + 0.35 * Math.max(0, 1 - chroma / 45);
    if (chroma * boost > MAX_CHROMA) boost = MAX_CHROMA / chroma;
    return labToRgb([stretch(L), a * boost, b * boost]);
  });
}

// Area-average downscale so the long edge is at most `size`.
export function downscale(image, size) {
  const { width, height, data } = image;
  const s = size / Math.max(width, height);
  if (s >= 1) return image;
  const w = Math.max(1, Math.round(width * s)), h = Math.max(1, Math.round(height * s));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * height) / h), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * width) / w), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / w));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * width + xx) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

// Islands of one ink smaller than `minArea` pixels join the ink around them, so the picture
// keeps only shapes big enough to cut as a stencil.
// `stands(ink, around)` (optional) says an island's ink stands out strongly from the ink around it;
// such islands (a white house on a green meadow) are kept down to a quarter of that size.
export function mergeSmall(labels, width, height, minArea, stands = null) {
  const out = Uint8Array.from(labels);
  const seen = new Int32Array(out.length).fill(-1);
  const stack = new Int32Array(out.length);
  const members = [];
  for (let start = 0; start < out.length; start++) {
    if (seen[start] !== -1) continue;
    const l = out[start];
    let top = 0;
    stack[top++] = start;
    seen[start] = start;
    members.length = 0;
    const around = new Map();
    while (top) {
      const p = stack[--top];
      members.push(p);
      const x = p % width;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, p - width, p + width]) {
        if (q < 0 || q >= out.length) continue;
        if (out[q] === l) {
          if (seen[q] === -1) { seen[q] = start; stack[top++] = q; }
        } else around.set(out[q], (around.get(out[q]) ?? 0) + 1);
      }
    }
    if (members.length < minArea && around.size) {
      let best = l, bestN = 0;
      for (const [k, n] of around) if (n > bestN) { bestN = n; best = k; }
      if (stands && members.length >= minArea / 4 && stands(l, best)) continue;
      for (const p of members) out[p] = best;
    }
  }
  return out;
}

// Label map → full-size image with smooth, softly anti-aliased edges: each ink's mask is
// softened a little, scaled up, and every pixel takes the strongest ink (blending with the
// runner-up only right at an edge).
export function renderLabels(labels, lw, lh, width, height, colours, antialias = true) {
  const k = colours.length;
  const masks = [];
  for (let j = 0; j < k; j++) {
    const m = new Float32Array(lw * lh);
    for (let p = 0; p < m.length; p++) m[p] = labels[p] === j ? 1 : 0;
    masks.push(boxBlur1(boxBlur1(m, lw, lh), lw, lh));
  }
  const data = new Uint8ClampedArray(width * height * 4);
  const sx = lw / width, sy = lh / height;
  const sharp = 1.25 * Math.max(1, width / lw);
  for (let y = 0; y < height; y++) {
    const fy = Math.min(lh - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(lh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.min(lw - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(lw - 1, x0 + 1), tx = fx - x0;
      const a = y0 * lw + x0, b = y0 * lw + x1, c = y1 * lw + x0, d = y1 * lw + x1;
      let best = 0, bestS = -1, second = 0, secondS = -1;
      for (let j = 0; j < k; j++) {
        const m = masks[j];
        const s = (m[a] * (1 - tx) + m[b] * tx) * (1 - ty) + (m[c] * (1 - tx) + m[d] * tx) * ty;
        if (s > bestS) { second = best; secondS = bestS; best = j; bestS = s; } else if (s > secondS) { second = j; secondS = s; }
      }
      const o = (y * width + x) * 4;
      const c1 = colours[best];
      const t = antialias && secondS > 0 ? Math.min(1, 0.5 + (bestS - secondS) * sharp) : 1;
      if (t >= 1) {
        data[o] = c1[0]; data[o + 1] = c1[1]; data[o + 2] = c1[2];
      } else {
        const c2 = colours[second];
        data[o] = c2[0] + (c1[0] - c2[0]) * t; data[o + 1] = c2[1] + (c1[1] - c2[1]) * t; data[o + 2] = c2[2] + (c1[2] - c2[2]) * t;
      }
      data[o + 3] = 255;
    }
  }
  return data;
}

// 3×3 box blur of a single-channel map, edges clamped.
function boxBlur1(src, w, h) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      tmp[p] = (src[x > 0 ? p - 1 : p] + src[p] + src[x < w - 1 ? p + 1 : p]) / 3;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      out[p] = (tmp[y > 0 ? p - w : p] + tmp[p] + tmp[y < h - 1 ? p + w : p]) / 3;
    }
  }
  return out;
}

// The shapes are always worked out at this size (long edge); only the final edges are drawn at
// full size. Give posterize() the photo at about this size and it can draw the poster at any size
// with exactly the same shapes and inks, so the preview and a big export always match.
export const WORK_SIZE = 540;

// Photo → flat-ink poster image. Returns { width, height, data, inks, labels }.
// width/height: the size to draw (default: the image's). `antialias: false` keeps edges pure ink.
export function posterize(image, { colors = 5, inks = 'poster', palette, seed = 1, antialias = true, width = image.width, height = image.height } = {}) {
  const k = Math.min(MAX_COLORS, Math.max(MIN_COLORS, Math.round(colors)));
  const work = blur(sharpen(downscale(image, WORK_SIZE)), 1);
  const { width: w, height: h } = work;
  const { points, weights } = balancedSamples(samplePixels(work));
  const centres = kmeans(points, k, createRng(seed), 14, weights);
  const lab = centres.map(fromKey);
  const stands = (a, b) => dist2(lab[a], lab[b]) > 40 ** 2;
  let labels = smooth(assign(work, centres), w, h, 1, 2);
  labels = mergeSmall(labels, w, h, Math.max(4, Math.round((w * h) / 1200)), stands);
  labels = smooth(labels, w, h, 2, 1);
  const colours = inks === 'poster' && palette ? toInks(lab, palette) : photoInks(lab);
  const data = renderLabels(labels, w, h, width, height, colours, antialias);
  return { width, height, data, inks: colours, labels: { data: labels, width: w, height: h } };
}
