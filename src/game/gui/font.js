// Fonte do 1.8.9 (FontRenderer): ascii.png em células 8×8, larguras pelo lado direito do glifo (+1 de espaçamento, espaço = 4),
// letras fora dele (ã, õ, Á...) pela página unicode_page_00.png com glyph_sizes.bin. Sombra = mesma cor escurecida (>>2) a +1 px de GUI.
// Texto que a fonte não cobre (outras páginas unicode) cai na fonte TTF 'Minecraft' no tamanho equivalente.
// loadMcFont() é esperado no boot (main.jsx): sem ele o desenho usa a TTF de reserva.
import { getOverlayUrlSync } from '../pack';

const COLOR_CODES = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
  'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
};

// Posição de cada caractere fora do ASCII no ascii.png (a lista começa no índice 127, como o ChatAllowedCharacters do jogo)
const EXTRA_CHARS = '⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αβΓπΣσμτΦΘΩδ∞∅∈∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■';

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
    if (text[i] === '§' && i + 1 < text.length) {
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

// ---- fonte bitmap ----
let sheet = null;          // { img, cell, widths: Uint8Array(256) }
let uniSheet = null;       // { img }
let glyphSizes = null;     // Uint8Array(65536)
let loading = null;
const tintCache = new Map();

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('imagem não carregou: ' + url));
    img.src = url;
  });
}

function measureWidths(img) {
  const cell = img.width / 16;
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const data = cx.getImageData(0, 0, img.width, img.height).data;
  const widths = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    if (i === 32) { widths[i] = 4; continue; }
    const col = i % 16, row = Math.floor(i / 16);
    let l = cell - 1;
    for (; l >= 0; l--) {
      let empty = true;
      for (let j = 0; j < cell && empty; j++) if (data[((row * cell + j) * img.width + col * cell + l) * 4 + 3] > 16) empty = false;
      if (!empty) break;
    }
    l++;
    widths[i] = Math.trunc(0.5 + l * (8 / cell)) + 1;
  }
  return { img, cell, widths };
}

export function loadMcFont() {
  if (loading) return loading;
  loading = (async () => {
    try {
      const [ascii, uni, sizes] = await Promise.all([
        loadImage(getOverlayUrlSync('textures/font/ascii.png') || '/assets/ui/ascii.png'),
        loadImage('/assets/ui/unicode_page_00.png'),
        fetch('/assets/ui/glyph_sizes.bin').then((r) => r.arrayBuffer()),
      ]);
      sheet = measureWidths(ascii);
      uniSheet = { img: uni };
      glyphSizes = new Uint8Array(sizes);
      tintCache.clear();
    } catch (e) {
      console.warn('[Fonte] bitmap indisponível, usando a TTF:', e.message);
    }
  })();
  return loading;
}

// glifo de um caractere: { kind: 'ascii', i } | { kind: 'uni', c, start, end } | null (sem glifo na fonte local)
function glyphOf(ch) {
  const code = ch.charCodeAt(0);
  if (code >= 32 && code < 127) return { kind: 'ascii', i: code, w: sheet.widths[code] };
  const k = EXTRA_CHARS.indexOf(ch);
  if (k >= 0) return { kind: 'ascii', i: 127 + k, w: sheet.widths[127 + k] };
  if (code < 256 && glyphSizes[code] !== 0) {
    const start = glyphSizes[code] >>> 4;
    const end = (glyphSizes[code] & 15) + 1;
    return { kind: 'uni', c: code, start, end, w: (end - start) / 2 + 1 };
  }
  return null;
}

let _measureCtx = null;
function ttfWidth(str, px) {
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  _measureCtx.font = `${px}px 'Minecraft', monospace`;
  return _measureCtx.measureText(str).width;
}

// largura em unidades de GUI de um trecho; o que não tem glifo mede pela TTF a 8 px
function unitsOf(str) {
  let u = 0;
  for (const ch of str) {
    const g = glyphOf(ch);
    u += g ? g.w : ttfWidth(ch, 8);
  }
  return u;
}

export function measureMcText(text, defaultColor = '#FFFFFF', px = 8) {
  const segments = parseColorCodes(text, defaultColor);
  let w = 0;
  if (sheet) for (const seg of segments) w += unitsOf(seg.text) * (px / 8);
  else for (const seg of segments) w += ttfWidth(seg.text, px);
  return Math.max(1, Math.ceil(w));
}

// folha pintada com a cor do texto (cache por folha e cor)
function tinted(key, img, color) {
  const k = key + color;
  let cv = tintCache.get(k);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const c = cv.getContext('2d');
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = color;
  c.fillRect(0, 0, cv.width, cv.height);
  tintCache.set(k, cv);
  return cv;
}

function drawBitmap(ctx, segments, x, y, px, shadow) {
  const s = px / 8;
  const so = Math.max(1, Math.round(s));
  const passes = shadow ? [true, false] : [false];
  for (const isShadow of passes) {
    let cx = x + (isShadow ? so : 0);
    const cy = y + (isShadow ? so : 0);
    for (const seg of segments) {
      const color = isShadow ? shadowColor(seg.color) : seg.color;
      for (const ch of seg.text) {
        const g = glyphOf(ch);
        if (!g) {
          ctx.font = `${px}px 'Minecraft', monospace`;
          ctx.fillStyle = color;
          ctx.fillText(ch, Math.round(cx), Math.round(cy));
          cx += ttfWidth(ch, px);
          continue;
        }
        if (ch !== ' ') {
          if (g.kind === 'ascii') {
            const cell = sheet.cell;
            ctx.drawImage(tinted('a', sheet.img, color), (g.i % 16) * cell, Math.floor(g.i / 16) * cell, cell, cell, Math.round(cx), Math.round(cy), 8 * s, 8 * s);
          } else {
            const gx = (g.c % 16) * 16 + g.start, gy = ((g.c & 255) >> 4) * 16;
            ctx.drawImage(tinted('u', uniSheet.img, color), gx, gy, g.end - g.start - 0.02, 16, Math.round(cx), Math.round(cy), (g.end - g.start - 0.02) / 2 * s, 8 * s);
          }
        }
        cx += g.w * s;
      }
    }
  }
}

export function drawMcText(ctx, text, x, y, defaultColor = '#FFFFFF', shadow = true, px = 8) {
  ctx.textBaseline = 'top';
  ctx.imageSmoothingEnabled = false;
  const segments = parseColorCodes(text, defaultColor);
  if (sheet) { drawBitmap(ctx, segments, x, y, px, shadow); return; }
  // reserva: TTF 'Minecraft' (fonte bitmap ainda não carregou)
  ctx.font = `${px}px 'Minecraft', monospace`;
  const so = Math.max(1, Math.round(px / 8));
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
