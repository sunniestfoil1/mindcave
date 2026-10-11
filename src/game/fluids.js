// Simulação de fluidos — água e lava corrente (PRD 02 RF-030/031/032)
import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL } from './constants';
import { chunkCoord, localCoord, chunkIndex, packState, stateId, chunkKey } from './chunk';
import { getBlock, isWater, isLava, isFluid, isReplaceable, lightEmission } from './blocks';

const WATER_TICK = 5;
const LAVA_TICK = 30;
const MAX_FLOW = 7;
const PROCESS_BUDGET_MS = 6;
const COLD_CHUNKS_PER_RUN = 3; // primeira varredura de chunks novos é espalhada (varrer 80 de uma vez trava ~150 ms)

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

// Alvo de fluxo: ar ou bloco substituível que não seja fluido. Fluido também é "replaceable" no registro,
// mas uma fonte nunca pode sobrescrever a água ao redor (inundava o oceano inteiro com água corrente).
function canFlowInto(id) { return id === 0 || (isReplaceable(id) && !isFluid(id)); }

// Id do vizinho (lx/lz podem sair do chunk em ±1; fora dele consulta o mundo)
function neighborId(world, data, baseX, baseZ, lx, y, lz) {
  if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && y >= 0 && y < WORLD_HEIGHT) {
    return stateId(data[chunkIndex(lx, y, lz)]);
  }
  return stateId(world.getBlock(baseX + lx, y, baseZ + lz));
}

// Fonte ou queda sem nada a fazer: nenhum vizinho em que possa fluir e nenhum fluido de outro tipo encostado
// (processFluidBlock só faz isso com esses dois tipos de célula). Evita processar o oceano inteiro a cada 5 ticks.
function isSettled(world, data, baseX, baseZ, lx, y, lz, id, isSource, checkInteraction) {
  const water = isWater(id);
  for (let i = 0; i < 6; i++) {
    const dx = i === 0 ? 1 : i === 1 ? -1 : 0;
    const dy = i === 2 ? 1 : i === 3 ? -1 : 0;
    const dz = i === 4 ? 1 : i === 5 ? -1 : 0;
    const nid = neighborId(world, data, baseX, baseZ, lx + dx, y + dy, lz + dz);
    if (checkInteraction && isFluid(nid) && isWater(nid) !== water) return false;
    if (isSource && dy <= 0 && canFlowInto(nid)) return false; // lados e embaixo recebem fluxo; acima não
  }
  return true;
}

// Há lava (corrente ou fonte) no chunk? Cache por versão do chunk: varre os 65 mil blocos só quando ele muda.
const lavaCache = new WeakMap();
function chunkHasLava(chunk) {
  const c = lavaCache.get(chunk);
  if (c && c.ver === chunk.ver) return c.has;
  let has = false;
  const d = chunk.data;
  for (let i = 0; i < d.length; i++) {
    const id = (d[i] >> 4) & 0xfff;
    if (id === 10 || id === 11) { has = true; break; }
  }
  lavaCache.set(chunk, { ver: chunk.ver, has });
  return has;
}
function lavaNear(world, cx, cz) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const ch = world.chunks.get(chunkKey(cx + dx, cz + dz));
      if (ch && chunkHasLava(ch)) return true;
    }
  }
  return false;
}

// Chunk parado: a vizinhança 3×3 não mudou desde a última varredura e ela não achou célula ativa.
// A simulação só lê o próprio chunk e os 8 vizinhos, então o resultado seria idêntico (nada a fazer).
const scanState = new WeakMap();
function neighborhoodSig(world, cx, cz) {
  let sig = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const ch = world.chunks.get(chunkKey(cx + dx, cz + dz));
      if (ch) sig += ch.ver + 1; // vizinho carregado também muda a assinatura
    }
  }
  return sig;
}

// Tick principal de fluidos — chamado a CADA tick do motor (raio ativo em volta do jogador).
// Cada chunk roda 1 vez a cada WATER_TICK ticks (mesma cadência de antes), mas em fases diferentes:
// o trabalho se espalha pelos 5 ticks em vez de cair todo no mesmo quadro.
export function tickFluids(world, tickCount, playerPos) {
  const phase = tickCount % WATER_TICK;
  const simTick = tickCount - phase; // múltiplo de 5: a lava (a cada 30) continua contando por chunk

  const pcx = playerPos ? chunkCoord(playerPos.x) : 0;
  const pcz = playerPos ? chunkCoord(playerPos.z) : 0;
  const activeRadius = 4; // Apenas chunks ativas num raio de 4 (64 blocos)

  const updates = [];
  let cold = 0;
  for (let cx = pcx - activeRadius; cx <= pcx + activeRadius; cx++) {
    for (let cz = pcz - activeRadius; cz <= pcz + activeRadius; cz++) {
      if ((((cx + 2 * cz) % WATER_TICK) + WATER_TICK) % WATER_TICK !== phase) continue;
      const chunk = world.chunks.get(chunkKey(cx, cz));
      if (!chunk) continue;
      const sig = neighborhoodSig(world, cx, cz);
      const prev = scanState.get(chunk);
      if (prev && prev.sig === sig && prev.active === 0) continue;
      if (!prev && ++cold > COLD_CHUNKS_PER_RUN) continue;
      const activeBefore = updates.length;
      const { data, baseX, baseZ, secCount } = chunk;
      const lava = lavaNear(world, cx, cz);
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
              const isSource = id === 9 || id === 11;
              if (isSource && (belowId !== 0 && !isReplaceable(belowId))) continue;
              if (isSource || (s & 0xf) === 8) {
                const checkInteraction = lava || !isWater(id); // água sem lava por perto não interage com nada
                if (!isSource && !checkInteraction) continue;  // queda de água: só interage
                if (isSettled(world, data, baseX, baseZ, lx, y, lz, id, isSource, checkInteraction)) continue;
              }
              updates.push({ x: baseX + lx, y, z: baseZ + lz, state: s });
            }
          }
        }
      }
      scanState.set(chunk, { sig, active: updates.length - activeBefore });
    }
  }

  // Orçamento por tick: o que sobrar fica ativo e é reprocessado no próximo ciclo desse chunk
  const t0 = performance.now();
  for (const u of updates) {
    processFluidBlock(world, u.x, u.y, u.z, u.state, simTick);
    if (performance.now() - t0 > PROCESS_BUDGET_MS) break;
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
  if (canFlowInto(belowId) || (isFluid(belowId) && fluidType(below) !== type)) {
    // Cai como queda (level 8 = visual full block caindo)
    if (type === 'water') {
      world.setBlock(x, y - 1, z, packState(8, 8));
    } else {
      world.setBlock(x, y - 1, z, packState(10, 8));
    }
    return;
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
      if (canFlowInto(nid)) {
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