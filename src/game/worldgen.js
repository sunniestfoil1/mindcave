// Camada de dispatch: registra o gerador legado e re-exporta generateChunk (PRD 04 RF-004)
import { generateChunk as genDispatch, setLegacyGen, getBiomeProvider } from './generators';
import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, WATER_FILL_LEVEL } from './constants';
import { fractal2 } from './noise';
import { hash3 } from './prng';
import { createChunkData, chunkIndex, packState } from './chunk';

const STONE = 1, GRASS = 2, DIRT = 3, BEDROCK = 7, WATER = 9, SAND = 12, GRAVEL = 13,
  IRON_ORE = 15, COAL_ORE = 16, LOG = 17, LEAVES = 18;

// Gerador legado do PRD-01 (para mundos criados com mapType='open_basic')
function generateLegacy(seed, cx, cz) {
  const data = createChunkData();
  const heightFn = fractal2(seed, 5, 0.5, 2, 0.0125);
  const oreFn = fractal2(seed ^ 0x9e3779b9, 3, 0.5, 2, 0.06);
  const set = (x, y, z, id) => { if (y >= 0 && y < WORLD_HEIGHT) data[chunkIndex(x, y, z)] = packState(id, 0); };

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const ax = cx * CHUNK_SIZE + x, az = cz * CHUNK_SIZE + z;
      const n = heightFn(ax, az) * 0.5 + 0.5;
      const h = Math.floor(56 + n * 34);
      const colTop = Math.max(h, WATER_FILL_LEVEL);
      for (let y = 0; y <= colTop; y++) {
        if (y === 0) { set(x, y, z, BEDROCK); continue; }
        if (y <= 4 && hash3(ax, y, az, seed) % 8 === 0) { set(x, y, z, BEDROCK); continue; }
        if (y > h) { if (y <= WATER_FILL_LEVEL) set(x, y, z, WATER); continue; }
        if (y >= h - 3) {
          if (h < SEA_LEVEL - 1 && y >= h - 1) set(x, y, z, SAND);
          else if (y === h) set(x, y, z, GRASS);
          else set(x, y, z, DIRT);
        } else {
          let block = STONE;
          const ov = oreFn(ax, y, az);
          if (y < 64) {
            if (ov > 0.78) block = COAL_ORE;
            else if (ov > 0.82 && y < 40) block = IRON_ORE;
          }
          if (y < 8 && hash3(ax, y * 7, az, seed ^ 0x1234) % 40 === 0) block = GRAVEL;
          set(x, y, z, block);
        }
      }
    }
  }

  const treeRng = hash3(cx * 73856093, cz * 19349663, seed);
  if (treeRng % 100 < 18) {
    const tx = 2 + (treeRng % 12), tz = 2 + ((treeRng >> 4) % 12);
    const ax = cx * CHUNK_SIZE + tx, az = cz * CHUNK_SIZE + tz;
    let groundY = -1;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const s = data[chunkIndex(tx, y, tz)];
      if (s !== 0 && (s >> 4) === GRASS) { groundY = y; break; }
      if (s !== 0 && (s >> 4) !== WATER && (s >> 4) !== BEDROCK) break;
    }
    if (groundY > 0 && groundY < SEA_LEVEL + 20) placeTree(data, tx, groundY + 1, tz, ax, az, seed);
  }
  return data;
}

function placeTree(data, x, y, z, ax, az, seed) {
  const trunk = 4 + (hash3(ax, az, seed) % 3);
  for (let i = 0; i < trunk; i++) {
    const yy = y + i;
    if (yy < WORLD_HEIGHT) data[chunkIndex(x, yy, z)] = packState(LOG, 0);
  }
  const topY = y + trunk;
  for (let ly = -3; ly <= 0; ly++) { // copa da 1.8.9: de topY-3 a topY, raio 2,2,1,1
    const yy = topY + ly;
    if (yy >= WORLD_HEIGHT) continue;
    const radius = ly >= -1 ? 1 : 2;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) {
          if (hash3(ax + dx, yy, az + dz, seed) % 2 === 0) continue;
        }
        const bx = x + dx, bz = z + dz;
        if (bx < 0 || bx >= CHUNK_SIZE || bz < 0 || bz >= CHUNK_SIZE) continue;
        const cur = data[chunkIndex(bx, yy, bz)];
        if (cur === 0) data[chunkIndex(bx, yy, bz)] = packState(LEAVES, 0);
      }
    }
  }
}

// Registra o gerador legado
setLegacyGen(generateLegacy);

export function generateChunk(seed, cx, cz, opts) {
  return genDispatch(seed, cx, cz, opts);
}

export { getBiomeProvider };