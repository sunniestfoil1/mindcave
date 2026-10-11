// Combate 1.8.9 — PRD 07 RF-001..034
// Lógica instantânea e independente da animação (como no 1.8)
import { Effect, getAmplifier, hasEffect } from './effects';
import { getItem, isWeapon } from './items';
import { isWater } from './blocks';
import { stateId } from './chunk';
import { applyDamage } from './survival';

// === Alcance (RF-002) ===
export const ATTACK_REACH = { survival: 3.0, creative: 6.0 };

// === Tipos de item de combate ===
export function isSword(item) {
  if (!item || !item.id) return false;
  const def = getItem(item.id);
  return !!(def && def.weapon && !def.tool);
}

export function isBow(item) {
  if (!item || !item.id) return false;
  return item.id === 261;
}

export function isThrowable(id) {
  return id === 332 || id === 344 || id === 368; // snowball, egg, ender_pearl
}

// === Dano base (RF-004, RF-007) ===
export function getAttackDamage(attacker, item) {
  let dmg;
  if (!item || !item.id) {
    dmg = 1; // soco
  } else {
    const def = getItem(item.id);
    if (def && def.weaponDamage) dmg = def.weaponDamage;
    else dmg = 1; // bloco/item comum = 1
  }
  // Força 1.8.9: +130% do dano base por nível
  const str = getAmplifier(attacker, Effect.STRENGTH);
  if (str >= 0) dmg += dmg * 1.3 * (str + 1);
  // Fraqueza 1.8.9: -1 dano (0.5 coração)
  const weak = getAmplifier(attacker, Effect.WEAKNESS);
  if (weak >= 0) dmg -= 1 * (weak + 1);
  return Math.max(0, dmg);
}

// === Crítico (RF-004.2) ===
export function isCriticalHit(attacker, world) {
  if (!attacker.vel) return false;
  // caindo (vel.y < 0) e não no chão
  if (attacker.vel.y >= 0) return false;
  if (attacker.onGround) return false;
  if (attacker.fallDistance !== undefined && attacker.fallDistance <= 0) return false;
  // não em escada/trepadeira
  const p = attacker.pos;
  const feetId = stateId(world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)));
  if (feetId === 30 || feetId === 165 || feetId === 106) return false;
  // não na água
  const eyeId = stateId(world.getBlock(Math.floor(p.x), Math.floor(p.y + 1.62), Math.floor(p.z)));
  if (isWater(eyeId) || isWater(feetId)) return false;
  // não cego, não montado
  if (hasEffect(attacker, Effect.BLINDNESS)) return false;
  if (attacker.riding) return false;
  return true;
}

// === Dano final com crítico e encantamentos (RF-004.2..3) ===
export function calculateAttackDamage(attacker, item, world) {
  let dmg = getAttackDamage(attacker, item);
  const crit = isCriticalHit(attacker, world);
  if (crit) dmg = Math.floor(dmg * 1.5);
  // Encantamentos (Afiação +1,25/nível — PRD 11 placeholder)
  if (item && item.enchants) {
    const sharp = item.enchants.sharpness || 0;
    if (sharp > 0) dmg += 1 + Math.floor(1.25 * sharp);
  }
  return { damage: Math.max(0, dmg), crit };
}

// === Knockback 1.8.9 (RF-005) ===
export function applyKnockback(target, attackerPos, sprinting, knockbackLevel = 0) {
  const tp = target.pos, ap = attackerPos;
  const dx = tp.x - ap.x;
  const dz = tp.z - ap.z;
  const d = Math.hypot(dx, dz);
  const normX = d > 0.0001 ? dx / d : 0;
  const normZ = d > 0.0001 ? dz / d : 1;

  // Nível efetivo: sprint adiciona +1 ao knockback horizontal
  const effKb = 0.4 + (sprinting ? 0.4 : 0) + (knockbackLevel * 0.5);

  if (!target.vel) target.vel = { x: 0, y: 0, z: 0 };
  const curVx = target.vel.x || 0;
  const curVz = target.vel.z || 0;

  // Fórmula oficial 1.8.9: (V_atual / 2) + direção_normalizada * 0.4
  target.vel.x = (curVx / 2) + normX * effKb;
  target.vel.z = (curVz / 2) + normZ * effKb;

  // Impulso vertical se no chão
  if (target.onGround !== false) {
    target.vel.y = 0.4;
  } else {
    target.vel.y = Math.min((target.vel.y || 0) / 2 + 0.35, 0.4);
  }

  return { x: target.vel.x, y: target.vel.y, z: target.vel.z };
}

// === Bloqueio com espada (RF-006) ===
const BLOCKABLE_SOURCES = new Set(['attack', 'projectile', 'explosion']);
export function canBlockDamage(source) { return BLOCKABLE_SOURCES.has(source); }

// (1 + dano) × 0,5 — regra 1.8
export function getBlockedDamage(damage) {
  return Math.floor((1 + damage) * 0.5);
}

export function isBlocking(player) {
  return !!player.blocking;
}

// === Dano de flecha (RF-022) ===
export function calculateArrowDamage(charge, velocity) {
  let dmg = Math.ceil(velocity * 2.0);
  const crit = charge >= 1.0;
  if (crit) {
    // Crítico: +aleatório até +50%
    dmg += Math.floor(Math.random() * (dmg * 0.5 + 1));
    dmg = Math.min(dmg, 10);
  }
  return { damage: Math.max(1, dmg), crit };
}

// Carga do arco (RF-020): f = t/20; f = (f² + 2f)/3; máx 1
export function computeBowCharge(ticksHeld) {
  let f = ticksHeld / 20;
  f = (f * f + 2 * f) / 3;
  return Math.min(1, f);
}

// Velocidade inicial da flecha (RF-021)
export function getArrowVelocity(charge, lookDir, shooterVel) {
  const speed = charge * 3.0;
  const vx = lookDir.x * speed + (shooterVel ? shooterVel.x : 0);
  const vy = lookDir.y * speed + (shooterVel ? shooterVel.y : 0);
  const vz = lookDir.z * speed + (shooterVel ? shooterVel.z : 0);
  // Pequena dispersão aleatória 1.8
  const disp = 0.0075;
  return {
    x: vx + (Math.random() - 0.5) * disp,
    y: vy + (Math.random() - 0.5) * disp,
    z: vz + (Math.random() - 0.5) * disp,
  };
}

// === Ataque corpo a corpo completo (RF-001..008) ===
export function attackEntity(attacker, target, world, opts = {}) {
  if (target.isDead) return { hit: false, reason: 'dead' };

  const item = opts.item || (attacker.hotbar && attacker.hotbar[attacker.selectedSlot]) || null;
  const { damage, crit } = calculateAttackDamage(attacker, item, world);

  // Janela de invulnerabilidade (10 ticks / 500ms — MC 1.8.9)
  // Cálculo de Dano Concorrente: se o dano B for maior que o A original, aplica apenas a diferença
  let actualDamage = damage;
  if (target.hurtResistantTime > 0) {
    if (damage <= (target.lastDamage || 0)) {
      return { hit: false, reason: 'invuln' };
    }
    actualDamage = Math.max(0, damage - (target.lastDamage || 0));
    target.lastDamage = damage;
  } else {
    target.lastDamage = damage;
  }

  // Bloqueio do alvo
  if (isBlocking(target) && canBlockDamage('attack')) {
    actualDamage = getBlockedDamage(actualDamage);
  }

  // Knockback (RF-005)
  const sprinting = attacker.sprinting;
  const kbLevel = (item && item.enchants && item.enchants.knockback) || 0;
  const kbVector = applyKnockback(target, attacker.pos, sprinting, kbLevel);

  // Registrar atacante para mensagem de morte (RF-008)
  target._lastAttacker = attacker.nomeJogador || attacker.name || 'alguém';
  target._lastWeapon = item && item.id ? (getItem(item.id)?.namePt || null) : null;

  // Aplicar dano
  applyDamageToTarget(target, actualDamage, 'attack');

  // Gastar exaustão (RF-004.5)
  if (attacker.exhaustion !== undefined) {
    attacker.exhaustion = Math.min(40, attacker.exhaustion + 0.3);
  }
  // Durabilidade (RF-004.5 / RF-007)
  if (item && item.durability !== undefined) {
    item.durability--;
    if (item.durability <= 0) {
      // Quebrar ferramenta
      attacker.hotbar[attacker.selectedSlot] = { id: 0, meta: 0 };
    }
  }
  if (attacker.stats) attacker.stats.damageDealt += actualDamage;

  // Interromper sprint do atacante após golpe correndo (RF-005)
  if (sprinting && attacker.vel) {
    attacker.sprinting = false;
    attacker.vel.x *= 0.6;
    attacker.vel.z *= 0.6;
  }

  return { hit: true, damage: actualDamage, crit, kbLevel, blocked: isBlocking(target) };
}

// Aplica dano respeitando a janela de invulnerabilidade — reaproveita applyDamage do survival
function applyDamageToTarget(target, amount, source) {
  applyDamage(target, amount, source, { bypass: false });
}

// === Mensagem de morte PvP (RF-008) ===
export function getDeathMessageWithWeapon(source, killer, weapon) {
  const k = killer || '';
  if (source === 'attack' && k) {
    if (weapon) return `${k} matou você usando [${weapon}]`;
    return `${k} matou você`;
  }
  // Fallback para o sistema existente
  return k ? `${k} causou sua morte` : 'morreu';
}

// === Projéteis (RF-020..034) ===
export const PROJECTILE_TYPES = {
  arrow:      { gravity: 0.05, drag: 0.99, dragWater: 0.6, lifetime: 1200, damage: null, color: 0x806040 },
  snowball:   { gravity: 0.03, drag: 0.99, dragWater: 0.6, lifetime: 1200, damage: 0, color: 0xf0f0f0, knockback: true },
  egg:        { gravity: 0.03, drag: 0.99, dragWater: 0.6, lifetime: 1200, damage: 0, color: 0xffe8c0, knockback: true },
  ender_pearl:{ gravity: 0.03, drag: 0.99, dragWater: 0.6, lifetime: 1200, damage: 5, color: 0x18e07a, teleport: true },
  fishing_bobber: { gravity: 0.03, drag: 0.92, dragWater: 0.4, lifetime: 1200, damage: 0, color: 0xc0c0c0, knockback: true },
  bullet:     { gravity: 0.01, drag: 1.0, dragWater: 0.2, lifetime: 20, damage: 0, color: 0xffee44, isBullet: true },
  grenade:    { gravity: 0.04, drag: 0.99, dragWater: 0.6, lifetime: 200, damage: 0, color: 0x4a5a3a, isGrenade: true },
};

export function getProjectileType(id) {
  switch (id) {
    case 262: return 'arrow';
    case 332: return 'snowball';
    case 344: return 'egg';
    case 368: return 'ender_pearl';
    case 346: return 'fishing_bobber';
    default: return null;
  }
}

// === CPS (RF-012) ===
export function createCpsTracker() {
  return { clicks: [], lastCps: 0, timer: 0 };
}

export function recordClick(cps) {
  const now = performance.now();
  cps.clicks.push(now);
  // Remove cliques com mais de 1 segundo
  cps.clicks = cps.clicks.filter(t => now - t < 1000);
}

export function getCps(cps) {
  const now = performance.now();
  cps.clicks = cps.clicks.filter(t => now - t < 1000);
  return cps.clicks.length;
}