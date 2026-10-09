// Definições de biomas (PRD 04 RF-011/012) + cores de grama/folhagem
// Block IDs locais (evitam dependência circular)
const STONE = 1, GRASS = 2, DIRT = 3, SAND = 12, GRAVEL = 13;
const ICE = 79, SNOW_BLOCK = 80, MYCELIUM = 110, HARDENED_CLAY = 159;

export const BIOME_IDS = {
  ocean: 0, deep_ocean: 1, frozen_ocean: 2,
  plains: 3, sunflower_plains: 4,
  desert: 5, desert_hills: 6,
  extreme_hills: 7, extreme_hills_plus: 8, extreme_hills_edge: 9,
  forest: 10, flower_forest: 11, forest_hills: 12,
  birch_forest: 13, birch_forest_m: 14,
  roofed_forest: 15,
  taiga: 16, cold_taiga: 17, mega_taiga: 18,
  swamp: 19,
  river: 20, frozen_river: 21,
  ice_plains: 22, ice_mountains: 23, ice_spikes: 24,
  mushroom_island: 25,
  beach: 26, stone_beach: 27, cold_beach: 28,
  jungle: 29, jungle_hills: 30, jungle_edge: 31,
  savanna: 32, savanna_plateau: 33,
  mesa: 34, mesa_plateau: 35,
};

// hBase/hVar em unidades de ~8 blocos acima/abaixo do nível do mar
// hBase/hVar em unidades de ~8 blocos acima/abaixo do nível do mar (referência exata do Minecraft 1.8.9 via SeedFinding/mc_biome_java)
export const BIOMES = [
  { id: 0, name: 'Oceano', temp: 0.5, hum: 0.5, hBase: -1.0, hVar: 0.1, top: GRAVEL, fill: STONE, water: true, color: 0x1a3a5a },
  { id: 1, name: 'Oceano Profundo', temp: 0.5, hum: 0.5, hBase: -1.8, hVar: 0.1, top: GRAVEL, fill: STONE, water: true, color: 0x0d2d4d },
  { id: 2, name: 'Oceano Congelado', temp: 0.0, hum: 0.5, hBase: -1.0, hVar: 0.1, top: ICE, fill: STONE, water: true, snow: true, color: 0x204060 },
  { id: 3, name: 'Planícies', temp: 0.8, hum: 0.4, hBase: 0.25, hVar: 0.15, top: GRASS, fill: DIRT, trees: { type: 'oak', density: 0.05 }, plants: { grass: 0.7, flower: 0.1 }, spawn: true, color: 0x90b050 },
  { id: 4, name: 'Planícies de Girassol', temp: 0.8, hum: 0.4, hBase: 0.25, hVar: 0.15, top: GRASS, fill: DIRT, trees: { type: 'oak', density: 0.02 }, plants: { grass: 0.5, flower: 0.4 }, spawn: true, color: 0xa0c060, m: 3 },
  { id: 5, name: 'Deserto', temp: 2.0, hum: 0.0, hBase: 0.25, hVar: 0.15, top: SAND, fill: SAND, plants: { cactus: 0.3, deadBush: 0.1 }, color: 0xe0d090 },
  { id: 6, name: 'Colinas do Deserto', temp: 2.0, hum: 0.0, hBase: 0.55, hVar: 0.35, top: SAND, fill: SAND, plants: { cactus: 0.2 }, color: 0xd0c080, m: 5 },
  { id: 7, name: 'Colinas Extremas', temp: 0.2, hum: 0.3, hBase: 1.1, hVar: 0.65, top: GRASS, fill: DIRT, trees: { type: 'spruce', density: 0.1 }, plants: { grass: 0.2 }, emerald: true, color: 0x809070 },
  { id: 8, name: 'Colinas Extremas+', temp: 0.2, hum: 0.3, hBase: 1.1, hVar: 0.65, top: GRASS, fill: DIRT, trees: { type: 'oak', density: 0.3 }, plants: { grass: 0.2 }, color: 0x889080, m: 7 },
  { id: 9, name: 'Borda das Colinas Extremas', temp: 0.2, hum: 0.3, hBase: 0.85, hVar: 0.35, top: GRASS, fill: DIRT, plants: { grass: 0.2 }, color: 0x80907a },
  { id: 10, name: 'Floresta', temp: 0.7, hum: 0.8, hBase: 0.25, hVar: 0.2, top: GRASS, fill: DIRT, trees: { type: 'oak', density: 0.7 }, plants: { grass: 0.4, mushroom: 0.05 }, spawn: true, color: 0x507030 },
  { id: 11, name: 'Floresta de Flores', temp: 0.7, hum: 0.8, hBase: 0.25, hVar: 0.4, top: GRASS, fill: DIRT, trees: { type: 'oak', density: 0.5 }, plants: { grass: 0.3, flower: 0.4 }, spawn: true, color: 0x608040, m: 10 },
  { id: 12, name: 'Colinas da Floresta', temp: 0.7, hum: 0.8, hBase: 0.55, hVar: 0.35, top: GRASS, fill: DIRT, trees: { type: 'oak', density: 0.6 }, plants: { grass: 0.3 }, color: 0x506830 },
  { id: 13, name: 'Floresta de Bétulas', temp: 0.6, hum: 0.6, hBase: 0.25, hVar: 0.2, top: GRASS, fill: DIRT, trees: { type: 'birch', density: 0.7 }, plants: { grass: 0.3 }, spawn: true, color: 0x507840 },
  { id: 14, name: 'Floresta de Bétulas Altas', temp: 0.6, hum: 0.6, hBase: 0.25, hVar: 0.2, top: GRASS, fill: DIRT, trees: { type: 'birch_tall', density: 0.7 }, plants: { grass: 0.3 }, color: 0x507848, m: 13 },
  { id: 15, name: 'Floresta Escura', temp: 0.7, hum: 0.8, hBase: 0.25, hVar: 0.2, top: GRASS, fill: DIRT, trees: { type: 'dark_oak', density: 0.9 }, plants: { grass: 0.1, mushroom: 0.1 }, color: 0x305020 },
  { id: 16, name: 'Taiga', temp: 0.25, hum: 0.8, hBase: 0.3, hVar: 0.25, top: GRASS, fill: DIRT, trees: { type: 'spruce', density: 0.7 }, plants: { grass: 0.3, mushroom: 0.05 }, spawn: true, color: 0x406855 },
  { id: 17, name: 'Taiga Fria', temp: -0.5, hum: 0.4, hBase: 0.3, hVar: 0.25, top: GRASS, fill: DIRT, snow: true, trees: { type: 'spruce', density: 0.7 }, plants: { grass: 0.2 }, spawn: true, color: 0x608090 },
  { id: 18, name: 'Mega Taiga', temp: 0.3, hum: 0.8, hBase: 0.3, hVar: 0.25, top: DIRT, topMeta: 2, fill: DIRT, trees: { type: 'spruce_giant', density: 0.4 }, plants: { grass: 0.2, mushroom: 0.1 }, color: 0x506845 },
  { id: 19, name: 'Pântano', temp: 0.8, hum: 0.9, hBase: 0.05, hVar: 0.05, top: GRASS, fill: DIRT, water: true, trees: { type: 'swamp_oak', density: 0.15 }, plants: { grass: 0.3, mushroom: 0.1, lilypad: 0.2 }, color: 0x506030 },
  { id: 20, name: 'Rio', temp: 0.5, hum: 0.5, hBase: -0.3, hVar: 0.0, top: SAND, fill: DIRT, water: true, plants: { sugarcane: 0.3 }, color: 0x4080a0 },
  { id: 21, name: 'Rio Congelado', temp: 0.0, hum: 0.5, hBase: -0.3, hVar: 0.0, top: ICE, fill: DIRT, water: true, snow: true, plants: {}, color: 0x6090b0 },
  { id: 22, name: 'Planícies de Gelo', temp: 0.0, hum: 0.5, hBase: 0.25, hVar: 0.15, top: SNOW_BLOCK, fill: DIRT, snow: true, trees: { type: 'spruce', density: 0.01 }, plants: {}, color: 0xc0d0e0 },
  { id: 23, name: 'Montanhas de Gelo', temp: 0.0, hum: 0.5, hBase: 0.55, hVar: 0.35, top: SNOW_BLOCK, fill: DIRT, snow: true, color: 0xa0b8c8 },
  { id: 24, name: 'Picos de Gelo', temp: 0.0, hum: 0.5, hBase: 0.525, hVar: 0.55, top: ICE, fill: ICE, snow: true, color: 0x90c0d8, m: 22 },
  { id: 25, name: 'Ilha de Cogumelos', temp: 0.9, hum: 1.0, hBase: 0.3, hVar: 0.3, top: MYCELIUM, fill: DIRT, trees: { type: 'mushroom', density: 0.3 }, plants: { mushroom: 0.3 }, color: 0x8050a0 },
  { id: 26, name: 'Praia', temp: 0.8, hum: 0.4, hBase: 0.05, hVar: 0.05, top: SAND, fill: SAND, color: 0xe0d8a0 },
  { id: 27, name: 'Praia de Pedra', temp: 0.2, hum: 0.3, hBase: 0.15, hVar: 0.8, top: STONE, fill: STONE, color: 0x808890 },
  { id: 28, name: 'Praia Fria', temp: 0.05, hum: 0.3, hBase: 0.05, hVar: 0.05, top: SAND, fill: SAND, snow: true, color: 0xd0d8e0 },
  { id: 29, name: 'Selva', temp: 0.95, hum: 0.9, hBase: 0.25, hVar: 0.25, top: GRASS, fill: DIRT, trees: { type: 'jungle', density: 3.5 }, plants: { grass: 0.4, melon: 0.02 }, spawn: true, color: 0x30a020 },
  { id: 30, name: 'Colinas da Selva', temp: 0.95, hum: 0.9, hBase: 0.55, hVar: 0.35, top: GRASS, fill: DIRT, trees: { type: 'jungle', density: 2.0 }, plants: { grass: 0.3 }, color: 0x309018, m: 29 },
  { id: 31, name: 'Borda da Selva', temp: 0.95, hum: 0.8, hBase: 0.25, hVar: 0.2, top: GRASS, fill: DIRT, trees: { type: 'jungle_small', density: 0.8 }, plants: { grass: 0.3 }, spawn: true, color: 0x40a830 },
  { id: 32, name: 'Savana', temp: 1.2, hum: 0.0, hBase: 0.25, hVar: 0.15, top: GRASS, topMeta: 2, fill: DIRT, trees: { type: 'acacia', density: 0.07 }, plants: { grass: 0.6 }, spawn: true, color: 0xb0c050 },
  { id: 33, name: 'Planalto da Savana', temp: 1.0, hum: 0.0, hBase: 1.6, hVar: 0.025, top: GRASS, topMeta: 2, fill: DIRT, trees: { type: 'acacia', density: 0.03 }, plants: { grass: 0.4 }, color: 0xa0b048, m: 32 },
  { id: 34, name: 'Mesa', temp: 2.0, hum: 0.0, hBase: 0.25, hVar: 0.25, top: SAND, topMeta: 1, fill: HARDENED_CLAY, plants: { cactus: 0.15, deadBush: 0.1 }, goldBonus: true, color: 0xc06030 },
  { id: 35, name: 'Planalto da Mesa', temp: 2.0, hum: 0.0, hBase: 1.6, hVar: 0.025, top: HARDENED_CLAY, fill: HARDENED_CLAY, plants: { cactus: 0.1 }, goldBonus: true, color: 0xb05828, m: 34 },
];

export const BIOME_MAP = {};
BIOMES.forEach(b => { BIOME_MAP[b.id] = b; });

export function getBiome(id) { return BIOME_MAP[id] || BIOMES[0]; }

// Cores de grama por bioma (RF-012)
export function biomeGrassColor(biome) {
  if (biome.id === 19) return [0.38, 0.48, 0.22]; // pântano
  if (biome.id === 15) return [0.25, 0.38, 0.18]; // floresta escura
  if (biome.id === 34 || biome.id === 35) return [0.55, 0.42, 0.25]; // mesa
  if (biome.id === 25) return [0.55, 0.35, 0.60]; // cogumelo
  const t = Math.max(0, Math.min(1, (biome.temp + 0.5) / 2.5));
  const h = Math.max(0, Math.min(1, biome.hum));
  let r = 0.45 - t * 0.18;
  let g = 0.62 + h * 0.12;
  let b = 0.22 + (1 - t) * 0.18;
  if (t > 0.75 && h < 0.25) { r += 0.12; g -= 0.06; }
  if (t < 0.2) { r -= 0.06; b += 0.08; }
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

export function biomeFoliageColor(biome) {
  const c = biomeGrassColor(biome);
  return [Math.max(0, c[0] - 0.04), Math.max(0, c[1] - 0.04), Math.max(0, c[2])];
}

// Biomas válidos para spawn (RF-073)
export const SPAWN_BIOMES = new Set([3, 4, 10, 11, 13, 16, 17, 29, 30, 31, 32]);