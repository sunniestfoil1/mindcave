// Tinta de bioma (MC24-RF-031): cor de grama/folhagem lida de colormap/grass.png e foliage.png (256×256)
// na posição dada por temperatura e umidade; água por multiplicador de bioma. Roda só na main thread:
// o resultado vira um Uint8Array por chunk (9 bytes por coluna) enviado aos workers junto com os blocos.
import { getPackCanvas, MC } from './pack';

let grassMap = null;
let foliageMap = null;
let waterBase = [255, 255, 255];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;

function readMap(cv) {
  let src = cv;
  if (cv.width !== 256 || cv.height !== 256) {
    src = document.createElement('canvas');
    src.width = 256; src.height = 256;
    src.getContext('2d').drawImage(cv, 0, 0, 256, 256);
  }
  return src.getContext('2d').getImageData(0, 0, 256, 256).data;
}

// Lê os mapas de cor do pacote e decide se a textura da água precisa de tinta própria
export async function initBiomeTint() {
  const [g, f, w] = await Promise.all([
    getPackCanvas(MC + 'textures/colormap/grass.png'),
    getPackCanvas(MC + 'textures/colormap/foliage.png'),
    getPackCanvas(MC + 'textures/blocks/water_still.png'),
  ]);
  if (g) grassMap = readMap(g);
  if (f) foliageMap = readMap(f);
  if (w) {
    // textura acinzentada (estilo moderno) precisa da cor de água do bioma; azulada já vem pronta (1.8)
    const d = w.getContext('2d').getImageData(0, 0, w.width, Math.min(w.width, w.height)).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 0) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
    if (n > 0) {
      r /= n; gg /= n; b /= n;
      waterBase = (Math.max(r, gg, b) - Math.min(r, gg, b) < 40) ? [63, 118, 228] : [255, 255, 255];
    }
  }
}

export function hasColormaps() { return !!(grassMap && foliageMap); }

// Aproximação dos mapas oficiais, usada só enquanto o pacote não está disponível
function fallbackColor(t, rr, hot, dry, cold, out) {
  for (let i = 0; i < 3; i++) {
    const warm = lerp(dry[i], hot[i], rr);
    out[i] = lerp(cold[i], warm, t);
  }
}
const G_HOT = [71, 205, 51], G_DRY = [191, 183, 85], G_COLD = [128, 180, 151];
const F_HOT = [48, 187, 11], F_DRY = [174, 164, 42], F_COLD = [96, 161, 123];

const TMP = [0, 0, 0];
function colormap(map, temp, hum, kind, out) {
  const t = clamp01(temp);
  const r = clamp01(hum) * t;
  if (map) {
    const x = Math.floor((1 - t) * 255), y = Math.floor((1 - r) * 255);
    const i = (y * 256 + x) * 4;
    out[0] = map[i]; out[1] = map[i + 1]; out[2] = map[i + 2];
  } else if (kind === 0) {
    fallbackColor(t, t > 0 ? r / t : 0, G_HOT, G_DRY, G_COLD, out);
  } else {
    fallbackColor(t, t > 0 ? r / t : 0, F_HOT, F_DRY, F_COLD, out);
  }
}

const hex = (h, out) => { out[0] = (h >> 16) & 255; out[1] = (h >> 8) & 255; out[2] = h & 255; };

// Escreve [grama r,g,b, folhagem r,g,b, água r,g,b] em out[o..o+8]
function biomeColors(biome, out, o) {
  const id = biome ? biome.id : 3;
  const temp = biome ? biome.temp : 0.8;
  const hum = biome ? biome.hum : 0.4;

  colormap(grassMap, temp, hum, 0, TMP);
  if (id === 19) { // pântano
    TMP[0] = (((TMP[0] & 0xfe) + 0x4e) >> 1); TMP[1] = (((TMP[1] & 0xfe) + 0x0e) >> 1); TMP[2] = (((TMP[2] & 0xfe) + 0x4e) >> 1);
  } else if (id === 15) { // floresta escura
    TMP[0] = (((TMP[0] & 0xfe) + 0x28) >> 1); TMP[1] = (((TMP[1] & 0xfe) + 0x34) >> 1); TMP[2] = (((TMP[2] & 0xfe) + 0x0a) >> 1);
  } else if (id === 34 || id === 35) { hex(0x90814d, TMP); }
  out[o] = TMP[0]; out[o + 1] = TMP[1]; out[o + 2] = TMP[2];

  colormap(foliageMap, temp, hum, 1, TMP);
  if (id === 19) hex(0x6a7039, TMP);
  else if (id === 34 || id === 35) hex(0x9e814d, TMP);
  out[o + 3] = TMP[0]; out[o + 4] = TMP[1]; out[o + 5] = TMP[2];

  if (id === 19) hex(0xe0ffae, TMP); else { TMP[0] = 255; TMP[1] = 255; TMP[2] = 255; }
  out[o + 6] = TMP[0] * waterBase[0] / 255; out[o + 7] = TMP[1] * waterBase[1] / 255; out[o + 8] = TMP[2] * waterBase[2] / 255;
}

const GRID = 6;
const STEP = 4;
const grid = new Float32Array(GRID * GRID * 9);
const cell = new Float32Array(9);

// Tinta das 256 colunas do chunk: biomas amostrados a cada 4 blocos e interpolados (equivale ao
// borrão 3×3 do Minecraft, sem 256 consultas de bioma por chunk).
export function computeChunkTint(biomeAt, cx, cz) {
  const out = new Uint8Array(256 * 9);
  const bx = cx * 16 - 2, bz = cz * 16 - 2;
  for (let gj = 0; gj < GRID; gj++) {
    for (let gi = 0; gi < GRID; gi++) {
      let b = null;
      try { b = biomeAt(bx + gi * STEP, bz + gj * STEP); } catch { b = null; }
      biomeColors(b, cell, 0);
      grid.set(cell, (gj * GRID + gi) * 9);
    }
  }
  for (let lz = 0; lz < 16; lz++) {
    const fz = (lz + 2) / STEP, j0 = Math.floor(fz), tz = fz - j0;
    for (let lx = 0; lx < 16; lx++) {
      const fx = (lx + 2) / STEP, i0 = Math.floor(fx), tx = fx - i0;
      const a = (j0 * GRID + i0) * 9, b = a + 9, c = a + GRID * 9, d = c + 9;
      const o = (lx + 16 * lz) * 9;
      for (let k = 0; k < 9; k++) {
        const top = grid[a + k] + (grid[b + k] - grid[a + k]) * tx;
        const bot = grid[c + k] + (grid[d + k] - grid[c + k]) * tx;
        out[o + k] = Math.round(top + (bot - top) * tz);
      }
    }
  }
  return out;
}