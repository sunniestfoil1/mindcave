// Decoração: árvores, plantas, neve/gelo (PRD 04 RF-050..052)
import { CHUNK_SIZE, WORLD_HEIGHT, WATER_FILL_LEVEL, SEA_LEVEL } from './constants';
import { hash3, mulberry32, javaRandom, decorationChunkSeed } from './prng';
import { chunkIndex, packState, stateId } from './chunk';
import { isWater } from './blocks';

const AIR = 0, GRASS = 2, DIRT = 3, STONE = 1, SAND = 12;
const LOG = 17, LEAVES = 18, LOG2 = 162, LEAVES2 = 161;
const TALLGRASS = 31, FLOWER = 37, ROSE = 38, CACTUS = 81, DEAD_BUSH = 143;
const SUGARCANE = 83, LILYPAD = 111, BROWN_MUSH = 39, RED_MUSH = 40;
const PUMPKIN = 86, MELON = 103, SNOW_LAYER = 78, ICE = 79, VINE = 106;
const BROWN_MUSH_BLK = 99, RED_MUSH_BLK = 100, WATER = 9, GLOWSTONE = 89;

function makeChunkWriter(data, cx, cz) {
  const baseX = cx * CHUNK_SIZE, baseZ = cz * CHUNK_SIZE;
  return {
    set(x, y, z, s) {
      const lx = x - baseX, lz = z - baseZ;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
      if (y < 0 || y >= WORLD_HEIGHT) return;
      data[chunkIndex(lx, y, lz)] = s;
    },
    get(x, y, z) {
      const lx = x - baseX, lz = z - baseZ;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return 0;
      if (y < 0 || y >= WORLD_HEIGHT) return 0;
      return data[chunkIndex(lx, y, lz)];
    },
  };
}

export function populateChunk(seed, cx, cz, data, getBiome, terrainGen, params = {}) {
  const baseX = cx * CHUNK_SIZE, baseZ = cz * CHUNK_SIZE;
  const writer = makeChunkWriter(data, cx, cz);

  // MC14-RF-003/051: seed de decoração por chunk — cada chunk tem posições diferentes e naturais
  const decRng = javaRandom(decorationChunkSeed(BigInt(seed), cx, cz));

  // MC14-RF-052: Árvores no chão — scanner real do dado do chunk, nunca em altura fixa
  if (params.structures !== false) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const ocx = cx + dx, ocz = cz + dz;
        const obx = ocx * CHUNK_SIZE, obz = ocz * CHUNK_SIZE;
        const biome = getBiome(obx + 8, obz + 8);
        if (!biome.trees) continue;
        // Cada chunk vizinho usa seu próprio seed de decoração (não compartilha sequência)
        const nRng = javaRandom(decorationChunkSeed(BigInt(seed), ocx, ocz));
        const count = treeCount(biome, nRng);
        for (let i = 0; i < count; i++) {
          const tx = obx + nRng.nextInt(CHUNK_SIZE);
          const tz = obz + nRng.nextInt(CHUNK_SIZE);
          // Buscar o chão real no dado do chunk (não a altura do ruído)
          const groundY = findGroundY(writer, tx, tz, terrainGen, getBiome, tx, tz);
          if (groundY < 2 || groundY > SEA_LEVEL + 60) continue;
          const gb = stateId(writer.get(tx, groundY, tz));
          if (gb !== GRASS && gb !== DIRT && gb !== SAND) continue;
          placeTree(writer, tx, groundY + 1, tz, biome.trees.type, nRng, seed);
        }
      }
    }
  }

  // MC14-RF-053: Plantas no chão, sempre — usam a altura real do terreno
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const ax = baseX + x, az = baseZ + z;
      const biome = getBiome(ax, az);
      if (!biome.plants) continue;
      const groundY = findGroundY(writer, ax, az, terrainGen, getBiome, ax, az);
      if (groundY < 2 || groundY <= WATER_FILL_LEVEL) continue;
      const gb = stateId(data[chunkIndex(x, groundY, z)]);
      const r = decRng.nextFloat();

      if (biome.plants.grass && r < biome.plants.grass * 0.4 && gb === GRASS)
        data[chunkIndex(x, groundY + 1, z)] = packState(TALLGRASS, 1);
      const r2 = decRng.nextFloat();
      if (biome.plants.flower && r2 < biome.plants.flower * 0.3 && gb === GRASS)
        data[chunkIndex(x, groundY + 1, z)] = packState(decRng.nextBoolean() ? FLOWER : ROSE, 0);
      if (biome.plants.cactus && decRng.nextFloat() < biome.plants.cactus * 0.2 && gb === SAND) {
        const ch = 1 + decRng.nextInt(3);
        for (let cy = 1; cy <= ch; cy++) if (groundY + cy < WORLD_HEIGHT)
          data[chunkIndex(x, groundY + cy, z)] = packState(CACTUS, 0);
      }
      if (biome.plants.deadBush && decRng.nextFloat() < biome.plants.deadBush * 0.15 && gb === SAND)
        data[chunkIndex(x, groundY + 1, z)] = packState(DEAD_BUSH, 0);
      if (biome.plants.sugarcane && decRng.nextFloat() < biome.plants.sugarcane * 0.2) {
        const nearW = isWater(stateId(writer.get(ax + 1, groundY, az))) ||
          isWater(stateId(writer.get(ax - 1, groundY, az))) ||
          isWater(stateId(writer.get(ax, groundY, az + 1))) ||
          isWater(stateId(writer.get(ax, groundY, az - 1)));
        if (nearW && (gb === GRASS || gb === SAND)) {
          const ch = 1 + decRng.nextInt(3);
          for (let cy = 1; cy <= ch; cy++) if (groundY + cy < WORLD_HEIGHT)
            data[chunkIndex(x, groundY + cy, z)] = packState(SUGARCANE, 0);
        }
      }
      if (biome.plants.melon && decRng.nextFloat() < biome.plants.melon && gb === GRASS) {
        const mx = x + (decRng.nextBoolean() ? 1 : -1), mz = z + (decRng.nextBoolean() ? 1 : -1);
        if (mx >= 0 && mx < CHUNK_SIZE && mz >= 0 && mz < CHUNK_SIZE) {
          const my = findGroundY(writer, baseX + mx, baseZ + mz, terrainGen, getBiome, baseX + mx, baseZ + mz) + 1;
          if (my < WORLD_HEIGHT && stateId(data[chunkIndex(mx, my, mz)]) === AIR)
            data[chunkIndex(mx, my, mz)] = packState(MELON, 0);
        }
      }
      if (biome.plants.mushroom && decRng.nextFloat() < biome.plants.mushroom * 0.3 && gb === GRASS)
        data[chunkIndex(x, groundY + 1, z)] = packState(decRng.nextBoolean() ? BROWN_MUSH : RED_MUSH, 0);
      if (biome.plants.lilypad && decRng.nextFloat() < biome.plants.lilypad * 0.3) {
        if (stateId(writer.get(ax, WATER_FILL_LEVEL, az)) === WATER &&
          stateId(writer.get(ax, WATER_FILL_LEVEL + 1, az)) === AIR)
          data[chunkIndex(x, WATER_FILL_LEVEL + 1, z)] = packState(LILYPAD, 0);
      }
    }
  }

  // Abóboras: 1/32 por chunk (usa o random de decoração)
  if (decRng.nextFloat() < 1 / 32) {
    const px = decRng.nextInt(CHUNK_SIZE), pz = decRng.nextInt(CHUNK_SIZE);
    const py = findGroundY(writer, baseX + px, baseZ + pz, terrainGen, getBiome, baseX + px, baseZ + pz);
    if (py < WORLD_HEIGHT - 1 && py > 0 && stateId(data[chunkIndex(px, py, pz)]) === GRASS)
      data[chunkIndex(px, py + 1, pz)] = packState(PUMPKIN, 0);
  }

  // Neve e gelo (RF-052) — usa altura real do terreno
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const ax = baseX + x, az = baseZ + z;
      const biome = getBiome(ax, az);
      if (!biome.snow) continue;
      const h = findGroundY(writer, ax, az, terrainGen, getBiome, ax, az);
      if (h <= WATER_FILL_LEVEL || h < 0) continue;
      if (h + 1 < WORLD_HEIGHT && stateId(data[chunkIndex(x, h + 1, z)]) === AIR)
        data[chunkIndex(x, h + 1, z)] = packState(SNOW_LAYER, 0);
      for (let y = h; y >= Math.max(0, h - 3); y--) {
        if (stateId(data[chunkIndex(x, y, z)]) === WATER) {
          data[chunkIndex(x, y, z)] = packState(ICE, 0);
          break;
        }
      }
    }
  }
}

// MC14-RF-052: Busca o bloco sólido mais alto na coluna real do chunk.
// Nunca usa altura fixa — escaneia o dado de cima para baixo.
function findGroundY(writer, wx, wz, terrainGen, getBiome, ax, az) {
  // Primeiro tenta o dado real do chunk (só funciona se estiver no chunk atual)
  for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
    const s = stateId(writer.get(wx, y, wz));
    if (s !== 0 && s !== 8 && s !== 9 && s !== 10 && s !== 11 && s !== 78 && s !== 79) {
      return y;
    }
  }
  // Fallback: altura do ruído (para posições em chunks vizinhos não carregados)
  const biome = getBiome(ax, az);
  return terrainGen.columnHeight(ax, az, biome);
}

function treeCount(biome, rng) {
  if (!biome.trees) return 0;
  const d = biome.trees.density;
  // MC14-RF-052: valor do bioma + 1 extra com chance de 1 em 10
  if (d < 1) return rng.nextFloat() < d ? 1 : 0;
  return Math.floor(d) + (rng.nextFloat() < (d % 1) ? 1 : 0);
}

// === Árvores ===
function placeTree(w, x, y, z, type, rng, seed) {
  switch (type) {
    case 'oak': placeOak(w, x, y, z, rng, 0); break;
    case 'birch': placeBirch(w, x, y, z, rng, 2, false); break;
    case 'birch_tall': placeBirch(w, x, y, z, rng, 2, true); break;
    case 'spruce': placeSpruce(w, x, y, z, rng, 1); break;
    case 'spruce_giant': placeGiantSpruce(w, x, y, z, rng, 1); break;
    case 'jungle': placeJungle(w, x, y, z, rng, 3); break;
    case 'jungle_small': placeOak(w, x, y, z, rng, 3); break;
    case 'acacia': placeAcacia(w, x, y, z, rng, 0); break;
    case 'dark_oak': placeDarkOak(w, x, y, z, rng, 1); break;
    case 'swamp_oak': placeSwampOak(w, x, y, z, rng, 0); break;
    case 'mushroom': placeMushroom(w, x, y, z, rng); break;
    default: placeOak(w, x, y, z, rng, 0);
  }
}

// Copa do carvalho/bétula como no WorldGenTrees da 1.8.9: 4 camadas de topY-3 a topY, raio 2,2,1,1;
// cantos da copa só entram com 50% de chance, e nunca na camada de cima.
function placeOakCanopy(w, x, topY, z, rng, meta) {
  for (let yy = topY - 3; yy <= topY; yy++) {
    const dy = yy - topY;                    // -3..0
    const r = 1 - Math.trunc(dy / 2);        // 2, 2, 1, 1
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const corner = Math.abs(dx) === r && Math.abs(dz) === r;
      if (corner && (dy === 0 || rng.nextInt(2) === 0)) continue;
      if (w.get(x + dx, yy, z + dz) === 0) w.set(x + dx, yy, z + dz, packState(LEAVES, meta));
    }
  }
}

function placeOak(w, x, y, z, rng, leafMeta) {
  const trunk = 4 + rng.nextInt(3);
  for (let i = 0; i < trunk; i++) w.set(x, y + i, z, packState(LOG, leafMeta & 3));
  placeOakCanopy(w, x, y + trunk, z, rng, leafMeta & 3);
}

function placeBirch(w, x, y, z, rng, logMeta, tall) {
  const trunk = tall ? 7 + rng.nextInt(3) : 5 + rng.nextInt(3);
  for (let i = 0; i < trunk; i++) w.set(x, y + i, z, packState(LOG, logMeta));
  placeOakCanopy(w, x, y + trunk, z, rng, logMeta);
}

function placeSpruce(w, x, y, z, rng, logMeta) {
  const trunk = 5 + Math.floor(rng.nextFloat() * 3);
  for (let i = 0; i < trunk; i++) w.set(x, y + i, z, packState(LOG, logMeta));
  const topY = y + trunk;
  for (let ly = 2; ly < trunk; ly++) {
    const yy = y + ly;
    const r = (ly % 2 === 0) ? 2 : 1;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.abs(dx) === r && Math.abs(dz) === r && rng.nextFloat() < 0.5) continue;
      if (w.get(x + dx, yy, z + dz) === 0) w.set(x + dx, yy, z + dz, packState(LEAVES, logMeta));
    }
  }
  for (let ly = 0; ly <= 2; ly++) {
    const r = 2 - ly;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (w.get(x + dx, topY + ly, z + dz) === 0) w.set(x + dx, topY + ly, z + dz, packState(LEAVES, logMeta));
    }
  }
  w.set(x, topY + 2, z, packState(LEAVES, logMeta));
}

function placeGiantSpruce(w, x, y, z, rng, logMeta) {
  const trunk = 18 + Math.floor(rng.nextFloat() * 12);
  for (let i = 0; i < trunk; i++) {
    w.set(x, y + i, z, packState(LOG, logMeta));
    w.set(x + 1, y + i, z, packState(LOG, logMeta));
    w.set(x, y + i, z + 1, packState(LOG, logMeta));
    w.set(x + 1, y + i, z + 1, packState(LOG, logMeta));
  }
  for (let ly = 3; ly < trunk; ly += 3) {
    const yy = y + ly, r = 2;
    for (let dx = -r; dx <= r + 1; dx++) for (let dz = -r; dz <= r + 1; dz++) {
      if (w.get(x + dx, yy, z + dz) === 0) w.set(x + dx, yy, z + dz, packState(LEAVES, logMeta));
    }
  }
  const topY = y + trunk;
  for (let dx = -1; dx <= 2; dx++) for (let dz = -1; dz <= 2; dz++)
    if (w.get(x + dx, topY, z + dz) === 0) w.set(x + dx, topY, z + dz, packState(LEAVES, logMeta));
}

function placeJungle(w, x, y, z, rng, logMeta) {
  const trunk = 4 + Math.floor(rng.nextFloat() * 4);
  for (let i = 0; i < trunk; i++) w.set(x, y + i, z, packState(LOG, logMeta));
  const topY = y + trunk;
  for (let ly = -2; ly <= 2; ly++) {
    const yy = topY + ly, r = ly <= 0 ? 2 : 1;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++)
      if (w.get(x + dx, yy, z + dz) === 0) w.set(x + dx, yy, z + dz, packState(LEAVES, logMeta));
  }
}

function placeAcacia(w, x, y, z, rng, logMeta) {
  const trunk = 3 + Math.floor(rng.nextFloat() * 2);
  const dir = Math.floor(rng.nextFloat() * 4);
  const dx = [0, 1, 0, -1][dir], dz = [1, 0, -1, 0][dir];
  for (let i = 0; i < trunk; i++)
    w.set(x + Math.round(dx * i * 0.3), y + i, z + Math.round(dz * i * 0.3), packState(LOG2, logMeta));
  const topY = y + trunk;
  const topX = x + Math.round(dx * trunk * 0.3), topZ = z + Math.round(dz * trunk * 0.3);
  for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) {
    if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && rng.nextFloat() < 0.7) continue;
    if (w.get(topX + lx, topY, topZ + lz) === 0) w.set(topX + lx, topY, topZ + lz, packState(LEAVES2, logMeta));
  }
  for (let lx = -1; lx <= 1; lx++) for (let lz = -1; lz <= 1; lz++)
    if (w.get(topX + lx, topY + 1, topZ + lz) === 0) w.set(topX + lx, topY + 1, topZ + lz, packState(LEAVES2, logMeta));
}

function placeDarkOak(w, x, y, z, rng, logMeta) {
  const trunk = 5 + Math.floor(rng.nextFloat() * 3);
  for (let i = 0; i < trunk; i++) {
    w.set(x, y + i, z, packState(LOG2, logMeta));
    w.set(x + 1, y + i, z, packState(LOG2, logMeta));
    w.set(x, y + i, z + 1, packState(LOG2, logMeta));
    w.set(x + 1, y + i, z + 1, packState(LOG2, logMeta));
  }
  const topY = y + trunk;
  for (let ly = -1; ly <= 1; ly++) {
    const yy = topY + ly;
    for (let dx = -2; dx <= 3; dx++) for (let dz = -2; dz <= 3; dz++) {
      if (Math.abs(dx) + Math.abs(dz) > 4) continue;
      if (w.get(x + dx, yy, z + dz) === 0) w.set(x + dx, yy, z + dz, packState(LEAVES2, logMeta));
    }
  }
}

function placeSwampOak(w, x, y, z, rng, leafMeta) {
  placeOak(w, x, y, z, rng, leafMeta);
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
    if (rng.nextFloat() < 0.3) {
      const vy = y + 3;
      if (w.get(x + dx, vy, z + dz) !== 0 && w.get(x + dx, vy - 1, z + dz) === 0)
        w.set(x + dx, vy - 1, z + dz, packState(VINE, 0));
    }
  }
}

function placeMushroom(w, x, y, z, rng) {
  const isRed = rng.nextFloat() > 0.5;
  const stem = 4 + Math.floor(rng.nextFloat() * 4);
  const capBlock = isRed ? RED_MUSH_BLK : BROWN_MUSH_BLK;
  for (let i = 0; i < stem; i++) w.set(x, y + i, z, packState(capBlock, 10));
  const capY = y + stem;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (dx * dx + dz * dz > 5) continue;
    w.set(x + dx, capY, z + dz, packState(capBlock, 0));
    if (isRed && dx * dx + dz * dz <= 1) w.set(x + dx, capY + 1, z + dz, packState(capBlock, 0));
  }
}