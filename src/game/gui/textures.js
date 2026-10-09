// Procedural texture generation for Java 1.8.9 UI — PRD 19 RF-004..006
import { getPackUrl, MC } from '../pack';

let _widgetsUrl = null;
let _dirtUrl = null;

function drawButtonState(ctx, x, y, state) {
  const w = 200, h = 20;
  let base, light, dark;

  if (state === 'normal') {
    base = '#727272'; light = '#8B8B8B'; dark = '#585858';
  } else if (state === 'hover') {
    base = '#5A6A82'; light = '#6B7B93'; dark = '#4A5A72';
  } else {
    base = '#5C5C5C'; light = '#666666'; dark = '#4C4C4C';
  }

  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);

  // Stone noise
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const seed = (px * 37 + py * 73 + x * 13) % 23;
      if (seed > 19) { ctx.fillStyle = light; ctx.fillRect(x + px, y + py, 1, 1); }
      else if (seed < 4) { ctx.fillStyle = dark; ctx.fillRect(x + px, y + py, 1, 1); }
    }
  }

  // Bevel
  ctx.fillStyle = light;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = dark;
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x + w - 1, y, 1, h);
}
export function getWidgetsTexture() {
  if (_widgetsUrl) return _widgetsUrl;
  // Tentar pegar do pack de texturas zip real se disponível
  getPackUrl(MC + 'textures/gui/widgets.png').then(url => {
    if (url) _widgetsUrl = url;
  });
  if (_widgetsUrl) return _widgetsUrl;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 256, 256);
  // Button states: disabled y=46, normal y=66, hover y=86 (RF-004)
  drawButtonState(ctx, 0, 46, 'disabled');
  drawButtonState(ctx, 0, 66, 'normal');
  drawButtonState(ctx, 0, 86, 'hover');
  _widgetsUrl = canvas.toDataURL();
  return _widgetsUrl;
}

export function getDirtTexture() {
  if (_dirtUrl) return _dirtUrl;
  getPackUrl(MC + 'textures/blocks/dirt.png').then(url => {
    if (url) _dirtUrl = url;
  });
  if (_dirtUrl) return _dirtUrl;
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  // Dirt darkened to #404040 base (RF-006)
  for (let py = 0; py < 16; py++) {
    for (let px = 0; px < 16; px++) {
      const seed = Math.sin(px * 12.9898 + py * 78.233) * 43758.5453;
      const v = seed - Math.floor(seed);
      const variation = Math.floor(v * 24 - 12);
      const r = Math.max(0, Math.min(255, 64 + variation));
      const g = Math.max(0, Math.min(255, 56 + variation));
      const b = Math.max(0, Math.min(255, 48 + variation));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(px, py, 1, 1);
    }
  }
  _dirtUrl = canvas.toDataURL();
  return _dirtUrl;
}