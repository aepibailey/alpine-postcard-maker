import { SAMPLES } from './samples.js';
import { renderPoster } from './poster.js';
import { PEAK_KINDS, peakShape } from './layers/mountains.js';
import { polygon } from './svg.js';

const LABELS = { spire: 'Jagged spire', massif: 'Broad massif', pyramid: 'Lone pyramid', random: 'Random ridgeline' };
const SHORT = { spire: 'Spire', massif: 'Massif', pyramid: 'Pyramid', random: '🎲 Random' };
const STORE_KEY = 'apm.editor';

// The poster being edited. Scene and lettering stay fixed until later milestones add controls.
const state = { ...SAMPLES[0], id: 'preview', peak: 'spire', peakSeed: newSeed() };

function newSeed() {
  return 1 + Math.floor(Math.random() * 999998);
}

// Remembering the last mountain is a convenience only; the app works without storage.
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved && PEAK_KINDS.includes(saved.peak)) Object.assign(state, { peak: saved.peak, peakSeed: saved.peakSeed ?? state.peakSeed });
  } catch { /* ignore */ }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ peak: state.peak, peakSeed: state.peakSeed }));
  } catch { /* ignore */ }
}

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

export function startEditor() {
  const preview = document.getElementById('preview');
  const label = document.getElementById('peak-label');
  const picker = document.getElementById('peak-picker');
  const roll = document.getElementById('roll-button');

  load();

  picker.innerHTML = PEAK_KINDS.map((kind) =>
    `<button type="button" role="radio" data-peak="${kind}" aria-label="${LABELS[kind]}">` +
    `<span class="icon"></span><span>${SHORT[kind]}</span></button>`).join('');
  const buttons = [...picker.querySelectorAll('button')];

  function render() {
    preview.innerHTML = renderPoster(state);
    preview.dataset.peak = state.peak;
    preview.dataset.seed = String(state.peakSeed);
    label.textContent = state.peak === 'random' ? `${LABELS.random} · No. ${state.peakSeed}` : LABELS[state.peak];
    for (const button of buttons) {
      const kind = button.dataset.peak;
      button.setAttribute('aria-checked', String(kind === state.peak));
      button.querySelector('.icon').innerHTML = peakIcon(kind, state.peakSeed);
    }
    roll.hidden = state.peak !== 'random';
    save();
  }

  function choose(kind) {
    state.peak = kind;
    render();
  }

  picker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-peak]');
    if (button) choose(button.dataset.peak);
  });

  roll.addEventListener('click', () => {
    state.peakSeed = newSeed();
    render();
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
    choose(PEAK_KINDS[(i + (dx < 0 ? 1 : -1) + PEAK_KINDS.length) % PEAK_KINDS.length]);
  });
  preview.addEventListener('pointercancel', () => { start = null; });

  render();
}
