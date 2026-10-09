// Sistema de tiro: estado, cadência, recarga, ADS, recuo, modos — PRD 09 RF-030..037
import { GUNS, AMMO_TYPES, GRENADE_ITEM_ID, GRENADE_FUSE_TICKS, GRENADE_POWER,
  getGunDef, getGunState, getFireMode, getEffectiveMagSize, getEffectiveReloadTime,
  calculateBulletDamage, calculateSpread, getNoiseRadius } from './registry';
import { removeItems, countItems } from '../inventory';
import { applyDamage } from '../survival';
import { stateId } from '../chunk';
import { isSolid, isWater } from '../blocks';

// Estado do controlador de armas (uma instância por jogador/engine)
export class GunController {
  constructor(engine) {
    this.engine = engine;
    this.cooldown = 0;          // ticks até próximo tiro
    this.reloadTimer = 0;       // ticks restantes de recarga
    this.reloading = false;
    this.reloadItemType = null;
    this.ads = false;
    this.recoilTime = 0;
    this.maxRecoilTime = 6;
    this.recoilYawOffset = 0;
    this.recoilPitchOffset = 0;
    this.shotCounter = 0;       // para rastro (tracer a cada N)
    this.burstShotsLeft = 0;
    this.burstCooldown = 0;
    this.prevAttack = false;
    this.prevUse = false;
    this.prevReload = false;
    this.prevFireMode = false;
    this.grenadeFuseTimer = 0;
    this.cookingGrenade = false;
    this.lanternOn = false;
    this.stats = { shotsFired: 0, hits: 0, headshots: 0, kills: 0, ammoCrafted: 0, techZombieKills: {} };
    this.hitMarkerTime = 0;
    this.hitMarkerType = 'normal'; // 'normal' | 'kill' | 'headshot'
    this.damageIndicators = []; // { angle, time, dist }
  }

  getHeldItem() {
    return this.engine.getHeldItem();
  }

  isGunEquipped() {
    const item = this.getHeldItem();
    return item && getGunDef(item.id);
  }

  getGunState() {
    const item = this.getHeldItem();
    return item ? getGunState(item) : null;
  }

  tick(player, world, ctx) {
    const gameRules = ctx.gameRules || {};
    if (gameRules.gunsEnabled === false) return;

    // Timers
    if (this.cooldown > 0) this.cooldown--;
    if (this.recoilTime > 0) this.recoilTime--;
    if (this.hitMarkerTime > 0) this.hitMarkerTime--;
    if (this.burstCooldown > 0) this.burstCooldown--;
    // Recuperação de recuo (70% em ~6 ticks)
    if (this.recoilTime <= 0) {
      this.recoilPitchOffset *= 0.7;
      this.recoilYawOffset *= 0.7;
    }
    // Dano de granada cozinhando
    if (this.cookingGrenade) {
      this.grenadeFuseTimer++;
      if (this.grenadeFuseTimer >= GRENADE_FUSE_TICKS) {
        // Explode na mão
        this.cookingGrenade = false;
        this.grenadeFuseTimer = 0;
        ctx.onExplode?.(player.pos, GRENADE_POWER);
        // Consome granada
        this.consumeGrenade();
      }
    }

    // Recarga em progresso
    if (this.reloading) {
      this.reloadTimer--;
      if (this.reloadTimer <= 0) {
        this.finishReload(player, ctx.inventory);
      }
    }

    // Rajada (burst) em progresso
    if (this.burstShotsLeft > 0 && this.burstCooldown <= 0) {
      this.fire(player, world, ctx);
      this.burstShotsLeft--;
      this.burstCooldown = 3;
    }

    // Input
    const attackActive = this.engine.isAction('attack') && !this.engine.paused && !this.engine.chatOpen;
    const useActive = this.engine.isAction('use') && !this.engine.paused && !this.engine.chatOpen;
    const keys = (this.engine.settingsStore?.get('user.keys') || {});
    const reloadPressed = this.engine.keys['KeyR'] || false;
    const fireModePressed = this.engine.keys['KeyB'] || false;

    const attackPressed = attackActive && !this.prevAttack;
    const usePressed = useActive && !this.prevUse;

    const item = this.getHeldItem();

    // === Granada ===
    if (item && item.id === GRENADE_ITEM_ID) {
      if (attackPressed && !this.cookingGrenade) {
        this.cookingGrenade = true;
        this.grenadeFuseTimer = 0;
      }
      if (!attackActive && this.cookingGrenade) {
        // Arremessar
        const fuseLeft = GRENADE_FUSE_TICKS - this.grenadeFuseTimer;
        this.throwGrenade(player, ctx, fuseLeft);
        this.cookingGrenade = false;
        this.grenadeFuseTimer = 0;
      }
      this.prevAttack = attackActive;
      this.prevUse = useActive;
      return;
    }

    // === Arma de fogo ===
    if (!item || !getGunDef(item.id)) {
      this.prevAttack = attackActive;
      this.prevUse = useActive;
      return;
    }

    // ADS (botão direito)
    this.ads = useActive;

    // Recarga (R)
    if (reloadPressed && !this.prevReload && !this.reloading) {
      this.startReload(player, ctx.inventory);
    }
    this.prevReload = reloadPressed;

    // Trocar modo de disparo (B)
    if (fireModePressed && !this.prevFireMode) {
      this.cycleFireMode();
    }
    this.prevFireMode = fireModePressed;

    // Disparar (clique esquerdo)
    const state = this.getGunState();
    if (!state) { this.prevAttack = attackActive; this.prevUse = useActive; return; }
    const gunDef = GUNS[state.gunKey];
    const mode = getFireMode(item);

    if (attackActive) {
      if (gunDef.automatic || mode === 'auto') {
        // Automático: atira enquanto segura
        if (this.cooldown <= 0) this.fire(player, world, ctx);
      } else if (mode === 'burst') {
        // Rajada de 3
        if (this.cooldown <= 0 && this.burstShotsLeft === 0) {
          this.burstShotsLeft = gunDef.burstCount || 3;
          this.burstCooldown = 0;
        }
      } else {
        // Semi: um tiro por clique
        if (attackPressed && this.cooldown <= 0) this.fire(player, world, ctx);
      }
    }

    // Coronhada (Shift + atacar) — RF-030
    if (player.sneaking && attackPressed) {
      this.meleeButtstock(player, ctx);
    }

    this.prevAttack = attackActive;
    this.prevUse = useActive;
  }

  // === Disparar ===
  fire(player, world, ctx) {
    const item = this.getHeldItem();
    const state = getGunState(item);
    if (!state) return;
    const gun = GUNS[state.gunKey];
    if (!gun) return;

    // Verificar munição no carregador
    if (state.ammoInMag <= 0) {
      // Clique seco — tentar recarga automática
      if (!this.reloading) this.startReload(player, ctx.inventory);
      return;
    }

    // Cadência
    const ticksPerShot = Math.round(20 / gun.fireRate);
    this.cooldown = ticksPerShot;

    // Modo bolt: adiciona tempo extra
    if (getFireMode(item) === 'bolt') {
      this.cooldown = Math.max(this.cooldown, 25);
    }

    // Consumir munição
    state.ammoInMag--;

    // Durabilidade
    state.durability--;
    if (state.durability <= 0) {
      // Arma quebra
      player.hotbar[player.selectedSlot] = { id: 0, meta: 0 };
      return;
    }

    // Interromper sprint
    if (player.sprinting) {
      player.sprinting = false;
      player.vel.x *= 0.6;
      player.vel.z *= 0.6;
    }

    // Calcular dispersão
    const spread = calculateSpread(gun, player, this.ads, ctx.inventory);
    const silenced = !!state.accessories?.silencer;

    // Disparar projéteis
    const pellets = gun.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      this.spawnBullet(player, world, ctx, gun, spread, silenced);
    }

    // Recuo
    this.applyRecoil(gun, state);

    // Clarão, som, cápsula ejetada (efeitos visuais no render)
    this.muzzleFlashTime = 2;

    // Ruído atrai mobs (RF-038)
    const noiseRadius = getNoiseRadius(silenced);
    ctx.onGunshot?.(player.pos, noiseRadius);

    // Stats
    this.stats.shotsFired += pellets;
    this.shotCounter++;
  }

  spawnBullet(player, world, ctx, gun, spreadDeg, silenced) {
    if (!ctx.projectiles) return;
    const eye = this.engine.eyePos();
    const dir = this.engine.lookDir();

    // Aplicar recuo à direção
    const recoilYaw = this.recoilYawOffset * Math.PI / 180;
    const recoilPitch = this.recoilPitchOffset * Math.PI / 180;

    // Aplicar dispersão (cone aleatório)
    const spreadRad = spreadDeg * Math.PI / 180;
    const spreadYaw = (Math.random() - 0.5) * 2 * spreadRad;
    const spreadPitch = (Math.random() - 0.5) * 2 * spreadRad;

    // Combinar direção
    let dx = dir.x, dy = dir.y, dz = dir.z;
    // Rotacionar por spread (simplificado: rotação yaw + pitch)
    const cy = Math.cos(spreadYaw + recoilYaw), sy = Math.sin(spreadYaw + recoilYaw);
    const cp = Math.cos(spreadPitch + recoilPitch), sp = Math.sin(spreadPitch + recoilPitch);
    // Aplicar: primeiro pitch, depois yaw
    const len = Math.hypot(dx, dz);
    if (len > 0.001) {
      const newY = dy * cp - sp * len;
      const newLen = len * cp + dy * sp;
      dy = newY;
      const f = newLen / len;
      dx *= f; dz *= f;
    }
    // Yaw
    const newDx = dx * cy - dz * sy;
    const newDz = dx * sy + dz * cy;
    dx = newDx; dz = newDz;

    // Normalizar
    const dlen = Math.hypot(dx, dy, dz) || 1;
    dx /= dlen; dy /= dlen; dz /= dlen;

    const speed = gun.bulletSpeed;
    const vel = { x: dx * speed, y: dy * speed, z: dz * speed };

    // Tracer a cada N tiros (carabina: 1 a cada 3; outras: 1 a cada 4)
    const tracerInterval = gun.name === 'carbine' ? 3 : 4;
    const showTracer = this.shotCounter % tracerInterval === 0;

    // Multiplicador de dano
    const damageMult = (ctx.gameRules?.gunDamageMultiplier) || 1.0;

    const proj = ctx.projectiles.spawn('bullet', {
      pos: eye, vel,
      shooterId: player.id,
      shooterName: player.nomeJogador || player.name,
      gunKey: gun.name,
      damage: gun.damage * damageMult,
      headshotMult: gun.headshotMult || 1.5,
      effectiveRange: gun.effectiveRange,
      maxRange: gun.maxRange,
      damageFalloff: gun.damageFalloff,
      armorPenetration: gun.armorPenetration || 0,
      gravity: gun.bulletGravity,
      lifetime: gun.bulletLifetime,
      silenced,
      showTracer,
      onHitEntity: (p, entity, hit) => this._onBulletHitEntity(p, entity, hit, ctx, player),
      onHitBlock: (p, hit) => this._onBulletHitBlock(p, hit, ctx, world),
    });
    return proj;
  }

  _onBulletHitEntity(proj, entity, hit, ctx, player) {
    if (!entity) return;
    // Verificar se é tiro na cabeça
    const headY = entity.pos.y + (entity.height || 1.8) * 0.85;
    const isHeadshot = hit.y >= headY;

    // Calcular dano com queda de distância
    const dist = Math.hypot(proj.pos.x - (proj._origin?.x || 0), proj.pos.y - (proj._origin?.y || 0), proj.pos.z - (proj._origin?.z || 0));
    const gun = GUNS[proj.gunKey];
    let dmg = calculateBulletDamage(gun, dist, isHeadshot);

    // Penetração de armadura
    if (entity.type && entity.type.armor && proj.armorPenetration > 0) {
      const armorReduction = entity.type.armor / 25;
      const effectiveArmor = armorReduction * (1 - proj.armorPenetration);
      dmg = dmg / (1 - effectiveArmor + 0.001);
    }

    // Knockback pequeno
    if (entity.vel) {
      const dlen = Math.hypot(proj.vel.x, 0, proj.vel.z) || 1;
      entity.vel.x += (proj.vel.x / dlen) * 0.1;
      entity.vel.z += (proj.vel.z / dlen) * 0.1;
    }

    // Marcar atacante
    entity._lastAttacker = proj.shooterName;
    entity._lastWeapon = gun?.namePt;
    entity.lastDamageSource = 'gun';

    // Aplicar dano (sem janela de invulnerabilidade para armas de fogo)
    entity.hurtResistantTime = 0;
    if (entity.applyDamage) {
      entity.applyDamage(dmg, 'gun', player);
    } else {
      applyDamage(entity, dmg, 'gun');
    }

    // Zumbi blindado: dano reduzido por balas sem penetração
    if (entity.typeId === 'zombie_armored' && proj.armorPenetration <= 0) {
      // Já aplicou dano; não reduzir aqui (seria confuso)
    }

    // Hit marker
    this.hitMarkerTime = 10;
    if (entity.health <= 0) {
      this.hitMarkerType = 'kill';
      this.stats.kills++;
      // Zumbi tecnológico abatido
      if (entity.typeId && entity.typeId.startsWith('zombie_')) {
        this.stats.techZombieKills[entity.typeId] = (this.stats.techZombieKills[entity.typeId] || 0) + 1;
      }
    } else if (isHeadshot) {
      this.hitMarkerType = 'headshot';
      this.stats.headshots++;
    } else {
      this.hitMarkerType = 'normal';
    }
    this.stats.hits++;
  }

  _onBulletHitBlock(proj, hit, ctx, world) {
    const bx = hit.blockX, by = hit.blockY, bz = hit.blockZ;
    const blockState = world.getBlock(bx, by, bz);
    const blockId = stateId(blockState);

    // Vidro: quebra
    if (blockId === 20 || blockId === 95 || blockId === 102) {
      if (ctx.gameRules?.explosionsBreakBlocks !== false) {
        world.setBlock(bx, by, bz, 0);
      }
    }
    // TNT: acende
    if (blockId === 46) {
      world.setBlock(bx, by, bz, 51); // fire
    }
    // Marca de bala (decalque temporário) — gerenciado no render
    this._addBulletDecal(bx, by, bz, hit);
  }

  _addBulletDecal(bx, by, bz, hit) {
    if (!this.engine._bulletDecals) this.engine._bulletDecals = [];
    if (this.engine._bulletDecals.length >= 64) {
      const old = this.engine._bulletDecals.shift();
      if (old.mesh) this.engine.scene.remove(old.mesh);
    }
    // Simplificado: não criar mesh por enquanto, apenas registar para F3
    this.engine._bulletDecals.push({ x: bx, y: by, z: bz, time: 600 });
  }

  applyRecoil(gun, state) {
    this.recoilPitchOffset += gun.recoilV;
    // Recuo lateral aleatório (±30% do vertical)
    this.recoilYawOffset += (Math.random() - 0.5) * gun.recoilV * 0.6;
    this.recoilTime = this.maxRecoilTime;

    // Carabina: recuo crescente nos primeiros 8 tiros
    if (gun.recoilPattern === 'increasing') {
      this._carbineShotCount = (this._carbineShotCount || 0) + 1;
      if (this._carbineShotCount <= 8) {
        this.recoilPitchOffset += gun.recoilV * (this._carbineShotCount / 8);
      }
    } else {
      this._carbineShotCount = 0;
    }

    // Aplicar ao pitch/yaw do jogador
    this.engine.player.pitch -= gun.recoilV * Math.PI / 180 * 0.5;
    this.engine.player.yaw += (Math.random() - 0.5) * gun.recoilV * Math.PI / 180 * 0.3;
  }

  // === Recarga ===
  startReload(player, inventory) {
    const item = this.getHeldItem();
    const state = getGunState(item);
    if (!state) return;
    const gun = GUNS[state.gunKey];
    if (!gun) return;
    const magSize = getEffectiveMagSize(item);
    if (state.ammoInMag >= magSize) return;

    // Encontrar munição no inventário
    const ammoId = AMMO_TYPES[gun.ammoType].id;
    const hasAmmo = countItems(inventory, ammoId) > 0;
    if (!hasAmmo) return;

    this.reloading = true;
    this.reloadItemType = gun.ammoType;
    this.reloadTimer = getEffectiveReloadTime(item);
  }

  finishReload(player, inventory) {
    const item = this.getHeldItem();
    const state = getGunState(item);
    if (!state) { this.reloading = false; return; }
    const gun = GUNS[state.gunKey];
    if (!gun) { this.reloading = false; return; }

    const magSize = getEffectiveMagSize(item);
    const ammoId = AMMO_TYPES[gun.ammoType].id;
    const needed = magSize - state.ammoInMag;
    const available = countItems(inventory, ammoId);
    const toLoad = Math.min(needed, available);

    if (toLoad > 0) {
      removeItems(inventory, ammoId, toLoad);
      state.ammoInMag += toLoad;
    }
    this.reloading = false;
  }

  // Escopeta: recarga cartucho a cartucho
  reloadOneShell(player, inventory) {
    const item = this.getHeldItem();
    const state = getGunState(item);
    if (!state) return;
    const gun = GUNS[state.gunKey];
    if (!gun || !gun.perShellReload) return;
    const ammoId = AMMO_TYPES[gun.ammoType].id;
    const magSize = getEffectiveMagSize(item);
    if (state.ammoInMag >= magSize) return;
    if (countItems(inventory, ammoId) <= 0) return;
    removeItems(inventory, ammoId, 1);
    state.ammoInMag++;
  }

  cycleFireMode() {
    const item = this.getHeldItem();
    const state = getGunState(item);
    if (!state) return;
    const gun = GUNS[state.gunKey];
    if (!gun || gun.fireModes.length <= 1) return;
    state.fireModeIndex = (state.fireModeIndex + 1) % gun.fireModes.length;
  }

  // === Granada ===
  throwGrenade(player, ctx, fuseLeft) {
    const item = this.getHeldItem();
    if (!item || item.id !== GRENADE_ITEM_ID) return;
    if (!ctx.projectiles) return;

    const eye = this.engine.eyePos();
    const dir = this.engine.lookDir();
    const speed = 1.0;
    const vel = {
      x: dir.x * speed + (player.vel?.x || 0) * 0.5,
      y: dir.y * speed + 0.2,
      z: dir.z * speed + (player.vel?.z || 0) * 0.5,
    };

    ctx.projectiles.spawn('grenade', {
      pos: eye, vel,
      shooterId: player.id,
      shooterName: player.nomeJogador || player.name,
      fuseTicks: fuseLeft || GRENADE_FUSE_TICKS,
      onExplode: (pos) => ctx.onExplode?.(pos, GRENADE_POWER),
    });

    this.consumeGrenade();
  }

  consumeGrenade() {
    const slot = this.engine.player.hotbar[this.engine.player.selectedSlot];
    if (slot && slot.id === GRENADE_ITEM_ID) {
      slot.count = (slot.count || 1) - 1;
      if (slot.count <= 0) {
        this.engine.player.hotbar[this.engine.player.selectedSlot] = { id: 0, meta: 0 };
      }
    }
  }

  // === Coronhada ===
  meleeButtstock(player, ctx) {
    const entHit = this.engine.raycastEntity();
    if (entHit) {
      const dmg = 3;
      if (entHit.entity.applyDamage) {
        entHit.entity.applyDamage(dmg, 'melee', player);
      } else {
        applyDamage(entHit.entity, dmg, 'melee');
      }
      // Knockback alto
      if (entHit.entity.vel) {
        const dx = entHit.entity.pos.x - player.pos.x;
        const dz = entHit.entity.pos.z - player.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        entHit.entity.vel.x += (dx / d) * 0.6;
        entHit.entity.vel.z += (dz / d) * 0.6;
        entHit.entity.vel.y += 0.3;
      }
      this.cooldown = 20;
    }
  }

  // === HUD data ===
  getHudData() {
    const item = this.getHeldItem();
    if (!item) return null;
    if (item.id === GRENADE_ITEM_ID) {
      return { type: 'grenade', count: item.count, cooking: this.cookingGrenade, fuse: this.grenadeFuseTimer };
    }
    const state = getGunState(item);
    if (!state) return null;
    const gun = GUNS[state.gunKey];
    if (!gun) return null;
    const mode = gun.fireModes[state.fireModeIndex % gun.fireModes.length];
    return {
      type: 'gun',
      gunName: gun.namePt,
      ammoInMag: state.ammoInMag,
      magSize: getEffectiveMagSize(item),
      fireMode: mode.toUpperCase(),
      reloading: this.reloading,
      reloadProgress: this.reloading ? 1 - (this.reloadTimer / getEffectiveReloadTime(item)) : 0,
      ads: this.ads,
      durability: state.durability,
      maxDurability: gun.durability,
      hitMarker: this.hitMarkerTime > 0 ? this.hitMarkerType : null,
      silenced: !!state.accessories?.silencer,
      hasScope: !!state.accessories?.scope,
      lanternOn: this.lanternOn,
    };
  }
}