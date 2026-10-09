// Geração de terreno: densidade, superfície, bedrock, cavernas, ravinas, minérios (PRD 04 RF-020..040)
import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, WATER_FILL_LEVEL } from './constants';
import { fractal2, fractal3 } from './noise';
import { hash3, mulberry32, javaRandom, terrainChunkSeed, decorationChunkSeed } from './prng';
import { createChunkData, chunkIndex, packState, stateId } from './chunk';

const STONE = 1, GRASS = 2, DIRT = 3, BEDROCK = 7, WATER = 9, LAVA = 11;
const SAND = 12, GRAVEL = 13, ICE = 79;
const COAL_ORE = 16, IRON_ORE = 15, GOLD_ORE = 14, DIAMOND_ORE = 56;
const REDSTONE_ORE = 73, LAPIS_ORE = 21, EMERALD_ORE = 129;

// Distribuição de minérios (1.8.9 RF-040)
const ORES = [
  { id: DIRT, size: 33, count: 10, minY: 0, maxY: 255 },
  { id: GRAVEL, size: 33, count: 8, minY: 0, maxY: 255 },
  { id: STONE, meta: 1, size: 33, count: 10, minY: 0, maxY: 79 }, // granito
  { id: STONE, meta: 3, size: 33, count: 10, minY: 0, maxY: 79 }, // diorito
  { id: STONE, meta: 5, size: 33, count: 10, minY: 0, maxY: 79 }, // andesito
  { id: COAL_ORE, size: 17, count: 20, minY: 0, maxY: 127 },
  { id: IRON_ORE, size: 9, count: 20, minY: 0, maxY: 63 },
  { id: GOLD_ORE, size: 9, count: 2, minY: 0, maxY: 31 },
  { id: REDSTONE_ORE, size: 8, count: 8, minY: 0, maxY: 15 },
  { id: DIAMOND_ORE, size: 8, count: 1, minY: 0, maxY: 15 },
  { id: LAPIS_ORE, size: 7, count: 1, minY: 0, maxY: 31, triangular: true },
];

export function createTerrainGenerator(seed, opts = {}) {
  const amplified = opts.amplified || false;
  const heightN = fractal2(seed, 4, 0.5, 2, 0.0055);
  const detailN = fractal2(seed ^ 0x7777, 3, 0.5, 2, 0.02);
  const largeN = fractal2(seed ^ 0x9999, 2, 0.5, 2, 0.0015); // variação de grande escala
  const caveN1 = fractal3(seed ^ 0xaaaa, 3, 0.5, 2, 0.035);
  const caveN2 = fractal3(seed ^ 0xbbbb, 3, 0.5, 2, 0.035);
  const ravineN = fractal3(seed ^ 0xcccc, 2, 0.5, 2, 0.018);

  function columnHeight(ax, az, biome) {
    const hN = heightN(ax, az) * 0.5 + 0.5;
    const dN = detailN(ax, az) * 0.5 + 0.5;
    const lsN = largeN(ax, az) * 0.5 + 0.5; // 0..1, variação suave de grande escala
    const mult = amplified ? 2.2 : 1.0;
    const base = SEA_LEVEL + biome.hBase * 64 * mult;
    const varr = biome.hVar * 80 * mult; // era 48 — mais variação visível
    let h = Math.floor(base + hN * varr + (dN - 0.5) * varr * 0.3 + (lsN - 0.5) * varr * 0.8);
    return Math.max(1, Math.min(WORLD_HEIGHT - 20, h));
  }

  function blendedColumnHeight(ax, az, getBiome) {
    let totalH = 0, totalW = 0;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const nx = ax + dx, nz = az + dz;
        const b = getBiome(nx, nz);
        const h = columnHeight(nx, nz, b);
        const w = 1.0 / (1 + dx * dx + dz * dz);
        totalH += h * w;
        totalW += w;
      }
    }
    return Math.round(totalH / totalW);
  }

  function generate(cx, cz, getBiome) {
    const data = createChunkData();
    const baseX = cx * CHUNK_SIZE, baseZ = cz * CHUNK_SIZE;
    const set = (x, y, z, s) => { if (y >= 0 && y < WORLD_HEIGHT) data[chunkIndex(x, y, z)] = s; };

    // MC14-RF-002: bedrock usa seed de relevo do chunk
    const bedrockRng = javaRandom(terrainChunkSeed(BigInt(seed), cx, cz));

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const ax = baseX + x, az = baseZ + z;
        const biome = getBiome(ax, az);
        const h = blendedColumnHeight(ax, az, getBiome);
        const colTop = Math.max(h, WATER_FILL_LEVEL);
        const isWater = !!biome.water;
        const isSnow = !!biome.snow;
        // MC14-RF-030: bedrock irregular — Y de 0 a 4, com aleatório inteiro de 0 a 4 por coluna
        const bedrockMax = bedrockRng.nextInt(5);

        for (let y = 0; y <= colTop; y++) {
          if (y === 0) { set(x, y, z, packState(BEDROCK, 0)); continue; }
          if (y <= bedrockMax) { set(x, y, z, packState(BEDROCK, 0)); continue; }

          if (y > h) {
            if (y <= WATER_FILL_LEVEL && isWater) {
              set(x, y, z, packState(isSnow && y === WATER_FILL_LEVEL ? ICE : WATER, 0));
            }
            continue;
          }

          const depth = h - y;
          if (depth === 0) {
            set(x, y, z, packState(biome.top, biome.topMeta || 0));
          } else if (depth <= 3) {
            set(x, y, z, packState(biome.fill, biome.fillMeta || 0));
          } else {
            set(x, y, z, packState(STONE, 0));
          }
        }
      }
    }

    carveCaves(data, baseX, baseZ, caveN1, caveN2, ravineN, seed);
    const decRng = javaRandom(decorationChunkSeed(BigInt(seed), cx, cz));
    placeOres(data, decRng);
    placeEmeralds(data, baseX, baseZ, getBiome, decRng);
    return data;
  }

  return { generate, columnHeight: (ax, az, b) => b ? columnHeight(ax, az, b) : blendedColumnHeight(ax, az, (x, z) => ({ hBase: 0.1, hVar: 0.3 })) };
}

function carveCaves(data, baseX, baseZ, caveN1, caveN2, ravineN, seed) {
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const ax = baseX + x, az = baseZ + z;
      for (let y = 1; y < 128; y++) {
        const idx = chunkIndex(x, y, z);
        const currentId = stateId(data[idx]);
        if (currentId !== STONE && currentId !== DIRT && currentId !== GRASS) continue;
        const n1 = caveN1(ax, y, az);
        const n2 = caveN2(ax, y, az);
        if (Math.abs(n1) < 0.07 && Math.abs(n2) < 0.07) {
          data[idx] = y < 10 ? packState(LAVA, 0) : 0;
          continue;
        }
        if (y > 8 && y < 65) {
          const rn = ravineN(ax, y * 0.4, az);
          if (Math.abs(rn) < 0.03) data[idx] = y < 10 ? packState(LAVA, 0) : 0;
        }
      }
    }
  }
}

// MC14-RF-054: minérios usam o random de decoração do chunk
function placeOres(data, decRng) {
  for (const ore of ORES) {
    for (let i = 0; i < ore.count; i++) {
      const rng = decRng;
      const ox = rng.nextInt(CHUNK_SIZE);
      let oy;
      if (ore.triangular) {
        oy = Math.floor(16 + (rng.nextDouble() - 0.5) * 32);
        oy = Math.max(ore.minY, Math.min(ore.maxY, oy));
      } else {
        oy = ore.minY + rng.nextInt(ore.maxY - ore.minY + 1);
      }
      const oz = rng.nextInt(CHUNK_SIZE);
      placeVein(data, ox, oy, oz, ore, rng);
    }
  }
}

function placeVein(data, x, y, z, ore, rng) {
  const blobs = Math.max(1, Math.floor(ore.size / 3));
  for (let i = 0; i < blobs; i++) {
    const bx = x + (rng.nextDouble() - 0.5) * ore.size * 0.4;
    const by = y + (rng.nextDouble() - 0.5) * ore.size * 0.4;
    const bz = z + (rng.nextDouble() - 0.5) * ore.size * 0.4;
    const r = 1 + rng.nextDouble() * 1.5;
    const r2 = r * r;
    for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
        for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) {
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          const ix = Math.floor(bx + dx), iy = Math.floor(by + dy), iz = Math.floor(bz + dz);
          if (ix < 0 || ix >= CHUNK_SIZE || iz < 0 || iz >= CHUNK_SIZE || iy < 0 || iy >= WORLD_HEIGHT) continue;
          const idx = chunkIndex(ix, iy, iz);
          if (stateId(data[idx]) === STONE) data[idx] = packState(ore.id, ore.meta || 0);
        }
      }
    }
  }
}

function placeEmeralds(data, baseX, baseZ, getBiome, rng) {
  for (let i = 0; i < 8; i++) {
    const ox = rng.nextInt(CHUNK_SIZE);
    const oy = 4 + rng.nextInt(28);
    const oz = rng.nextInt(CHUNK_SIZE);
    const biome = getBiome(baseX + ox, baseZ + oz);
    if (biome.emerald) {
      const idx = chunkIndex(ox, oy, oz);
      if (stateId(data[idx]) === STONE) data[idx] = packState(EMERALD_ORE, 0);
    }
    // Ouro extra na mesa
    if (biome && biome.goldBonus) {
      const gy = 32 + rng.nextInt(48);
      const gidx = chunkIndex(ox, gy, oz);
      if (stateId(data[gidx]) === STONE) data[gidx] = packState(GOLD_ORE, 0);
    }
  }
}