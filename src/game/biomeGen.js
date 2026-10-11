// Geração de mapa de biomas em camadas (PRD 04 RF-010)
import { fractal2 } from './noise';
import { BIOME_IDS, getBiome } from './biomes';
import { hash3 } from './prng';

export function createBiomeGenerator(seed, opts = {}) {
  const biomeScale = opts.biomeScale || 1;
  const continentN = fractal2(seed, 4, 0.5, 2, 0.008 * biomeScale);
  const tempN = fractal2(seed ^ 0x1111, 3, 0.5, 2, 0.004 * biomeScale);
  const humN = fractal2(seed ^ 0x2222, 3, 0.5, 2, 0.004 * biomeScale);
  const biomeN = fractal2(seed ^ 0x3333, 3, 0.5, 2, 0.012 / biomeScale);
  const riverN1 = fractal2(seed ^ 0x5555, 2, 0.5, 2, 0.005);
  const mN = fractal2(seed ^ 0x7777, 2, 0.5, 2, 0.012);

  return function getBiomeAt(x, z) {
    const rawC = continentN(x, z);
    const distFromOrigin = Math.hypot(x, z);
    // Bias de terra firme em área inicial (< 400 blocos)
    const spawnLandBias = distFromOrigin < 400 ? (1 - distFromOrigin / 400) * 0.6 : 0;
    const c = rawC + spawnLandBias;

    const t = (tempN(x, z) + 1) / 2;
    const h = (humN(x, z) + 1) / 2;
    const b = (biomeN(x, z) + 1) / 2;
    const m = mN(x, z);

    // Oceano / continente (parâmetros calibrados para continentes ricos com mares costeiros)
    if (c < -0.55) return getBiome(BIOME_IDS.deep_ocean);
    if (c < -0.35) {
      if (t < 0.15) return getBiome(BIOME_IDS.frozen_ocean);
      if (c < -0.50 && hash3(x >> 4, z >> 4, seed ^ 0xdea) % 200 === 0)
        return getBiome(BIOME_IDS.mushroom_island);
      return getBiome(BIOME_IDS.ocean);
    }

    // Rios contínuos (faixa estreita de um único ruído contínuo)
    const r1 = riverN1(x, z); // fractal2 já aplica a frequência (0.005); multiplicar de novo achatava o ruído e quase tudo virava rio
    if (Math.abs(r1) < 0.015) {
      if (t < 0.2) return getBiome(BIOME_IDS.frozen_river);
      return getBiome(BIOME_IDS.river);
    }

    // Praias perto da costa
    if (c < -0.2) {
      if (t < 0.2) return getBiome(BIOME_IDS.cold_beach);
      return getBiome(BIOME_IDS.beach);
    }
    if (c < 0.02 && t > 0.2 && t < 0.7 && b > 0.7)
      return getBiome(BIOME_IDS.stone_beach);

    // Seleção por clima
    let biome;
    if (t < 0.12) {
      if (h > 0.5 && m > 0.6 && b > 0.6) biome = getBiome(BIOME_IDS.ice_spikes);
      else if (b > 0.6) biome = getBiome(BIOME_IDS.ice_mountains);
      else biome = getBiome(BIOME_IDS.ice_plains);
    } else if (t < 0.28) {
      if (h > 0.75 && b > 0.5) biome = getBiome(BIOME_IDS.mega_taiga);
      else if (m > 0.3 && h > 0.4) biome = getBiome(BIOME_IDS.cold_taiga);
      else if (b > 0.75) biome = getBiome(BIOME_IDS.extreme_hills);
      else biome = getBiome(BIOME_IDS.taiga);
    } else if (t < 0.6) {
      if (h > 0.85 && m > 0.2) biome = getBiome(BIOME_IDS.swamp);
      else if (b > 0.75) biome = getBiome(BIOME_IDS.extreme_hills);
      else if (h > 0.7 && m < -0.45) biome = getBiome(BIOME_IDS.roofed_forest); // floresta escura: rara
      else if (h > 0.55 && b > 0.35) biome = getBiome(BIOME_IDS.forest);
      else if (h > 0.5 && m > 0.35) biome = getBiome(BIOME_IDS.birch_forest);
      else biome = getBiome(BIOME_IDS.plains);
    } else if (t < 0.9) {
      if (h > 0.75) biome = getBiome(BIOME_IDS.jungle);
      else if (h > 0.6 && m < -0.45) biome = getBiome(BIOME_IDS.roofed_forest);
      else if (h < 0.15) biome = getBiome(BIOME_IDS.savanna);
      else biome = getBiome(BIOME_IDS.plains);
    } else {
      if (h < 0.1 && b > 0.6) biome = getBiome(BIOME_IDS.mesa);
      else if (h < 0.15) biome = getBiome(BIOME_IDS.savanna);
      else biome = getBiome(BIOME_IDS.desert);
    }

    // Variante M
    if (m > 0.65 && biome.m !== undefined) biome = getBiome(biome.m);
    return biome;
  };
}