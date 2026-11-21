// Vice Coast Cover Studio — the cover renderer.
//
// Everything the poster shows is drawn here, on plain canvas 2D, with no
// libraries and no network: multi-panel layouts in the style of a game cover,
// a sunset / neon / pastel grade washed over every photo, a halftone-and-grain
// print finish, and big staggered caption lettering in the bundled Anton
// display font. The same draw routine paints the live preview and the
// exported PNG, so what you see is exactly what you save.

export const GRADES = {
  sunset: {
    label: 'Sunset',
    wash: ['#ff8a2a', '#ff2d78'],
    washAngle: 'vertical',
    filter: 'saturate(1.4) contrast(1.14) brightness(1.02)',
    overlayAlpha: 0.34,
    vignette: 0.34,
    accent: '#ff2d78',
  },
  neon: {
    label: 'Neon Night',
    wash: ['#00e5ff', '#ff00a8'],
    washAngle: 'diagonal',
    filter: 'saturate(1.55) contrast(1.2) brightness(0.98)',
    overlayAlpha: 0.38,
    vignette: 0.46,
    accent: '#00e5ff',
  },
  pastel: {
    label: 'Pastel Vice',
    wash: ['#ffd6f5', '#a8e6ff'],
    washAngle: 'vertical',
    filter: 'saturate(1.05) contrast(1.03) brightness(1.07)',
    overlayAlpha: 0.26,
    vignette: 0.2,
    accent: '#ffb3e6',
  },
};

export const LAYOUTS = {
  grid: { label: 'Cover Grid', panels: 9 },
  duo: { label: 'Hero Duo', panels: 2 },
  single: { label: 'Single Hero', panels: 1 },
};

export const SIZES = {
  square: { label: 'Square', w: 1080, h: 1080 },
  portrait: { label: 'Portrait', w: 1080, h: 1350 },
  landscape: { label: 'Landscape', w: 1920, h: 1080 },
};

/** Geometry of every photo panel for a layout, plus where the caption sits. */
export function layoutPanels(layout, W, H) {
  const m = Math.round(W * 0.022); // outer margin
  const g = Math.round(W * 0.011); // gutter between panels
  const innerW = W - m * 2;
  const innerH = H - m * 2;
  if (layout === 'grid') {
    // Tall hero down the middle, four stacked panels on each side.
    const sideW = Math.round(innerW * 0.27);
    const heroW = innerW - sideW * 2 - g * 2;
    const rows = 4;
    const cellH = Math.round((innerH - g * (rows - 1)) / rows);
    const panels = [{ x: m + sideW + g, y: m, w: heroW, h: innerH, hero: true }];
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? m : m + sideW + g + heroW + g;
      for (let r = 0; r < rows; r++) {
        panels.push({ x, y: m + r * (cellH + g), w: sideW, h: cellH, hero: false });
      }
    }
    return { panels, caption: { x: m, y: H - m - Math.round(H * 0.17), w: innerW, h: Math.round(H * 0.17) } };
  }
  if (layout === 'duo') {
    if (W >= H) {
      const leftW = Math.round(innerW * 0.56);
      const rightW = innerW - leftW - g;
      return {
        panels: [
          { x: m, y: m, w: leftW, h: innerH, hero: true },
          { x: m + leftW + g, y: m, w: rightW, h: innerH, hero: false },
        ],
        caption: { x: m, y: H - m - Math.round(H * 0.2), w: innerW, h: Math.round(H * 0.2) },
      };
    }
    const topH = Math.round(innerH * 0.56);
    const botH = innerH - topH - g;
    return {
      panels: [
        { x: m, y: m, w: innerW, h: topH, hero: true },
        { x: m, y: m + topH + g, w: innerW, h: botH, hero: false },
      ],
      caption: { x: m, y: H - m - Math.round(H * 0.2), w: innerW, h: Math.round(H * 0.2) },
    };
  }
  // single: one full-bleed photo, caption over the foot.
  return {
    panels: [{ x: 0, y: 0, w: W, h: H, hero: true }],
    caption: { x: m, y: H - Math.round(H * 0.26), w: innerW, h: Math.round(H * 0.24) },
  };
}

let grainCanvas = null;
/** A small tile of random speckle, reused as the print-grain pattern. */
function grainPattern(ctx) {
  if (!grainCanvas) {
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = 140;
    grainCanvas.height = 140;
    const g = grainCanvas.getContext('2d');
    const data = g.createImageData(140, 140);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.random() * 255;
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    g.putImageData(data, 0, 0);
  }
  return ctx.createPattern(grainCanvas, 'repeat');
}

/** Paints one photo into one panel rect, graded, with a print finish. */
function drawPanel(ctx, rect, photo, cfg, grade) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();

  if (photo) {
    const iw = photo.naturalWidth;
    const ih = photo.naturalHeight;
    const zoom = cfg.zoom ?? 1;
    let scale = cfg.fit === 'fit'
      ? Math.min(rect.w / iw, rect.h / ih) * zoom
      : Math.max(rect.w / iw, rect.h / ih) * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = rect.x + (rect.w - dw) / 2 + (cfg.dx ?? 0);
    const dy = rect.y + (rect.h - dh) / 2 + (cfg.dy ?? 0);
    // Posterised colour pass.
    ctx.filter = grade.filter;
    ctx.drawImage(photo, dx, dy, dw, dh);
    ctx.filter = 'none';
    // Gritty ink pass: a high-contrast, half-desaturated copy laid over the top.
    ctx.globalAlpha = 0.22;
    ctx.globalCompositeOperation = 'overlay';
    ctx.filter = 'contrast(1.7) saturate(0.35)';
    ctx.drawImage(photo, dx, dy, dw, dh);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = '#241a33';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }

  // Sunset / neon / pastel wash.
  const wash = grade.washAngle === 'diagonal'
    ? ctx.createLinearGradient(rect.x, rect.y + rect.h, rect.x + rect.w, rect.y)
    : ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.globalAlpha = grade.overlayAlpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // Halftone dots, denser towards the foot of the panel.
  const spacing = Math.max(9, Math.round(rect.w / 64));
  ctx.fillStyle = '#12081f';
  for (let y = rect.y + spacing / 2; y < rect.y + rect.h; y += spacing) {
    const depth = (y - rect.y) / rect.h; // 0 at top, 1 at bottom
    const r = Math.max(0.4, spacing * 0.16 * (0.4 + depth));
    for (let x = rect.x + spacing / 2; x < rect.x + rect.w; x += spacing) {
      ctx.globalAlpha = 0.05 + depth * 0.09;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Print grain.
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = 1;

  // Vignette inside the panel.
  const vg = ctx.createRadialGradient(
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.42,
    rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.75,
  );
  vg.addColorStop(0, 'rgba(10,4,20,0)');
  vg.addColorStop(1, `rgba(10,4,20,${grade.vignette})`);
  ctx.fillStyle = vg;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // Comic panel border: heavy dark line, thin pale inner line.
  ctx.lineWidth = Math.max(2, Math.round(rect.w * 0.008));
  ctx.strokeStyle = '#12081f';
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
  ctx.restore();
}

/** Fits one line of Anton into maxWidth, returning the font size to use. */
function fitFont(ctx, text, startSize, maxWidth, family) {
  let size = startSize;
  ctx.font = `${size}px ${family}`;
  while (size > 10 && ctx.measureText(text).width > maxWidth) {
    size = Math.max(10, size - 2);
    ctx.font = `${size}px ${family}`;
  }
  return size;
}

/** The staggered title + tagline bar, drawn over the foot of the cover. */
function drawCaption(ctx, W, H, state, area) {
  const grade = GRADES[state.grade];
  const lines = state.title.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3);
  if (!lines.length && !state.tagline.trim()) return;

  // A soft dark strip so the lettering reads on any photo.
  const strip = ctx.createLinearGradient(0, area.y - H * 0.04, 0, area.y + area.h + H * 0.02);
  strip.addColorStop(0, 'rgba(10,4,20,0)');
  strip.addColorStop(0.35, 'rgba(10,4,20,0.45)');
  strip.addColorStop(1, 'rgba(10,4,20,0.72)');
  ctx.fillStyle = strip;
  ctx.fillRect(0, area.y - H * 0.04, W, area.h + H * 0.06);

  const family = '"Anton", "Arial Narrow", sans-serif';
  const maxW = area.w * 0.96;
  const base = Math.round(H * state.titleSize);
  const gap = Math.round(base * 0.92);
  const totalH = lines.length * gap;

  // Tagline bar first, so the title block can sit clear above it.
  const tag = state.tagline.trim().toUpperCase();
  const tSize = Math.max(14, Math.round(H * 0.021));
  const bh = Math.round(tSize * 1.9);
  const barTop = tag
    ? area.y + area.h - bh - Math.round(H * 0.012)
    : area.y + area.h;
  // First line's centre: the whole title block ends just above the bar.
  const titleBottom = tag ? barTop - Math.round(H * 0.014) : area.y + area.h - Math.round(H * 0.01);
  let y = titleBottom - totalH + Math.round(base * 0.55);

  const tilts = [-0.022, 0.016, -0.012];
  lines.forEach((line, i) => {
    const text = line.toUpperCase();
    const size = fitFont(ctx, text, base, maxW, family);
    const tw = ctx.measureText(text).width;
    // Stagger: alternate lines sit a little left / right of centre.
    const cx = area.x + area.w / 2 + (i % 2 === 0 ? -W * 0.012 : W * 0.016);
    const cy = y + i * gap;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilts[i % tilts.length]);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.14);
    ctx.strokeStyle = '#12081f';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.04;
    ctx.strokeText(text, 0, 0);
    // Warm-to-white face so the title glows against the grade.
    const face = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    face.addColorStop(0, '#ffffff');
    face.addColorStop(1, '#ffe9c9');
    ctx.fillStyle = face;
    ctx.fillText(text, 0, 0);
    ctx.restore();
    void tw;
  });

  if (tag) {
    ctx.font = `${tSize}px ${family}`;
    try { ctx.letterSpacing = `${Math.round(tSize * 0.22)}px`; } catch { /* older canvas */ }
    const tw = ctx.measureText(tag).width;
    const pad = Math.round(tSize * 0.7);
    const bw = tw + pad * 2;
    const bx = area.x + area.w / 2 - bw / 2;
    const by = barTop;
    ctx.save();
    ctx.fillStyle = grade.accent;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    ctx.fillRect(bx, by, bw, bh);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#12081f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, bx + bw / 2, by + bh / 2 + 1);
    ctx.restore();
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }
}

/**
 * Draws the whole cover onto `canvas` at its own pixel size.
 * `state`: { layout, grade, title, tagline, titleSize, photos, panels, selected }
 * `photos`: array of HTMLImageElement (or null). `panels`: per-panel configs
 *   { photo, zoom, dx, dy, fit } indexed by panel position.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, W, H);

  const { panels, caption } = layoutPanels(state.layout, W, H);
  panels.forEach((rect, i) => {
    const cfg = state.panels[i] ?? { photo: 0, zoom: 1, dx: 0, dy: 0, fit: 'fill' };
    const photo = state.photos[cfg.photo] ?? state.photos[0] ?? null;
    drawPanel(ctx, rect, photo, cfg, grade);
  });

  drawCaption(ctx, W, H, state, caption);

  // Thin poster frame around the whole cover.
  ctx.lineWidth = Math.max(3, Math.round(W * 0.004));
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

  // Selection highlight in the editor preview (never in an export).
  if (state.selected != null && state.showSelection) {
    const rect = panels[state.selected];
    if (rect) {
      ctx.save();
      ctx.lineWidth = Math.max(3, Math.round(W * 0.005));
      ctx.strokeStyle = '#00e5ff';
      ctx.setLineDash([Math.round(W * 0.02), Math.round(W * 0.01)]);
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
      ctx.restore();
    }
  }
}
