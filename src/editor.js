import { renderPoster } from './poster.js';
import { PEAK_KINDS, peakShape } from './layers/mountains.js';
import { PALETTES } from './palettes.js';
import { polygon } from './svg.js';
import { SCENERY } from './scene.js';
import { TYPEFACES, LAYOUTS } from './layers/lettering.js';
import { PRINT_STYLES } from './styles/print.js';
import { MAX_TITLE, MAX_TAGLINE, randomSeed, surpriseRecipe } from './recipe.js';

const PEAK_LABELS = { spire: 'Jagged spire', massif: 'Broad massif', pyramid: 'Lone pyramid', random: 'Random ridgeline' };
const PEAK_SHORT = { spire: 'Spire', massif: 'Massif', pyramid: 'Pyramid', random: '🎲 Random' };
export const TIMES = ['dawn', 'midday', 'alpenglow', 'night'];
const TIME_LABELS = { dawn: 'Dawn', midday: 'Midday', alpenglow: 'Alpenglow', night: 'Starry night' };
const SCENERY_LABELS = { village: '🏘️ Village', hut: '🛖 Hut', gondola: '🚡 Gondola', forest: '🌲 Forest', lake: '🏞️ Lake', skier: '⛷️ Skier' };
const LAYOUT_LABELS = { top: 'Top', bottom: 'Bottom', arched: 'Arched', banner: 'Banner' };
const FONT_LABELS = Object.fromEntries(Object.entries(TYPEFACES).map(([key, face]) => [key, face.label]));
const STYLE_LABELS = { flat: 'Flat', screenprint: 'Screen print', aged: 'Aged paper' };
// Small silhouette of a peak for its picker button.
function peakIcon(kind, seed) {
  const shape = peakShape(kind, seed);
  const id = `icon-${kind}`;
  const snow = [[0, 0], [1200, 0], [1200, shape.snowEdge[0][1]], ...shape.snowEdge, [0, shape.snowEdge.at(-1)[1]]];
  return `<svg viewBox="0 300 1200 900" aria-hidden="true">` +
    `<clipPath id="${id}">${polygon(shape.outline, '#000')}</clipPath>` +
    polygon(shape.outline, 'currentColor') +
    `<g clip-path="url(#${id})">${polygon(snow, '#f3e6c8')}</g></svg>`;
}

// A little swatch of the time of day: its sky bands, sun or moon, and a peak in its inks.
function timeIcon(time) {
  const p = PALETTES[time];
  const bands = p.sky.slice(0, 4).map((c, i) => `<rect x="0" y="${i * 10}" width="60" height="11" fill="${c}"/>`).join('');
  const orb = time === 'night'
    ? `<circle cx="44" cy="11" r="6" fill="${p.sun}"/><circle cx="47" cy="9" r="5" fill="${p.sky[1]}"/>`
    : `<circle cx="${time === 'midday' ? 44 : 14}" cy="${time === 'dawn' ? 30 : 13}" r="7" fill="${p.sun}"/>`;
  return `<svg viewBox="0 0 60 40" aria-hidden="true">${bands}${orb}` +
    polygon([[8, 40], [30, 12], [52, 40]], p.peak) + polygon([[30, 12], [52, 40], [36, 40]], p.shadow) +
    polygon([[25, 18.4], [30, 12], [35, 18.4], [32, 17], [30, 20], [28, 17]], p.snow) + `</svg>`;
}

// A tiny poster outline showing where the title goes.
function layoutIcon(layout) {
  const frame = '<rect x="1" y="1" width="26" height="38" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>';
  const marks = {
    top: '<rect x="5" y="5" width="18" height="5" fill="currentColor"/>',
    bottom: '<rect x="1" y="28" width="26" height="11" fill="currentColor" opacity="0.35"/><rect x="5" y="31" width="18" height="5" fill="currentColor"/>',
    arched: '<path d="M4,13 Q14,2 24,13" fill="none" stroke="currentColor" stroke-width="4"/>',
    banner: '<rect x="1" y="27" width="26" height="12" fill="currentColor" opacity="0.35"/><rect x="5" y="30" width="18" height="4" fill="currentColor"/>',
  };
  return `<svg viewBox="0 0 28 40" aria-hidden="true">${frame}${marks[layout]}</svg>`;
}

// A little swatch hinting at each print finish.
function styleIcon(style) {
  const art = '<rect width="60" height="40" fill="#e9a25f"/><polygon points="6,40 30,10 54,40" fill="#1f3a5f"/><polygon points="25,16 30,10 35,16 30,19" fill="#f3e6c8"/>';
  const extra = {
    flat: '',
    screenprint: '<g fill="#f3e6c8" opacity="0.8">' +
      [[8, 6], [20, 4], [44, 8], [52, 18], [12, 22], [40, 30], [22, 34], [48, 36], [34, 24], [16, 12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.9"/>`).join('') + '</g>',
    aged: '<rect width="60" height="40" fill="#b08a55" opacity="0.45"/><circle cx="46" cy="10" r="9" fill="#6b4a2a" opacity="0.2"/><line x1="30" y1="0" x2="30" y2="40" stroke="#fff" stroke-width="1" opacity="0.5"/>',
  };
  return `<svg viewBox="0 0 60 40" aria-hidden="true">${art}${extra[style]}</svg>`;
}

// The word "Alpen" set in each typeface.
function fontIcon(font) {
  const face = TYPEFACES[font];
  return `<span class="font-sample" style="font-family:${face.family.replaceAll('"', "'")};font-weight:${face.weight}">Alpen</span>`;
}

function radioGroup(container, options, label, short, icon) {
  container.innerHTML = options.map((value) =>
    `<button type="button" role="radio" data-value="${value}" aria-label="${label[value]}">` +
    `<span class="icon">${icon ? icon(value) : ''}</span><span>${short[value]}</span></button>`).join('');
  return [...container.querySelectorAll('button')];
}

// Builds the editor controls. Returns { load(recipe), current() }; onChange(recipe) runs after every edit.
export function startEditor({ onChange = () => {} } = {}) {
  let state = null;
  const preview = document.getElementById('preview');
  const label = document.getElementById('peak-label');
  const peakPicker = document.getElementById('peak-picker');
  const timePicker = document.getElementById('time-picker');
  const roll = document.getElementById('roll-button');
  const sceneryPicker = document.getElementById('scenery-picker');
  const titleInput = document.getElementById('title-input');
  const taglineInput = document.getElementById('tagline-input');
  const fontPicker = document.getElementById('font-picker');
  const layoutPicker = document.getElementById('layout-picker');
  const stylePicker = document.getElementById('style-picker');
  const surprise = document.getElementById('surprise-button');
  const mini = document.getElementById('mini-preview');
  const editView = document.getElementById('edit-view');
  let miniShown = false;

  const peakButtons = radioGroup(peakPicker, PEAK_KINDS, PEAK_LABELS, PEAK_SHORT);
  const timeButtons = radioGroup(timePicker, TIMES, TIME_LABELS, TIME_LABELS, timeIcon);
  sceneryPicker.innerHTML = SCENERY.map((name) =>
    `<button type="button" data-layer="${name}" aria-pressed="false">${SCENERY_LABELS[name]}</button>`).join('');
  const sceneryButtons = [...sceneryPicker.querySelectorAll('button')];
  const fontButtons = radioGroup(fontPicker, Object.keys(TYPEFACES), FONT_LABELS, FONT_LABELS, fontIcon);
  const layoutButtons = radioGroup(layoutPicker, LAYOUTS, LAYOUT_LABELS, LAYOUT_LABELS, layoutIcon);
  const styleButtons = radioGroup(stylePicker, PRINT_STYLES, STYLE_LABELS, STYLE_LABELS, styleIcon);
  titleInput.maxLength = MAX_TITLE;
  taglineInput.maxLength = MAX_TAGLINE;

  function render() {
    preview.innerHTML = renderPoster(state, { id: 'preview' });
    preview.dataset.posterId = state.id;
    preview.dataset.peak = state.peak;
    preview.dataset.seed = String(state.peakSeed);
    preview.dataset.time = state.time;
    const peakName = state.peak === 'random' ? `${PEAK_LABELS.random} No. ${state.peakSeed}` : PEAK_LABELS[state.peak];
    label.textContent = `${peakName} · ${TIME_LABELS[state.time]}`;
    for (const button of peakButtons) {
      button.setAttribute('aria-checked', String(button.dataset.value === state.peak));
      button.querySelector('.icon').innerHTML = peakIcon(button.dataset.value, state.peakSeed);
    }
    for (const button of timeButtons) button.setAttribute('aria-checked', String(button.dataset.value === state.time));
    for (const button of sceneryButtons) button.setAttribute('aria-pressed', String(state.layers[button.dataset.layer]));
    preview.dataset.layers = SCENERY.filter((name) => state.layers[name]).join(',');
    preview.dataset.font = state.lettering.font;
    preview.dataset.layout = state.lettering.layout;
    for (const button of fontButtons) button.setAttribute('aria-checked', String(button.dataset.value === state.lettering.font));
    for (const button of layoutButtons) button.setAttribute('aria-checked', String(button.dataset.value === state.lettering.layout));
    for (const button of styleButtons) button.setAttribute('aria-checked', String(button.dataset.value === state.style));
    preview.dataset.style = state.style;
    roll.hidden = state.peak !== 'random';
    if (miniShown) mini.querySelector('.mini-art').innerHTML = renderPoster(state, { id: 'mini' });
  }

  // A small copy of the poster stays in view while the owner scrolls down to the lower controls.
  function showMini(show) {
    miniShown = show;
    mini.hidden = !show;
    if (show && state) mini.querySelector('.mini-art').innerHTML = renderPoster(state, { id: 'mini' });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      showMini(!editView.hidden && !entry.isIntersecting);
    }, { threshold: 0.15 }).observe(preview);
  }
  mini.addEventListener('click', () => {
    preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Every edit: redraw, then tell the app so it can save.
  function changed() {
    render();
    onChange(state);
  }

  function choosePeak(kind) {
    state.peak = kind;
    changed();
  }

  peakPicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (button) choosePeak(button.dataset.value);
  });

  timePicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    state.time = button.dataset.value;
    changed();
  });

  sceneryPicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-layer]');
    if (!button) return;
    state.layers[button.dataset.layer] = !state.layers[button.dataset.layer];
    changed();
  });

  titleInput.addEventListener('input', () => {
    state.lettering.title = titleInput.value;
    changed();
  });
  taglineInput.addEventListener('input', () => {
    state.lettering.tagline = taglineInput.value;
    changed();
  });
  fontPicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    state.lettering.font = button.dataset.value;
    changed();
  });
  layoutPicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    state.lettering.layout = button.dataset.value;
    changed();
  });

  stylePicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    state.style = button.dataset.value;
    changed();
  });

  surprise.addEventListener('click', () => {
    state = surpriseRecipe(state);
    changed();
  });

  roll.addEventListener('click', () => {
    state.peakSeed = randomSeed();
    changed();
  });

  // Horizontal swipe on the poster steps through the mountains.
  let start = null;
  preview.addEventListener('pointerdown', (event) => { start = { x: event.clientX, y: event.clientY }; });
  preview.addEventListener('pointerup', (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    const i = PEAK_KINDS.indexOf(state.peak);
    choosePeak(PEAK_KINDS[(i + (dx < 0 ? 1 : -1) + PEAK_KINDS.length) % PEAK_KINDS.length]);
  });
  preview.addEventListener('pointercancel', () => { start = null; });

  return {
    // Show a poster (a normalized recipe) in the editor.
    load(recipe) {
      state = structuredClone(recipe);
      titleInput.value = state.lettering.title;
      taglineInput.value = state.lettering.tagline;
      render();
    },
    current: () => structuredClone(state),
  };
}
