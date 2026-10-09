// Bitmap font rendering — PRD 19 RF-002..003
const COLOR_CODES = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
  'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
};

export function shadowColor(hex) {
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16) >> 2;
    const g = parseInt(hex.slice(3, 5), 16) >> 2;
    const b = parseInt(hex.slice(5, 7), 16) >> 2;
    return `rgb(${r},${g},${b})`;
  }
  return '#404040';
}

export function parseColorCodes(text, defaultColor = '#FFFFFF') {
  const segments = [];
  let currentColor = defaultColor;
  let buffer = '';
  for (let i = 0; i < text.length; i++) {
    if ((text[i] === '\u00a7' || text[i] === '&') && i + 1 < text.length) {
      if (buffer) { segments.push({ text: buffer, color: currentColor }); buffer = ''; }
      const code = text[i + 1].toLowerCase();
      if (COLOR_CODES[code]) currentColor = COLOR_CODES[code];
      else if (code === 'r') currentColor = defaultColor;
      i++;
    } else {
      buffer += text[i];
    }
  }
  if (buffer) segments.push({ text: buffer, color: currentColor });
  return segments;
}

let _measureCtx = null;
function getMeasureCtx() {
  if (!_measureCtx) {
    const c = document.createElement('canvas');
    _measureCtx = c.getContext('2d');
  }
  return _measureCtx;
}

export function measureMcText(text, defaultColor = '#FFFFFF', px = 8) {
  const ctx = getMeasureCtx();
  ctx.font = `${px}px 'Minecraft', monospace`;
  const segments = parseColorCodes(text, defaultColor);
  let w = 0;
  for (const seg of segments) w += ctx.measureText(seg.text).width;
  return Math.max(1, Math.ceil(w));
}

export function drawMcText(ctx, text, x, y, defaultColor = '#FFFFFF', shadow = true, px = 8) {
  ctx.font = `${px}px 'Minecraft', monospace`;
  ctx.textBaseline = 'top';
  ctx.imageSmoothingEnabled = false;
  const segments = parseColorCodes(text, defaultColor);
  const so = Math.max(1, Math.round(px / 8)); // shadow offset scales with font size
  let cx = x;

  if (shadow) {
    for (const seg of segments) {
      ctx.fillStyle = shadowColor(seg.color);
      ctx.fillText(seg.text, Math.round(cx + so), Math.round(y + so));
      cx += ctx.measureText(seg.text).width;
    }
  }

  cx = x;
  for (const seg of segments) {
    ctx.fillStyle = seg.color;
    ctx.fillText(seg.text, Math.round(cx), Math.round(y));
    cx += ctx.measureText(seg.text).width;
  }
}