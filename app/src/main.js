// Vice Coast Cover Studio — the editor.
//
// Wires the page: load photos (your own files, local only, or the two bundled
// samples), pick a panel and crop it by dragging, choose a layout, a grade
// and a caption, then export a print-ready PNG. A `?shot=` query sets up a
// fixed scene for a screenshot instead (./shots.js).

import { drawCover, GRADES, LAYOUTS, SIZES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const $ = (id) => document.getElementById(id);

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load image'));
    img.src = url;
  });
}

export const state = {
  layout: 'grid',
  grade: 'sunset',
  size: 'square',
  title: 'VICE COAST',
  tagline: 'A LEONIDA STORY',
  titleSize: 0.085,
  photos: [], // HTMLImageElement, in load order
  photoNames: [],
  panels: Array.from({ length: 9 }, (_, i) => ({
    photo: i % 2 === 0 ? 0 : 1,
    zoom: 1,
    dx: 0,
    dy: 0,
    fit: 'fill',
  })),
  selected: 0,
  showSelection: true,
};

let raf = 0;
function redraw() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const size = SIZES[state.size];
    const scale = Math.min(920 / size.w, 920 / size.h);
    canvas.width = Math.round(size.w * scale);
    canvas.height = Math.round(size.h * scale);
    drawCover(canvas, state);
  });
}

/** Renders the cover at full export resolution and downloads it as a PNG. */
async function exportPNG() {
  const size = SIZES[state.size];
  const t0 = performance.now();
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, { ...state, showSelection: false });
  const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vice-coast-cover-${size.w}x${size.h}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  status.textContent = `Saved ${a.download} (${size.w} x ${size.h}, ${secs}s to PNG).`;
}

function panelCount() {
  return LAYOUTS[state.layout].panels;
}

function refreshPanelControls() {
  const sel = $('panelPhoto');
  sel.innerHTML = '';
  state.photoNames.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i + 1}. ${name}`;
    sel.appendChild(opt);
  });
  const cfg = state.panels[state.selected];
  sel.value = String(cfg.photo);
  $('zoom').value = String(cfg.zoom);
  $('zoomVal').textContent = `${Math.round(cfg.zoom * 100)}%`;
  $('fit').value = cfg.fit;
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${panelCount()}`;
}

function refreshButtons() {
  document.querySelectorAll('[data-layout]').forEach((b) =>
    b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) =>
    b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) =>
    b.classList.toggle('active', b.dataset.size === state.size));
  document.querySelectorAll('[data-caption]').forEach((b) =>
    b.classList.toggle('active', b.dataset.caption === state.title));
}

/** Adds a loaded photo to the library and, when it is the first, fills the panels. */
function addPhoto(img, name) {
  state.photos.push(img);
  state.photoNames.push(name);
  if (state.photos.length === 1) {
    state.panels.forEach((p) => { p.photo = 0; });
  }
  refreshPanelControls();
}

async function loadSample(name) {
  const img = await loadImage(`samples/${name}.jpg`);
  addPhoto(img, name === 'pier' ? 'Pier (sample)' : 'Boulevard (sample)');
  status.textContent = `Loaded sample photo “${name}”.`;
  redraw();
}

async function loadFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const img = await loadImage(URL.createObjectURL(file));
    addPhoto(img, file.name);
  }
  status.textContent = `Loaded ${files.length} photo${files.length === 1 ? '' : 's'}. Pick a panel, then choose its photo.`;
  redraw();
}

// ---- caption & style controls ----

$('title').addEventListener('input', (e) => { state.title = e.target.value; refreshButtons(); redraw(); });
$('tagline').addEventListener('input', (e) => { state.tagline = e.target.value; redraw(); });
$('titleSize').addEventListener('input', (e) => {
  state.titleSize = Number(e.target.value) / 1000;
  $('titleSizeVal').textContent = `${e.target.value}%`;
  redraw();
});
document.querySelectorAll('[data-caption]').forEach((b) => b.addEventListener('click', () => {
  state.title = b.dataset.caption;
  $('title').value = b.dataset.caption;
  refreshButtons();
  redraw();
}));
document.querySelectorAll('[data-layout]').forEach((b) => b.addEventListener('click', () => {
  state.layout = b.dataset.layout;
  state.selected = 0;
  refreshButtons();
  refreshPanelControls();
  redraw();
}));
document.querySelectorAll('[data-grade]').forEach((b) => b.addEventListener('click', () => {
  state.grade = b.dataset.grade;
  refreshButtons();
  redraw();
}));
document.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => {
  state.size = b.dataset.size;
  refreshButtons();
  redraw();
}));

// ---- photo controls ----

$('photo').addEventListener('change', (e) => { if (e.target.files.length) loadFiles([...e.target.files]); });
$('samplePier').addEventListener('click', () => loadSample('pier'));
$('sampleBoulevard').addEventListener('click', () => loadSample('boulevard'));
$('panelPhoto').addEventListener('change', (e) => {
  state.panels[state.selected].photo = Number(e.target.value);
  redraw();
});
$('zoom').addEventListener('input', (e) => {
  state.panels[state.selected].zoom = Number(e.target.value);
  $('zoomVal').textContent = `${Math.round(Number(e.target.value) * 100)}%`;
  redraw();
});
$('fit').addEventListener('change', (e) => {
  state.panels[state.selected].fit = e.target.value;
  redraw();
});
$('allPanels').addEventListener('click', () => {
  const cfg = state.panels[state.selected];
  state.panels.forEach((p) => { p.photo = cfg.photo; });
  status.textContent = 'One photo for all panels.';
  redraw();
});
$('resetPanel').addEventListener('click', () => {
  const cfg = state.panels[state.selected];
  cfg.zoom = 1; cfg.dx = 0; cfg.dy = 0; cfg.fit = 'fill';
  refreshPanelControls();
  redraw();
});
$('randomise').addEventListener('click', () => {
  const layouts = Object.keys(LAYOUTS);
  const grades = Object.keys(GRADES);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  const captions = ['VICE COAST', 'SUNSET HEIST', 'BOULEVARD QUEEN', 'NEON TIDE', 'PIER PRESSURE', 'PALM & CHROME'];
  state.title = captions[Math.floor(Math.random() * captions.length)];
  $('title').value = state.title;
  state.panels.forEach((p) => { p.photo = Math.floor(Math.random() * state.photos.length); });
  state.selected = 0;
  refreshButtons();
  refreshPanelControls();
  redraw();
});
$('export').addEventListener('click', exportPNG);

// ---- click a panel to select it, drag to pan its photo ----

let drag = null;
canvas.addEventListener('pointerdown', async (e) => {
  const { layoutPanels } = await import('./cover.js');
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * canvas.width;
  const y = ((e.clientY - r.top) / r.height) * canvas.height;
  const { panels } = layoutPanels(state.layout, canvas.width, canvas.height);
  const hit = panels.findIndex((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
  if (hit === -1) return;
  state.selected = hit;
  refreshPanelControls();
  const cfg = state.panels[hit];
  drag = { x: e.clientX, y: e.clientY, dx: cfg.dx, dy: cfg.dy };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const cfg = state.panels[state.selected];
  const k = canvas.width / canvas.getBoundingClientRect().width;
  cfg.dx = drag.dx + (e.clientX - drag.x) * k;
  cfg.dy = drag.dy + (e.clientY - drag.y) * k;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });

// ---- boot ----

async function boot() {
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch { /* Anton falls back to a narrow sans; the cover still draws */ }
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query, { state, loadImage, addPhoto, redraw, refreshButtons, refreshPanelControls, exportPNG });
    return;
  }
  await loadSample('boulevard');
  await loadSample('pier');
  refreshButtons();
  refreshPanelControls();
  redraw();
}

boot();
