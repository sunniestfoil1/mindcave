// Decoração: árvores, plantas, neve/gelo (PRD 04 RF-050..052)
import { CHUNK_SIZE, WORLD_HEIGHT, WATER_FILL_LEVEL, SEA_LEVEL } from './constants';
import { hash3, mulberry32, javaRandom, decorationChunkSeed } from './prng';
import { chunkIndex, packState, stateId } from './chunk';
import { isWater } from './blocks';
import { JRandom } from './jrandom';
import * as T from './trees';

const AIR = 0, GRASS = 2, DIRT = 3, STONE = 1, SAND = 12;
const LOG = 17, LEAVES = 18, LOG2 = 162, LEAVES2 = 161;
const TALLGRASS = 31, FLOWER = 37, ROSE = 38, CACTUS = 81, DEAD_BUSH = 32;
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
          placeTree(data, cx, cz, tx, groundY, tz, biome, seed);
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

// === Árvores (geradores do 1.8.9 em trees.js; aqui só a escolha por bioma, na mesma regra do genBigTreeChance de cada classe) ===
const oak = (w, r, x, y, z) => T.genTrees(w, r, x, y, z);
const bigOak = (w, r, x, y, z) => T.genBigTree(w, r, x, y, z, 5);
const birchSmall = (w, r, x, y, z) => T.genBirch(w, r, x, y, z, false);
const birchTall = (w, r, x, y, z) => T.genBirch(w, r, x, y, z, true);
const taiga1 = (w, r, x, y, z) => T.genTaiga1(w, r, x, y, z);
const taiga2 = (w, r, x, y, z) => T.genTaiga2(w, r, x, y, z);
const defaultTree = (r) => (r.nextInt(10) === 0 ? bigOak : oak);   // BiomeGenBase.genBigTreeChance
const FOREST_IDS = new Set([10, 11, 12]), HILLS_IDS = new Set([7, 8, 9]);

function pickTree(type, biomeId, r) {
  switch (type) {
    case 'oak':
      if (FOREST_IDS.has(biomeId)) return r.nextInt(5) !== 0 ? oak : birchSmall;            // BiomeGenForest
      if (HILLS_IDS.has(biomeId)) return r.nextInt(3) > 0 ? taiga2 : defaultTree(r);        // BiomeGenHills
      return defaultTree(r);
    case 'birch': return birchSmall;
    case 'birch_tall': return r.nextBoolean() ? birchTall : birchSmall;                    // floresta de bétulas M
    case 'spruce':
      if (HILLS_IDS.has(biomeId)) return r.nextInt(3) > 0 ? taiga2 : defaultTree(r);
      return r.nextInt(3) === 0 ? taiga1 : taiga2;                                          // BiomeGenTaiga
    case 'spruce_giant':
      if (r.nextInt(3) === 0) return r.nextInt(13) !== 0 ? (w, rr, x, y, z) => T.genMegaPine(w, rr, x, y, z, false) : (w, rr, x, y, z) => T.genMegaPine(w, rr, x, y, z, true);
      return r.nextInt(3) === 0 ? taiga1 : taiga2;
    case 'jungle': case 'jungle_small': {
      if (r.nextInt(10) === 0) return bigOak;
      if (r.nextInt(2) === 0) return (w, rr, x, y, z) => T.genShrub(w, rr, x, y, z);
      if (type === 'jungle' && r.nextInt(3) === 0) return (w, rr, x, y, z) => T.genMegaJungle(w, rr, x, y, z);
      const minHeight = 4 + r.nextInt(7);
      return (w, rr, x, y, z) => T.genTrees(w, rr, x, y, z, { minHeight, wood: 3, leaf: 3, vines: true });
    }
    case 'acacia': return r.nextInt(5) > 0 ? (w, rr, x, y, z) => T.genSavannaTree(w, rr, x, y, z) : oak;
    case 'dark_oak':
      if (r.nextInt(3) > 0) return (w, rr, x, y, z) => T.genCanopy(w, rr, x, y, z);          // BiomeGenForest roofed
      return r.nextInt(5) !== 0 ? oak : birchSmall;
    case 'swamp_oak': return (w, rr, x, y, z) => T.genSwamp(w, rr, x, y, z);
    default: return defaultTree(r);
  }
}

// "Mundo" que os geradores de árvore enxergam: o chunk atual de verdade; fora dele, ar acima do chão da raiz e grama abaixo
// (a árvore de um chunk vizinho só precisa saber que há chão sob o tronco e que o ar em volta está livre).
function treeWorld(data, cx, cz, rootGroundY) {
  const baseX = cx * CHUNK_SIZE, baseZ = cz * CHUNK_SIZE;
  const GROUND = packState(GRASS, 0);
  const get = (x, y, z) => {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    const lx = x - baseX, lz = z - baseZ;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return y <= rootGroundY ? GROUND : 0;
    return data[chunkIndex(lx, y, lz)];
  };
  return {
    get,
    id: (x, y, z) => (get(x, y, z) >> 4) & 0xfff,
    isAir: (x, y, z) => get(x, y, z) === 0,
    set(x, y, z, s) {
      const lx = x - baseX, lz = z - baseZ;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return;
      data[chunkIndex(lx, y, lz)] = s;
    },
  };
}

// Cada árvore tem o próprio Random (semente pela posição): o formato não depende de quantas árvores o chunk vizinho já tentou
function placeTree(data, cx, cz, x, groundY, z, biome, seed) {
  const w = treeWorld(data, cx, cz, groundY);
  const r = new JRandom(BigInt(hash3(x, 0x5f3, z, (seed >>> 0) ^ 0x7ee5)));
  const type = biome.trees.type;
  if (type === 'mushroom') { placeMushroom(w, x, groundY + 1, z, r); return; }
  pickTree(type, biome.id, r)(w, r, x, groundY + 1, z);
}

function placeMushroom(w, x, y, z, rng) {
  const isRed = rng.nextFloat() > 0.5;
  const stem = 4 + Math.floor(rng.nextFloat() * 4);
  const capBlock = isRed ? RED_MUSH_BLK : BROWN_MUSH_BLK;
  for (let i = 0; i < stem; i++) w.set(x, y + i, z, packState(capBlock, 10));
  const capY = y + stem;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (dx * dx + dz * dz > 5) continue;
    w.set(x + dx, capY, z + dz, packState(capBlock, 14));   // 14 = pele nos seis lados; 10 = caule
    if (isRed && dx * dx + dz * dz <= 1) w.set(x + dx, capY + 1, z + dz, packState(capBlock, 14));
  }
}