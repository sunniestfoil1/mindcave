import * as THREE from 'three';
import { MobEntity } from './mobEntity';
import { MobSpawnSystem, spawnChunkAnimals } from './mobSpawn';
import { applyDamage, addXP } from './survival';
import { addItem } from './inventory';
import { getBlock } from './blocks';
import { stateId } from './chunk';
import { canBlockDamage, getBlockedDamage } from './combat';

const _mobBox = new THREE.Box3();

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

  summon(typeId, pos) { return this.spawn(typeId, pos); }

  killAll(typeFilter) {
    for (const m of this.mobs) {
      if (!typeFilter || m.typeId === typeFilter) { m.health = 0; m.isDead = true; }
    }
  }

  tick(player, ctx) {
    // Spawn natural
    this.spawnSystem.tick(this.world, player, this.mobs, ctx);

    const mobCtx = {
      ...ctx, player, mobs: this.mobs,
      onAttackPlayer: (mob, damage) => {
        const p = player;
        if (p.isDead || p.gameMode === 'creative') return;
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
          eye, shooterIsMob: true,
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

    const toRemove = [];
    for (const mob of this.mobs) {
      if (!mob._model) mob.ensureModel(this.scene);
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
        if (mob.type.xp > 0) addXP(player, mob.type.xp);
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

  _explode(pos, power, player, ctx) {
    const dx = player.pos.x - pos.x, dy = (player.pos.y + 1) - pos.y, dz = player.pos.z - pos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < power * 2 && player.gameMode !== 'creative') {
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

  renderUpdate(time, playerPos, frustum) {
    const px = playerPos?.x || 0, pz = playerPos?.z || 0;
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
      mob.updateModel(time);
    }
  }

  getEntities() { return this.mobs.filter(m => !m.isDead); }
  getMobCount() { return this.mobs.length; }

  dispose() {
    for (const m of this.mobs) m.removeModel(this.scene);
    this.mobs = [];
  }
}