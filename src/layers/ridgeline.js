import { createRng } from '../rng.js';

const W = 1200;
const HORIZON = 1150;
const BELOW = 1300;

// Walk from the summit out to one poster edge, stepping down with jagged sub-summits.
function slope(rng, apex, edgeX, edgeY) {
  const dir = Math.sign(edgeX - apex[0]);
  const points = [];
  let x = apex[0];
  while (true) {
    x += dir * rng.range(45, 110);
    if ((dir > 0 && x >= edgeX) || (dir < 0 && x <= edgeX)) break;
    const t = Math.abs(x - apex[0]) / Math.abs(edgeX - apex[0]);
    // Concave profile: steep near the top, easing out toward the valley.
    const base = apex[1] + (edgeY - apex[1]) * (1 - (1 - t) ** 1.6);
    const jag = rng() < 0.35 ? -rng.range(20, 70) : rng.range(-25, 25);
    points.push([x, Math.min(HORIZON - 20, Math.max(apex[1] + 25, base + jag))]);
  }
  return points;
}

// A new original peak from a seed, in the same shape format as the hand-drawn PEAKS.
export function generateRidgeline(seed) {
  const rng = createRng(seed ^ 0x5eed);
  const apex = [rng.range(430, 770), rng.range(340, 480)];
  const leftEdge = rng.range(860, 1060);
  const rightEdge = rng.range(860, 1060);

  const left = slope(rng, apex, 0, leftEdge).reverse();
  const right = slope(rng, apex, W, rightEdge);
  const outline = [[0, BELOW], [0, leftEdge], ...left, apex, ...right, [W, rightEdge], [W, BELOW]];

  // Shadowed face: everything right of a ridge that falls from the summit.
  const ridgeMid = [apex[0] + rng.range(15, 70), apex[1] + (HORIZON - apex[1]) * rng.range(0.35, 0.55)];
  const shadow = [apex, ...right, [W, rightEdge], [W, BELOW], [apex[0] + rng.range(60, 180), BELOW], ridgeMid];

  // Snowline: a zigzag edge, drawn right-to-left like the hand-made peaks.
  const snowline = apex[1] + rng.range(200, 320);
  const snowEdge = [];
  let down = true;
  for (let x = W - 40; x > 40; x -= rng.range(28, 75)) {
    // Mostly a ragged zigzag, with the odd long gully of snow running further down.
    const gully = down && rng() < 0.22 ? rng.range(50, 120) : 0;
    const depth = down ? rng.range(15, 70) + gully : -rng.range(5, 50);
    snowEdge.push([x, snowline + depth + Math.abs(x - apex[0]) * 0.12]);
    down = !down;
  }

  return { outline, shadow, snowEdge };
}
