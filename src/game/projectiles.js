import * as THREE from 'three';
import { isSolid, isWater } from './blocks';
import { stateId } from './chunk';
import { PROJECTILE_TYPES, calculateArrowDamage, applyKnockback, getArrowVelocity } from './combat';
import { applyDamage } from './survival';
import { getPackCanvas, MC } from './pack';

let _id = 0;

let _arrowMaterial = null;
function getArrowMaterial() {
  if (_arrowMaterial) return _arrowMaterial;
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 32;
  const ctx = cv.getContext('2d');
  // Textura base fiel 1.8.9 (haste marrom, ponta cinza sílex, penas brancas)
  ctx.fillStyle = '#8B5A2B';
  ctx.fillRect(0, 0, 16, 5);
  ctx.fillStyle = '#6E6E6E';
  ctx.fillRect(16, 0, 8, 5);
  ctx.fillStyle = '#EAEAEA';
  ctx.fillRect(24, 0, 8, 5);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  _arrowMaterial = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });

  getPackCanvas(MC + 'textures/entity/arrow.png').then((src) => {
    if (!src) return;
    cv.width = src.width;
    cv.height = src.height;
    ctx.drawImage(src, 0, 0);
    tex.needsUpdate = true;
  }).catch(() => {});

  return _arrowMaterial;
}

function buildArrowGroup() {
  const group = new THREE.Group();
  const mat = getArrowMaterial();
  
  // Planos cruzados característicos do Minecraft
  const plane1 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2), mat);
  plane1.rotation.y = Math.PI / 2;
  
  const plane2 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.2), mat);
  plane2.rotation.y = Math.PI / 2;
  plane2.rotation.x = Math.PI / 2;

  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.65), new THREE.MeshBasicMaterial({ color: 0x8b5a2b }));

  group.add(shaft);
  group.add(plane1);
  group.add(plane2);
  return group;
}

export class Projectile {
  constructor(type, opts) {
    this.id = ++_id;
    this.type = type; // 'arrow' | 'snowball' | 'egg' | 'ender_pearl' | 'fishing_bobber'
    this.def = PROJECTILE_TYPES[type];
    this.pos = { ...opts.pos };
    this.vel = { ...opts.vel };
    this.shooterId = opts.shooterId || null;
    this.shooterName = opts.shooterName || null;
    this.charge = opts.charge || 0; // para flechas
    this.shooterIsMob = !!opts.shooterIsMob; // flecha de mob: só acerta o jogador
    this.inGround = false;
    this.groundBlock = null;
    this.ticksAlive = 0;
    this.stuckEntityId = null;
    this.stuckOffset = null;
    this.onHitEntity = opts.onHitEntity || null;
    this.onHitBlock = opts.onHitBlock || null;
    this.mesh = null;
    this._prevPos = { ...opts.pos };
    // Custom physics overrides (bullets, grenades)
    this.gravity = opts.gravity ?? this.def.gravity;
    this.lifetime = opts.lifetime ?? this.def.lifetime;
    this.fuseTicks = opts.fuseTicks ?? null;
    this.onExplode = opts.onExplode || null;
    this.gunKey = opts.gunKey || null;
    this.damage = opts.damage ?? this.def.damage;
    this.headshotMult = opts.headshotMult || 1.5;
    this.effectiveRange = opts.effectiveRange || 32;
    this.maxRange = opts.maxRange || 64;
    this.damageFalloff = opts.damageFalloff || 0.5;
    this.armorPenetration = opts.armorPenetration || 0;
    this.silenced = opts.silenced || false;
    this.showTracer = opts.showTracer || false;
    this._origin = { ...opts.pos };
    this._distanceTraveled = 0;
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.y, this.vel.z);
  }
}

export class ProjectileManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.projectiles = [];
    this._arrowGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6);
    this._arrowGeo.rotateZ(Math.PI / 2);
    this._ballGeo = new THREE.SphereGeometry(0.15, 8, 6);
  }

  spawn(type, opts) {
    const p = new Projectile(type, opts);
    this.createMesh(p);
    this.projectiles.push(p);
    return p;
  }

  spawnArrow(shooter, charge, opts = {}) {
    const eye = opts.eye || { x: shooter.pos.x, y: shooter.pos.y + 1.62, z: shooter.pos.z };
    const lookDir = opts.lookDir || this._lookDir(shooter);
    const vel = getArrowVelocity(charge, lookDir, shooter.vel);
    return this.spawn('arrow', {
      pos: eye, vel, shooterId: shooter.id, shooterName: opts.shooterName || shooter.nomeJogador || shooter.name,
      charge, shooterIsMob: !!opts.shooterIsMob,
      onHitEntity: opts.onHitEntity, onHitBlock: opts.onHitBlock,
    });
  }

  spawnThrowable(shooter, itemId, opts = {}) {
    const type = itemId === 332 ? 'snowball' : itemId === 344 ? 'egg' : itemId === 368 ? 'ender_pearl' : null;
    if (!type) return null;
    const eye = { x: shooter.pos.x, y: shooter.pos.y + 1.62, z: shooter.pos.z };
    const lookDir = this._lookDir(shooter);
    const speed = 1.5;
    return this.spawn(type, {
      pos: eye,
      vel: { x: lookDir.x * speed + shooter.vel.x, y: lookDir.y * speed + shooter.vel.y, z: lookDir.z * speed + shooter.vel.z },
      shooterId: shooter.id, shooterName: shooter.nomeJogador || shooter.name,
      onHitEntity: opts.onHitEntity, onHitBlock: opts.onHitBlock,
    });
  }

  _lookDir(p) {
    const cp = Math.cos(p.pitch);
    return { x: -Math.sin(p.yaw) * cp, y: -Math.sin(p.pitch), z: Math.cos(p.yaw) * cp };
  }

  createMesh(p) {
    if (p.type === 'bullet') {
      // Tracer: linha curta brilhante
      const geo = new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4);
      geo.rotateZ(Math.PI / 2);
      p.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffee44, transparent: true, opacity: p.showTracer ? 0.9 : 0.3 }));
    } else if (p.type === 'grenade') {
      const geo = new THREE.BoxGeometry(0.12, 0.16, 0.12);
      p.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x4a5a3a }));
    } else if (p.type === 'arrow') {
      p.mesh = buildArrowGroup();
    } else {
      p.mesh = new THREE.Mesh(this._ballGeo, new THREE.MeshBasicMaterial({ color: p.def.color }));
    }
    p.mesh.position.set(p.pos.x, p.pos.y, p.pos.z);
    this.scene.add(p.mesh);
  }

  updateMeshOrientation(p) {
    if (!p.mesh) return;
    p.mesh.position.set(p.pos.x, p.pos.y, p.pos.z);
    if (p.type === 'arrow' && !p.inGround) {
      const sp = p.speed;
      if (sp > 0.001) {
        p.mesh.lookAt(p.pos.x + p.vel.x, p.pos.y + p.vel.y, p.pos.z + p.vel.z);
      }
    }
  }

  // Colisão por varredura (RF-021)
  raycastBlocks(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.001) return null;
    const steps = Math.ceil(len / 0.2);
    let prev = { ...from };
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t, y = from.y + dy * t, z = from.z + dz * t;
      const block = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
      if (isSolid(stateId(block))) {
        return { x: prev.x, y: prev.y, z: prev.z, blockX: Math.floor(x), blockY: Math.floor(y), blockZ: Math.floor(z) };
      }
      prev = { x, y, z };
    }
    return null;
  }

  // Colisão com entidades (caixas AABB)
  raycastEntities(from, to, entities, ignoreId) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.001) return null;
    const steps = Math.ceil(len / 0.2);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t, y = from.y + dy * t, z = from.z + dz * t;
      for (const e of entities) {
        if (e.id === ignoreId || e.isDead) continue;
        const box = this._entityBox(e);
        if (x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY && z >= box.minZ && z <= box.maxZ) {
          return { entity: e, x, y, z };
        }
      }
    }
    return null;
  }

  _entityBox(e) {
    const w = 0.6, h = 1.8;
    const p = e.pos;
    return { minX: p.x - w / 2 - 0.1, maxX: p.x + w / 2 + 0.1, minY: p.y - 0.1, maxY: p.y + h + 0.1, minZ: p.z - w / 2 - 0.1, maxZ: p.z + w / 2 + 0.1 };
  }

  tick(entities, playerTarget) {
    const toRemove = [];
    for (const p of this.projectiles) {
      // === Granada (RF-039) ===
      if (p.type === 'grenade') {
        this._tickGrenade(p, toRemove);
        continue;
      }

      // === Bala (RF-031) ===
      if (p.type === 'bullet') {
        this._tickBullet(p, entities, toRemove);
        continue;
      }

      // === Projéteis padrão (flecha, bola de neve, etc.) ===
      if (p.inGround) {
        p.ticksAlive++;
        if (p.ticksAlive > p.def.lifetime) toRemove.push(p);
        continue;
      }

      p._prevPos = { ...p.pos };
      p.ticksAlive++;

      const block = this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z));
      const inWater = isWater(stateId(block));
      const drag = inWater ? p.def.dragWater : p.def.drag;

      p.vel.x *= drag;
      p.vel.y *= drag;
      p.vel.z *= drag;
      p.vel.y -= p.def.gravity;

      const next = { x: p.pos.x + p.vel.x, y: p.pos.y + p.vel.y, z: p.pos.z + p.vel.z };

      const blockHit = this.raycastBlocks(p.pos, next);
      if (blockHit) {
        p.pos = { x: blockHit.x, y: blockHit.y, z: blockHit.z };
        p.inGround = true;
        p.groundBlock = { x: blockHit.blockX, y: blockHit.blockY, z: blockHit.blockZ };
        if (p.onHitBlock) p.onHitBlock(p);
        continue;
      }

      // Flecha de mob só acerta o jogador (esqueletos não se ferem entre si); as dos jogadores acertam mobs e outros jogadores
      const targets = p.shooterIsMob ? (playerTarget && !playerTarget.isDead && playerTarget.gameMode !== 'creative' && playerTarget.gameMode !== 'spectator' ? [playerTarget] : []) : entities;
      if (targets && targets.length > 0) {
        const entHit = this.raycastEntities(p.pos, next, targets, p.shooterId);
        if (entHit) {
          this._onHitEntity(p, entHit.entity, entHit);
          if (p.type === 'arrow') {
            p.pos = { x: entHit.x, y: entHit.y, z: entHit.z };
          } else {
            toRemove.push(p);
            continue;
          }
        }
      }

      p.pos = next;
      this.updateMeshOrientation(p);

      if (p.ticksAlive > p.def.lifetime) toRemove.push(p);
    }

    for (const p of toRemove) {
      this.remove(p);
    }
  }

  // === Tick de bala (RF-031) ===
  _tickBullet(p, entities, toRemove) {
    p._prevPos = { ...p.pos };
    p.ticksAlive++;

    // Água: perde 80% da velocidade por tick
    const block = this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z));
    const inWater = isWater(stateId(block));
    if (inWater) {
      p.vel.x *= 0.2;
      p.vel.y *= 0.2;
      p.vel.z *= 0.2;
    }

    // Sem arrasto no ar (drag = 1.0)
    p.vel.y -= p.gravity;

    const next = { x: p.pos.x + p.vel.x, y: p.pos.y + p.vel.y, z: p.pos.z + p.vel.z };

    // Distância percorrida
    const stepDist = Math.hypot(next.x - p.pos.x, next.y - p.pos.y, next.z - p.pos.z);
    p._distanceTraveled += stepDist;

    // Colisão com blocos (varredura)
    const blockHit = this.raycastBlocks(p.pos, next);
    if (blockHit) {
      p.pos = { x: blockHit.x, y: blockHit.y, z: blockHit.z };
      if (p.onHitBlock) p.onHitBlock(p, blockHit);
      toRemove.push(p);
      return;
    }

    // Colisão com entidades (varredura)
    if (entities && entities.length > 0) {
      const entHit = this.raycastEntities(p.pos, next, entities, p.shooterId);
      if (entHit) {
        // Calcular distância total da origem
        const dist = Math.hypot(p.pos.x - p._origin.x, p.pos.y - p._origin.y, p.pos.z - p._origin.z);
        this._onBulletHitEntity(p, entHit.entity, entHit, dist);
        toRemove.push(p);
        return;
      }
    }

    p.pos = next;
    this.updateMeshOrientation(p);

    // Tempo de vida (balas desaparecem rápido)
    if (p.ticksAlive > p.lifetime || p._distanceTraveled > p.maxRange * 1.5) {
      toRemove.push(p);
    }
  }

  _onBulletHitEntity(p, entity, hit, dist) {
    // O dano é calculado no callback onHitEntity (no GunController)
    if (p.onHitEntity) p.onHitEntity(p, entity, hit);
  }

  // === Tick de granada (RF-039) ===
  _tickGrenade(p, toRemove) {
    p._prevPos = { ...p.pos };
    p.ticksAlive++;

    // Física
    const block = this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z));
    const inWater = isWater(stateId(block));
    const drag = inWater ? 0.6 : 0.99;

    p.vel.x *= drag;
    p.vel.z *= drag;
    p.vel.y = p.vel.y * drag - p.gravity;

    const next = { x: p.pos.x + p.vel.x, y: p.pos.y + p.vel.y, z: p.pos.z + p.vel.z };

    // Colisão com blocos → quica
    const blockHit = this.raycastBlocks(p.pos, next);
    if (blockHit) {
      // Perde 60% da velocidade por impacto
      p.vel.x *= 0.4;
      p.vel.z *= 0.4;
      p.vel.y *= -0.4; // quica
      p.pos = { x: blockHit.x, y: blockHit.y, z: blockHit.z };
    } else {
      p.pos = next;
    }

    this.updateMeshOrientation(p);

    // Pavio
    if (p.fuseTicks !== null) {
      p.fuseTicks--;
      if (p.fuseTicks <= 0) {
        // Explodir
        if (p.onExplode) p.onExplode(p.pos);
        toRemove.push(p);
        return;
      }
    }

    if (p.ticksAlive > p.lifetime) toRemove.push(p);
  }

  _onHitEntity(p, entity, hit) {
    if (p.type === 'arrow') {
      const { damage, crit } = calculateArrowDamage(p.charge, p.speed);
      // Knockback na direção da flecha
      const dir = { x: p.vel.x, y: 0, z: p.vel.z };
      const len = Math.hypot(dir.x, dir.z) || 1;
      dir.x /= len; dir.z /= len;
      if (entity.vel) {
        entity.vel.x = (entity.vel.x || 0) / 2 + dir.x * 0.4;
        entity.vel.z = (entity.vel.z || 0) / 2 + dir.z * 0.4;
        entity.vel.y = Math.min((entity.vel.y || 0) / 2 + 0.4, 0.4);
      }
      entity._lastAttacker = p.shooterName;
      if (typeof entity.applyDamage === 'function') {
        entity.applyDamage(damage, 'projectile', p.shooter || { name: p.shooterName });
      } else {
        if (entity && !Array.isArray(entity.effects)) entity.effects = [];
        applyDamage(entity, damage, 'projectile');
      }
    } else if (p.type === 'snowball' || p.type === 'egg' || p.type === 'fishing_bobber') {
      // Knockback sem dano (RF-030, RF-031)
      if (p.def.knockback && entity.vel) {
        const dir = { x: p.vel.x, z: p.vel.z };
        const len = Math.hypot(dir.x, dir.z) || 1;
        entity.vel.x = (entity.vel.x || 0) / 2 + (dir.x / len) * 0.2;
        entity.vel.z = (entity.vel.z || 0) / 2 + (dir.z / len) * 0.2;
      }
    } else if (p.type === 'ender_pearl') {
      // Teleportar atirador (RF-032)
      if (p.shooterTeleport) p.shooterTeleport(p.pos);
      applyDamage(entity, p.def.damage, 'fall');
    }
    if (p.onHitEntity) p.onHitEntity(p, entity, hit);
  }

  remove(p) {
    if (p.mesh) {
      this.scene.remove(p.mesh);
      p.mesh.geometry = null;
      p.mesh.material?.dispose?.();
      p.mesh = null;
    }
    const idx = this.projectiles.indexOf(p);
    if (idx >= 0) this.projectiles.splice(idx, 1);
  }

  clearAll() { for (const p of [...this.projectiles]) this.remove(p); this.projectiles.length = 0; }

  dispose() {
    for (const p of [...this.projectiles]) this.remove(p);
    this._arrowGeo.dispose();
    this._ballGeo.dispose();
  }
}