import { polygon } from '../svg.js';

const W = 1200;

// Original peak silhouettes, drawn on a 1200-wide poster with the base at y=1150.
// Each has an outline, a shadowed face, and the jagged lower edge of its snowfield.
export const PEAKS = {
  spire: {
    outline: [[0, 1300], [0, 1010], [150, 960], [260, 920], [380, 780], [430, 760], [520, 580], [566, 556], [612, 400], [640, 360], [668, 420], [700, 452], [730, 440], [800, 620], [850, 640], [940, 820], [1040, 870], [1200, 990], [1200, 1300]],
    shadow: [[640, 360], [668, 420], [700, 452], [730, 440], [800, 620], [850, 640], [940, 820], [1040, 870], [1200, 990], [1200, 1300], [760, 1300], [700, 860], [660, 560]],
    snowEdge: [[980, 880], [900, 760], [860, 790], [820, 700], [780, 740], [740, 660], [700, 720], [668, 640], [630, 700], [590, 630], [556, 690], [520, 650], [470, 760], [430, 730], [390, 820], [340, 800]],
  },
  massif: {
    outline: [[0, 1300], [0, 900], [110, 850], [220, 700], [290, 668], [380, 560], [440, 530], [510, 600], [560, 540], [610, 470], [660, 500], [700, 540], [770, 500], [860, 600], [950, 630], [1050, 750], [1200, 800], [1200, 1300]],
    shadow: [[610, 470], [660, 500], [700, 540], [770, 500], [860, 600], [950, 630], [1050, 750], [1200, 800], [1200, 1300], [700, 1300], [650, 820], [630, 620]],
    snowEdge: [[1120, 800], [1060, 760], [1000, 800], [950, 720], [890, 780], [840, 700], [790, 760], [740, 690], [690, 750], [640, 680], [600, 740], [555, 690], [510, 760], [470, 700], [420, 770], [370, 700], [320, 780], [270, 740], [210, 820], [140, 800]],
  },
  pyramid: {
    outline: [[40, 1300], [250, 900], [300, 906], [420, 720], [468, 706], [600, 430], [724, 660], [770, 670], [900, 880], [955, 872], [1170, 1300]],
    shadow: [[600, 430], [724, 660], [770, 670], [900, 880], [955, 872], [1170, 1300], [650, 1300], [615, 780]],
    snowEdge: [[960, 900], [880, 800], [830, 830], [790, 740], [745, 770], [700, 690], [660, 740], [620, 680], [580, 740], [540, 690], [500, 760], [460, 720], [420, 800], [360, 780], [300, 860]],
  },
};

function snowPolygon(edge) {
  return [[0, 0], [W, 0], [W, edge[0][1]], ...edge, [0, edge[edge.length - 1][1]]];
}

// Flat silhouette + shadow facet + snowfield, all clipped to the outline.
export function mountain(p, { id, kind, transform = '' }) {
  const peak = PEAKS[kind];
  const snow = snowPolygon(peak.snowEdge);
  const shadows = [peak.shadow];
  const shadowClip = shadows.map((s) => polygon(s, '#000')).join('');
  return `<g${transform ? ` transform="${transform}"` : ''}>` +
    `<clipPath id="${id}-peak">${polygon(peak.outline, '#000')}</clipPath>` +
    `<clipPath id="${id}-shade">${shadowClip}</clipPath>` +
    polygon(peak.outline, p.peak) +
    `<g clip-path="url(#${id}-peak)">` +
      shadows.map((s) => polygon(s, p.shadow)).join('') +
      polygon(snow, p.snow) +
      `<g clip-path="url(#${id}-shade)">${polygon(snow, p.snowShadow)}</g>` +
    `</g></g>`;
}

// A distant jagged range across the whole width, generated from the seed.
export function farRange(p, rng, { baseY = 1300, minY = 820, maxY = 960, color = p.far } = {}) {
  const points = [[0, baseY]];
  let x = 0;
  while (x < W) {
    points.push([x, rng.range(minY, maxY)]);
    x += rng.range(50, 130);
  }
  points.push([W, rng.range(minY, maxY)], [W, baseY]);
  return polygon(points, color);
}
