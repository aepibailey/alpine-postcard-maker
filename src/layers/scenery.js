import { polygon } from '../svg.js';

// A pine: three stacked triangles on a short trunk.
export function pine(x, baseY, h, color) {
  const w = h * 0.42;
  const tiers = [0, 0.3, 0.55].map((t, i) => {
    const top = baseY - h + t * h;
    const bottom = baseY - h * 0.12 - (2 - i) * h * 0.2;
    const half = w * (0.55 + i * 0.22);
    return polygon([[x, top], [x + half, bottom], [x - half, bottom]], color);
  });
  return `<rect x="${x - h * 0.03}" y="${baseY - h * 0.14}" width="${h * 0.06}" height="${h * 0.14}" fill="${color}"/>` + tiers.join('');
}

export function forest(p, rng, { x0, x1, baseY, minH, maxH, color = p.fore, density = 1 }) {
  let out = '';
  for (let x = x0; x < x1; x += rng.range(28, 60) / density) {
    out += pine(x, baseY + rng.range(-6, 6), rng.range(minH, maxH), color);
  }
  return out;
}

// A small house: walls, steep roof, one or two windows.
function house(p, { x, y, w, h, roof = p.accent, wall = p.paper, window = p.ink }) {
  const roofH = w * 0.55;
  return `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${wall}"/>` +
    polygon([[x - w * 0.12, y - h], [x + w / 2, y - h - roofH], [x + w * 1.12, y - h]], roof) +
    `<rect x="${x + w * 0.2}" y="${y - h * 0.62}" width="${w * 0.18}" height="${h * 0.26}" fill="${window}"/>` +
    (w > 60 ? `<rect x="${x + w * 0.6}" y="${y - h * 0.62}" width="${w * 0.18}" height="${h * 0.26}" fill="${window}"/>` : '');
}

function church(p, { x, y, window = p.ink, roof = p.accent }) {
  const tw = 46;
  return `<rect x="${x}" y="${y - 90}" width="120" height="90" fill="${p.paper}"/>` +
    polygon([[x - 10, y - 90], [x + 60, y - 140], [x + 130, y - 90]], roof) +
    `<rect x="${x + 120}" y="${y - 210}" width="${tw}" height="210" fill="${p.paper}"/>` +
    polygon([[x + 114, y - 210], [x + 120 + tw / 2, y - 330], [x + 126 + tw, y - 210]], roof) +
    `<circle cx="${x + 120 + tw / 2}" cy="${y - 170}" r="12" fill="${window}"/>` +
    `<rect x="${x + 131}" y="${y - 120}" width="${tw - 22}" height="36" rx="12" fill="${window}"/>` +
    `<rect x="${x + 30}" y="${y - 60}" width="18" height="30" rx="9" fill="${window}"/>` +
    `<rect x="${x + 70}" y="${y - 60}" width="18" height="30" rx="9" fill="${window}"/>`;
}

// The village buildings: rooftops stepping across a slope, church on the right.
// Windows glow at night; by day they are dark panes.
export function village(p, { lit = false } = {}) {
  const window = lit ? p.accent : p.fore;
  const roof = lit ? p.wood : p.accent;
  const houses = [
    { x: 250, y: 1262, w: 70, h: 60 }, { x: 345, y: 1250, w: 90, h: 72 }, { x: 460, y: 1256, w: 64, h: 54 },
    { x: 300, y: 1318, w: 96, h: 76 }, { x: 420, y: 1320, w: 78, h: 64 }, { x: 530, y: 1312, w: 100, h: 82 },
    { x: 650, y: 1300, w: 70, h: 58 },
  ].map((h) => house(p, { ...h, window, roof })).join('');
  return houses + church(p, { x: 730, y: 1320, window, roof });
}

// A forested foothill ridge standing in front of the main peak.
export function foothills(p, { horizon = 1150, color = p.fore } = {}) {
  return `<path d="M0,${horizon - 90} C200,${horizon - 150} 420,${horizon - 60} 620,${horizon - 70} C820,${horizon - 80} 1000,${horizon - 160} 1200,${horizon - 110} L1200,${horizon + 40} L0,${horizon + 40} Z" fill="${color}"/>`;
}

// Still lake with ripple lines; the reflection itself is drawn by the poster (it needs the peak).
export function lakeWater(p, rng, { top = 1150, bottom = 1480 } = {}) {
  let ripples = '';
  for (let y = top + 24; y < bottom - 10; y += rng.range(18, 34)) {
    const x = rng.range(40, 900);
    ripples += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${rng.range(80, 300).toFixed(0)}" height="4" fill="${p.paper}" opacity="0.35"/>`;
  }
  return ripples;
}

export function hut(p, { x, y, s = 1 }) {
  const w = 150 * s;
  const h = 90 * s;
  return `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${p.wood}"/>` +
    polygon([[x - 26 * s, y - h + 4 * s], [x + w / 2, y - h - 70 * s], [x + w + 26 * s, y - h + 4 * s]], p.accent) +
    `<rect x="${x + 22 * s}" y="${y - h * 0.7}" width="${26 * s}" height="${26 * s}" fill="${p.paper}"/>` +
    `<rect x="${x + w - 48 * s}" y="${y - h * 0.7}" width="${26 * s}" height="${26 * s}" fill="${p.paper}"/>` +
    `<rect x="${x + w / 2 - 14 * s}" y="${y - 48 * s}" width="${28 * s}" height="${48 * s}" fill="${p.ink}"/>`;
}

// A lone skier carving down the slope, with the trail behind.
export function skier(p, { x, y, s = 1, color = p.ink, trail = p.snowShadow }) {
  const t = (dx, dy) => `${x + dx * s},${y + dy * s}`;
  const trailPath = `<path d="M${t(-40, 70)} C${t(-200, 20)} ${t(-180, -120)} ${t(-380, -190)}" stroke="${trail}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
    `<path d="M${t(-30, 84)} C${t(-190, 36)} ${t(-170, -104)} ${t(-370, -174)}" stroke="${trail}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  const line = (d, w, c = color) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const figure = `<g transform="translate(${x},${y}) scale(${s}) rotate(8)">` +
    line('M-70,70 L85,86', 7) +
    line('M-60,80 L92,96', 7) +
    line('M-6,0 L18,32 L2,68', 13) +
    line('M6,-2 L34,30 L20,76', 13) +
    line('M0,0 L22,-50', 16) +
    line('M18,-42 L48,-16', 9) + line('M48,-16 L66,78', 4) +
    line('M16,-40 L-10,-16', 9) + line('M-10,-16 L-36,70', 4) +
    line('M16,-52 L-26,-46', 7, p.accent) +
    `<circle cx="28" cy="-68" r="14" fill="${color}"/>` +
    `</g>`;
  return trailPath + figure;
}

// Cable, one pylon and a single lit cabin.
export function gondola(p, { from, to, t = 0.4, pylonAt = 0.78, groundY, color = p.fore }) {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const cx = x0 + (x1 - x0) * t;
  const cy = y0 + (y1 - y0) * t;
  const px = x0 + (x1 - x0) * pylonAt;
  const py = y0 + (y1 - y0) * pylonAt;
  const pylonH = groundY ? groundY - py : 260;
  return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${color}" stroke-width="4"/>` +
    `<line x1="${x0}" y1="${y0 + 16}" x2="${x1}" y2="${y1 + 16}" stroke="${color}" stroke-width="2"/>` +
    polygon([[px - 8, py], [px + 8, py], [px + 22, py + pylonH], [px - 22, py + pylonH]], color) +
    `<rect x="${px - 40}" y="${py - 6}" width="80" height="12" fill="${color}"/>` +
    `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy + 40}" stroke="${color}" stroke-width="5"/>` +
    `<rect x="${cx - 36}" y="${cy + 40}" width="72" height="56" rx="8" fill="${color}"/>` +
    `<rect x="${cx - 26}" y="${cy + 50}" width="22" height="20" fill="${p.accent}"/>` +
    `<rect x="${cx + 4}" y="${cy + 50}" width="22" height="20" fill="${p.accent}"/>`;
}
