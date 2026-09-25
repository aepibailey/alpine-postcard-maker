// Tiny helpers for writing SVG markup as strings.
export const pts = (points) => points.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');

export const polygon = (points, fill, extra = '') => `<polygon points="${pts(points)}" fill="${fill}"${extra}/>`;

export const escapeText = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
