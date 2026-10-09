// Cálculo de iluminação de UM chunk (puro, sem ClientWorld) — roda dentro dos workers (PRD 23).
// Mesma semântica do antigo computeChunkLighting (BFS dentro do chunk), mas sem alocações por célula.
import { lightOpacity, lightEmission } from './blocks';

const SIZE = 16 * 16 * 256;
const QSIZE = 1 << 18;
const QMASK = QSIZE - 1;
const queue = new Int32Array(QSIZE);
let opLUT = null;
let emLUT = null;
let qHead = 0;
let qTail = 0;

function buildLUTs() {
  opLUT = new Uint8Array(4096);
  emLUT = new Uint8Array(4096);
  for (let i = 0; i < 4096; i++) {
    opLUT[i] = lightOpacity(i);
    emLUT[i] = lightEmission(i);
  }
}

function relax(blocks, light, nIdx, cur, down, sky) {
  const op = opLUT[(blocks[nIdx] >> 4) & 0xfff];
  const nl = (sky && down && cur === 15 && op === 0) ? 15 : cur - 1 - op;
  if (nl <= 0) return;
  const old = light[nIdx];
  if (sky) {
    if (nl <= (old >> 4)) return;
    light[nIdx] = (old & 0x0f) | (nl << 4);
  } else {
    if (nl <= (old & 15)) return;
    light[nIdx] = (old & 0xf0) | nl;
  }
  queue[qTail] = nIdx;
  qTail = (qTail + 1) & QMASK;
}

function propagate(blocks, light, sky) {
  while (qHead !== qTail) {
    const idx = queue[qHead];
    qHead = (qHead + 1) & QMASK;
    const cur = sky ? (light[idx] >> 4) : (light[idx] & 15);
    if (cur === 0) continue;
    const x = idx & 15, z = (idx >> 4) & 15, y = idx >> 8;
    if (x < 15) relax(blocks, light, idx + 1, cur, false, sky);
    if (x > 0) relax(blocks, light, idx - 1, cur, false, sky);
    if (y < 255) relax(blocks, light, idx + 256, cur, false, sky);
    if (y > 0) relax(blocks, light, idx - 256, cur, true, sky);
    if (z < 15) relax(blocks, light, idx + 16, cur, false, sky);
    if (z > 0) relax(blocks, light, idx - 16, cur, false, sky);
  }
}

// blocks: Uint16Array(65536) do chunk · light: Uint8Array(65536) de saída ((sky << 4) | block)
export function computeLightInto(blocks, light) {
  if (!opLUT) buildLUTs();
  light.fill(0);

  // Luz do céu: 15 acima do bloco opaco mais alto de cada coluna
  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      const col = x + 16 * z;
      let top = -1;
      for (let y = 255; y >= 0; y--) {
        const s = blocks[col + 256 * y];
        if (s !== 0 && opLUT[(s >> 4) & 0xfff] >= 15) { top = y; break; }
      }
      for (let y = top + 1; y < 256; y++) light[col + 256 * y] = 0xF0;
    }
  }
  qHead = 0; qTail = 0;
  for (let i = 0; i < SIZE; i++) if (light[i] !== 0) queue[qTail++] = i;
  propagate(blocks, light, true);

  // Luz de bloco: fontes emissoras
  qHead = 0; qTail = 0;
  for (let i = 0; i < SIZE; i++) {
    const s = blocks[i];
    if (s === 0) continue;
    const em = emLUT[(s >> 4) & 0xfff];
    if (em > 0) { light[i] = (light[i] & 0xf0) | em; queue[qTail++] = i; }
  }
  propagate(blocks, light, false);
}