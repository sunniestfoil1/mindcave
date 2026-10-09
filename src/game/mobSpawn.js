// Spawn natural de mobs 1.8.9 — PRD 08 RF-010..014
import { MOB_TYPES, MOB_CATEGORIES, SPAWN_WEIGHTS, SPAWN_LIMITS, getMobType } from './mobRegistry';
import { MobEntity } from './mobEntity';
import { isSolid, isWater, isLava } from './blocks';
import { stateId } from './chunk';
import { CHUNK_SIZE } from './constants';
import { chunkCoord } from './chunk';

export class MobSpawnSystem {
  constructor() {
    this.passiveTimer = 0;
  }

  // Conta mobs por categoria
  countByCategory(mobs) {
    const counts = { hostile: 0, passive: 0, ambient: 0, aquatic: 0, neutral: 0 };
    for (const m of mobs) {
      if (m.isDead) continue;
      const cat = m.type.category;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }

  tick(world, player, mobs, ctx) {
    if (!player) return;
    if (ctx.difficulty === 'peaceful') {
      // Remove hostis em pacífico
      for (const m of mobs) {
        if (m.type.category === 'hostile') m._shouldDespawn = true;
      }
      return;
    }

    const counts = this.countByCategory(mobs);

    // Hostis: todo tick (RF-010)
    if (counts.hostile < SPAWN_LIMITS.hostile) {
      this.trySpawn(world, player, mobs, 'hostile', ctx);
    }

    // Passivos: a cada 400 ticks (RF-010)
    this.passiveTimer++;
    if (this.passiveTimer >= 400 && counts.passive < SPAWN_LIMITS.passive) {
      this.passiveTimer = 0;
      this.trySpawn(world, player, mobs, 'passive', ctx);
    }

    // Ambiente: todo tick
    if (counts.ambient < SPAWN_LIMITS.ambient && Math.random() < 0.1) {
      this.trySpawn(world, player, mobs, 'ambient', ctx);
    }
  }

  trySpawn(world, player, mobs, category, ctx) {
    // MC22: só spawnar em chunks já carregados — NUNCA gerar chunk no spawn (causa lag extremo)
    const pcx = chunkCoord(Math.floor(player.pos.x));
    const pcz = chunkCoord(Math.floor(player.pos.z));
    const rd = world._lastLoadingRadius || 3;
    const maxDist = Math.max(1, rd - 1);
    const angle = Math.random() * Math.PI * 2;
    const dist = 1 + Math.floor(Math.random() * maxDist);
    const cx = pcx + Math.round(Math.cos(angle) * dist);
    const cz = pcz + Math.round(Math.sin(angle) * dist);

    // Pular se chunk não está carregado — não gerar aqui
    if (!world.chunks.has(world.key(cx, cz))) return;

    // Escolher coluna aleatória
    const lx = Math.floor(Math.random() * CHUNK_SIZE);
    const lz = Math.floor(Math.random() * CHUNK_SIZE);
    const ax = cx * CHUNK_SIZE + lx;
    const az = cz * CHUNK_SIZE + lz;

    // Encontrar altura do terreno
    let spawnY = -1;
    for (let y = 255; y >= 1; y--) {
      const b = stateId(world.getBlock(ax, y, az));
      if (isSolid(b)) { spawnY = y + 1; break; }
    }
    if (spawnY < 1) return;

    // Verificar distância mínima do jogador (RF-011)
    const distToPlayer = Math.hypot(ax - player.pos.x, az - player.pos.z);
    if (distToPlayer < 24) return;

    // Verificar condições de spawn
    if (!this.checkSpawnConditions(world, ax, spawnY, az, category, ctx)) return;

    // Escolher tipo de mob
    const typeId = this.pickMobType(category, ax, spawnY, az, world, ctx);
    if (!typeId) return;

    // Spawn de grupo (RF-010)
    const groupSize = 1 + Math.floor(Math.random() * 4);
    for (let i = 0; i < groupSize; i++) {
      const ox = ax + Math.floor((Math.random() - 0.5) * 6);
      const oz = az + Math.floor((Math.random() - 0.5) * 6);
      // Verificar espaço livre
      const feetBlock = stateId(world.getBlock(ox, spawnY, oz));
      const headBlock = stateId(world.getBlock(ox, spawnY + 1, oz));
      if (isSolid(feetBlock) || isSolid(headBlock)) continue;

      const mob = new MobEntity(typeId, { x: ox + 0.5, y: spawnY, z: oz + 0.5 });
      mobs.push(mob);
    }
  }

  checkSpawnConditions(world, x, y, z, category, ctx) {
    const feetBlock = stateId(world.getBlock(x, y, z));
    const headBlock = stateId(world.getBlock(x, y + 1, z));
    const groundBlock = stateId(world.getBlock(x, y - 1, z));

    // Espaço livre
    if (isSolid(feetBlock) || isSolid(headBlock)) return false;

    if (category === 'hostile') {
      // Luz ≤ 7 (RF-011) - levar em conta o horário do dia para a luz do céu
      const light = world.getLight(x, y, z);
      const worldTime = world.worldTime || 0;
      // Fator do ciclo dia/noite (0.0 à noite, 1.0 de dia)
      const tod = (worldTime % 24000) / 24000;
      let skyFactor = 1;
      if (tod > 0.23 && tod < 0.77) {
        if (tod < 0.27) skyFactor = 1 - (tod - 0.23) / 0.04;
        else if (tod > 0.73) skyFactor = (tod - 0.73) / 0.04;
        else skyFactor = 0;
      }
      const effectiveSky = Math.floor(light.sky * skyFactor);
      const maxLight = Math.max(light.block, effectiveSky);
      if (maxLight > 7) return false;
      // Chão sólido (não vidro/folhas/lajes)
      if (!isSolid(groundBlock)) return false;
      return true;
    }

    if (category === 'passive') {
      // Em grama, luz ≥ 9
      if (groundBlock !== 2) return false; // grass block
      const light = world.getLight(x, y, z);
      if (light.sky < 9) return false;
      return true;
    }

    if (category === 'ambient') {
      // Morcego: luz ≤ 3, abaixo de Y=63
      const light = world.getLight(x, y, z);
      if (light.block > 3) return false;
      if (y > 63) return false;
      return true;
    }

    return false;
  }

  pickMobType(category, x, y, z, world, ctx) {
    const weights = SPAWN_WEIGHTS[category];
    if (!weights) return null;

    // Filtrar tipos que podem spawnar nessas condições
    const valid = [];
    let totalWeight = 0;
    for (const [id, weight] of Object.entries(weights)) {
      const type = getMobType(id);
      if (!type) continue;
      // Slime: só em condições especiais
      if (id === 'slime') {
        // Pântano ou chunks de slime abaixo de Y=40
        if (y > 40 && y < 70) {
          // Verificar bioma pântano (simplificado: ignorar por enquanto)
        } else if (y < 40) {
          // Chunk de slime (1 em 10)
          if (((chunkCoord(x) * 0x1f1f1f1f) ^ (chunkCoord(z) * 0x0f0f0f0f)) % 10 === 0) {
            valid.push({ id, weight });
            totalWeight += weight;
          }
        }
        continue;
      }
      valid.push({ id, weight });
      totalWeight += weight;
    }

    if (totalWeight === 0) return null;

    let r = Math.random() * totalWeight;
    for (const v of valid) {
      r -= v.weight;
      if (r <= 0) return v.id;
    }
    return valid[0]?.id || null;
  }

  // Spawner de masmorra (RF-014)
  spawnFromSpawner(world, pos, mobType, maxNearby) {
    // TODO: implementar spawner block
  }
}

// Spawn de animais ao gerar chunk (RF-011 — principal fonte de animais na 1.8)
export function spawnChunkAnimals(world, cx, cz, mobs, ctx) {
  if (Math.random() > 0.1) return; // 10% de chance por chunk
  const types = ['pig', 'cow', 'sheep', 'chicken'];
  const typeId = types[Math.floor(Math.random() * types.length)];
  const groupSize = 2 + Math.floor(Math.random() * 3);

  for (let i = 0; i < groupSize; i++) {
    const lx = Math.floor(Math.random() * CHUNK_SIZE);
    const lz = Math.floor(Math.random() * CHUNK_SIZE);
    const ax = cx * CHUNK_SIZE + lx;
    const az = cz * CHUNK_SIZE + lz;

    // Encontrar grama
    for (let y = 255; y >= 1; y--) {
      const b = stateId(world.getBlock(ax, y, az));
      if (b === 2) { // grass
        const feetBlock = stateId(world.getBlock(ax, y + 1, az));
        if (!isSolid(feetBlock)) {
          const mob = new MobEntity(typeId, { x: ax + 0.5, y: y + 1, z: az + 0.5 });
          mobs.push(mob);
        }
        break;
      }
      if (isSolid(b)) break;
    }
  }
}