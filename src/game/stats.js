// Estatísticas do jogador (PRD 12 RF-031) — coleta e serialização

export function createStats() {
  return {
    playTime: 0,          // ticks
    blocksMined: 0,
    blocksPlaced: 0,
    woodMined: 0,
    ironCollected: 0,
    diamondsCollected: 0,
    redstonePlaced: 0,
    itemsCrafted: 0,
    crafts: 0,
    mobsKilled: 0,
    eliteKilled: 0,
    deaths: 0,
    damageDealt: 0,
    damageTaken: 0,
    distanceWalked: 0,
    distanceSprinted: 0,
    distanceFlown: 0,
    distanceFallen: 0,
    jumps: 0,
    fishCaught: 0,
    animalsBred: 0,
    shotsFired: 0,
    headshots: 0,
    cropsHarvested: 0,
    survivedNight: false,
    gunsmithBenchCrafted: false,
    // Por bloco
    blocksMinedByType: {},
    blocksPlacedByType: {},
    // Por mob
    mobsKilledByType: {},
    // Itens
    itemsUsed: {},
    itemsBroken: {},
  };
}

export function serializeStats(stats) {
  if (!stats) return '{}';
  return JSON.stringify(stats);
}

export function deserializeStats(str) {
  try {
    const obj = JSON.parse(str);
    return { ...createStats(), ...obj };
  } catch { return createStats(); }
}

export function addStat(stats, key, amount = 1) {
  if (!stats) return;
  stats[key] = (stats[key] || 0) + amount;
}

export function addStatByType(stats, mapKey, type, amount = 1) {
  if (!stats) return;
  if (!stats[mapKey]) stats[mapKey] = {};
  stats[mapKey][type] = (stats[mapKey][type] || 0) + amount;
}