// Registro de geradores de mundo (PRD 04 RF-004, RF-070..083)
import { CHUNK_SIZE, WORLD_HEIGHT, WATER_FILL_LEVEL, SEA_LEVEL } from './constants';
import { createBiomeGenerator } from './biomeGen';
import { createTerrainGenerator } from './terrain';
import { populateChunk } from './vegetation';
import { createChunkData, chunkIndex, packState, stateId } from './chunk';
import { hash3, mulberry32 } from './prng';
import { BLOCKS } from './blocks';
import { SPAWN_BIOMES, getBiome, BIOME_IDS } from './biomes';

const STONE = 1, DIRT = 3, BEDROCK = 7, GRASS = 2, SAND = 12, WATER = 9;
const STONE_BRICKS = 98, COBBLESTONE = 4, GLOWSTONE = 89;

// === Registro de geradores ===
export const GENERATORS = {
  open_legacy: {
    id: 'open_legacy', name: 'Mundo Aberto (legado)', version: 1,
    generate(seed, cx, cz) { return generateLegacy(seed, cx, cz); },
  },
  open_world: {
    id: 'open_world', name: 'Mundo Aberto', version: 1,
    generate(seed, cx, cz, params = {}) {
      const gens = getCachedGens(seed, params);
      const data = gens.terrainGen.generate(cx, cz, gens.getBiome);
      populateChunk(seed, cx, cz, data, gens.getBiome, gens.terrainGen, params);
      return data;
    },
  },
  superflat: {
    id: 'superflat', name: 'Mundo Plano', version: 1,
    generate(seed, cx, cz, params = {}) {
      const preset = params.superflatPreset || 'lab';
      return generateSuperflat(seed, cx, cz, preset, params);
    },
  },
};

// Cache de geradores por seed+worldType (evita recriar noise per chunk)
const _genCache = new Map();
function getCachedGens(seed, params) {
  const key = seed + ':' + (params.worldType || 'default');
  if (_genCache.has(key)) { const v = _genCache.get(key); _genCache.delete(key); _genCache.set(key, v); return v; }
  if (_genCache.size > 4) _genCache.delete(_genCache.keys().next().value);
  const biomeScale = params.worldType === 'large_biomes' ? 4 : 1;
  const amplified = params.worldType === 'amplified';
  const getBiome = createBiomeGenerator(seed, { biomeScale });
  const terrainGen = createTerrainGenerator(seed, { amplified });
  const result = { getBiome, terrainGen };
  _genCache.set(key, result);
  return result;
}

export function generateChunk(seed, cx, cz, opts = {}) {
  const genId = opts.generatorId || 'open_legacy';
  const gen = GENERATORS[genId] || GENERATORS.open_legacy;
  return gen.generate(seed, cx, cz, opts.params || {});
}

// === Gerador legado (compatibilidade com mundos PRD-01) ===
function generateLegacy(seed, cx, cz) {
  // Re-exporta o gerador básico do PRD 01
  return _legacyGen(seed, cx, cz);
}

// Importação lazy para evitar dependência circular
let _legacyGen = null;
export function setLegacyGen(fn) { _legacyGen = fn; }

// Expõe o getBiome do gerador cacheado (para clima e spawn)
export function getBiomeProvider(seed, opts = {}) {
  const genId = opts.generatorId || 'open_legacy';
  if (genId === 'open_world') {
    const gens = getCachedGens(seed, opts.params || {});
    return gens.getBiome;
  }
  // Fallback: planícies para mundos não-bioma (superflat, legado)
  return () => getBiome(BIOME_IDS.plains);
}

// === Superplano (Mapa 2) ===
export const SUPERFLAT_PRESETS = {
  classic: { name: 'Clássico Plano', layers: [[BEDROCK, 0, 1], [DIRT, 0, 2], [GRASS, 0, 1]], biome: 'plains' },
  miner_dream: { name: 'Sonho do Minerador', layers: [[BEDROCK, 0, 1], [STONE, 0, 230], [DIRT, 0, 5], [GRASS, 0, 1]], caves: true, ores: true },
  water_world: { name: "Mundo d'Água", layers: [[BEDROCK, 0, 1], [STONE, 0, 5], [DIRT, 0, 5], [SAND, 0, 5], [WATER, 0, 90]], biome: 'ocean' },
  lab: { name: 'Laboratório Mind Cave', layers: [[BEDROCK, 0, 1], [STONE, 0, 3], [STONE_BRICKS, 0, 1]], lab: true },
  void: { name: 'Vazio', layers: [[STONE, 0, 1]], void: true },
};

function generateSuperflat(seed, cx, cz, presetName, params) {
  const preset = SUPERFLAT_PRESETS[presetName] || SUPERFLAT_PRESETS.lab;
  const data = createChunkData();
  const baseX = cx * CHUNK_SIZE, baseZ = cz * CHUNK_SIZE;

  if (preset.void && !(cx === 0 && cz === 0)) return data;

  let y = 0;
  for (const [blockId, meta, count] of preset.layers) {
    for (let i = 0; i < count; i++) {
      if (y >= WORLD_HEIGHT) break;
      for (let x = 0; x < CHUNK_SIZE; x++)
        for (let z = 0; z < CHUNK_SIZE; z++)
          data[chunkIndex(x, y, z)] = packState(blockId, meta);
      y++;
    }
  }
  const floorY = y - 1;

  // Grade de chunk (lab)
  if (preset.lab) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const ax = baseX + x, az = baseZ + z;
        if (ax % 16 === 0 || az % 16 === 0)
          data[chunkIndex(x, floorY, z)] = packState(STONE_BRICKS, 0);
      }
    }
    buildLabAreas(data, cx, cz, baseX, baseZ, floorY, seed);
  }

  // Cavernas simples (miner dream)
  if (preset.caves) {
    for (let x = 0; x < CHUNK_SIZE; x++)
      for (let z = 0; z < CHUNK_SIZE; z++)
        for (let yy = 1; yy < floorY - 5; yy++) {
          if (stateId(data[chunkIndex(x, yy, z)]) !== STONE) continue;
          if (hash3(baseX + x, yy, baseZ + z, seed ^ 0xcafe) % 100 < 3)
            data[chunkIndex(x, yy, z)] = 0;
        }
  }

  return data;
}

// === Áreas do Laboratório (RF-081) ===
function buildLabAreas(data, cx, cz, baseX, baseZ, floorY, seed) {
  // Praça central: glowstone no spawn
  if (cx === 0 && cz === 0) {
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        if (floorY + 1 < WORLD_HEIGHT)
          data[chunkIndex(8 + dx, floorY + 1, 8 + dz)] = packState(GLOWSTONE, 0);
  }

  // Galeria de blocos: norte (z < 0)
  if (cz < 0 && cz >= -4 && cx === 0)
    placeBlockGallery(data, baseX, baseZ, floorY);

  // Arena de mobs: leste (x >= 0)
  if (cx >= 0 && cx <= 2 && cz >= -1 && cz <= 1)
    placeMobArena(data, baseX, baseZ, floorY, seed);

  // Piscinas de líquidos: sudoeste (x < 0, z > 0)
  if (cx < 0 && cz > 0 && cz <= 2)
    placeLiquidPools(data, baseX, baseZ, floorY, seed);

  // Sala de luz: noroeste (x < 0, z < 0)
  if (cx < 0 && cz < 0 && cx >= -3 && cz >= -3)
    placeLightRoom(data, baseX, baseZ, floorY, seed);
}

function placeBlockGallery(data, baseX, baseZ, floorY) {
  const ids = Object.keys(BLOCKS).map(Number).filter(id => id > 0 && id < 200).sort((a, b) => a - b);
  for (let i = 0; i < ids.length; i++) {
    const col = i % 8, row = Math.floor(i / 8);
    const ax = col * 2, az = -2 - row * 2;
    const lx = ax - baseX, lz = az - baseZ;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) continue;
    if (floorY + 1 < WORLD_HEIGHT) data[chunkIndex(lx, floorY + 1, lz)] = packState(COBBLESTONE, 0);
    if (floorY + 2 < WORLD_HEIGHT) data[chunkIndex(lx, floorY + 2, lz)] = packState(ids[i], 0);
  }
}

function placeMobArena(data, baseX, baseZ, floorY, seed) {
  // Cercado 32×32 em pedregulho a partir de (4, floorY, -16)
  for (let i = 0; i <= 32; i++) {
    setAbs(data, baseX, baseZ, 4 + i, floorY + 1, -16, packState(COBBLESTONE, 0));
    setAbs(data, baseX, baseZ, 4 + i, floorY + 2, -16, packState(COBBLESTONE, 0));
    setAbs(data, baseX, baseZ, 4 + i, floorY + 1, 16, packState(COBBLESTONE, 0));
    setAbs(data, baseX, baseZ, 4, floorY + 1, -16 + i, packState(COBBLESTONE, 0));
    setAbs(data, baseX, baseZ, 36, floorY + 1, -16 + i, packState(COBBLESTONE, 0));
  }
}

function placeLiquidPools(data, baseX, baseZ, floorY, seed) {
  // Piscina de água 8×8 e poço de lava 4×4
  for (let dx = 0; dx < 8; dx++)
    for (let dz = 0; dz < 8; dz++)
      setAbs(data, baseX, baseZ, -20 + dx, floorY + 1, 4 + dz, packState(WATER, 0));
  for (let dx = 0; dx < 4; dx++)
    for (let dz = 0; dz < 4; dz++)
      setAbs(data, baseX, baseZ, -8 + dx, floorY + 1, 4 + dz, packState(11, 0)); // lava
}

function placeLightRoom(data, baseX, baseZ, floorY, seed) {
  // Sala escura com fontes de luz de cada nível
  const lights = [89, 169, 50, 89, 169]; // glowstone, sea_lantern, torch
  for (let i = 0; i < lights.length; i++) {
    setAbs(data, baseX, baseZ, -20 + i * 4, floorY + 1, -20, packState(lights[i], 0));
  }
}

function setAbs(data, baseX, baseZ, ax, ay, az, state) {
  const lx = ax - baseX, lz = az - baseZ;
  if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
  if (ay < 0 || ay >= WORLD_HEIGHT) return;
  data[chunkIndex(lx, ay, lz)] = state;
}

// === Spawn (RF-073) Otimizado para encontrar terra firme e seca ===
export function findSpawn(cw, getBiome, terrainGen, sx = 0, sz = 0) {
  const step = 8;
  for (let r = 0; r <= 384; r += step) {
    for (let dx = -r; dx <= r; dx += step) {
      for (let dz = -r; dz <= r; dz += step) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = sx + dx, z = sz + dz;
        const biome = getBiome ? getBiome(x, z) : null;
        if (biome && (biome.water || !SPAWN_BIOMES.has(biome.id))) continue;
        const h = terrainGen ? terrainGen.columnHeight(x, z, biome) : 66;
        if (h > WATER_FILL_LEVEL + 1 && h < SEA_LEVEL + 40)
          return { x: x + 0.5, y: h + 1, z: z + 0.5, onGround: true };
      }
    }
  }
  // Fallback seguro acima do nível da água
  const biome = getBiome ? getBiome(sx, sz) : null;
  const h = terrainGen ? terrainGen.columnHeight(sx, sz, biome) : 66;
  return { x: sx + 0.5, y: Math.max(SEA_LEVEL + 2, h + 1), z: sz + 0.5, onGround: true };
}