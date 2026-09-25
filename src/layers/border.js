// Cream paper margin around the print, with a thin keyline inside it.
export function border(p, { width = 1200, height = 1800, margin = 34 } = {}) {
  const m = margin;
  return `<path fill-rule="evenodd" fill="${p.paper}" d="M0,0H${width}V${height}H0Z M${m},${m}V${height - m}H${width - m}V${m}Z"/>` +
    `<rect x="${m + 10}" y="${m + 10}" width="${width - 2 * m - 20}" height="${height - 2 * m - 20}" fill="none" stroke="${p.paper}" stroke-width="3" opacity="0.8"/>`;
}
