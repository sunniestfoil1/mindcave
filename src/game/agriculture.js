// Sistema de agricultura — PRD 11 §3
import { stateId, stateMeta, packState } from './chunk';
import { getBlock, isWater, isSolid } from './blocks';

const FARMLAND = 60, WHEAT = 59, CARROT = 141, POTATO = 142;
const PUMPKIN_STEM = 104, MELON_STEM = 105, NETHER_WART = 115;
const SUGARCANE = 83, CACTUS = 81;
const DIRT = 3, GRASS = 2, SAND = 12;

// Verifica se há água num raio de 4 blocos (mesmo nível ou 1 acima)
export function isFarmlandHydrated(world, x, y, z) {
  for (let dx = -4; dx <= 4; dx++) {
    for (let dz = -4; dz <= 4; dz++) {
      for (let dy = 0; dy <= 1; dy++) {
        if (isWater(stateId(world.getBlock(x + dx, y + dy, z + dz)))) return true;
      }
    }
  }
  return false;
}

// Tick de bloco agrícola (chamado por random tick)
export function tickAgriculture(world, x, y, z, worldTime) {
  const state = world.getBlock(x, y, z);
  const id = stateId(state);
  const meta = stateMeta(state);

  switch (id) {
    case FARMLAND: tickFarmland(world, x, y, z, meta); break;
    case WHEAT: tickCrop(world, x, y, z, meta, WHEAT); break;
    case CARROT: tickCrop(world, x, y, z, meta, CARROT); break;
    case POTATO: tickCrop(world, x, y, z, meta, POTATO); break;
    case PUMPKIN_STEM: tickStem(world, x, y, z, meta, 'pumpkin'); break;
    case MELON_STEM: tickStem(world, x, y, z, meta, 'melon'); break;
    case NETHER_WART: tickNetherWart(world, x, y, z, meta); break;
    case SUGARCANE: tickSugarcane(world, x, y, z); break;
    case CACTUS: tickCactus(world, x, y, z); break;
  }
}

function getLightLevel(world, x, y, z) {
  const light = world.getLight(x, y, z);
  return Math.max(light.sky, light.block);
}

// Terra arada: hidrata ou reverte para terra
function tickFarmland(world, x, y, z, meta) {
  const hydrated = isFarmlandHydrated(world, x, y, z);
  const cropAbove = stateId(world.getBlock(x, y + 1, z));

  if (!hydrated && cropAbove !== WHEAT && cropAbove !== CARROT && cropAbove !== POTATO &&
      cropAbove !== PUMPKIN_STEM && cropAbove !== MELON_STEM) {
    // Sem água e sem plantação → vira terra (chance aleatória)
    if (Math.random() < 0.02) {
      world.setBlock(x, y, z, packState(DIRT, 0));
    }
  }

  // Atualiza meta de hidratação (0 = seco, 7 = hidratado)
  const newMeta = hydrated ? 7 : 0;
  if (newMeta !== meta) {
    world.setBlock(x, y, z, packState(FARMLAND, newMeta));
  }
}

// Plantação genérica (trigo/cenoura/batata): 8 estágios (0-7)
function tickCrop(world, x, y, z, meta, cropId) {
  if (meta >= 7) return; // Madura

  const light = getLightLevel(world, x, y + 1, z);
  if (light < 9) return;

  // Verifica se a terra abaixo é arada
  const below = stateId(world.getBlock(x, y - 1, z));
  if (below !== FARMLAND) {
    world.setBlock(x, y, z, 0); // Quebra se a terra sumir
    return;
  }

  const hydrated = isFarmlandHydrated(world, x, y - 1, z);

  // Chance de crescimento baseada em hidratação e vizinhos
  let chance = hydrated ? 0.04 : 0.02;

  // Bônus por fileiras alternadas (verifica vizinhos nas laterais)
  let neighborCrops = 0;
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    if (stateId(world.getBlock(x+dx, y, z+dz)) === cropId) neighborCrops++;
  }
  // Fileiras alternadas crescem mais rápido
  if (neighborCrops <= 2) chance *= 1.5;
  else chance *= 0.6;

  if (Math.random() < chance) {
    world.setBlock(x, y, z, packState(cropId, meta + 1));
  }
}

// Caule de abóbora/melancia
function tickStem(world, x, y, z, meta, type) {
  if (meta >= 7) {
    // Maduro — tenta gerar fruto num bloco livre adjacente
    const fruitBlock = type === 'pumpkin' ? 86 : 103;
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const fx = x + dx, fz = z + dz;
      const groundState = world.getBlock(fx, y - 1, fz);
      const groundId = stateId(groundState);
      if (groundId === FARMLAND || groundId === DIRT || groundId === GRASS) {
        const fruitState = world.getBlock(fx, y, fz);
        if (stateId(fruitState) === 0) {
          world.setBlock(fx, y, fz, packState(fruitBlock, 0));
          break;
        }
      }
    }
    return;
  }

  const light = getLightLevel(world, x, y + 1, z);
  if (light < 9) return;

  const below = stateId(world.getBlock(x, y - 1, z));
  if (below !== FARMLAND) { world.setBlock(x, y, z, 0); return; }

  if (Math.random() < 0.03) {
    world.setBlock(x, y, z, packState(type === 'pumpkin' ? PUMPKIN_STEM : MELON_STEM, meta + 1));
  }
}

// Verruga do Nether: 4 estágios, sem exigência de luz
function tickNetherWart(world, x, y, z, meta) {
  if (meta >= 3) return;
  const below = stateId(world.getBlock(x, y - 1, z));
  if (below !== 88) { world.setBlock(x, y, z, 0); return; } // Areia das almas
  if (Math.random() < 0.02) {
    world.setBlock(x, y, z, packState(NETHER_WART, meta + 1));
  }
}

// Cana-de-açúcar: cresce até 3 de altura
function tickSugarcane(world, x, y, z) {
  // Verifica base
  if (stateId(world.getBlock(x, y - 1, z)) !== SUGARCANE) {
    // É a base — verifica se pode crescer para cima
    if (stateId(world.getBlock(x, y + 1, z)) !== 0) return;
    // Conta altura
    let height = 1;
    for (let dy = 2; dy <= 3; dy++) {
      if (stateId(world.getBlock(x, y + dy - 1, z)) === SUGARCANE) height++;
    }
    if (height >= 3) return;
    // Verifica água adjacente na base
    let hasWater = false;
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      if (isWater(stateId(world.getBlock(x+dx, y-1, z+dz)))) { hasWater = true; break; }
    }
    if (!hasWater) return;
    if (Math.random() < 0.03) {
      world.setBlock(x, y + 1, z, packState(SUGARCANE, 0));
    }
  }
}

// Cacto: cresce até 3, quebra se houver bloco ao lado
function tickCactus(world, x, y, z) {
  // Quebra se há bloco sólido adjacente
  for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const adj = stateId(world.getBlock(x+dx, y, z+dz));
    if (adj !== 0 && adj !== CACTUS) {
      world.setBlock(x, y, z, 0);
      return;
    }
  }
  // Só a base cresce
  if (stateId(world.getBlock(x, y - 1, z)) !== CACTUS && stateId(world.getBlock(x, y - 1, z)) !== SAND) return;
  if (stateId(world.getBlock(x, y - 1, z)) === CACTUS) return; // não é a base
  if (stateId(world.getBlock(x, y + 1, z)) !== 0) return;

  let height = 1;
  for (let dy = 0; dy < 3; dy++) {
    if (stateId(world.getBlock(x, y - dy, z)) === CACTUS) height++;
  }
  if (height >= 3) return;
  if (Math.random() < 0.02) {
    world.setBlock(x, y + 1, z, packState(CACTUS, 0));
  }
}

// Farinha de osso: acelera crescimento (retorna true se aplicou)
export function applyBonemeal(world, x, y, z) {
  const state = world.getBlock(x, y, z);
  const id = stateId(state);
  const meta = stateMeta(state);

  if (id === WHEAT || id === CARROT || id === POTATO) {
    if (meta < 7) {
      const growth = 2 + Math.floor(Math.random() * 3); // 2-5 estágios
      world.setBlock(x, y, z, packState(id, Math.min(7, meta + growth)));
      return true;
    }
  } else if (id === PUMPKIN_STEM || id === MELON_STEM) {
    if (meta < 7) {
      world.setBlock(x, y, z, packState(id, Math.min(7, meta + 2 + Math.floor(Math.random() * 3))));
      return true;
    }
  } else if (id === NETHER_WART) {
    if (meta < 3) {
      world.setBlock(x, y, z, packState(id, Math.min(3, meta + 1)));
      return true;
    }
  } else if (id === GRASS) {
    // Gera grama alta e flores em volta
    for (let dx = -4; dx <= 4; dx++) {
      for (let dz = -4; dz <= 4; dz++) {
        if (Math.random() > 0.3) continue;
        const tx = x + dx, tz = z + dz;
        if (stateId(world.getBlock(tx, y, tz)) === GRASS && stateId(world.getBlock(tx, y + 1, tz)) === 0) {
          if (Math.random() < 0.5) {
            world.setBlock(tx, y + 1, tz, packState(31, 1)); // grama alta
          } else if (Math.random() < 0.3) {
            world.setBlock(tx, y + 1, tz, packState(37, 0)); // flor
          }
        }
      }
    }
    return true;
  }
  return false;
}

// Pisoteio: transforma terra arada em terra
export function trampleFarmland(world, x, y, z) {
  if (stateId(world.getBlock(x, y, z)) === FARMLAND) {
    world.setBlock(x, y, z, packState(DIRT, 0));
    return true;
  }
  return false;
}

// Colheita: retorna drops
export function harvestCrop(world, x, y, z) {
  const state = world.getBlock(x, y, z);
  const id = stateId(state);
  const meta = stateMeta(state);
  const drops = [];

  if (id === WHEAT && meta === 7) {
    drops.push({ id: 296, count: 1 }); // trigo
    const seeds = Math.floor(Math.random() * 4);
    if (seeds > 0) drops.push({ id: 295, count: seeds });
  } else if (id === CARROT && meta === 7) {
    drops.push({ id: 391, count: 1 + Math.floor(Math.random() * 4) });
  } else if (id === POTATO && meta === 7) {
    drops.push({ id: 392, count: 1 + Math.floor(Math.random() * 4) });
    if (Math.random() < 0.02) drops.push({ id: 394, count: 1 }); // batata venenosa
  } else if (id === NETHER_WART && meta === 3) {
    drops.push({ id: 372, count: 2 + Math.floor(Math.random() * 3) });
  } else {
    // Não maduro — dropa sementes
    if (id === WHEAT) drops.push({ id: 295, count: 1 });
  }

  world.setBlock(x, y, z, 0);
  return drops;
}