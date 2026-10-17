// Gerador do Aether: ilhas flutuantes de grama azul-esverdeada sobre pedra sagrada, com a parte de baixo afunilada, árvores claras, flores brancas,
// nuvens frias no alto e nuvens azuis embaixo. Determinístico por seed e sem depender de chunks vizinhos: as ilhas moram numa grade de células
// (cada célula sorteia 1–2 ilhas), então qualquer chunk sabe quais ilhas o tocam só olhando as células ao redor.
import { fractal3, perlin2 } from './noise';
import { createChunkData, chunkIndex, packState } from './chunk';
import { CHUNK_SIZE } from './constants';
import { hash3 } from './prng';
import { AETHER } from './blocksAether';

const DIRT = 3, LOG = 17, LEAVES = 18, TALL_GRASS = 31, FLOWER = 38;
export const AETHER_CELL = 112;
const R_MAX = 40;

const cache = new Map();
function noises(seed) {
  let n = cache.get(seed);
  if (!n) {
    if (cache.size > 3) cache.delete(cache.keys().next().value);
    n = { edge: perlin2(seed ^ 0xae71), hill: perlin2(seed ^ 0x4111), under: perlin2(seed ^ 0x0de9), cloud: fractal3(seed ^ 0xc10d, 3, 0.5, 2, 0.02), cloud2: fractal3(seed ^ 0xc20d, 3, 0.5, 2, 0.025), gold: fractal3(seed ^ 0xc30d, 2, 0.5, 2, 0.03) };
    cache.set(seed, n);
  }
  return n;
}

// As ilhas que tocam a área [x0, x1] × [z0, z1]
export function islandsNear(seed, x0, z0, x1, z1) {
  const out = [];
  for (let ci = Math.floor((x0 - R_MAX) / AETHER_CELL); ci <= Math.floor((x1 + R_MAX) / AETHER_CELL); ci++) {
    for (let cj = Math.floor((z0 - R_MAX) / AETHER_CELL); cj <= Math.floor((z1 + R_MAX) / AETHER_CELL); cj++) {
      for (let k = 0; k < 2; k++) {
        const h = hash3(ci * 2 + k, 23 + k, cj, seed ^ 0xa37);
        if (k === 1 && h % 100 >= 40) continue;
        if (k === 0 && h % 100 >= 88) continue;
        const r = 16 + ((h >>> 22) % 25);
        out.push({
          x: ci * AETHER_CELL + 12 + ((h >>> 4) % (AETHER_CELL - 24)), z: cj * AETHER_CELL + 12 + ((h >>> 11) % (AETHER_CELL - 24)),
          y: 70 + ((h >>> 16) % 60), r,
        });
      }
    }
  }
  return out;
}

// Altura do topo e do fundo da ilha na coluna (x, z): null se a coluna está fora dela
export function islandColumn(n, isl, x, z) {
  const dist = Math.hypot(x - isl.x, z - isl.z);
  const dn = dist / isl.r + n.edge(x * 0.045, z * 0.045) * 0.22;
  if (dn >= 1) return null;
  const inner = 1 - dn;
  const top = isl.y + (3 + isl.r * 0.12) * (1 - dn * dn) + n.hill(x * 0.05, z * 0.05) * 2.2 * inner;
  const bottom = isl.y - isl.r * 0.8 * Math.pow(inner, 1.3) * (0.78 + 0.22 * n.under(x * 0.07, z * 0.07));
  if (bottom > top) return null;
  return { top: Math.floor(top), bottom: Math.ceil(bottom), dn };
}

export function generateAetherChunk(seed, cx, cz) {
  const data = createChunkData();
  const n = noises(seed >>> 0);
  const baseX = cx * CHUNK_SIZE, baseZ = cz * CHUNK_SIZE;
  const islands = islandsNear(seed >>> 0, baseX, baseZ, baseX + CHUNK_SIZE - 1, baseZ + CHUNK_SIZE - 1);
  const tops = new Int16Array(CHUNK_SIZE * CHUNK_SIZE).fill(-1);   // topo de grama da ilha mais alta da coluna (para árvores e plantas)
  const depthN = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);

  for (const isl of islands) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const col = islandColumn(n, isl, baseX + lx, baseZ + lz);
      if (!col) continue;
      for (let y = Math.max(1, col.bottom); y <= Math.min(250, col.top); y++) {
        const i = chunkIndex(lx, y, lz);
        if (data[i] !== 0) continue;
        const d = col.top - y;
        data[i] = packState(d === 0 ? AETHER.GRASS : d <= 3 ? DIRT : AETHER.HOLYSTONE, 0);
      }
      if (col.top > tops[lx * CHUNK_SIZE + lz]) { tops[lx * CHUNK_SIZE + lz] = col.top; depthN[lx * CHUNK_SIZE + lz] = col.dn; }
    }
  }

  // nuvens: faixa fria no alto, faixa azul embaixo das ilhas e algumas douradas no meio, sempre onde não tem terra
  for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    const wx = baseX + lx, wz = baseZ + lz;
    for (let y = 172; y <= 208; y++) {
      if (n.cloud(wx, y * 2.6, wz) - Math.abs(y - 190) * 0.028 > 0.3) data[chunkIndex(lx, y, lz)] = packState(AETHER.CLOUD_COLD, 0);
    }
    for (let y = 14; y <= 50; y++) {
      const i = chunkIndex(lx, y, lz);
      if (data[i] === 0 && n.cloud2(wx, y * 2.6, wz) - Math.abs(y - 32) * 0.03 > 0.32) data[i] = packState(AETHER.CLOUD_BLUE, 0);
    }
    for (let y = 128; y <= 170; y++) {
      const i = chunkIndex(lx, y, lz);
      if (data[i] === 0 && n.gold(wx, y * 3.2, wz) - Math.abs(y - 150) * 0.03 > 0.5) data[i] = packState(AETHER.CLOUD_GOLD, 0);
    }
  }

  // vegetação sobre a grama do Aether: árvores claras (inteiras dentro do chunk), capim e flores brancas
  for (let lx = 0; lx < CHUNK_SIZE; lx++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    const top = tops[lx * CHUNK_SIZE + lz];
    if (top < 0 || depthN[lx * CHUNK_SIZE + lz] > 0.86) continue;
    const wx = baseX + lx, wz = baseZ + lz;
    if (data[chunkIndex(lx, top, lz)] >> 4 !== AETHER.GRASS || data[chunkIndex(lx, top + 1, lz)] !== 0) continue;
    const h = hash3(wx, top, wz, seed ^ 0x7ee);
    if (h % 140 === 0 && lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13 && top < 240) {
      const th = 4 + ((h >>> 8) % 3);
      for (let k = 1; k <= th; k++) data[chunkIndex(lx, top + k, lz)] = packState(LOG, 2);
      for (let dy = th - 2; dy <= th + 1; dy++) {
        const rad = dy >= th + 1 ? 1 : 2;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          const i = chunkIndex(lx + dx, top + dy, lz + dz);
          if (data[i] === 0) data[i] = packState(LEAVES, 2);
        }
      }
    } else if (h % 7 === 1) data[chunkIndex(lx, top + 1, lz)] = packState(TALL_GRASS, 1);
    else if (h % 53 === 2) data[chunkIndex(lx, top + 1, lz)] = packState(FLOWER, 8);
  }
  return data;
}

// Primeira célula de ar com chão sólido logo embaixo perto de (x, z), de cima para baixo; -1 se a coluna é vazia (só céu)
export function findAetherFloor(getBlockId, x, z, fromY = 200) {
  for (let y = fromY; y > 20; y--) {
    const below = getBlockId(x, y - 1, z);
    if (below !== 0 && getBlockId(x, y, z) === 0 && getBlockId(x, y + 1, z) === 0 && below !== AETHER.CLOUD_COLD && below !== AETHER.CLOUD_BLUE && below !== AETHER.CLOUD_GOLD) return y;
  }
  return -1;
}
