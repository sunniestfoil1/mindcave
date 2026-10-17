import * as THREE from 'three';
import { MobEntity } from './mobEntity';
import { MobSpawnSystem, spawnChunkAnimals } from './mobSpawn';
import { applyDamage, addXP } from './survival';
import { addItem } from './inventory';
import { getBlock } from './blocks';
import { stateId } from './chunk';
import { applyHitFlash } from './hitFlash';
import { clientStore } from './client/clientStore';
import { canBlockDamage, getBlockedDamage } from './combat';

const _mobBox = new THREE.Box3();
const NO_DESPAWN = new Set(['pig', 'cow', 'sheep', 'chicken', 'wolf']);   // EntityAnimal.canDespawn = false

export class MobManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mobs = [];
    this.spawnSystem = new MobSpawnSystem();
  }

  spawn(typeId, pos) {
    const mob = new MobEntity(typeId, pos);
    mob.ensureModel(this.scene);
    this.mobs.push(mob);
    return mob;
  }

  summon(typeId, pos) { const m = this.spawn(typeId, pos); m.persistent = true; return m; }

  killAll(typeFilter) {
    for (const m of this.mobs) {
      if (!typeFilter || m.typeId === typeFilter) { m.health = 0; m.isDead = true; }
    }
  }

  tick(player, ctx) {
    this._populateNear(player, ctx);
    // Spawn natural
    this.spawnSystem.tick(this.world, player, this.mobs, ctx);

    const mobCtx = {
      ...ctx, player, mobs: this.mobs,
      onAttackPlayer: (mob, damage) => {
        const p = player;
        if (p.isDead || p.gameMode === 'creative' || p.gameMode === 'spectator') return;
        let dmg = damage;
        if (p.blocking && canBlockDamage('attack')) dmg = getBlockedDamage(damage);
        applyDamage(p, dmg, 'attack');
        p._lastAttacker = mob.type.namePt;
        p._lastWeapon = null;
      },
      onShootArrow: (mob, target) => {
        if (!ctx.projectiles) return;
        // EntitySkeleton.attackEntityWithRangedAttack: mira o peito do alvo, soma um arco proporcional à distância
        // (0,2 · distância horizontal) e dispara a 1,6 blocos/tick com imprecisão 14 − 4·dificuldade
        const eye = { x: mob.pos.x, y: mob.pos.y + mob.type.eyeHeight, z: mob.pos.z };
        const tx = target.pos.x - eye.x, tz = target.pos.z - eye.z;
        const horiz = Math.hypot(tx, tz);
        const ty = (target.pos.y + 1.62 / 3 * 1.0 + 0.6) - eye.y + horiz * 0.2;
        const len = Math.hypot(tx, ty, tz) || 1;
        const diff = ({ peaceful: 0, easy: 1, normal: 2, hard: 3 })[ctx.difficulty] ?? 2;
        const inacc = 0.0075 * (14 - diff * 4) * 2;
        const jit = () => (Math.random() - 0.5) * inacc;
        ctx.projectiles.spawnArrow(mob, 1.6 / 3, {
          eye, shooterIsMob: true, shooterName: mob.type.namePt,
          lookDir: { x: tx / len + jit(), y: ty / len + jit(), z: tz / len + jit() },
        });
        MobEntity.onSound?.(mob, 'shoot');
      },
      // Usa a explosão do motor (raios, drops, cadeia de TNT, som); a esfera simples fica só como reserva sem motor
      onExplode: (pos, power) => (ctx.onExplode ? ctx.onExplode(pos, power) : this._explode(pos, power, player, ctx)),
      onBreed: (p1) => {
        const baby = new MobEntity(p1.typeId, { x: p1.pos.x, y: p1.pos.y, z: p1.pos.z });
        baby.isBaby = true;
        baby.ensureModel(this.scene);
        this.mobs.push(baby);
      },
    };

    this._collideEntities(player);

    const toRemove = [];
    for (const mob of this.mobs) {
      if (!mob._model) mob.ensureModel(this.scene);
      // Como no jogo original: entidade em chunk descarregado fica congelada (sem gravidade, IA ou dano) em vez de cair no vazio
      if (!this.world.hasChunkAt(Math.floor(mob.pos.x), Math.floor(mob.pos.z))) continue;
      // Rede de segurança: abaixo do mundo some sem morte, partículas, drops nem som
      if (mob.pos.y < -32) { mob.removeModel(this.scene); toRemove.push(mob); continue; }
      if (this._shouldNaturallyDespawn(mob, player)) { mob.removeModel(this.scene); toRemove.push(mob); continue; }
      mob.tick(this.world, mobCtx);

      // Drops ao morrer
      if (mob.isDead && !mob._dropsProcessed) {
        mob._dropsProcessed = true;
        const drops = mob.getDrops(true);
        if (ctx.itemEntities && drops.length > 0) {
          for (const d of drops) {
            const rx = (Math.random() - 0.5) * 0.2;
            const rz = (Math.random() - 0.5) * 0.2;
            ctx.itemEntities.spawnItem(
              { id: d.id, count: d.count, meta: d.meta || 0 },
              { x: mob.pos.x, y: mob.pos.y + 0.3, z: mob.pos.z },
              { x: rx, y: 0.25, z: rz },
              10
            );
          }
        } else if (ctx.inventory && drops.length > 0) {
          for (const d of drops) addItem(ctx.inventory, d);
        }
        if (mob.type.xp > 0) {
          if (ctx.itemEntities?.spawnXpOrb) {
            ctx.itemEntities.spawnXpOrb(mob.type.xp, { x: mob.pos.x, y: mob.pos.y + 0.3, z: mob.pos.z });
          } else {
            addXP(player, mob.type.xp);
          }
        }
      }

      // Remover mortos após 20 ticks (1s) de tombamento clássico ou por explosão imediata
      if (mob._shouldDespawn || (mob.isDead && (mob.deathTime || 0) >= 20)) {
        if (ctx.particles) {
          ctx.particles.spawnDeathPoof(mob.pos.x, mob.pos.y + (mob.type.height || 1.8) * 0.5, mob.pos.z);
        }
        mob.removeModel(this.scene);
        toRemove.push(mob);
      }
    }

    for (const m of toRemove) {
      const idx = this.mobs.indexOf(m);
      if (idx >= 0) this.mobs.splice(idx, 1);
    }
  }

  // EntityLiving.despawnEntity (1.8.9): só mob que nasceu do mundo e não é animal. Mais longe que 128 blocos some na hora; entre 32 e 128, depois de
  // 600 ticks (30 s) sem jogador a menos de 32, tem 1 chance em 800 por tick de sumir; a menos de 32 o relógio zera. Ovo, /summon e nome fixam o mob.
  _shouldNaturallyDespawn(mob, player) {
    if (mob.isDead || mob.persistent || NO_DESPAWN.has(mob.typeId) || !player) return false;
    const d2 = (player.pos.x - mob.pos.x) ** 2 + (player.pos.y - mob.pos.y) ** 2 + (player.pos.z - mob.pos.z) ** 2;
    if (d2 > 16384) return true;
    mob._idle = (mob._idle || 0) + 1;
    if (d2 < 1024) { mob._idle = 0; return false; }
    return mob._idle > 600 && Math.floor(Math.random() * 800) === 0;
  }

  _explode(pos, power, player, ctx) {
    const dx = player.pos.x - pos.x, dy = (player.pos.y + 1) - pos.y, dz = player.pos.z - pos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < power * 2 && player.gameMode !== 'creative' && player.gameMode !== 'spectator') {
      let dmg = (1 - dist / (power * 2)) * power * 4;
      if (player.blocking && canBlockDamage('explosion')) dmg = getBlockedDamage(dmg);
      applyDamage(player, dmg, 'explosion');
      player._lastAttacker = 'Explosão';
      const d = dist || 1;
      player.vel.x += (dx / d) * dmg * 0.1;
      player.vel.z += (dz / d) * dmg * 0.1;
      player.vel.y += 0.3;
    }
    for (const m of this.mobs) {
      if (m.isDead) continue;
      const md = Math.hypot(m.pos.x - pos.x, m.pos.y - pos.y, m.pos.z - pos.z);
      if (md < power * 2) m.applyDamage((1 - md / (power * 2)) * power * 4, 'explosion', null);
    }
    if (ctx.gameRules?.mobGriefing !== false) {
      const r = Math.ceil(power);
      for (let bx2 = -r; bx2 <= r; bx2++)
        for (let by2 = -r; by2 <= r; by2++)
          for (let bz2 = -r; bz2 <= r; bz2++) {
            if (bx2*bx2 + by2*by2 + bz2*bz2 > power*power) continue;
            const bx = Math.floor(pos.x + bx2), by = Math.floor(pos.y + by2), bz = Math.floor(pos.z + bz2);
            const block = getBlock(stateId(this.world.getBlock(bx, by, bz)));
            if (block && block.hardness >= 0 && block.hardness < 100) this.world.setBlock(bx, by, bz, 0);
          }
    }
  }

  renderUpdate(time, playerPos, frustum, partialTick = 1) {
    const px = playerPos?.x || 0, pz = playerPos?.z || 0;
    let flash = null;
    for (const mob of this.mobs) {
      if (mob.isDead) continue;
      // 1. Distance Culling: ignora entidades a mais de 64 blocos do jogador
      const dx = mob.pos.x - px, dz = mob.pos.z - pz;
      if (dx * dx + dz * dz > 4096) {
        if (mob._model) mob._model.visible = false;
        continue;
      }
      // 2. Frustum Culling (Sodium / Out of Sight / Patcher): se estiver fora do campo de visão da câmera, oculta e pula animação
      if (frustum) {
        const w = (mob.width || 0.6) * 1.5;
        const h = (mob.height || 1.8) * 1.2;
        _mobBox.min.set(mob.pos.x - w, mob.pos.y - 0.2, mob.pos.z - w);
        _mobBox.max.set(mob.pos.x + w, mob.pos.y + h, mob.pos.z + w);
        if (!frustum.intersectsBox(_mobBox)) {
          if (mob._model) mob._model.visible = false;
          continue;
        }
      }
      if (!mob._model) mob.ensureModel(this.scene);
      mob.updateModel(time, partialTick);
      // Flash de dano (hurtTime 10 → 0): cor do módulo Hit Color
      const hurt = mob.hurtTime > 0 && clientStore.isOn('hitcolor');
      if (hurt && !flash) flash = clientStore.hitFlash(performance.now());
      if (hurt || mob._model.userData._flashMeshes) applyHitFlash(mob._model, hurt, flash);
    }
  }


  // Entity.applyEntityCollision (1.8.9): entidades cujas caixas (alargadas 0,2 em X/Z) se cruzam se empurram. Direção normalizada pela
  // maior componente, força 0,05 e atenuação 1/dist; as duas partes recebem o impulso (mob×mob e jogador×mob).
  _collideEntities(player) {
    const list = this.mobs;
    const push = (a, b, ax, az, bx, bz) => {
      let dx = bx - ax, dz = bz - az;
      let m = Math.max(Math.abs(dx), Math.abs(dz));
      if (m < 0.01) return;
      m = Math.sqrt(m);
      dx /= m; dz /= m;
      let inv = 1 / m; if (inv > 1) inv = 1;
      dx *= inv * 0.05; dz *= inv * 0.05;
      return [dx, dz];
    };
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.isDead) continue;
      const wa = a.type.width / 2 + 0.2, ha = a.type.height;
      // jogador (criativo/espectador não empurra nem é empurrado)
      if (player && !player.isDead && player.gameMode !== 'spectator' && !player.flying) {
        const w = wa + 0.3, ddx = player.pos.x - a.pos.x, ddz = player.pos.z - a.pos.z;
        if (Math.abs(ddx) < w && Math.abs(ddz) < w && player.pos.y < a.pos.y + ha && player.pos.y + 1.8 > a.pos.y) {
          const v = push(a, player, a.pos.x, a.pos.z, player.pos.x, player.pos.z);
          if (v) {
            // o mob é empurrado para longe do jogador; o jogador recebe o contrário, mais fraco
            a._pushX = (a._pushX || 0) - v[0]; a._pushZ = (a._pushZ || 0) - v[1];
            if (player.vel && player.gameMode !== 'creative') { player.vel.x += v[0] * 0.5; player.vel.z += v[1] * 0.5; }
          }
        }
      }
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.isDead) continue;
        const w = wa + b.type.width / 2, ddx = b.pos.x - a.pos.x, ddz = b.pos.z - a.pos.z;
        if (Math.abs(ddx) >= w || Math.abs(ddz) >= w) continue;
        if (a.pos.y >= b.pos.y + b.type.height || b.pos.y >= a.pos.y + ha) continue;
        const v = push(a, b, a.pos.x, a.pos.z, b.pos.x, b.pos.z);
        if (!v) continue;
        a._pushX = (a._pushX || 0) - v[0]; a._pushZ = (a._pushZ || 0) - v[1];
        b._pushX = (b._pushX || 0) + v[0]; b._pushZ = (b._pushZ || 0) + v[1];
      }
    }
  }

  // Chunks carregados perto do jogador que ainda não receberam a população inicial de animais (feito uma vez por chunk, salvo no mundo)
  _populateNear(player, ctx) {
    if (!player || ctx.dimension === 'nether') return;   // animais de fazenda não nascem no Nether
    this._popTick = (this._popTick || 0) + 1;
    if (this._popTick % 20 !== 0) return;
    if (!this.populated) this.populated = new Set();
    const pcx = Math.floor(player.pos.x / 16), pcz = Math.floor(player.pos.z / 16);
    const r = Math.max(2, Math.min(6, (this.world._lastLoadingRadius || 4) - 1));
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const cx = pcx + dx, cz = pcz + dz, k = cx + ',' + cz;
      if (this.populated.has(k) || !this.world.hasChunkAt(cx * 16, cz * 16)) continue;
      // só depois dos vizinhos existirem, para o chão do grupo estar pronto
      if (!this.world.hasChunkAt(cx * 16 + 16, cz * 16) || !this.world.hasChunkAt(cx * 16 - 1, cz * 16) || !this.world.hasChunkAt(cx * 16, cz * 16 + 16) || !this.world.hasChunkAt(cx * 16, cz * 16 - 1)) continue;
      this.populated.add(k);
      this.spawnSystem.populateChunk(this.world, cx, cz, this.mobs);
    }
  }

  getEntities() { return this.mobs.filter(m => !m.isDead); }
  getMobCount() { return this.mobs.length; }

  serialize() {
    const list = this.mobs
      .filter(m => !m.isDead)
      .map(m => ({
        typeId: m.typeId,
        pos: { x: m.pos.x, y: m.pos.y, z: m.pos.z },
        yaw: m.yaw,
        pitch: m.pitch,
        health: m.health,
        isBaby: !!m.isBaby,
        persistent: !!m.persistent,
      }));
    if (this.populated?.size) list.push({ _populated: [...this.populated] });
    return list;
  }

  deserialize(data) {
    if (!Array.isArray(data)) return;
    for (const m of this.mobs) m.removeModel(this.scene);
    this.mobs = [];
    for (const item of data) {
      if (item && Array.isArray(item._populated)) { this.populated = new Set(item._populated); continue; }
      if (!item || !item.typeId || !item.pos) continue;
      const mob = new MobEntity(item.typeId, item.pos);
      if (typeof item.yaw === 'number') mob.yaw = item.yaw;
      if (typeof item.pitch === 'number') mob.pitch = item.pitch;
      if (typeof item.health === 'number') mob.health = item.health;
      if (item.isBaby) mob.isBaby = true;
      if (item.persistent) mob.persistent = true;
      mob.ensureModel(this.scene);
      this.mobs.push(mob);
    }
  }

  dispose() {
    for (const m of this.mobs) m.removeModel(this.scene);
    this.mobs = [];
  }

  // Troca de dimensão: os mobs do outro mundo ficam para trás
  clearAll() {
    for (const m of this.mobs) m.removeModel(this.scene);
    this.mobs.length = 0;
  }
}
