// Fogo: porte do BlockFire do 1.8.9 (updateTick, catchOnFire, getNeighborEncouragement, canPlaceBlockAt) — idade 0–15 na meta.
// Cada fogo tem o próprio relógio: acorda 30 + rand(10) ticks depois de nascer e a cada passagem se reagenda. Não existe "tudo queima de uma vez":
// um bloco só vira fogo (ou some) quando o sorteio dele sai, e só se estiver colado num fogo (6 faces) ou dentro do alcance de espalhar.
import { CHUNK_SIZE, WORLD_HEIGHT } from './constants';
import { chunkIndex, stateId, packState } from './chunk';
import { getBlock } from './blocks';

export const FIRE = 51;

// setFireInfo(bloco, encouragement, flammability) do 1.8.9: encouragement = o quanto atrai fogo para o ar vizinho; flammability = chance de queimar
const T = (enc, flam, ids) => ids.map((id) => [id, { enc, flam }]);
export const FLAMMABILITY = Object.fromEntries([
  ...T(5, 20, [5, 125, 126, 53, 134, 135, 136, 163, 164, 107, 183, 184, 185, 186, 187, 85, 188, 189, 190, 191, 192]),   // tábuas, lajes, escadas, portões e cercas de madeira
  ...T(5, 5, [17, 162, 173]),                 // troncos e bloco de carvão
  ...T(30, 60, [18, 161, 35]),                // folhas e lã
  ...T(30, 20, [47]),                         // estante
  ...T(15, 100, [46, 106]),                   // TNT e trepadeira
  ...T(60, 100, [31, 32, 37, 38, 175]),       // grama alta, arbusto morto, flores, plantas altas
  ...T(60, 20, [170, 171]),                   // fardo de feno e tapete
]);
const flam = (id) => (FLAMMABILITY[id] ? FLAMMABILITY[id].flam : 0);
const enc = (id) => (FLAMMABILITY[id] ? FLAMMABILITY[id].enc : 0);

const DIFFICULTY_ID = { peaceful: 0, easy: 1, normal: 2, hard: 3 };
const TICK_RATE = 30;
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]];

const fireCache = new WeakMap();
const dueByWorld = new WeakMap();   // por mundo: "x,y,z" → tick em que o fogo acorda de novo

function scanChunkFires(chunk) {
  const { data, secCount } = chunk;
  const list = [];
  for (let sy = 0; sy < WORLD_HEIGHT / 16; sy++) {
    if (secCount && !secCount[sy]) continue;
    for (let x = 0; x < CHUNK_SIZE; x++) for (let z = 0; z < CHUNK_SIZE; z++) for (let y = sy * 16; y < sy * 16 + 16; y++) {
      if (stateId(data[chunkIndex(x, y, z)]) === FIRE) list.push(x, y, z);
    }
  }
  return { ver: chunk.ver, list };
}

// World.doesBlockHaveSolidTopSurface
const solidTop = (world, x, y, z) => { const b = getBlock(stateId(world.getBlock(x, y, z))); return !!b && b.solid && (b.opaque || b.model === 'slab' || b.model === 'stairs' || b.model === 'fence'); };
export const canCatchFireAt = (world, x, y, z) => flam(stateId(world.getBlock(x, y, z))) > 0;
export const canNeighborCatchFire = (world, x, y, z) => DIRS.some(([dx, dy, dz]) => canCatchFireAt(world, x + dx, y + dy, z + dz));
// BlockFire.canPlaceBlockAt: chão sólido embaixo ou alguma face vizinha inflamável
export const canPlaceFire = (world, x, y, z) => solidTop(world, x, y - 1, z) || canNeighborCatchFire(world, x, y, z);

// Quais lados mostram chama colada no vizinho (BlockFire.getActualState): só quando não há chão sólido nem inflamável embaixo
export function fireSides(world, x, y, z) {
  if (solidTop(world, x, y - 1, z) || canCatchFireAt(world, x, y - 1, z)) return { n: false, s: false, e: false, w: false, up: false };
  return {
    n: canCatchFireAt(world, x, y, z - 1), s: canCatchFireAt(world, x, y, z + 1),
    e: canCatchFireAt(world, x + 1, y, z), w: canCatchFireAt(world, x - 1, y, z),
    up: canCatchFireAt(world, x, y + 1, z),
  };
}

// canDie: chuva em cima do fogo ou ao lado dele
function canDie(world, weather, x, y, z) {
  if (!weather || !weather.isRainingAt) return false;
  return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => weather.isRainingAt(x + dx, z + dz, world));
}

function neighborEncouragement(world, x, y, z) {
  if (stateId(world.getBlock(x, y, z)) !== 0) return 0;
  let m = 0;
  for (const [dx, dy, dz] of DIRS) m = Math.max(m, enc(stateId(world.getBlock(x + dx, y + dy, z + dz))));
  return m;
}

function catchOnFire(world, x, y, z, chance, rand, age, ctx) {
  const id = stateId(world.getBlock(x, y, z));
  const f = flam(id);
  if (!f || rand() * chance >= f) return;
  if (rand() * (age + 10) < 5 && !(ctx.weather && ctx.weather.isThundering && ctx.weather.isThundering())) {
    let j = age + Math.floor(rand() * 5 / 4);
    if (j > 15) j = 15;
    world.setBlock(x, y, z, packState(FIRE, j));
  } else {
    world.setBlock(x, y, z, 0);
  }
  if (id === 46 && world.onTntIgnite) world.onTntIgnite(x + 0.5, y + 0.5, z + 0.5);
}

// Um passo do fogo em (x, y, z): updateTick do 1.8.9
export function updateFire(world, x, y, z, ctx, rand = Math.random) {
  const state = world.getBlock(x, y, z);
  if (stateId(state) !== FIRE) return;
  if (!canPlaceFire(world, x, y, z)) { world.setBlock(x, y, z, 0); return; }
  const belowId = stateId(world.getBlock(x, y - 1, z));
  const eternal = belowId === 87;                                   // netherrack: o fogo nunca se apaga
  if (!eternal && canDie(world, ctx.weather, x, y, z)) { world.setBlock(x, y, z, 0); return; }
  const i = state & 15;
  if (i < 15) world.setBlock(x, y, z, packState(FIRE, i + Math.floor(rand() * 3 / 2)));   // rand(3) / 2: sobe 0 ou 1
  if (!eternal) {
    if (!canNeighborCatchFire(world, x, y, z)) {
      if (!solidTop(world, x, y - 1, z) || i > 3) world.setBlock(x, y, z, 0);
      return;
    }
    if (!canCatchFireAt(world, x, y - 1, z) && i === 15 && Math.floor(rand() * 4) === 0) { world.setBlock(x, y, z, 0); return; }
  }
  // queima os seis vizinhos
  catchOnFire(world, x + 1, y, z, 300, rand, i, ctx); catchOnFire(world, x - 1, y, z, 300, rand, i, ctx);
  catchOnFire(world, x, y - 1, z, 250, rand, i, ctx); catchOnFire(world, x, y + 1, z, 250, rand, i, ctx);
  catchOnFire(world, x, y, z - 1, 300, rand, i, ctx); catchOnFire(world, x, y, z + 1, 300, rand, i, ctx);
  // espalha para o ar em volta (3×3 horizontal, de 1 abaixo até 4 acima): quanto mais acima, mais difícil
  const diff = DIFFICULTY_ID[ctx.difficulty] ?? 2;
  for (let k = -1; k <= 1; k++) for (let l = -1; l <= 1; l++) for (let h = -1; h <= 4; h++) {
    if (k === 0 && l === 0 && h === 0) continue;
    let j1 = 100;
    if (h > 1) j1 += (h - 1) * 100;
    const bx = x + k, by = y + h, bz = z + l;
    const e = neighborEncouragement(world, bx, by, bz);
    if (e <= 0) continue;
    const l1 = Math.floor((e + 40 + diff * 7) / (i + 30));
    if (l1 > 0 && Math.floor(rand() * j1) <= l1 && !canDie(world, ctx.weather, bx, by, bz)) {
      let i2 = i + Math.floor(rand() * 5 / 4);
      if (i2 > 15) i2 = 15;
      world.setBlock(bx, by, bz, packState(FIRE, i2));
    }
  }
}

// Tick de fogo (chamado a cada tick do motor): acorda só os fogos cujo relógio venceu
export function tickFire(world, tickCount, weather, gameRules, difficulty = 'normal', rand = Math.random) {
  if (gameRules && gameRules.doFireTick === false) return;
  let map = dueByWorld.get(world);
  if (!map) { map = new Map(); dueByWorld.set(world, map); }
  let budget = 8;
  const ctx = { weather, difficulty };
  const alive = [];
  for (const chunk of world.chunks.values()) {
    let c = fireCache.get(chunk);
    if (!c || c.ver !== chunk.ver) {
      if (!c && budget <= 0) continue;
      if (budget > 0) { budget--; c = scanChunkFires(chunk); fireCache.set(chunk, c); }
    }
    for (let k = 0; k < c.list.length; k += 3) alive.push([chunk.baseX + c.list[k], c.list[k + 1], chunk.baseZ + c.list[k + 2]]);
  }
  for (const [x, y, z] of alive) {
    if (stateId(world.getBlock(x, y, z)) !== FIRE) continue;
    const key = x + ',' + y + ',' + z;
    const t = map.get(key);
    if (t === undefined) {   // fogo novo (onBlockAdded): sem chão nem vizinho inflamável some na hora; senão agenda 30 + rand(10)
      if (!canPlaceFire(world, x, y, z)) { world.setBlock(x, y, z, 0); continue; }
      map.set(key, tickCount + TICK_RATE + Math.floor(rand() * 10));
      continue;
    }
    if (t > tickCount) continue;
    map.set(key, tickCount + TICK_RATE + Math.floor(rand() * 10));
    updateFire(world, x, y, z, ctx, rand);
  }
  if (map.size > 4096) for (const k of map.keys()) { const [x, y, z] = k.split(',').map(Number); if (stateId(world.getBlock(x, y, z)) !== FIRE) map.delete(k); }
}

// Fogos num raio (para o som ambiente e a fumaça)
export function firesNear(world, x, y, z, r) {
  const out = [];
  for (let cx = Math.floor((x - r) / 16); cx <= Math.floor((x + r) / 16); cx++) for (let cz = Math.floor((z - r) / 16); cz <= Math.floor((z + r) / 16); cz++) {
    const chunk = world.chunks.get(world.key ? world.key(cx, cz) : undefined);
    const c = chunk && fireCache.get(chunk);
    if (!c) continue;
    for (let k = 0; k < c.list.length; k += 3) {
      const fx = chunk.baseX + c.list[k], fy = c.list[k + 1], fz = chunk.baseZ + c.list[k + 2];
      if (Math.abs(fx - x) <= r && Math.abs(fy - y) <= r && Math.abs(fz - z) <= r) out.push([fx, fy, fz]);
    }
  }
  return out;
}

// Acende uma entidade
export function igniteEntity(p, ticks = 160) {
  p.fireTicks = Math.max(p.fireTicks, ticks);
}

// Verifica se o jogador está pisando em fogo
export function isOnFireBlock(world, x, y, z) {
  return stateId(world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))) === FIRE;
}

