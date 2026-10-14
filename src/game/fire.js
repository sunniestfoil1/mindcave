// Fogo: espalhamento, queima de blocos, entidades em chamas — PRD 05 RF-090
import { CHUNK_SIZE, WORLD_HEIGHT } from './constants';
import { chunkIndex, stateId, packState } from './chunk';
import { getBlock, isSolid, isReplaceable } from './blocks';

// Flammability: { encouragement, flammability } — chance de pegar fogo / chance de queimar
export const FLAMMABILITY = {
  5: { enc: 5, flam: 20 },     // tábuas
  17: { enc: 5, flam: 5 },    // tronco
  162: { enc: 5, flam: 5 },   // tronco2 (acácia)
  18: { enc: 30, flam: 60 },  // folhas
  161: { enc: 30, flam: 60 }, // folhas2
  47: { enc: 30, flam: 20 },  // estante
  35: { enc: 30, flam: 60 },  // lã
  46: { enc: 15, flam: 100 }, // TNT (detona)
  31: { enc: 60, flam: 100 }, // grama alta
  106: { enc: 15, flam: 100 },// trepadeira
  173: { enc: 5, flam: 5 },   // bloco de carvão
  170: { enc: 60, flam: 20 }, // fardo de feno
  171: { enc: 60, flam: 20 }, // tapete
  87: { enc: 0, flam: 0 },    // netherrack (fogo infinito, não queima)
  86: { enc: 30, flam: 60 },  // abóbora
  103: { enc: 30, flam: 60 }, // melancia
};

const FIRE_TICK_INTERVAL = 30;
const fireCache = new WeakMap();

function scanChunkFires(chunk) {
  const { data, secCount } = chunk;
  const list = [];
  for (let sy = 0; sy < WORLD_HEIGHT / 16; sy++) {
    if (secCount && !secCount[sy]) continue; // seção vazia
    for (let x = 0; x < CHUNK_SIZE; x++) for (let z = 0; z < CHUNK_SIZE; z++) for (let y = sy * 16; y < sy * 16 + 16; y++) {
      if (stateId(data[chunkIndex(x, y, z)]) === 51) list.push(x, y, z);
    }
  }
  return { ver: chunk.ver, list };
}

// Tick de fogo — processa blocos de fogo carregados
export function tickFire(world, tickCount, weather, gameRules) {
  if (gameRules.doFireTick === false) return;
  if (tickCount % FIRE_TICK_INTERVAL !== 0) return;

  // Antes: varria todas as células de todos os chunks carregados a cada 30 ticks (dezenas de milhões de leituras = pico de ~50 ms).
  // Agora cada chunk guarda a lista de fogos da última varredura e só é varrido de novo quando muda (chunk.ver);
  // varreduras novas são limitadas por chamada, espalhando o custo inicial.
  const updates = [];
  let budget = 8;
  for (const chunk of world.chunks.values()) {
    let c = fireCache.get(chunk);
    if (!c || c.ver !== chunk.ver) {
      if (budget <= 0 && c) { /* usa a lista antiga; cada fogo é revalidado abaixo */ }
      else if (budget <= 0) continue;
      else { budget--; c = scanChunkFires(chunk); fireCache.set(chunk, c); }
    }
    const l = c.list;
    for (let k = 0; k < l.length; k += 3) updates.push({ x: chunk.baseX + l[k], y: l[k + 1], z: chunk.baseZ + l[k + 2] });
  }

  for (const f of updates) {
    if (stateId(world.getBlock(f.x, f.y, f.z)) !== 51) continue; // lista pode estar desatualizada
    processFireBlock(world, f.x, f.y, f.z, tickCount, weather, gameRules);
  }
}

function processFireBlock(world, x, y, z, tickCount, weather, gameRules) {
  const belowState = world.getBlock(x, y - 1, z);
  const belowId = stateId(belowState);
  const belowBlock = getBlock(belowId);

  // Netherrack: fogo infinito
  if (belowId === 87) return;

  // Chuva apaga fogo exposto
  if (weather && weather.isRainingAt(x, z, world) && isExposedToSky(world, x, y, z)) {
    world.setBlock(x, y, z, 0);
    return;
  }

  // Precisa de bloco sólido abaixo ou bloco inflamável adjacente
  const hasSolidBelow = belowBlock.solid;
  const hasFlammableNeighbor = checkFlammableNeighbors(world, x, y, z, false);
  if (!hasSolidBelow && !hasFlammableNeighbor) {
    world.setBlock(x, y, z, 0);
    return;
  }

  // Idade do fogo (meta 0-15)
  const fireState = world.getBlock(x, y, z);
  const age = fireState & 0xf;
  if (age < 15) {
    world.setBlock(x, y, z, packState(51, age + 1));
  }

  // Chance de apagar
  if (!hasFlammableNeighbor && age >= 3 && Math.random() < 0.25) {
    world.setBlock(x, y, z, 0);
    return;
  }

  // Espalhar fogo
  if (Math.random() < 0.3) {
    spreadFire(world, x, y, z, weather);
  }
}

function isExposedToSky(world, x, y, z) {
  for (let yy = y + 1; yy < WORLD_HEIGHT; yy++) {
    if (isSolid(world.getBlock(x, yy, z))) return false;
  }
  return true;
}

function checkFlammableNeighbors(world, x, y, z, ignite) {
  let found = false;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 4; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        const id = stateId(world.getBlock(x + dx, y + dy, z + dz));
        const f = FLAMMABILITY[id];
        if (!f) continue;
        found = true;
        if (ignite && Math.random() < f.enc / 100) {
          // Coloca fogo no bloco de ar adjacente
          const airX = x + dx, airY = y + dy, airZ = z + dz;
          const airState = world.getBlock(airX, airY, airZ);
          if (stateId(airState) === 0) {
            world.setBlock(airX, airY, airZ, packState(51, 0));
          }
        }
      }
    }
  }
  return found;
}

function spreadFire(world, x, y, z, weather) {
  // Tenta acender blocos de ar vizinhos
  checkFlammableNeighbors(world, x, y, z, true);

  // Queima blocos inflamáveis adjacentes
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 4; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        const nx = x + dx, ny = y + dy, nz = z + dz;
        const id = stateId(world.getBlock(nx, ny, nz));
        const f = FLAMMABILITY[id];
        if (!f) continue;
        if (Math.random() < f.flam / 100) {
          if (id === 46) {
            // TNT detona (simplificado: explode)
            world.setBlock(nx, ny, nz, 0);
            // TODO: explosão real (PRD 07)
          } else {
            world.setBlock(nx, ny, nz, 0);
          }
        }
      }
    }
  }
}

// Acende uma entidade
export function igniteEntity(p, ticks = 160) {
  p.fireTicks = Math.max(p.fireTicks, ticks);
}

// Verifica se o jogador está pisando em fogo
export function isOnFireBlock(world, x, y, z) {
  return stateId(world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))) === 51;
}