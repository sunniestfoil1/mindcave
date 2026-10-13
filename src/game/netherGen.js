// Gerador do Nether (inspirado em ChunkProviderHell do 1.8.9): teto e piso de bedrock, cavernas de netherrack, oceano de lava até y=31,
// areia das almas e cascalho nas praias, glowstone pendurado no teto, veios de quartzo e fogo sobre a netherrack. Determinístico por seed.
import { fractal3, perlin2 } from './noise';
import { createChunkData, chunkIndex, packState } from './chunk';
import { CHUNK_SIZE } from './constants';
import { hash3 } from './prng';

const NETHERRACK = 87, LAVA = 11, BEDROCK = 7, SOUL_SAND = 88, GRAVEL = 13, GLOWSTONE = 89, QUARTZ_ORE = 153, FIRE = 51;
export const NETHER_HEIGHT = 128;       // teto de bedrock em y = 127
export const NETHER_LAVA_LEVEL = 31;

const cache = new Map();
function noises(seed) {
  let n = cache.get(seed);
  if (!n) {
    if (cache.size > 3) cache.delete(cache.keys().next().value);
    n = { den: fractal3(seed ^ 0x5eed, 4, 0.5, 2, 0.011), soil: perlin2(seed ^ 0x50111), ridge: fractal3(seed ^ 0xbeef, 2, 0.5, 2, 0.03) };
    cache.set(seed, n);
  }
  return n;
}

// Densidade: ruído 3D esticado em Y + faixas sólidas perto do piso e do teto (o miolo vira caverna)
function density(n, x, y, z) {
  const v = n.den(x, y * 1.9, z);
  const top = Math.max(0, (y - 94) / 33), bottom = Math.max(0, (22 - y) / 22);
  return v + 1.15 * top * top + 1.15 * bottom * bottom - 0.02;
}

export function generateNetherChunk(seed, cx, cz) {
  const data = createChunkData();
  const n = noises(seed >>> 0);
  const baseX = cx * CHUNK_SIZE, baseZ = cz * CHUNK_SIZE;
  const solid = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * NETHER_HEIGHT);
  const si = (lx, y, lz) => lx + CHUNK_SIZE * (lz + CHUNK_SIZE * y);

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = baseX + lx, wz = baseZ + lz;
      for (let y = 0; y < NETHER_HEIGHT; y++) {
        let id = 0;
        if (y === 0 || y === NETHER_HEIGHT - 1) id = BEDROCK;
        else if ((y <= 4 || y >= NETHER_HEIGHT - 5) && hash3(wx, y, wz, seed) % 100 < (y <= 4 ? 5 - y : y - (NETHER_HEIGHT - 6)) * 22) id = BEDROCK; // bedrock irregular
        else if (density(n, wx, y, wz) > 0) id = NETHERRACK;
        else if (y <= NETHER_LAVA_LEVEL) id = LAVA;
        if (id) { data[chunkIndex(lx, y, lz)] = packState(id, 0); if (id !== LAVA) solid[si(lx, y, lz)] = 1; }
      }
    }
  }
  // praias de areia das almas e cascalho logo acima do nível da lava; fogo esparso sobre a netherrack
  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wx = baseX + lx, wz = baseZ + lz;
      const soil = n.soil(wx * 0.07, wz * 0.07);
      for (let y = NETHER_LAVA_LEVEL - 2; y < NETHER_HEIGHT - 2; y++) {
        if (!solid[si(lx, y, lz)] || data[chunkIndex(lx, y, lz)] >> 4 !== NETHERRACK) continue;
        const above = data[chunkIndex(lx, y + 1, lz)];
        if (above !== 0) continue;
        if (y <= NETHER_LAVA_LEVEL + 4) {
          if (soil > 0.25) data[chunkIndex(lx, y, lz)] = packState(SOUL_SAND, 0);
          else if (soil < -0.3) data[chunkIndex(lx, y, lz)] = packState(GRAVEL, 0);
        }
        if (data[chunkIndex(lx, y, lz)] >> 4 === NETHERRACK && hash3(wx, y, wz, seed ^ 0xf1) % 400 === 0) data[chunkIndex(lx, y + 1, lz)] = packState(FIRE, 0);
      }
    }
  }
  // glowstone pendurado no teto: blobs de 3–10 blocos a partir de uma célula de ar colada no teto
  const rngBase = hash3(cx, 7, cz, seed ^ 0x61);
  for (let t = 0; t < 10; t++) {
    const h = hash3(cx * 31 + t, t, cz * 17 + t, rngBase);
    const lx = h & 15, lz = (h >> 4) & 15, y0 = 100 + ((h >> 8) % 22);
    let y = y0;
    while (y < NETHER_HEIGHT - 1 && !solid[si(lx, y, lz)]) y++;     // sobe até o teto
    if (y >= NETHER_HEIGHT - 1 || y === y0 && solid[si(lx, y0, lz)] === 0) { /* sem teto acima */ }
    if (y >= NETHER_HEIGHT - 1) continue;
    const size = 3 + (h >> 12) % 8;
    for (let k = 0; k < size; k++) {
      const hh = hash3(lx + k, y + k, lz + t, h);
      const bx = Math.max(0, Math.min(15, lx + (hh % 5) - 2)), bz = Math.max(0, Math.min(15, lz + ((hh >> 3) % 5) - 2)), by = y - 1 - (hh >> 6) % 4;
      if (by > 1 && data[chunkIndex(bx, by, bz)] >> 4 === 0) data[chunkIndex(bx, by, bz)] = packState(GLOWSTONE, 0);
    }
    data[chunkIndex(lx, y - 1, lz)] = packState(GLOWSTONE, 0);
  }
  // veios de quartzo dentro da netherrack (16 tentativas por chunk, 6–12 blocos cada)
  for (let t = 0; t < 16; t++) {
    const h = hash3(cx * 13 + t, t * 5, cz * 7 + t, seed ^ 0x9a);
    let lx = h & 15, lz = (h >> 4) & 15, y = 10 + ((h >> 8) % 108);
    const len = 6 + (h >> 16) % 7;
    for (let k = 0; k < len; k++) {
      if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16 && data[chunkIndex(lx, y, lz)] >> 4 === NETHERRACK) data[chunkIndex(lx, y, lz)] = packState(QUARTZ_ORE, 0);
      const hh = hash3(lx, y + k, lz, h);
      lx += (hh % 3) - 1; lz += ((hh >> 2) % 3) - 1; y += ((hh >> 4) % 3) - 1;
      if (y < 1 || y > NETHER_HEIGHT - 2) break;
    }
  }
  return data;
}

// Altura útil para achar chão perto de (x, z): primeira célula de ar com chão sólido (não lava) embaixo, de cima para baixo
export function findNetherFloor(getBlockId, x, z, fromY = 120) {
  for (let y = fromY; y > NETHER_LAVA_LEVEL + 1; y--) {
    const here = getBlockId(x, y, z), below = getBlockId(x, y - 1, z);
    if (here === 0 && getBlockId(x, y + 1, z) === 0 && below !== 0 && below !== LAVA && below !== 10 && below !== BEDROCK) return y;
  }
  return -1;
}
