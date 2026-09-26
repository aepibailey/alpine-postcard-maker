import { renderPoster, POSTER_WIDTH, POSTER_HEIGHT, styleOf } from './poster.js';
import { printStyle } from './styles/print.js';
import { PALETTES } from './palettes.js';
import { letteringOf, TYPEFACES } from './layers/lettering.js';

// Export sizes. The poster keeps its 2:3 shape; other shapes get a cream mat around it, like a mounted print.
export const EXPORT_SIZES = {
  wallpaper: { label: 'Phone wallpaper', width: 1440, height: 3200 },
  screen: { label: 'Match my screen' },
  print: { label: '10×15 print', width: 1200, height: 1800 },
  square: { label: 'Square post', width: 2160, height: 2160 },
};

// The phone's real pixel size, portrait.
export function screenSize(win = globalThis) {
  const dpr = win.devicePixelRatio || 1;
  const a = Math.round(win.screen.width * dpr);
  const b = Math.round(win.screen.height * dpr);
  return { width: Math.min(a, b), height: Math.max(a, b) };
}

// How a poster fills a shape other than 2:3: on a cream mat, or with its scenery extended edge to edge.
export const FITS = { mat: 'Cream mat', fill: 'Fill the screen' };

export function sizeFor(key, win = globalThis) {
  return key === 'screen' ? screenSize(win) : EXPORT_SIZES[key];
}

// Fonts each typeface needs, as files bundled in /fonts (relative to the app root).
const FONT_FILES = {
  Limelight: { url: 'fonts/Limelight-Regular.woff2', weight: '400' },
  'Poiret One': { url: 'fonts/PoiretOne-Regular.woff2', weight: '400' },
  'Bebas Neue': { url: 'fonts/BebasNeue-Regular.woff2', weight: '400' },
  'Josefin Sans': { url: 'fonts/JosefinSans-Variable.woff2', weight: '100 700' },
};

const familyName = (cssFamily) => cssFamily.split(',')[0].replace(/['"]/g, '').trim();

// The title face plus Josefin Sans (always used for taglines).
export function fontsUsed(recipe) {
  const { font } = letteringOf(recipe);
  return [...new Set([familyName(TYPEFACES[font].family), 'Josefin Sans'])];
}

function toBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

// An image-rendered SVG can't see the page's fonts, so embed them as data: URLs.
// fetch() is answered by the service worker cache, so this works offline.
export async function embeddedFontCss(families, base = document.baseURI) {
  const rules = await Promise.all(families.map(async (family) => {
    const file = FONT_FILES[family];
    const response = await fetch(new URL(file.url, base));
    if (!response.ok) throw new Error(`Font ${family} unavailable`);
    const data = toBase64(await response.arrayBuffer());
    return `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${data}) format('woff2');font-weight:${file.weight};}`;
  }));
  return rules.join('');
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Poster image failed to render'));
    img.src = url;
  });
}

const svgUrl = (svg) => URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));

async function drawSvg(ctx, svg, x, y, w, h) {
  const url = svgUrl(svg);
  try {
    ctx.drawImage(await loadImage(url), x, y, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Extend the edges of the poster (drawn at x, y, w, h) out to the whole canvas by stretching its
// outermost pixels: the sky continues upward, the ground (and any lane) downward, the scenery sideways.
// The poster is drawn without texture in this mode, so stretched pixels stay clean. Pixels are taken a
// little way in from the edge, because the screen-print wobble leaves the outermost ones ragged.
function extendEdges(ctx, canvas, { x, y, w, h }, inset) {
  const W = canvas.width;
  const H = canvas.height;
  if (y > 0) {
    ctx.drawImage(canvas, x, y + inset, w, 1, 0, 0, W, y + inset);
    ctx.drawImage(canvas, x, y + h - inset - 1, w, 1, 0, y + h - inset, W, H - y - h + inset);
  }
  if (x > 0) {
    ctx.drawImage(canvas, x + inset, y, 1, h, 0, y, x + inset, h);
    ctx.drawImage(canvas, x + w - inset - 1, y, 1, h, x + w - inset, y, W - x - w + inset, h);
  }
}

// Recipe → PNG Blob at the requested size.
export async function exportPoster(recipe, { width, height, embedFonts = true, fit = 'mat', type = 'image/png', quality } = {}) {
  const scale = Math.min(width / POSTER_WIDTH, height / POSTER_HEIGHT);
  const w = Math.round(POSTER_WIDTH * scale);
  const h = Math.round(POSTER_HEIGHT * scale);
  const x = Math.round((width - w) / 2);
  const y = Math.round((height - h) / 2);
  const fill = fit === 'fill' && (w < width || h < height);

  let svg = renderPoster(recipe, { id: 'export', frame: !fill, overlay: !fill })
    .replace('<svg ', `<svg width="${w}" height="${h}" `);
  if (embedFonts) {
    const css = await embeddedFontCss(fontsUsed(recipe));
    svg = svg.replace(/(<svg [^>]*>)/, `$1<style>${css}</style>`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const p = PALETTES[recipe.time] ?? PALETTES.alpenglow;
  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, width, height);
  await drawSvg(ctx, svg, x, y, w, h);

  if (fill) {
    extendEdges(ctx, canvas, { x, y, w, h }, Math.ceil(10 * scale));
    // The print texture goes over the whole image, so the extended edges match the poster.
    const print = printStyle(styleOf(recipe), p, { id: 'fill', seed: recipe.seed, width, height });
    if (print.overlay) {
      await drawSvg(ctx, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${print.defs}</defs>${print.overlay}</svg>`, 0, 0, width, height);
    }
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image'))), type, quality));
}

export function fileName(recipe, sizeKey) {
  const slug = letteringOf(recipe).title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'alpine-poster'}-${sizeKey}.png`;
}

// Hand the image to the share sheet (Photos, Messages, Drive…). Returns false if sharing isn't possible.
export async function shareFile(file, title) {
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title });
  } catch (error) {
    if (error.name === 'AbortError') return true; // The owner closed the share sheet.
    return false;
  }
  return true;
}

// Save into the phone's Downloads folder (which gallery apps show).
export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
