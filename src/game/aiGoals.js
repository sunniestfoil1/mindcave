// Sistema de IA por objetivos (goals) — PRD 08 RF-002 + PRD 09
import { findPath, hasLineOfSight } from './pathfinding';
import { isWater, isSolid } from './blocks';
import { stateId } from './chunk';
import { MobEntity } from './mobEntity';
import { lookDirFromAngles } from './viewMath';

// === Sistema de objetivos ===
// Como o EntityAITasks da 1.8: vários objetivos rodam ao mesmo tempo, desde que não se excluam (bits de exclusão mútua).
// Um objetivo de prioridade maior (número menor) interrompe um incompatível de prioridade menor. Objetivos de alvo
// (nearest_target, enderman_stare) rodam à parte e só definem mob.target: antes, um deles ficava ativo para sempre e
// travava perseguição, ataque e explosão do creeper.
const MUTEX = { swim: 4, look_at_player: 2, creeper_swell: 1, flee_sun: 1, avoid_entity: 1, panic: 1 }; // padrão 3

export class GoalSystem {
  constructor(goalDefs) {
    const all = goalDefs.map(createGoal).filter(Boolean);
    all.sort((a, b) => a.priority - b.priority);
    for (const g of all) { g.mutex = MUTEX[g.def.type] ?? 3; g.running = false; }
    this.targetGoals = all.filter((g) => g.isTarget);
    this.goals = all.filter((g) => !g.isTarget);
  }

  _canUse(g) {
    for (const o of this.goals) {
      if (o !== g && o.running && (o.mutex & g.mutex) && g.priority >= o.priority) return false;
    }
    return true;
  }

  tick(mob, world, ctx) {
    for (const g of this.targetGoals) {
      if (g.running) {
        if (!g.canContinue(mob, world, ctx)) { g.stop(mob); g.running = false; }
      } else if (g.canStart(mob, world, ctx)) {
        g.start(mob, world, ctx);
        g.running = true;
      }
    }
    for (const g of this.goals) {
      if (g.running && !g.canContinue(mob, world, ctx)) { g.stop(mob); g.running = false; }
    }
    for (const g of this.goals) {
      if (g.running || !this._canUse(g) || !g.canStart(mob, world, ctx)) continue;
      for (const o of this.goals) {
        if (o.running && (o.mutex & g.mutex)) { o.stop(mob); o.running = false; }
      }
      g.start(mob, world, ctx);
      g.running = true;
    }
    for (const g of this.goals) {
      if (g.running) g.tick(mob, world, ctx);
    }
  }
}

function createGoal(def) {
  switch (def.type) {
    case 'swim': return new SwimGoal(def);
    case 'panic': return new PanicGoal(def);
    case 'wander': return new WanderGoal(def);
    case 'melee_attack': return new MeleeAttackGoal(def);
    case 'ranged_attack': return new RangedAttackGoal(def);
    case 'nearest_target': { const g = new NearestTargetGoal(def); g.isTarget = true; return g; }
    case 'enderman_stare': { const g = new EndermanStareGoal(def); g.isTarget = true; return g; }
    case 'slime_jump': return new SlimeJumpGoal(def);
    case 'look_at_player': return new LookAtPlayerGoal(def);
    case 'flee_sun': return new FleeSunGoal(def);
    case 'creeper_swell': return new CreeperSwellGoal(def);
    case 'tempt': return new TemptGoal(def);
    case 'breed': return new BreedGoal(def);
    case 'eat_grass': return new EatGrassGoal(def);
    // PRD 09: Zumbis tecnológicos
    case 'investigate_noise': return new InvestigateNoiseGoal(def);
    case 'shoot_gun': return new ShootGunGoal(def);
    case 'dig_to_target': return new DigToTargetGoal(def);
    case 'call_reinforcements': return new CallReinforcementsGoal(def);
    case 'plant_charge': return new PlantChargeGoal(def);
    case 'maintain_distance': return new MaintainDistanceGoal(def);
    case 'protect_back': return new ProtectBackGoal(def);
    default: return null;
  }
}

// === Base ===
class Goal {
  constructor(def) { this.priority = def.priority || 99; this.def = def; }
  canStart() { return false; }
  canContinue() { return false; }
  start() {}
  stop() {}
  tick() {}
}

// === Nadar ===
class SwimGoal extends Goal {
  canStart(mob, world) {
    const feet = stateId(world.getBlock(Math.floor(mob.pos.x), Math.floor(mob.pos.y), Math.floor(mob.pos.z)));
    return isWater(feet);
  }
  canContinue(mob, world) { return this.canStart(mob, world); }
  tick(mob) {
    if (mob.vel.y < 0.04) mob.vel.y = 0.04;
  }
}

// === Pânico (passivos ao levar dano) ===
class PanicGoal extends Goal {
  canStart(mob) { return mob.hurtTime > 0 && mob.type.category === 'passive'; }
  canContinue(mob) { return mob.hurtTime > 0; }
  start(mob) { mob._panicDir = Math.random() * Math.PI * 2; mob._panicTimer = 60; }
  tick(mob) {
    const sp = mob.type.speed * 1.4;
    mob._panicTimer--;
    if (mob._panicTimer % 10 === 0) mob._panicDir = Math.random() * Math.PI * 2;
    mob.vel.x = -Math.sin(mob._panicDir) * sp;
    mob.vel.z = Math.cos(mob._panicDir) * sp;
    mob.yaw = mob._panicDir;
    if (mob.onGround && Math.random() < 0.1) mob.vel.y = 0.3;
  }
}

// === Vaguear ===
class WanderGoal extends Goal {
  canStart(mob) { return !mob.target && Math.random() < 0.02; }
  canContinue(mob) { return mob._wanderTimer > 0; }
  start(mob) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 3 + Math.random() * 7;
    mob._wanderTarget = { x: mob.pos.x + Math.cos(ang) * dist, z: mob.pos.z + Math.sin(ang) * dist };
    mob._wanderTimer = 40 + Math.random() * 40;
  }
  tick(mob) {
    mob._wanderTimer--;
    if (mob._wanderTimer <= 0) return;
    const dx = mob._wanderTarget.x - mob.pos.x, dz = mob._wanderTarget.z - mob.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.5) { mob._wanderTimer = 0; return; }
    const sp = mob.type.speed * 0.6;
    mob.vel.x = (dx / d) * sp;
    mob.vel.z = (dz / d) * sp;
    mob.yaw = Math.atan2(-dx, dz);
  }
}

// === Alvo mais próximo ===
class NearestTargetGoal extends Goal {
  canStart(mob, world, ctx) {
    if (ctx.difficulty === 'peaceful' && mob.type.category === 'hostile') return false;
    if (mob.target) return false;
    const range = this.def.range || mob.type.followRange || 16;
    const interval = this.def.checkInterval || 40;
    if (mob.ticksAlive % interval !== 0) return false;
    const player = ctx.player;
    if (!player || player.isDead) return false;
    const dist = Math.hypot(player.pos.x - mob.pos.x, player.pos.z - mob.pos.z);
    if (dist > range) return false;
    // Aranha: neutra sob luz alta
    if (mob.type.neutralAboveLight) {
      const light = world.getLight(Math.floor(mob.pos.x), Math.floor(mob.pos.y), Math.floor(mob.pos.z));
      if (light.sky >= mob.type.neutralAboveLight && mob.angerLevel <= 0) return false;
    }
    // Enderman: só ataca se provocado
    if (mob.typeId === 'enderman' && mob.angerLevel <= 0) return false;
    // Lobo: só ataca se provocado
    if (mob.typeId === 'wolf' && mob.angerLevel <= 0 && !mob.tameOwner) return false;
    return hasLineOfSight(world, { x: mob.pos.x, y: mob.pos.y + mob.type.eyeHeight, z: mob.pos.z }, { x: player.pos.x, y: player.pos.y + 1.0, z: player.pos.z });
  }
  canContinue(mob, world, ctx) {
    if (!mob.target) return false;
    const p = mob.target;
    if (!p || p.isDead) { mob.target = null; return false; }
    const dist = Math.hypot(p.pos.x - mob.pos.x, p.pos.z - mob.pos.z);
    return dist < (mob.type.followRange || 16) + 10;
  }
  start(mob, world, ctx) { mob.target = ctx.player; }
  stop(mob) { mob.target = null; }
  tick() {}
}

// === Atacar corpo a corpo ===
class MeleeAttackGoal extends Goal {
  canStart(mob, world, ctx) { return !!mob.target && !mob.target.isDead; }
  canContinue(mob, world, ctx) { return !!mob.target && !mob.target.isDead; }
  tick(mob, world, ctx) {
    const t = mob.target;
    if (!t) return;
    const dx = t.pos.x - mob.pos.x, dz = t.pos.z - mob.pos.z;
    const dist = Math.hypot(dx, dz);
    const reach = mob.type.width / 2 + 0.6 + 0.6;
    mob.yaw = Math.atan2(-dx, dz);

    if (dist <= reach) {
      // Atacar
      if (mob.attackCooldown <= 0) {
        const dmg = typeof mob.type.attackDamage === 'object'
          ? (mob.type.attackDamage[ctx.difficulty] || mob.type.attackDamage.normal || 2)
          : (mob.type.attackDamage || 2);
        if (!this.def.noDamage && dmg > 0) {
          ctx.onAttackPlayer?.(mob, dmg);
        }
        mob.attackCooldown = 20;
      }
      mob.vel.x *= 0.5; mob.vel.z *= 0.5;
    } else {
      // Perseguir
      if (mob.pathRecalcTimer <= 0 || !mob.path) {
        mob.path = findPath(world, mob.pos, t.pos, mob.type);
        mob.pathIdx = 0;
        mob.pathRecalcTimer = 15;
      }
      if (mob.path) {
        mob.followPath(mob.type.speed);
      } else {
        // Sem caminho, move direto
        const d = Math.hypot(dx, dz) || 1;
        mob.vel.x = (dx / d) * mob.type.speed;
        mob.vel.z = (dz / d) * mob.type.speed;
        if (mob.onGround) mob.vel.y = 0.42;
      }
    }
  }
}

// === Ataque à distância (esqueleto, bruxa) ===
class RangedAttackGoal extends Goal {
  canStart(mob, world, ctx) { return !!mob.target && !mob.target.isDead; }
  canContinue(mob, world, ctx) { return !!mob.target && !mob.target.isDead; }
  tick(mob, world, ctx) {
    const t = mob.target;
    if (!t) return;
    const dx = t.pos.x - mob.pos.x, dz = t.pos.z - mob.pos.z;
    const dist = Math.hypot(dx, dz);
    const range = mob.type.rangedRange || 15;
    mob.yaw = Math.atan2(-dx, dz);

    if (dist < range * 0.6) {
      // Aproxima demais, recua
      const d = dist || 1;
      mob.vel.x = -(dx / d) * mob.type.speed * 0.5;
      mob.vel.z = -(dz / d) * mob.type.speed * 0.5;
    } else if (dist > range) {
      // Aproxima
      if (mob.pathRecalcTimer <= 0 || !mob.path) {
        mob.path = findPath(world, mob.pos, t.pos, mob.type);
        mob.pathIdx = 0;
        mob.pathRecalcTimer = 20;
      }
      if (mob.path) mob.followPath(mob.type.speed);
    } else {
      // No alcance, atira
      mob.vel.x *= 0.3; mob.vel.z *= 0.3;
      if (mob.attackCooldown <= 0) {
        ctx.onShootArrow?.(mob, t);
        mob.attackCooldown = mob.type.rangedInterval || 40;
      }
    }
  }
}

// === Olhar para o jogador ===
class LookAtPlayerGoal extends Goal {
  canStart(mob, world, ctx) {
    const p = ctx.player;
    if (!p) return false;
    const dist = Math.hypot(p.pos.x - mob.pos.x, p.pos.z - mob.pos.z);
    return dist < 8 && Math.random() < 0.1;
  }
  canContinue(mob, world, ctx) {
    const p = ctx.player;
    if (!p) return false;
    return Math.hypot(p.pos.x - mob.pos.x, p.pos.z - mob.pos.z) < 8;
  }
  tick(mob, world, ctx) {
    const p = ctx.player;
    if (!p) return;
    const dx = p.pos.x - mob.pos.x, dz = p.pos.z - mob.pos.z;
    mob.headYaw = Math.atan2(-dx, dz) - mob.yaw;
    const dy = p.pos.y + 1.0 - (mob.pos.y + mob.type.eyeHeight);
    const d = Math.hypot(dx, dz) || 1;
    mob.headPitch = -Math.atan2(dy, d);
  }
}

// === Fugir do sol (mortos-vivos) ===
class FleeSunGoal extends Goal {
  canStart(mob, world, ctx) {
    if (!mob.type.burnsInSun) return false;
    const t = ctx.worldTime % 24000;
    if (t < 12541 || t > 23458) {
      // É dia
      const light = world.getLight(Math.floor(mob.pos.x), Math.floor(mob.pos.y), Math.floor(mob.pos.z));
      return light.sky > 12 && !ctx.weather?.isRaining();
    }
    return false;
  }
  canContinue(mob, world, ctx) { return this.canStart(mob, world, ctx); }
  start(mob) {
    mob._fleeTimer = 0;
    mob._fleeDir = mob.yaw || 0;
  }
  tick(mob, world) {
    // Move em uma direção consistente por 40-80 ticks em vez de sortear a cada 50ms (evita giro de 1200 RPM)
    if (!mob._fleeTimer || mob._fleeTimer <= 0) {
      mob._fleeTimer = 40 + Math.floor(Math.random() * 40);
      mob._fleeDir = Math.random() * Math.PI * 2;
    }
    mob._fleeTimer--;
    const sp = mob.type.speed;
    mob.vel.x = -Math.sin(mob._fleeDir) * sp;
    mob.vel.z = Math.cos(mob._fleeDir) * sp;
    mob.yaw = mob._fleeDir;
    // Queima
    if (mob.ticksAlive % 20 === 0) {
      mob.fireTicks = Math.max(mob.fireTicks || 0, 160);
    }
  }
}

// === Creeper inchar ===
class CreeperSwellGoal extends Goal {
  canStart(mob, world, ctx) {
    if (mob.typeId !== 'creeper') return false;
    const t = mob.target;
    if (!t || t.isDead) return false;
    const dist = Math.hypot(t.pos.x - mob.pos.x, t.pos.z - mob.pos.z);
    return dist <= 3;
  }
  canContinue(mob, world, ctx) {
    const t = mob.target;
    if (!t || t.isDead) return false;
    const dist = Math.hypot(t.pos.x - mob.pos.x, t.pos.z - mob.pos.z);
    return dist <= 7;
  }
  start(mob) { MobEntity.onSound?.(mob, 'primed'); }
  stop(mob) { mob.swelling = 0; mob.swellTicks = 0; }
  tick(mob, world, ctx) {
    // 1.8.9: infla (+1/tick) com o alvo a menos de 3 blocos, desinfla (−1/tick) entre 3 e 7; explode em 30
    const t = mob.target;
    const near = t && Math.hypot(t.pos.x - mob.pos.x, t.pos.z - mob.pos.z) <= 3;
    mob.swellTicks = Math.max(0, mob.swellTicks + (near ? 1 : -1));
    mob.swelling = Math.min(1, mob.swellTicks / 30);
    mob.vel.x *= 0.6; mob.vel.z *= 0.6;
    if (mob.swellTicks >= 30) {
      // Explodir!
      ctx.onExplode?.(mob.pos, mob.type.explosionPower || 3);
      mob.health = 0;
      mob.isDead = true;
    }
  }
}

// === Enderman: fica hostil quando o jogador olha para a sua cabeça (EntityEnderman.shouldAttackPlayer) ===
class EndermanStareGoal extends Goal {
  canStart(mob, world, ctx) {
    const p = ctx.player;
    if (!p || p.isDead || mob.target || ctx.difficulty === 'peaceful') return false;
    if (p.gameMode === 'creative' || p.gameMode === 'spectator') return false;
    if (mob.ticksAlive % 5 !== 0) return false;
    const eye = { x: p.pos.x, y: p.pos.y + 1.62, z: p.pos.z };
    const dx = mob.pos.x - eye.x, dy = mob.pos.y + mob.type.height / 2 - eye.y, dz = mob.pos.z - eye.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > 64 || d < 1e-3) return false;
    const look = lookDirFromAngles(p.yaw, p.pitch);
    const dot = (look.x * dx + look.y * dy + look.z * dz) / d;
    if (!(dot > 1 - 0.025 / d)) return false;
    return hasLineOfSight(world, eye, { x: mob.pos.x, y: mob.pos.y + mob.type.eyeHeight, z: mob.pos.z });
  }
  start(mob, world, ctx) {
    mob.target = ctx.player; mob.angerLevel = 600; mob.screaming = true;
    MobEntity.onSound?.(mob, 'stare');
    MobEntity.onSound?.(mob, 'scream');
  }
  canContinue(mob) {
    if (!mob.target || mob.target.isDead) return false;
    return mob.angerLevel > 0;
  }
  stop(mob) { mob.target = null; mob.screaming = false; }
}

// === Slime: pula em direção ao alvo (ou a esmo) a cada ~1 s ===
class SlimeJumpGoal extends Goal {
  canStart() { return true; }
  canContinue() { return true; }
  tick(mob) {
    if (!mob.onGround) return;
    mob._jumpTimer = (mob._jumpTimer ?? 20) - 1;
    if (mob._jumpTimer > 0) return;
    mob._jumpTimer = 10 + Math.floor(Math.random() * 20);
    let dx, dz;
    if (mob.target) { dx = mob.target.pos.x - mob.pos.x; dz = mob.target.pos.z - mob.pos.z; }
    else { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dz = Math.sin(a); }
    const d = Math.hypot(dx, dz) || 1;
    mob.vel.x = (dx / d) * mob.type.speed;
    mob.vel.z = (dz / d) * mob.type.speed;
    mob.vel.y = 0.42;
    mob.yaw = Math.atan2(-dx, dz);
  }
}

// === Tentação (segurar item favorito) ===
class TemptGoal extends Goal {
  canStart(mob, world, ctx) {
    if (!mob.type.breedItem) return false;
    const p = ctx.player;
    if (!p) return false;
    const held = ctx.getHeldItem?.();
    return held && held.id === this.def.item && Math.hypot(p.pos.x - mob.pos.x, p.pos.z - mob.pos.z) < 10;
  }
  canContinue(mob, world, ctx) { return this.canStart(mob, world, ctx); }
  tick(mob, world, ctx) {
    const p = ctx.player;
    if (!p) return;
    const dx = p.pos.x - mob.pos.x, dz = p.pos.z - mob.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d > 1.5) {
      mob.vel.x = (dx / d) * mob.type.speed;
      mob.vel.z = (dz / d) * mob.type.speed;
      mob.yaw = Math.atan2(-dx, dz);
    }
  }
}

// === Reprodução ===
class BreedGoal extends Goal {
  canStart(mob, world, ctx) {
    if (mob.inLove <= 0) return false;
    const mobs = ctx.mobs || [];
    for (const m of mobs) {
      if (m === mob || m.isDead || m.typeId !== mob.typeId || m.inLove <= 0) continue;
      const dist = Math.hypot(m.pos.x - mob.pos.x, m.pos.z - mob.pos.z);
      if (dist < 8) { mob._breedPartner = m; return true; }
    }
    return false;
  }
  canContinue(mob) { return mob.inLove > 0 && mob._breedPartner && !mob._breedPartner.isDead; }
  tick(mob, world, ctx) {
    const partner = mob._breedPartner;
    if (!partner) return;
    const dx = partner.pos.x - mob.pos.x, dz = partner.pos.z - mob.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    if (d < 1.0) {
      // Reproduzir
      ctx.onBreed?.(mob, partner);
      mob.inLove = 0; partner.inLove = 0;
      mob.breedCooldown = 6000; partner.breedCooldown = 6000;
      mob._breedPartner = null;
    } else {
      mob.vel.x = (dx / d) * mob.type.speed;
      mob.vel.z = (dz / d) * mob.type.speed;
      mob.yaw = Math.atan2(-dx, dz);
    }
  }
}

// === Comer grama (ovelha) ===
class EatGrassGoal extends Goal {
  canStart(mob, world) {
    if (mob.typeId !== 'sheep') return false;
    const bx = Math.floor(mob.pos.x), by = Math.floor(mob.pos.y), bz = Math.floor(mob.pos.z);
    const below = stateId(world.getBlock(bx, by - 1, bz));
    return below === 2 && Math.random() < 0.002; // grass block
  }
  canContinue(mob) { return mob._eatTimer > 0; }
  start(mob) { mob._eatTimer = 40; }
  tick(mob, world) {
    mob._eatTimer--;
    mob.vel.x = 0; mob.vel.z = 0;
    if (mob._eatTimer <= 0) {
      // Transformar grama em terra e regenerar lã
      const bx = Math.floor(mob.pos.x), by = Math.floor(mob.pos.y), bz = Math.floor(mob.pos.z);
      world.setBlock(bx, by - 1, bz, 3); // dirt
      mob.sheared = false;
    }
  }
}

// === PRD 09: Investigar ruído (RF-038, RF-052) ===
class InvestigateNoiseGoal extends Goal {
  canStart(mob, world, ctx) {
    if (!ctx.noiseSystem || mob.target) return false;
    if (mob.type.category !== 'hostile') return false;
    if (mob.ticksAlive % 20 !== 0) return false;
    const noise = ctx.noiseSystem.getNoiseAt(mob.pos, world);
    if (!noise) return false;
    mob._noiseTarget = { x: noise.x, y: noise.y, z: noise.z };
    return true;
  }
  canContinue(mob) { return mob._noiseTarget && (mob._noiseTimer || 0) > 0; }
  start(mob) { mob._noiseTimer = 200; }
  stop(mob) { mob._noiseTarget = null; mob._noiseTimer = 0; }
  tick(mob, world, ctx) {
    mob._noiseTimer--;
    if (!mob._noiseTarget) return;
    const dx = mob._noiseTarget.x - mob.pos.x, dz = mob._noiseTarget.z - mob.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) { mob._noiseTimer = 0; return; }
    if (mob.pathRecalcTimer <= 0 || !mob.path) {
      mob.path = findPath(world, mob.pos, mob._noiseTarget, mob.type);
      mob.pathIdx = 0;
      mob.pathRecalcTimer = 30;
    }
    if (mob.path) mob.followPath(mob.type.speed);
    else {
      const sp = mob.type.speed;
      mob.vel.x = (dx / d) * sp;
      mob.vel.z = (dz / d) * sp;
      mob.yaw = Math.atan2(-dx, dz);
    }
  }
}

// === Atirar com arma (RF-052 — Zumbi Soldado, Atirador) ===
class ShootGunGoal extends Goal {
  canStart(mob, world, ctx) {
    if (!mob.type.hasGun) return false;
    if (!mob.target || mob.target.isDead) return false;
    const t = mob.target;
    const dx = t.pos.x - mob.pos.x, dz = t.pos.z - mob.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > (this.def.range || 16)) return false;
    return hasLineOfSight(world, { x: mob.pos.x, y: mob.pos.y + mob.type.eyeHeight, z: mob.pos.z }, { x: t.pos.x, y: t.pos.y + 1.0, z: t.pos.z });
  }
  canContinue(mob, world, ctx) { return this.canStart(mob, world, ctx); }
  tick(mob, world, ctx) {
    const t = mob.target;
    if (!t) return;
    const dx = t.pos.x - mob.pos.x, dz = t.pos.z - mob.pos.z;
    mob.yaw = Math.atan2(-dx, dz);
    mob.vel.x *= 0.3; mob.vel.z *= 0.3;
    // Laser sight (Atirador de elite) — telegrafia
    if (this.def.laser && mob._laserTimer === undefined) {
      mob._laserTimer = this.def.laser;
    }
    if (mob._laserTimer > 0) { mob._laserTimer--; return; }
    if (mob.attackCooldown <= 0) {
      const burst = this.def.burst || 1;
      const interval = this.def.interval || 50;
      for (let i = 0; i < burst; i++) ctx.onShootArrow?.(mob, t);
      mob.attackCooldown = interval;
      mob._laserTimer = undefined;
      if (ctx.noiseSystem) ctx.noiseSystem.emit(mob.pos, 32);
    }
  }
}

// === Cavar até o alvo (RF-052 — Zumbi Minerador) ===
class DigToTargetGoal extends Goal {
  canStart(mob, world, ctx) {
    if (!mob.type.canDig) return false;
    if (!mob.target || mob.target.isDead) return false;
    if (mob.ticksAlive % 30 !== 0) return false;
    const t = mob.target;
    const dx = t.pos.x - mob.pos.x, dz = t.pos.z - mob.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) return false;
    if (mob.pathRecalcTimer <= 0 || !mob.path) {
      mob.path = findPath(world, mob.pos, t.pos, mob.type);
      mob.pathRecalcTimer = 30;
    }
    return !mob.path && d < 32;
  }
  canContinue(mob) { return mob._digTimer > 0; }
  start(mob) { mob._digTimer = 60; }
  tick(mob, world, ctx) {
    mob._digTimer--;
    const t = mob.target;
    if (!t) return;
    const dx = t.pos.x - mob.pos.x, dy = t.pos.y - mob.pos.y, dz = t.pos.z - mob.pos.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const dirX = dx / d, dirY = dy / d, dirZ = dz / d;
    if (mob.ticksAlive % 10 === 0 && ctx.gameRules?.mobGriefing !== false) {
      const bx = Math.floor(mob.pos.x + dirX * 0.8);
      const by = Math.floor(mob.pos.y + dirY * 0.8);
      const bz = Math.floor(mob.pos.z + dirZ * 0.8);
      const blockId = stateId(world.getBlock(bx, by, bz));
      if (blockId !== 0 && blockId !== 49 && blockId !== 7 && isSolid(blockId)) {
        world.setBlock(bx, by, bz, 0);
      }
    }
    mob.vel.x = dirX * mob.type.speed * 0.5;
    mob.vel.z = dirZ * mob.type.speed * 0.5;
    if (dirY > 0.3 && mob.onGround) mob.vel.y = 0.42;
  }
}

// === Chamar reforços (RF-052 — Zumbi Batedor) ===
class CallReinforcementsGoal extends Goal {
  canStart(mob, world, ctx) {
    if (!mob.type.canCallReinforcements) return false;
    if (!mob.target || mob.target.isDead) return false;
    if (mob._reinforcementCooldown > 0) return false;
    const t = mob.target;
    const dist = Math.hypot(t.pos.x - mob.pos.x, t.pos.z - mob.pos.z);
    return dist < (this.def.range || 40);
  }
  canContinue(mob) { return mob._callingTimer > 0; }
  start(mob) {
    mob._callingTimer = 30;
    mob._reinforcementCooldown = this.def.cooldown || 600;
  }
  tick(mob, world, ctx) {
    mob._callingTimer--;
    mob.vel.x *= 0.3; mob.vel.z *= 0.3;
    if (mob._callingTimer <= 0 && ctx.mobs) {
      const count = mob.type.reinforcementCount || 3;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 12 + Math.random() * 12;
        const x = mob.pos.x + Math.cos(angle) * dist;
        const z = mob.pos.z + Math.sin(angle) * dist;
        let y = -1;
        for (let yy = 255; yy >= 1; yy--) {
          if (isSolid(stateId(world.getBlock(Math.floor(x), yy, Math.floor(z))))) { y = yy + 1; break; }
        }
        if (y > 0) {
          const isTech = Math.random() < 0.3;
          const typeId = isTech ? 'zombie_soldier' : 'zombie';
          ctx.mobs.push(new MobEntity(typeId, { x: x + 0.5, y, z: z + 0.5 }));
        }
      }
    }
  }
  stop(mob) { mob._callingTimer = 0; }
}

// === Plantar carga (RF-052 — Zumbi Sapador) ===
class PlantChargeGoal extends Goal {
  canStart(mob, world, ctx) {
    if (!mob.type.canPlantCharge) return false;
    if (!mob.target || mob.target.isDead) return false;
    const t = mob.target;
    const dist = Math.hypot(t.pos.x - mob.pos.x, t.pos.z - mob.pos.z);
    if (dist <= (mob.type.suicideRange || 2)) { mob._suicideMode = true; return true; }
    return dist < 16 && (mob._chargeCooldown || 0) <= 0;
  }
  canContinue(mob) { return (mob._plantingTimer || 0) > 0 || (mob._suicideTimer || 0) > 0; }
  start(mob) {
    if (mob._suicideMode) { mob._suicideTimer = mob.type.suicideFuse || 30; }
    else { mob._plantingTimer = 20; }
  }
  tick(mob, world, ctx) {
    if (mob._suicideMode) {
      mob._suicideTimer--;
      mob.vel.x *= 0.5; mob.vel.z *= 0.5;
      if (mob._suicideTimer <= 0) {
        ctx.onExplode?.(mob.pos, mob.type.chargePower || 3);
        mob.health = 0; mob.isDead = true;
      }
      return;
    }
    mob._plantingTimer--;
    mob.vel.x *= 0.3; mob.vel.z *= 0.3;
    if (mob._plantingTimer <= 0) {
      const t = mob.target;
      const dx = t.pos.x - mob.pos.x, dz = t.pos.z - mob.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const bx = Math.floor(mob.pos.x + (dx / d)), by = Math.floor(mob.pos.y), bz = Math.floor(mob.pos.z + (dz / d));
      if (ctx.gameRules?.mobGriefing !== false) {
        world.setBlock(bx, by, bz, 46);
        world.setBlock(bx, by + 1, bz, 51);
      }
      mob._chargeCooldown = 200;
      mob.vel.x = -(dx / d) * mob.type.speed;
      mob.vel.z = -(dz / d) * mob.type.speed;
    }
  }
  stop(mob) { mob._plantingTimer = 0; mob._suicideTimer = 0; mob._suicideMode = false; }
}

// === Manter distância (RF-052 — Atirador de elite) ===
class MaintainDistanceGoal extends Goal {
  canStart(mob, world, ctx) {
    if (!mob.type.maintainDistance) return false;
    if (!mob.target || mob.target.isDead) return false;
    const t = mob.target;
    const dist = Math.hypot(t.pos.x - mob.pos.x, t.pos.z - mob.pos.z);
    const min = this.def.min || 30, max = this.def.max || 60;
    return dist < min || dist > max;
  }
  canContinue(mob, world, ctx) { return this.canStart(mob, world, ctx); }
  tick(mob, world, ctx) {
    const t = mob.target;
    if (!t) return;
    const dx = t.pos.x - mob.pos.x, dz = t.pos.z - mob.pos.z;
    const dist = Math.hypot(dx, dz);
    const min = this.def.min || 30, max = this.def.max || 60;
    const d = dist || 1;
    if (dist < min) {
      mob.vel.x = -(dx / d) * mob.type.speed;
      mob.vel.z = -(dz / d) * mob.type.speed;
    } else if (dist > max) {
      if (mob.pathRecalcTimer <= 0 || !mob.path) {
        mob.path = findPath(world, mob.pos, t.pos, mob.type);
        mob.pathIdx = 0;
        mob.pathRecalcTimer = 30;
      }
      if (mob.path) mob.followPath(mob.type.speed);
    }
    mob.yaw = Math.atan2(-dx, dz);
  }
}

// === Proteger costas (RF-052 — Zumbi Blindado) ===
class ProtectBackGoal extends Goal {
  canStart(mob, world, ctx) {
    if (!mob.type.hasBackWeakspot) return false;
    if (mob.target && !mob.target.isDead) {
      const dist = Math.hypot(mob.target.pos.x - mob.pos.x, mob.target.pos.z - mob.pos.z);
      return dist < 10;
    }
    return false;
  }
  canContinue(mob, world, ctx) { return this.canStart(mob, world, ctx); }
  tick(mob, world, ctx) {
    let closest = null, closestDist = 10;
    if (mob.target && !mob.target.isDead) {
      const d = Math.hypot(mob.target.pos.x - mob.pos.x, mob.target.pos.z - mob.pos.z);
      if (d < closestDist) { closestDist = d; closest = mob.target; }
    }
    if (closest) {
      const dx = closest.pos.x - mob.pos.x, dz = closest.pos.z - mob.pos.z;
      mob.yaw = Math.atan2(-dx, dz);
    }
  }
}