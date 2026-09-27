import { PHOTO_COLORS, PHOTO_INKS, MAX_SPOTS, normalizePhoto } from './recipe.js';
import { importPhoto, loadPhoto, loadedPhoto, photoArt, cachedArt, PhotoError } from './photo/photo-art.js';
import { panCrop, cropRect } from './photo/photo-poster.js';
import { SPOT_RADIUS } from './photo/posterize.js';

const INK_LABELS = { photo: 'Photo colours', poster: 'Poster inks' };

// A row of little ink swatches for the colours picker.
function colorsIcon(n) {
  const inks = ['#1f3a5f', '#6f4a6b', '#c96f53', '#e9a25f', '#f3d9a4', '#fffaf0'];
  const pick = inks.filter((_, i) => n === 6 || [0, 2, 3, 5, 1].slice(0, n).includes(i));
  const w = 60 / pick.length;
  return `<svg viewBox="0 0 60 20" aria-hidden="true">${pick.map((c, i) =>
    `<rect x="${i * w}" y="0" width="${w + 0.5}" height="20" fill="${c}"/>`).join('')}</svg>`;
}

// The photo controls: pick a photo, colours, inks, zoom, drag to frame, back to a drawn mountain.
// hooks: state() → the editor's recipe, render({ raw, art }) redraws, changed() redraws and saves.
export function startPhotoControls({ state, render, changed }) {
  const preview = document.getElementById('preview');
  const input = document.getElementById('photo-input');
  const pickButton = document.getElementById('photo-button');
  const status = document.getElementById('photo-status');
  const colorsPicker = document.getElementById('photo-colors-picker');
  const inksPicker = document.getElementById('photo-inks-picker');
  const zoom = document.getElementById('photo-zoom');
  const clearSpots = document.getElementById('clear-spots-button');

  colorsPicker.innerHTML = PHOTO_COLORS.map((n) =>
    `<button type="button" role="radio" data-value="${n}" aria-label="${n} colours">` +
    `<span class="icon">${colorsIcon(n)}</span><span>${n}</span></button>`).join('');
  inksPicker.innerHTML = PHOTO_INKS.map((key) => `<button type="button" role="radio" data-value="${key}">${INK_LABELS[key]}</button>`).join('');
  const colorButtons = [...colorsPicker.querySelectorAll('button')];
  const inkButtons = [...inksPicker.querySelectorAll('button')];

  // The art on show: the latest finished one for this photo, kept while a new one is being made,
  // so changing a setting doesn't flash an empty poster.
  let shown = null;
  let request = 0;
  let live = null; // { raw } while dragging or zooming: the plain photo is shown until the finger lifts

  function artFor(recipe) {
    return cachedArt(recipe) ?? (shown?.photoId === recipe.photo.id ? shown.art : null);
  }

  // Make the art for the current settings (unless it's ready), then redraw. The latest request wins.
  function makeArt() {
    const recipe = state();
    if (!recipe.photo || cachedArt(recipe)) return;
    const mine = ++request;
    preview.classList.add('working');
    preview.setAttribute('aria-busy', 'true');
    photoArt(recipe).then((art) => {
      if (mine !== request) return;
      shown = { photoId: recipe.photo.id, art };
      status.textContent = '';
      done();
      render();
    }).catch((error) => {
      if (mine !== request) return;
      done();
      status.textContent = error instanceof PhotoError ? error.message : 'Something went wrong making the poster.';
    });
  }
  function done() {
    preview.classList.remove('working');
    preview.removeAttribute('aria-busy');
  }

  // Called by the editor on every redraw: what to draw, and keeps the controls in step.
  function update(recipe) {
    const photo = recipe.photo;
    pickButton.textContent = photo ? '📷 Change photo' : '📷 Use your photo';
    if (!photo) {
      request++;
      done();
      return {};
    }
    for (const b of colorButtons) b.setAttribute('aria-checked', String(Number(b.dataset.value) === photo.colors));
    for (const b of inkButtons) b.setAttribute('aria-checked', String(b.dataset.value === photo.inks));
    if (document.activeElement !== zoom) zoom.value = String(photo.zoom);
    Object.assign(preview.dataset, {
      photo: photo.id, colors: String(photo.colors), inks: photo.inks,
      zoom: photo.zoom.toFixed(2), x: photo.x.toFixed(3), y: photo.y.toFixed(3), spots: String(photo.spots?.length ?? 0),
    });
    clearSpots.hidden = !photo.spots?.length;
    if (live) return { raw: live.raw, art: artFor(recipe) };
    const art = artFor(recipe);
    if (!cachedArt(recipe)) makeArt();
    return { art };
  }

  // Picking a photo: Android offers the camera or the photo gallery.
  pickButton.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    status.textContent = 'Opening your photo…';
    try {
      const { id, x, y } = await importPhoto(file);
      const before = state().photo;
      // A new photo starts framed on its main peak, keeping the colours and inks chosen for the last one.
      state().photo = normalizePhoto({ id, x, y, colors: before?.colors, inks: before?.inks });
      status.textContent = 'Making your poster…';
      changed();
    } catch (error) {
      status.textContent = error instanceof PhotoError ? error.message : "Couldn't open that photo. Try a JPEG or PNG.";
    }
  });

  colorsPicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button || !state().photo) return;
    state().photo.colors = Number(button.dataset.value);
    changed();
  });
  inksPicker.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-value]');
    if (!button || !state().photo) return;
    state().photo.inks = button.dataset.value;
    changed();
  });

  // While the slider moves, show the plain photo (instant); make the poster when it's let go.
  zoom.addEventListener('input', () => {
    const recipe = state();
    const raw = recipe.photo && loadedPhoto(recipe.photo.id);
    if (!raw) return;
    live = { raw };
    recipe.photo = panCrop(raw.width, raw.height, { ...recipe.photo, zoom: Number(zoom.value) }, 0, 0);
    render();
  });
  zoom.addEventListener('change', () => {
    if (!state().photo) return;
    live = null;
    state().photo.zoom = Number(zoom.value);
    changed();
  });

  document.getElementById('drawn-button').addEventListener('click', () => {
    delete state().photo;
    shown = null;
    status.textContent = '';
    changed();
  });

  // One finger drags the photo inside the poster.
  let drag = null;
  preview.addEventListener('pointerdown', (event) => {
    const recipe = state();
    const raw = recipe.photo && loadedPhoto(recipe.photo.id);
    if (!raw) return;
    drag = { x: event.clientX, y: event.clientY, crop: { ...recipe.photo }, raw, moved: false, pointer: event.pointerId };
    preview.setPointerCapture?.(event.pointerId);
  });
  preview.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const dx = (event.clientX - drag.x) / preview.clientWidth;
    const dy = (event.clientY - drag.y) / preview.clientHeight;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) return;
    drag.moved = true;
    live = { raw: drag.raw };
    state().photo = panCrop(drag.raw.width, drag.raw.height, drag.crop, dx, dy);
    render();
  });
  const endDrag = (event, tapped) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const { moved, raw } = drag;
    drag = null;
    live = null;
    if (moved) changed();
    else if (tapped) toggleSpot(event, raw);
  };
  preview.addEventListener('pointerup', (event) => endDrag(event, true));
  preview.addEventListener('pointercancel', (event) => endDrag(event, false));

  // A tap (no drag) keeps that spot of the photo detailed, or removes a spot tapped again.
  function toggleSpot(event, raw) {
    const art = preview.querySelector('svg')?.getBoundingClientRect();
    if (!art?.width) return;
    const u = (event.clientX - art.left) / art.width;
    const v = (event.clientY - art.top) / art.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    const photo = state().photo;
    const r = cropRect(raw.width, raw.height, photo);
    const px = r.left + u * r.width;
    const py = r.top + v * r.height;
    const spots = photo.spots ?? [];
    const near = spots.findIndex((s) => Math.hypot(s.x * raw.width - px, s.y * raw.height - py) < SPOT_RADIUS * r.width * 0.6);
    if (near >= 0) {
      spots.splice(near, 1);
      status.textContent = 'Detail spot removed.';
    } else if (spots.length >= MAX_SPOTS) {
      status.textContent = `That's the most detail spots (${MAX_SPOTS}). Tap one to remove it.`;
      return;
    } else {
      spots.push({ x: Math.round((px / raw.width) * 1e4) / 1e4, y: Math.round((py / raw.height) * 1e4) / 1e4 });
      status.textContent = 'Keeping this spot detailed…';
    }
    if (spots.length) photo.spots = spots; else delete photo.spots;
    changed();
    showRings();
  }

  // Briefly ring every detail spot, so the owner can see where they are.
  function showRings() {
    const photo = state().photo;
    const raw = photo && loadedPhoto(photo.id);
    // Rings live in the editor, over the poster, so redrawing the poster doesn't wipe them.
    const layer = preview.parentElement;
    for (const ring of layer.querySelectorAll('.spot-ring')) ring.remove();
    const art = preview.querySelector('svg');
    if (!raw || !art || !photo.spots) return;
    const box = art.getBoundingClientRect();
    const frame = layer.getBoundingClientRect();
    const r = cropRect(raw.width, raw.height, photo);
    const size = 2 * SPOT_RADIUS * box.width;
    for (const s of photo.spots) {
      const u = (s.x * raw.width - r.left) / r.width;
      const v = (s.y * raw.height - r.top) / r.height;
      const ring = Object.assign(document.createElement('span'), { className: 'spot-ring' });
      ring.setAttribute('aria-hidden', 'true');
      Object.assign(ring.style, {
        width: `${size}px`, height: `${size}px`,
        left: `${box.left - frame.left + u * box.width - size / 2}px`,
        top: `${box.top - frame.top + v * box.height - size / 2}px`,
      });
      layer.append(ring);
      ring.addEventListener('animationend', () => ring.remove());
    }
  }

  clearSpots.addEventListener('click', () => {
    if (!state().photo) return;
    delete state().photo.spots;
    status.textContent = 'Detail spots cleared.';
    changed();
  });

  return {
    update,
    // A different poster was opened in the editor.
    reset(recipe) {
      live = null;
      drag = null;
      status.textContent = '';
      if (shown && shown.photoId !== recipe.photo?.id) shown = null;
      if (recipe.photo) loadPhoto(recipe.photo.id).catch(() => {});
    },
  };
}
