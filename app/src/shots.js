// Deterministic scenes for screenshots: ?shot=editor shows the page with a
// sample photo loaded; ?shot=cover shows the finished cover alone, full-bleed.
// Query knobs: photo=<sample>, caption=<text>, tagline=<text>, layout=<id>,
// size=<square|portrait|landscape>, grade=<id>. window.__shotReady is set
// once the scene is painted (and the display font is loaded), so a screenshot
// taken after that flag is reproducible.

import { drawCover, layoutPanels, SIZES } from './cover.js';

function ready() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; resolve(); }));
  });
}

/**
 * Applies one shot scene. `app` is the live editor context from main.js:
 * { state, loadImage, addPhoto, redraw, refreshButtons, refreshPanelControls }.
 */
export async function runShot(shot, query, app) {
  const { state } = app;

  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('size') && SIZES[query.get('size')]) state.size = query.get('size');
  if (query.get('caption')) state.title = query.get('caption');
  if (query.get('tagline') != null) state.tagline = query.get('tagline');
  const titleEl = document.getElementById('title');
  if (titleEl) titleEl.value = state.title;
  const tagEl = document.getElementById('tagline');
  if (tagEl) tagEl.value = state.tagline;

  // The scene's photos: the named sample first, then the other sample so the
  // multi-panel layouts have two photos to work with.
  const first = query.get('photo') ?? 'boulevard';
  const second = first === 'pier' ? 'boulevard' : 'pier';
  for (const name of [first, second]) {
    const img = await app.loadImage(`samples/${name}.jpg`);
    app.addPhoto(img, name === 'pier' ? 'Pier (sample)' : 'Boulevard (sample)');
  }
  // Hero panel gets the named photo; the rest alternate.
  state.panels.forEach((p, i) => { p.photo = i % 2 === 0 ? 0 : 1; });
  // Bias each panel's crop towards the top of its photo, so faces stay in
  // frame in the wide and short panels (the same pan a user sets by dragging).
  const size = SIZES[state.size];
  const { panels } = layoutPanels(state.layout, size.w, size.h);
  panels.forEach((rect, i) => {
    const cfg = state.panels[i];
    const photo = state.photos[cfg.photo];
    if (!photo) return;
    const scale = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight);
    const drawnH = photo.naturalHeight * scale;
    cfg.dy = Math.round((drawnH - rect.h) * 0.35);
    cfg.dx = 0;
  });
  state.selected = 0;
  app.refreshButtons();
  app.refreshPanelControls();

  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch { /* fall back to a narrow sans */ }

  if (shot === 'cover') {
    // Full-resolution cover, controls hidden, canvas stretched to the window.
    document.body.classList.add('shot-cover');
    const canvas = document.getElementById('cover');
    canvas.width = size.w;
    canvas.height = size.h;
    drawCover(canvas, { ...state, showSelection: false });
    await ready();
    return;
  }

  // Editor scene: the normal preview, UI visible.
  app.redraw();
  await ready();
}
