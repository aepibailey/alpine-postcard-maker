import { renderPoster, POSTER_WIDTH, POSTER_HEIGHT } from './poster.js';
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

// Recipe → PNG Blob at the requested size.
export async function exportPoster(recipe, { width, height, embedFonts = true } = {}) {
  const scale = Math.min(width / POSTER_WIDTH, height / POSTER_HEIGHT);
  const w = Math.round(POSTER_WIDTH * scale);
  const h = Math.round(POSTER_HEIGHT * scale);

  let svg = renderPoster(recipe, { id: 'export' })
    .replace('<svg ', `<svg width="${w}" height="${h}" `);
  if (embedFonts) {
    const css = await embeddedFontCss(fontsUsed(recipe));
    svg = svg.replace(/(<svg [^>]*>)/, `$1<style>${css}</style>`);
  }

  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = PALETTES[recipe.time]?.paper ?? '#f3e6c8';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, Math.round((width - w) / 2), Math.round((height - h) / 2), w, h);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
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
