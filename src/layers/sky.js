import { polygon } from '../svg.js';

const W = 1200;

// Flat horizontal ink bands, darkest at the top, ending at the horizon.
export function sky(p, { horizon = 1150 } = {}) {
  const bands = p.sky;
  const step = horizon / bands.length;
  // The last band runs to the bottom so nothing below the horizon is ever left unpainted.
  return bands
    .map((color, i) => {
      const height = i === bands.length - 1 ? 1800 - i * step : step + 2;
      return `<rect x="0" y="${Math.round(i * step)}" width="${W}" height="${Math.ceil(height)}" fill="${color}"/>`;
    })
    .join('');
}

export function sun(p, { x, y, r }) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.sun}"/>`;
}

// A crescent: a disc with an offset disc masked out.
export function moon(p, { id, x, y, r }) {
  return `<mask id="${id}-moon"><rect width="${W}" height="1800" fill="white"/>` +
    `<circle cx="${x + r * 0.45}" cy="${y - r * 0.2}" r="${r * 0.9}" fill="black"/></mask>` +
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.sun}" mask="url(#${id}-moon)"/>`;
}

// Scattered dots plus a few four-point sparkles.
export function stars(p, rng, { count = 70, top = 40, bottom = 900 } = {}) {
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = rng.range(40, W - 40);
    const y = rng.range(top, bottom);
    if (rng() < 0.12) {
      const s = rng.range(10, 18);
      const t = s * 0.22;
      out += polygon([[x, y - s], [x + t, y - t], [x + s, y], [x + t, y + t], [x, y + s], [x - t, y + t], [x - s, y], [x - t, y - t]], p.sun);
    } else {
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rng.range(1.5, 4).toFixed(1)}" fill="${p.sun}" opacity="${rng.range(0.6, 1).toFixed(2)}"/>`;
    }
  }
  return out;
}
