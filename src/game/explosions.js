// Algoritmo de explosão de alta performance — Minecraft 1.8.9 (estilo Lithium / CM Client / Badlion)
import { stateId, packState } from './chunk';
import { getBlock, isWater } from './blocks';

const TNT = 46, FIRE = 51;

// Tabela oficial de resistência a explosões do Minecraft 1.8.9
export const VANILLA_BLAST_RESISTANCE = {
  0: 0.0,     // ar
  1: 30.0,    // pedra
  2: 2.5,     // grama
  3: 2.5,     // terra
  4: 30.0,    // pedregulho
  5: 15.0,    // tábuas
  7: 3600000, // bedrock
  8: 500.0,   // água corrente
  9: 500.0,   // água
  10: 500.0,  // lava corrente
  11: 500.0,  // lava
  12: 2.5,    // areia
  13: 2.5,    // cascalho
  14: 15.0,   // minério de ouro
  15: 15.0,   // minério de ferro
  16: 15.0,   // minério de carvão
  17: 10.0,   // tronco de carvalho
  18: 1.0,    // folhas
  19: 1.5,    // esponja
  20: 1.5,    // vidro
  21: 15.0,   // minério de lápis-lazúli
  22: 15.0,   // bloco de lápis-lazúli
  23: 17.5,   // ejetor
  24: 4.0,    // arenito
  25: 4.0,    // bloco musical
  26: 1.0,    // cama
  30: 20.0,   // teia de aranha
  35: 4.0,    // lã
  41: 30.0,   // bloco de ouro
  42: 30.0,   // bloco de ferro
  43: 30.0,   // laje dupla de pedra
  44: 30.0,   // laje de pedra
  45: 30.0,   // tijolos
  46: 0.0,    // tnt
  47: 7.5,    // estante
  48: 30.0,   // pedregulho musgoso
  49: 6000.0, // obsidiana
  50: 0.0,    // tocha
  51: 0.0,    // fogo
  53: 15.0,   // escada de carvalho
  54: 12.5,   // baú
  56: 15.0,   // minério de diamante
  57: 30.0,   // bloco de diamante
  58: 12.5,   // bancada de trabalho
  61: 17.5,   // fornalha
  62: 17.5,   // fornalha acesa
  64: 15.0,   // porta de madeira
  65: 2.0,    // escada de mão
  67: 30.0,   // escada de pedra
  71: 25.0,   // porta de ferro
  73: 15.0,   // minério de redstone
  74: 15.0,   // minério de redstone aceso
  79: 2.5,    // gelo
  80: 1.0,    // bloco de neve
  82: 3.0,    // argila
  85: 15.0,   // cerca
  86: 5.0,    // abóbora
  87: 2.0,    // netherrack
  88: 2.5,    // areia das almas
  89: 1.5,    // pedra luminosa
  91: 5.0,    // lanterna de abóbora
  98: 30.0,   // tijolos de pedra
  101: 25.0,  // barras de ferro
  102: 1.5,   // painel de vidro
  108: 30.0,  // escada de tijolo
  109: 30.0,  // escada de tijolos de pedra
  110: 2.5,   // micélio
  112: 30.0,  // tijolo do nether
  113: 30.0,  // cerca de tijolos do nether
  114: 30.0,  // escada de tijolos do nether
  121: 45.0,  // pedra do end
  128: 4.0,   // escada de arenito
  129: 15.0,  // minério de esmeralda
  130: 3000.0,// baú do end
  133: 30.0,  // bloco de esmeralda
  145: 6000.0,// bigorna
  152: 25.0,  // bloco de redstone
  153: 15.0,  // minério de quartzo
  155: 4.0,   // bloco de quartzo
  156: 4.0,   // escada de quartzo
  159: 21.0,  // argila tingida
  170: 2.5,   // fardo de feno
  172: 21.0,  // argila endurecida
  173: 25.0,  // bloco de carvão
  174: 2.5,   // gelo compactado
};

export function getBlockBlastResistance(id, block) {
  if (VANILLA_BLAST_RESISTANCE[id] !== undefined) return VANILLA_BLAST_RESISTANCE[id];
  if (block?.resistance !== undefined) return block.resistance;
  if (block?.hardness !== undefined) {
    if (block.hardness < 0) return 3600000;
    return block.hardness * 5.0;
  }
  return 1.0;
}

// 1. Pré-computa os 1.352 vetores unitários do cubo 16x16x16 uma única vez no carregamento
const FULL_RAYS = (() => {
  const dirs = [];
  const N = 15;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      for (let k = 0; k <= N; k++) {
        if (i === 0 || i === N || j === 0 || j === N || k === 0 || k === N) {
          const vx = (i / N) * 2 - 1;
          const vy = (j / N) * 2 - 1;
          const vz = (k / N) * 2 - 1;
          const len = Math.hypot(vx, vy, vz);
          if (len > 0.0001) {
            dirs.push(vx / len, vy / len, vz / len);
          }
        }
      }
    }
  }
  return new Float32Array(dirs);
})();

// Raios otimizados (passo 2 na borda) para reações em cadeia (> 4 TNTs no mesmo segundo)
const FAST_RAYS = (() => {
  const dirs = [];
  const N = 14;
  for (let i = 0; i <= N; i += 2) {
    for (let j = 0; j <= N; j += 2) {
      for (let k = 0; k <= N; k += 2) {
        if (i === 0 || i === N || j === 0 || j === N || k === 0 || k === N) {
          const vx = (i / N) * 2 - 1;
          const vy = (j / N) * 2 - 1;
          const vz = (k / N) * 2 - 1;
          const len = Math.hypot(vx, vy, vz);
          if (len > 0.0001) {
            dirs.push(vx / len, vy / len, vz / len);
          }
        }
      }
    }
  }
  return new Float32Array(dirs);
})();

// Buffer estático de visitação 64x64x64 em torno da explosão (zero alocação de memória / zero GC)
const VISIT_STAMP = new Uint32Array(64 * 64 * 64);
let _currentStamp = 1;
let _lastExplosionSoundMs = 0;
let _recentExplosionsCount = 0;
let _recentExplosionWindowMs = 0;

// Lista reutilizável de coordenadas atingidas [x0, y0, z0, x1, y1, z1, ...]
const _hitCoords = new Int32Array(16384 * 3);

// Throttling de áudio para evitar congelar o Web Audio se 30 TNTs estourarem juntas
export function canPlayExplosionSound() {
  const now = performance.now();
  if (now - _lastExplosionSoundMs < 40) return false;
  _lastExplosionSoundMs = now;
  return true;
}

export function getChainExplosionScale() {
  const now = performance.now();
  if (now - _recentExplosionWindowMs > 300) {
    _recentExplosionWindowMs = now;
    _recentExplosionsCount = 0;
  }
  _recentExplosionsCount++;
  return _recentExplosionsCount;
}

// Explosão principal: destrói blocos por raios pré-computados, gera drops em lote e cadeia de TNT
export function explode(world, pos, power, options = {}) {
  const { fire = false, breakBlocks = true, dropItems = true } = options;

  // Verifica se está na água — água absorve toda a destruição de blocos mas fere entidades (1.8.9)
  const centerState = world.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  const inWater = isWater(stateId(centerState));
  const actualBreak = breakBlocks && !inWater;

  const result = { destroyed: [], chainTNT: [], droppedItems: [], pos, power, inWater };
  if (!actualBreak || !world) return result;

  const chainCount = getChainExplosionScale();

  // Incrementa o carimbo do buffer estático (evita .fill(0) custoso a cada explosão)
  _currentStamp = (_currentStamp + 1) >>> 0;
  if (_currentStamp === 0) {
    VISIT_STAMP.fill(0);
    _currentStamp = 1;
  }
  const stamp = _currentStamp;

  const cx = Math.floor(pos.x);
  const cy = Math.floor(pos.y);
  const cz = Math.floor(pos.z);

  // Em reações com muitas TNTs simultâneas, usa FAST_RAYS para manter 60+ FPS liso
  const rays = chainCount > 4 ? FAST_RAYS : FULL_RAYS;
  const rayCount = rays.length;
  let hitCount = 0;

  for (let r = 0; r < rayCount; r += 3) {
    const dx = rays[r];
    const dy = rays[r + 1];
    const dz = rays[r + 2];

    let intensity = power * (0.7 + Math.random() * 0.6);
    let rx = pos.x;
    let ry = pos.y;
    let rz = pos.z;

    while (intensity > 0) {
      const bx = Math.floor(rx);
      const by = Math.floor(ry);
      const bz = Math.floor(rz);

      if (by < 1 || by >= 255) break;

      const st = world.getBlock(bx, by, bz);
      const id = stateId(st);

      if (id !== 0) {
        const block = getBlock(id);
        if (block.hardness < 0) {
          intensity = 0;
          break; // bedrock / inquebrável
        }

        // Fórmula exata do Minecraft 1.8.9: (resistência + 0.3) * 0.3
        const resistance = getBlockBlastResistance(id, block);
        intensity -= (resistance + 0.3) * 0.3;

        if (intensity > 0) {
          const ox = (bx - cx + 32) & 63;
          const oy = (by - cy + 32) & 63;
          const oz = (bz - cz + 32) & 63;
          const vIdx = ox + (oy << 6) + (oz << 12);

          if (VISIT_STAMP[vIdx] !== stamp) {
            VISIT_STAMP[vIdx] = stamp;
            if (hitCount < 16384) {
              const base = hitCount * 3;
              _hitCoords[base] = bx;
              _hitCoords[base + 1] = by;
              _hitCoords[base + 2] = bz;
              hitCount++;
            }
          }
        }
      }

      rx += dx * 0.3;
      ry += dy * 0.3;
      rz += dz * 0.3;
      // Decaimento constante por passo no ar (0.225 vanilla 1.8.9)
      intensity -= 0.225;
    }
  }

  if (hitCount === 0) return result;

  // Mapa para fundir drops de blocos iguais em pilhas de 64 (evita criar centenas de entidades 3D no chão)
  const mergedDrops = dropItems ? new Map() : null;
  const dropChance = 1 / Math.max(1, power);

  // Ativa o Batching no ClientWorld para atualizar todos os blocos sem reconstruir a malha centenas de vezes
  if (world.beginBatch) world.beginBatch();

  try {
    for (let i = 0; i < hitCount; i++) {
      const base = i * 3;
      const bx = _hitCoords[base];
      const by = _hitCoords[base + 1];
      const bz = _hitCoords[base + 2];

      const st = world.getBlock(bx, by, bz);
      const id = stateId(st);
      if (id === 0) continue;

      // Cadeia de TNT: se o bloco for TNT (46), acende com pavio curto (10..30 ticks)
      if (id === TNT) {
        result.chainTNT.push({
          x: bx + 0.5,
          y: by + 0.5,
          z: bz + 0.5,
          delay: 10 + Math.floor(Math.random() * 20),
        });
      }

      // Drops com chance vanilla 1 / power
      if (mergedDrops && Math.random() <= dropChance) {
        const block = getBlock(id);
        if (block?.drop) {
          const dKey = block.drop;
          mergedDrops.set(dKey, (mergedDrops.get(dKey) || 0) + 1);
        }
      }

      // Remove o bloco do mundo em lote
      world.setBlock(bx, by, bz, 0);
      result.destroyed.push({ x: bx, y: by, z: bz });
    }

    // Fogo opcional nas superfícies expostas
    if (fire) {
      for (let i = 0; i < hitCount; i++) {
        if (Math.random() < 0.25) {
          const base = i * 3;
          const bx = _hitCoords[base], by = _hitCoords[base + 1], bz = _hitCoords[base + 2];
          if (stateId(world.getBlock(bx, by, bz)) === 0) {
            world.setBlock(bx, by, bz, packState(FIRE, 0));
          }
        }
      }
    }
  } finally {
    if (world.endBatch) world.endBatch();
  }

  // Gera drops agrupados em pilhas de no máximo 64 itens
  if (mergedDrops) {
    for (const [dropId, totalCount] of mergedDrops.entries()) {
      let rem = totalCount;
      while (rem > 0) {
        const stackCount = Math.min(64, rem);
        rem -= stackCount;
        result.droppedItems.push({
          id: dropId,
          count: stackCount,
          x: pos.x + (Math.random() - 0.5) * 1.2,
          y: pos.y + 0.5,
          z: pos.z + (Math.random() - 0.5) * 1.2,
        });
      }
    }
  }

  return result;
}

// Dano e knockback para entidades (fiel à fórmula da 1.8.9)
export function getExplosionDamage(entityPos, explosionPos, power) {
  const dx = entityPos.x - explosionPos.x;
  const dy = (entityPos.y + 0.5) - explosionPos.y;
  const dz = entityPos.z - explosionPos.z;
  const dist = Math.hypot(dx, dy, dz);
  const maxDist = power * 2;
  if (dist > maxDist) return { damage: 0, knockback: { x: 0, y: 0, z: 0 } };

  const exposure = 1.0;
  const normDist = dist / maxDist;
  const damage = (1.0 - normDist) * power * 4.0 * exposure;
  const kbMag = damage * 0.15;
  const len = dist || 1.0;
  const knockback = {
    x: (dx / len) * kbMag,
    y: 0.3 + kbMag * 0.3,
    z: (dz / len) * kbMag,
  };
  return { damage: Math.max(0, damage), knockback };
}