// Spawn natural de mobs 1.8.9 — PRD 08 RF-010..014
import { MOB_TYPES, MOB_CATEGORIES, SPAWN_WEIGHTS, NETHER_SPAWN_WEIGHTS, SPAWN_LIMITS, getMobType } from './mobRegistry';
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

    // Nether: outro conjunto de criaturas, sem passivos nem ambiente do mundo normal
    if (ctx.dimension === 'nether') { this.tickNether(world, player, mobs, counts); return; }

    // Aether: só animais pacíficos (sem hostis, sem morcegos)
    if (ctx.dimension === 'aether') {
      this.passiveTimer++;
      if (this.passiveTimer >= 400 && Math.random() < 0.05 && counts.passive < SPAWN_LIMITS.passive) { this.passiveTimer = 0; this.trySpawn(world, player, mobs, 'passive', ctx); }
      return;
    }

    // Hostis: todo tick (RF-010)
    if (counts.hostile < SPAWN_LIMITS.hostile) {
      this.trySpawn(world, player, mobs, 'hostile', ctx);
    }

    // Passivos: a cada 400 ticks (RF-010)
    this.passiveTimer++;
    if (this.passiveTimer >= 400 && Math.random() < 0.05 && counts.passive < SPAWN_LIMITS.passive) {
      this.passiveTimer = 0;
      this.trySpawn(world, player, mobs, 'passive', ctx);
    }

    // Ambiente: todo tick
    if (counts.ambient < SPAWN_LIMITS.ambient && Math.random() < 0.1) {
      this.trySpawn(world, player, mobs, 'ambient', ctx);
    }
  }

  // Nether: a cada tick uma chance de achar um chão de pedra livre (2 de ar em cima, sem lava) a 24+ blocos e soltar um grupo de porcos-zumbis
  tickNether(world, player, mobs, counts) {
    if (counts.neutral >= 20 || Math.random() > 0.02) return;
    const pcx = chunkCoord(Math.floor(player.pos.x)), pcz = chunkCoord(Math.floor(player.pos.z));
    const rd = Math.max(2, (world._lastLoadingRadius || 3) - 1);
    const cx = pcx + Math.floor((Math.random() * 2 - 1) * rd), cz = pcz + Math.floor((Math.random() * 2 - 1) * rd);
    if (!world.chunks.has(world.key(cx, cz))) return;
    const ax = cx * CHUNK_SIZE + Math.floor(Math.random() * CHUNK_SIZE), az = cz * CHUNK_SIZE + Math.floor(Math.random() * CHUNK_SIZE);
    let y0 = -1;
    for (let y = 32 + Math.floor(Math.random() * 80); y >= 5; y--) {
      if (isSolid(stateId(world.getBlock(ax, y, az))) && stateId(world.getBlock(ax, y + 1, az)) === 0 && stateId(world.getBlock(ax, y + 2, az)) === 0) { y0 = y + 1; break; }
    }
    if (y0 < 0 || Math.hypot(ax - player.pos.x, az - player.pos.z) < 24 || Math.abs(y0 - player.pos.y) > 48) return;
    const ground = stateId(world.getBlock(ax, y0 - 1, az));
    if (isLava(ground) || isWater(ground)) return;
    let x = ax, z = az;
    for (let n = 0; n < 4; n++) {
      x += Math.floor(Math.random() * 5) - 2; z += Math.floor(Math.random() * 5) - 2;
      if (!world.hasChunkAt(x, z)) continue;
      if (!isSolid(stateId(world.getBlock(x, y0 - 1, z))) || stateId(world.getBlock(x, y0, z)) !== 0 || stateId(world.getBlock(x, y0 + 1, z)) !== 0) continue;
      mobs.push(new MobEntity('zombie_pigman', { x: x + 0.5, y: y0, z: z + 0.5 }));
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

    // Como em WorldEntitySpawner: altura aleatória entre 0 e o topo da coluna (assim nasce em caverna, não só na superfície)
    let top = -1;
    for (let y = 255; y >= 1; y--) {
      if (isSolid(stateId(world.getBlock(ax, y, az)))) { top = y; break; }
    }
    if (top < 1) return;
    const spawnY = 1 + Math.floor(Math.random() * top);
    if (isSolid(stateId(world.getBlock(ax, spawnY, az)))) return;

    // Distância mínima do jogador (RF-011)
    if (Math.hypot(ax - player.pos.x, az - player.pos.z) < 24 || Math.abs(spawnY - player.pos.y) > 48) return;

    // Cada tentativa de grupo caminha a partir do ponto inicial (x += rand(6) - rand(6)); 3 tentativas, até 4 por grupo
    let placed = 0;
    let typeId = null;
    let x = ax, y = spawnY, z = az;
    for (let n = 0; n < 4 && placed < 4; n++) {
      x += Math.floor(Math.random() * 6) - Math.floor(Math.random() * 6);
      z += Math.floor(Math.random() * 6) - Math.floor(Math.random() * 6);
      if (!world.hasChunkAt(x, z)) continue;
      if (!this.checkSpawnConditions(world, x, y, z, category, ctx)) continue;
      if (Math.hypot(x - player.pos.x, z - player.pos.z) < 24) continue;
      if (!typeId) { typeId = this.pickMobType(category, x, y, z, world, ctx); if (!typeId) return; }
      mobs.push(new MobEntity(typeId, { x: x + 0.5, y, z: z + 0.5 }));
      placed++;
    }
  }

  // População inicial determinística de um chunk (ChunkProviderGenerate/SpawnerAnimals.performWorldGenSpawning): 10% de chance por chunk,
  // um grupo de animais na grama, tudo derivado da seed do mundo e das coordenadas — o mesmo chunk sempre recebe os mesmos animais
  populateChunk(world, cx, cz, mobs) {
    let h = (Math.imul(cx, 341873128) ^ Math.imul(cz, 132897987) ^ (world.seed | 0)) >>> 0;
    const rnd = () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
    if (rnd() >= 0.1) return 0;
    const kinds = ['pig', 'cow', 'sheep', 'chicken'];
    const typeId = kinds[Math.floor(rnd() * kinds.length)];
    let x = cx * CHUNK_SIZE + Math.floor(rnd() * CHUNK_SIZE), z = cz * CHUNK_SIZE + Math.floor(rnd() * CHUNK_SIZE);
    let placed = 0;
    for (let n = 0; n < 4 && placed < 4; n++) {
      x += Math.floor(rnd() * 5) - 2; z += Math.floor(rnd() * 5) - 2;
      if (!world.hasChunkAt(x, z)) continue;
      let y = -1;
      for (let yy = 255; yy >= 1; yy--) { if (isSolid(stateId(world.getBlock(x, yy, z)))) { y = yy + 1; break; } }
      if (y < 1 || ![2, 210].includes(stateId(world.getBlock(x, y - 1, z)))) continue;
      if (isSolid(stateId(world.getBlock(x, y, z))) || isSolid(stateId(world.getBlock(x, y + 1, z)))) continue;
      mobs.push(new MobEntity(typeId, { x: x + 0.5, y, z: z + 0.5 }));
      placed++;
    }
    return placed;
  }

  // Luz efetiva do ponto: bloco ou céu do dia (fator do ciclo dia/noite, como na 1.8)
  _maxLight(world, x, y, z) {
    const light = world.getLight(x, y, z);
    const worldTime = world.worldTime || 0;
    const tod = (worldTime % 24000) / 24000;
    let skyFactor = 1;
    if (tod > 0.23 && tod < 0.77) {
      if (tod < 0.27) skyFactor = 1 - (tod - 0.23) / 0.04;
      else if (tod > 0.73) skyFactor = (tod - 0.73) / 0.04;
      else skyFactor = 0;
    }
    const effectiveSky = Math.floor(light.sky * skyFactor);
    return Math.max(light.block, effectiveSky);
  }

  checkSpawnConditions(world, x, y, z, category, ctx) {
    const feetBlock = stateId(world.getBlock(x, y, z));
    const headBlock = stateId(world.getBlock(x, y + 1, z));
    const groundBlock = stateId(world.getBlock(x, y - 1, z));

    // Espaço livre
    if (isSolid(feetBlock) || isSolid(headBlock)) return false;

    if (category === 'hostile') {
      // Luz ≤ 7 (RF-011) — luz do céu só vale de dia
      if (this._maxLight(world, x, y, z) > 7) return false;
      // Chão sólido (não vidro/folhas/lajes)
      if (!isSolid(groundBlock)) return false;
      return true;
    }

    if (category === 'passive') {
      // Em grama, luz ≥ 9
      if (groundBlock !== 2 && groundBlock !== 210) return false; // grama (a do Aether também)
      const light = world.getLight(x, y, z);
      if (light.sky < 9) return false;
      return true;
    }

    if (category === 'ambient') {
      // Morcego: luz efetiva ≤ 3 (bloco OU céu de dia — sem isso nasce na superfície à noite), abaixo de Y=63
      if (this._maxLight(world, x, y, z) > 3) return false;
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
        if (b === 2 || b === 210) { // grama (a do Aether também)
          const feetBlock = stateId(world.getBlock(ax, y + 1, az));
          const headBlock = stateId(world.getBlock(ax, y + 2, az)); // sem checar a cabeça o animal nasce com a cabeça dentro de teto/folha e morre
          if (!isSolid(feetBlock) && !isSolid(headBlock)) {
            const mob = new MobEntity(typeId, { x: ax + 0.5, y: y + 1, z: az + 0.5 });
            mobs.push(mob);
          }
          break;
        }
        if (isSolid(b)) break;
      }
  }
}