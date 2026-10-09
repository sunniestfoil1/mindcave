// Simulação de fluidos — água e lava corrente (PRD 02 RF-030/031/032)
import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL } from './constants';
import { chunkCoord, localCoord, chunkIndex, packState, stateId, chunkKey } from './chunk';
import { getBlock, isWater, isLava, isFluid, isReplaceable, lightEmission } from './blocks';

const WATER_TICK = 5;
const LAVA_TICK = 30;
const MAX_FLOW = 7;

// Retorna o nível de fluido de um estado (0 = fonte, 1-7 = corrente, 8 = queda)
export function fluidLevel(state) {
  const id = stateId(state);
  if (id === 9 || id === 11) return 0; // fonte parada
  if (id === 8 || id === 10) {
    const m = state & 0xf;
    return m || 1;
  }
  return -1;
}

export function isFluidSource(state) {
  const id = stateId(state);
  return id === 9 || id === 11;
}

export function fluidType(state) {
  const id = stateId(state);
  if (isWater(id)) return 'water';
  if (isLava(id)) return 'lava';
  return null;
}

// Altura visual do fluido (0-1)
export function fluidHeight(state) {
  const lvl = fluidLevel(state);
  if (lvl < 0) return 0;
  if (lvl === 0) return 1.0;
  return Math.max(0, (MAX_FLOW - lvl + 1) / MAX_FLOW);
}

// Tick principal de fluidos — chamado a cada tick do motor (com raio ativo em volta do jogador)
export function tickFluids(world, tickCount, playerPos) {
  if (tickCount % WATER_TICK !== 0) return; // água a cada 5 ticks

  const pcx = playerPos ? chunkCoord(playerPos.x) : 0;
  const pcz = playerPos ? chunkCoord(playerPos.z) : 0;
  const activeRadius = 4; // Apenas chunks ativas num raio de 4 (64 blocos)

  const updates = [];
  for (let cx = pcx - activeRadius; cx <= pcx + activeRadius; cx++) {
    for (let cz = pcz - activeRadius; cz <= pcz + activeRadius; cz++) {
      const chunk = world.chunks.get(chunkKey(cx, cz));
      if (!chunk) continue;
      const { data, baseX, baseZ, secCount } = chunk;
      for (let sy = 0; sy < 16; sy++) {
        if (!secCount[sy]) continue; // Pula seções sem blocos instantaneamente
        const yStart = sy * 16;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            for (let ly = 0; ly < 16; ly++) {
              const y = yStart + ly;
              const s = data[chunkIndex(lx, y, lz)];
              const id = stateId(s);
              if (!isFluid(id)) continue;
              // Pula água/lava estática (fontes apoiadas por outro bloco não se movem)
              const belowState = data[chunkIndex(lx, Math.max(0, y - 1), lz)];
              const belowId = stateId(belowState);
              if ((id === 9 || id === 11) && (belowId !== 0 && !isReplaceable(belowId))) continue;
              updates.push({ x: baseX + lx, y, z: baseZ + lz, state: s });
            }
          }
        }
      }
    }
  }

  for (const u of updates) {
    processFluidBlock(world, u.x, u.y, u.z, u.state, tickCount);
  }
}

function processFluidBlock(world, x, y, z, state, tickCount) {
  const type = fluidType(state);
  if (!type) return;

  // Lava ticka mais devagar
  if (type === 'lava' && tickCount % LAVA_TICK !== 0) return;

  const isSource = isFluidSource(state);
  const level = fluidLevel(state);

  // Verifica interação água+lava
  if (checkLavaWaterInteraction(world, x, y, z, type)) return;

  // Se é queda (level 8 = meta especial), não processa fluxo horizontal
  if (level === 8) return;

  // 1. Flui para baixo primeiro
  const below = world.getBlock(x, y - 1, z);
  const belowId = stateId(below);
  if (belowId === 0 || isReplaceable(belowId) || isFluid(belowId)) {
    if (belowId === 0 || isReplaceable(belowId) || (isFluid(belowId) && fluidType(below) !== type)) {
      // Cai como queda (level 8 = visual full block caindo)
      if (type === 'water') {
        world.setBlock(x, y - 1, z, packState(8, 8));
      } else {
        world.setBlock(x, y - 1, z, packState(10, 8));
      }
      return;
    }
  }

  // 2. Espalha horizontalmente se não é queda
  if (isSource || level < MAX_FLOW) {
    const newLevel = isSource ? 1 : level + 1;
    if (newLevel > MAX_FLOW) return;

    const flowingId = type === 'water' ? 8 : 10;
    const sourceId = type === 'water' ? 9 : 11;

    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      const ns = world.getBlock(nx, y, nz);
      const nid = stateId(ns);
      if (nid === 0 || isReplaceable(nid)) {
        world.setBlock(nx, y, nz, packState(flowingId, newLevel));
      }
    }
  }

  // 3. Fonte infinita de água
  if (type === 'water' && !isSource) {
    checkInfiniteWaterSource(world, x, y, z);
  }

  // 4. Seca corrente sem fonte
  if (!isSource && type === 'water') {
    checkDryUp(world, x, y, z);
  }
}

function checkInfiniteWaterSource(world, x, y, z) {
  // Se tem 2+ fontes horizontais adjacentes e bloco sólido/fonte embaixo → vira fonte
  const below = world.getBlock(x, y - 1, z);
  const belowId = stateId(below);
  if (!getBlock(belowId).solid && !isFluidSource(below)) return;

  let sourceCount = 0;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ns = world.getBlock(x + dx, y, z + dz);
    if (isFluidSource(ns) && fluidType(ns) === 'water') sourceCount++;
  }
  if (sourceCount >= 2) {
    world.setBlock(x, y, z, packState(9, 0));
  }
}

function checkDryUp(world, x, y, z) {
  // Se não tem fonte ou corrente adjacente de nível menor, seca
  const state = world.getBlock(x, y, z);
  const level = fluidLevel(state);
  if (level <= 0 || level >= 8) return;

  let hasFeeder = false;
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const ns = world.getBlock(x + dx, y + dy, z + dz);
    if (!isFluid(stateId(ns))) continue;
    if (fluidType(ns) !== 'water') continue;
    const nl = fluidLevel(ns);
    if (isFluidSource(ns) || (nl >= 0 && nl < level)) { hasFeeder = true; break; }
  }
  if (!hasFeeder) {
    world.setBlock(x, y, z, 0);
  }
}

function checkLavaWaterInteraction(world, x, y, z, type) {
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
    const ns = world.getBlock(x + dx, y + dy, z + dz);
    const nid = stateId(ns);
    const otherType = fluidType(ns);
    if (!otherType || otherType === type) continue;

    // Lava + água
    if (type === 'lava' || type === 'water') {
      const lavaState = type === 'lava' ? world.getBlock(x, y, z) : ns;
      const isLavaSource = isFluidSource(lavaState);
      const lavaY = type === 'lava' ? y : y + dy;

      // Lava fonte tocada por água → obsidiana
      if (isLavaSource) {
        world.setBlock(type === 'lava' ? x : x + dx, lavaY, type === 'lava' ? z : z + dz, packState(49, 0));
      } else {
        // Lava corrente tocada por água → pedregulho (ou pedra se lava acima de água)
        if (dy < 0 && type === 'water') {
          world.setBlock(x + dx, y + dy, z + dz, packState(1, 0)); // pedra
        } else {
          world.setBlock(type === 'lava' ? x : x + dx, lavaY, type === 'lava' ? z : z + dz, packState(4, 0));
        }
      }
      return true;
    }
  }
  return false;
}

// Verifica se o jogador está submerso num fluido
export function getFluidAtEye(world, x, y, z) {
  const s = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
  const id = stateId(s);
  if (isWater(id)) return 'water';
  if (isLava(id)) return 'lava';
  return null;
}