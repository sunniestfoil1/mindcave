// Entidade viva (mob) — física, IA, combate, modelo, animação — PRD 08 RF-004
import { moveEntity } from './physics';
import { getMobType } from './mobRegistry';
import { buildMobModel, animateMobModel } from './mobModels';
import { GoalSystem } from './aiGoals';
import { findPath } from './pathfinding';
import { isWater, isSolid, isLava } from './blocks';
import { stateId } from './chunk';
import { applyDamage } from './survival';

let _mobId = 0;

export class MobEntity {
  constructor(typeId, pos) {
    this.id = ++_mobId;
    this.typeId = typeId;
    this.type = getMobType(typeId);
    this.pos = { x: pos.x, y: pos.y, z: pos.z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.headYaw = 0;
    this.headPitch = 0;
    this.onGround = false;
    this.sprinting = false;
    this.health = this.type.maxHealth;
    this.maxHealth = this.type.maxHealth;
    this.hurtTime = 0;
    this.hurtResistantTime = 0;
    this.lastDamage = 0;
    this.lastDamageSource = null;
    this.isDead = false;
    this.isBaby = Math.random() < (this.type.babyChance || 0);
    this.target = null;
    this.path = null;
    this.pathIdx = 0;
    this.pathRecalcTimer = 0;
    this.attackCooldown = 0;
    this.swelling = 0;
    this.swellTicks = 0;
    this.fireTicks = 0;
    this.angerLevel = 0;
    this.inLove = 0;
    this.breedCooldown = 0;
    this.sheared = false;
    this.tameOwner = null;
    this.ticksAlive = 0;
    this.idleTimer = 0;
    this._model = null;
    this._inScene = false;

    if (this.isBaby) {
      // Bebês são menores e mais rápidos
      this.type = { ...this.type, width: this.type.width * 0.5, height: this.type.height * 0.5, speed: this.type.speed * 1.2 };
    }

    this.ai = new GoalSystem(this.type.goals);
  }

  get width() { return this.type.width; }
  get height() { return this.type.height; }

  ensureModel(scene) {
    if (!this._model) this._model = buildMobModel(this.typeId);
    if (!this._inScene && scene) { scene.add(this._model); this._inScene = true; }
    return this._model;
  }

  removeModel(scene) {
    if (this._model && this._inScene && scene) {
      scene.remove(this._model);
      this._inScene = false;
    }
  }

  updateModel(time) {
    if (!this._model) return;
    this._model.position.set(this.pos.x, this.pos.y, this.pos.z);
    
    // Suavização angular suave de yaw do corpo (evita estalos ou giros instantâneos)
    if (this._renderYaw === undefined) this._renderYaw = this.yaw;
    let dyaw = this.yaw - this._renderYaw;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    this._renderYaw += dyaw * 0.25;
    this._model.rotation.y = this._renderYaw;

    this._model.visible = true;
    if (this.isBaby) this._model.scale.set(0.5, 0.5, 0.5);
    animateMobModel(this._model, this, time);
  }

  // === Path following ===
  followPath(speed) {
    if (!this.path || this.pathIdx >= this.path.length) { this.path = null; return false; }
    const wp = this.path[this.pathIdx];
    const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4) {
      this.pathIdx++;
      if (this.pathIdx >= this.path.length) { this.path = null; return false; }
      return this.followPath(speed);
    }
    this.vel.x = (dx / dist) * speed;
    this.vel.z = (dz / dist) * speed;
    this.yaw = Math.atan2(-dx, dz);
    // Pular se próximo nó está mais alto
    if (wp.y > this.pos.y + 0.5 && this.onGround) this.vel.y = 0.42;
    return true;
  }

  moveTowards(tx, tz, speed) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.1) return;
    this.vel.x = (dx / d) * speed;
    this.vel.z = (dz / d) * speed;
    this.yaw = Math.atan2(-dx, dz);
  }

  // === Tick ===
  tick(world, ctx) {
    if (this.isDead) return;
    this.ticksAlive++;

    // Timers
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.hurtResistantTime > 0) this.hurtResistantTime--;
    if (this.attackCooldown > 0) this.attackCooldown--;
    if (this.pathRecalcTimer > 0) this.pathRecalcTimer--;
    if (this.angerLevel > 0) this.angerLevel--;
    if (this.inLove > 0) this.inLove--;
    if (this.breedCooldown > 0) this.breedCooldown--;
    if (this.idleTimer > 0) this.idleTimer--;

    // IA (RF-002) - Se sob efeito de knockback, a IA não altera a velocidade
    if (this.knockbackTicks > 0) {
      this.knockbackTicks--;
    } else {
      this.ai.tick(this, world, ctx);
    }

    // Física (RF-004)
    this.applyPhysics(world);

    // MCP 1.8.9: Avanço de limbSwing e limbSwingAmount baseado no deslocamento horizontal real
    const horizSpd = Math.hypot(this.vel.x, this.vel.z);
    this._limbSwing = (this._limbSwing || 0) + horizSpd * 1.8;
    const targetAmp = Math.min(1.0, horizSpd / (this.type.speed || 0.23));
    this._limbSwingAmount = (this._limbSwingAmount || 0) + (targetAmp - (this._limbSwingAmount || 0)) * 0.35;

    // Queimando
    if (this.fireTicks > 0) {
      this.fireTicks--;
      if (this.ticksAlive % 20 === 0) {
        this.applyDamage(1, 'burning', null);
      }
      // Apagar na água/chuva
      const feetId = stateId(world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z)));
      if (isWater(feetId) || (ctx.weather && ctx.weather.isRainingAt?.(this.pos.x, this.pos.z, world))) {
        this.fireTicks = 0;
      }
    }

    // Caída no vazio
    if (this.pos.y < -64) this.applyDamage(4, 'void', null);

    // Despawn por distância
    if (ctx.player) {
      const dist = Math.hypot(ctx.player.pos.x - this.pos.x, ctx.player.pos.z - this.pos.z);
      if (dist > 128 && !this.tameOwner) {
        this._shouldDespawn = true;
      } else if (dist > 32) {
        this.idleTimer++;
        if (this.idleTimer > 600 && Math.random() < 1/800 && !this.tameOwner) {
          this._shouldDespawn = true;
        }
      } else {
        this.idleTimer = 0;
      }
    }
  }

  applyPhysics(world) {
    // Gravidade
    if (!this.type.canFly) {
      this.vel.y -= 0.08;
      if (this.vel.y < -3.92) this.vel.y = -3.92;
    }
    this.vel.y *= 0.98;

    // Fricção
    const fric = this.onGround ? 0.546 : 0.91;
    this.vel.x *= fric;
    this.vel.z *= fric;

    // Galinha cai devagar
    if (this.type.fallsSlow && this.vel.y < -0.1) this.vel.y *= 0.6;

    // Mover
    const res = moveEntity(this.pos, this.vel, world, 1, {
      width: this.type.width, height: this.type.height,
      onGround: this.onGround,
    });
    this.onGround = res.onGround;
  }

  applyDamage(amount, source, attacker, opts = {}) {
    if (this.isDead) return false;
    // Janela de 10 ticks (1.8.9): golpe maior só aplica a diferença
    let applied = amount;
    if (this.hurtResistantTime > 0) {
      if (amount <= this.lastDamage) return false;
      applied = amount - this.lastDamage;
    }

    // Armadura natural
    let dmg = applied * (1 - Math.min(20, this.type.armor || 0) / 25);

    this.health -= dmg;
    this.hurtTime = 10;
    this.hurtResistantTime = 10;
    this.lastDamage = amount;
    this.lastDamageSource = source;

    if (attacker) {
      this._lastAttacker = attacker;
      this.angerLevel = 20;
      this.target = attacker;
    }
    if (attacker && opts.knockback !== false) {
      // Knockback
      const dx = this.pos.x - attacker.pos.x, dz = this.pos.z - attacker.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      this.vel.x = (this.vel.x || 0) / 2 + (dx / d) * 0.4;
      this.vel.z = (this.vel.z || 0) / 2 + (dz / d) * 0.4;
      this.vel.y = Math.min((this.vel.y || 0) / 2 + 0.4, 0.4);
    }
    if (attacker) this.knockbackTicks = 5;

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
    }
    return true;
  }

  getDrops(killedByPlayer) {
    if (!this.type.drops) return [];
    const drops = [];
    for (const d of this.type.drops) {
      if (d.rare && !killedByPlayer) continue;
      if (d.playerOnly && !killedByPlayer) continue;
      const count = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
      if (count > 0) drops.push({ id: d.id, count, meta: 0 });
    }
    // Carne assada se morreu queimando
    if (this.fireTicks > 0 || this.lastDamageSource === 'burning' || this.lastDamageSource === 'fire') {
      for (const d of drops) {
        if (d.id === 319) d.id = 320; // porkchop → cooked
        if (d.id === 363) d.id = 364; // beef → cooked
        if (d.id === 366) d.id = 365; // chicken → cooked
      }
    }
    return drops;
  }

  serialize() {
    return {
      typeId: this.typeId, pos: { ...this.pos }, vel: { ...this.vel },
      yaw: this.yaw, health: this.health, isBaby: this.isBaby,
      fireTicks: this.fireTicks, inLove: this.inLove, breedCooldown: this.breedCooldown,
      sheared: this.sheared, tameOwner: this.tameOwner, angerLevel: this.angerLevel,
    };
  }

  static deserialize(data) {
    const mob = new MobEntity(data.typeId, data.pos);
    mob.vel = data.vel || { x: 0, y: 0, z: 0 };
    mob.yaw = data.yaw || 0;
    mob.health = data.health || mob.type.maxHealth;
    mob.isBaby = data.isBaby || false;
    mob.fireTicks = data.fireTicks || 0;
    mob.inLove = data.inLove || 0;
    mob.breedCooldown = data.breedCooldown || 0;
    mob.sheared = data.sheared || false;
    mob.tameOwner = data.tameOwner || null;
    mob.angerLevel = data.angerLevel || 0;
    return mob;
  }
}