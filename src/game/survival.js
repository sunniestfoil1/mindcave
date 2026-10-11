// Sobrevivência: dano, fome, XP, morte, comida, sono — PRD 05 RF-020..062
import { Effect, hasEffect, getAmplifier, addEffect, tickEffects, getSpeedModifier, getMiningSpeedModifier } from './effects';
import { getBlock, isWater, isLava, isSolid, isOpaque, BLOCK_NAMES, packState } from './blocks';
import { stateId } from './chunk';

// === Constantes de dano (1.8.9) ===
export const Dmg = {
  VOID: 4, DROWN: 2, SUFFOCATE: 1, LAVA: 4, FIRE: 1, BURN: 1,
  CACTUS: 1, STARVE: 1, LIGHTNING: 5, FALL_BASE: 3,
};

const ARMOR_REDUCES = new Set(['attack', 'explosion', 'projectile', 'cactus', 'fire', 'lightning', 'falling_block']);
const BYPASSES_INVULN = new Set(['void', 'kill', 'hunger']);

// === Estado de sobrevivência ===
export function createSurvivalState(gameMode = 'creative') {
  return {
    health: 20, maxHealth: 20, absorption: 0,
    hunger: 20, saturation: 5, exhaustion: 0,
    air: 300, xp: 0, xpLevel: 0,
    fallDistance: 0, fireTicks: 0,
    hurtTime: 0, hurtResistantTime: 0, lastDamage: 0, lastDamageSource: null,
    effects: [],
    isDead: false,
    foodTimer: 0, starveTimer: 0, regenTimer: 0,
    suffocateTimer: 0, drownTimer: 0, lavaTimer: 0, fireTimer: 0, cactusTimer: 0, voidTimer: 0, burnTimer: 0,
    eating: false, eatingTicks: 0, eatingItem: null,
    sleeping: false, sleepTimer: 0,
    spawnX: 0, spawnY: 70, spawnZ: 0, hasBedSpawn: false,
    stats: {
      blocksMined: 0, distanceWalked: 0, distanceSprinted: 0, distanceFallen: 0,
      damageDealt: 0, damageTaken: 0, deaths: 0, jumps: 0,
      timePlayed: 0, timeSinceDeath: 0, foodEaten: 0, itemsPicked: 0, sleptCount: 0,
    },
  };
}

// Tabela de pontos de armadura (MC 1.8.9)
const ARMOR_POINTS = {
  298: 1, 299: 3, 300: 5, 301: 1,   // Couro
  302: 2, 303: 5, 304: 6, 305: 2,   // Corrente
  306: 2, 307: 6, 308: 5, 309: 2,   // Ferro
  310: 3, 311: 8, 312: 6, 313: 3,   // Diamante
  314: 2, 315: 5, 316: 3, 317: 1,   // Ouro
};

export function computeArmorPoints(inventory) {
  if (!inventory || !inventory.armor) return 0;
  return inventory.armor.reduce((sum, slot) => sum + (slot ? (ARMOR_POINTS[slot.id] || 0) : 0), 0);
}

// === Dano ===
export function applyDamage(p, amount, source, opts = {}) {
  if (p.isDead) return false;
  if (p.gameMode === 'creative' && source !== 'void' && source !== 'kill') return false;
  if (p.gameMode === 'spectator') return false;

  // Janela de invulnerabilidade (10 ticks / 500ms) — Dano Concorrente 1.8.9
  let effectiveAmount = amount;
  if (p.hurtResistantTime > 0 && !BYPASSES_INVULN.has(source) && !opts.bypass) {
    if (amount <= (p.lastDamage || 0)) return false;
    effectiveAmount = amount - (p.lastDamage || 0);
    p.lastDamage = amount;
  } else {
    p.lastDamage = amount;
  }

  let finalDamage = effectiveAmount;

  // Fire resistance cancela fogo/lava
  if ((source === 'fire' || source === 'lava' || source === 'burning') && hasEffect(p, Effect.FIRE_RESISTANCE)) {
    return false;
  }

  // Armadura
  if (ARMOR_REDUCES.has(source)) {
    const armor = p.inventory ? computeArmorPoints(p.inventory) : (p.armor || 0);
    p.armor = armor;
    finalDamage = amount * (1 - Math.min(20, armor) / 25);
  }

  // Resistência (-20% por nível, V = imune)
  const res = getAmplifier(p, Effect.RESISTANCE);
  if (res >= 0) {
    finalDamage *= Math.max(0, 1 - 0.2 * (res + 1));
    if (res >= 4 && source !== 'void') return false;
  }

  // Absorção
  if (p.absorption > 0) {
    const absorbed = Math.min(p.absorption, finalDamage);
    p.absorption -= absorbed;
    finalDamage -= absorbed;
  }

  if (finalDamage <= 0) return false;

  p.health -= finalDamage;
  p.hurtTime = 10;
  p.hurtResistantTime = 10;
  p.lastDamage = amount;
  p.lastDamageSource = source;
  p.exhaustion = Math.min(40, p.exhaustion + 0.3);
  p.stats.damageTaken += finalDamage;

  if (p.health <= 0) {
    p.health = 0;
    p.isDead = true;
  }
  return true;
}

// === XP ===
export function xpForNextLevel(level) {
  if (level <= 15) return 2 * level + 7;
  if (level <= 30) return 5 * level - 38;
  return 9 * level - 158;
}

export function addXP(p, amount) {
  p.xp += amount;
  while (p.xp >= xpForNextLevel(p.xpLevel)) {
    p.xp -= xpForNextLevel(p.xpLevel);
    p.xpLevel++;
  }
}

export function getXPProgress(p) {
  const need = xpForNextLevel(p.xpLevel);
  return need > 0 ? p.xp / need : 0;
}

// === Morte e renascimento ===
export function getDeathMessage(source, killer) {
  const k = killer || '';
  switch (source) {
    case 'fall': return k ? `foi derrubado de um lugar alto por ${k}` : 'caiu de um lugar alto';
    case 'void': return 'caiu no vazio';
    case 'drown': return 'se afogou';
    case 'lava': return k ? `tentou nadar na lava fugindo de ${k}` : 'tentou nadar na lava';
    case 'fire': case 'burning': return 'pegou fogo';
    case 'cactus': return 'foi espetado até a morte';
    case 'hunger': return 'morreu de fome';
    case 'lightning': return 'foi atingido por um raio';
    case 'explosion': return k ? `foi explodido por ${k}` : 'explodiu';
    case 'attack': return k ? `foi morto por ${k}` : 'foi morto';
    case 'magic': return 'foi morto por magia';
    case 'poison': return 'foi envenenado';
    case 'wither': return 'definhou';
    case 'kill': return 'foi morto';
    default: return 'morreu';
  }
}

export function getDroppedXP(p) {
  return Math.min(7 * p.xpLevel, 100);
}

// === Comidas (1.8.9) ===
export const FOODS = {
  260: { name: 'Maçã', hunger: 4, saturation: 2.4 },
  322: { name: 'Maçã Dourada', hunger: 4, saturation: 9.6, always: true, effects: [
    { type: Effect.REGENERATION, duration: 100, amplifier: 1 },
    { type: Effect.ABSORPTION, duration: 2400, amplifier: 0 },
  ]},
  466: { name: 'Maçã Dourada Encantada', hunger: 4, saturation: 9.6, always: true, effects: [
    { type: Effect.REGENERATION, duration: 600, amplifier: 4 },
    { type: Effect.ABSORPTION, duration: 2400, amplifier: 0 },
    { type: Effect.RESISTANCE, duration: 6000, amplifier: 0 },
    { type: Effect.FIRE_RESISTANCE, duration: 6000, amplifier: 0 },
  ]},
  297: { name: 'Pão', hunger: 5, saturation: 6.0 },
  392: { name: 'Batata', hunger: 1, saturation: 0.6 },
  393: { name: 'Batata Assada', hunger: 5, saturation: 6.0 },
  394: { name: 'Batata Venenosa', hunger: 2, saturation: 1.2, chance: { 0.6: { type: Effect.POISON, duration: 100, amplifier: 0 } } },
  391: { name: 'Cenoura', hunger: 3, saturation: 3.6 },
  396: { name: 'Cenoura Dourada', hunger: 6, saturation: 14.4 },
  363: { name: 'Carne Crua', hunger: 3, saturation: 1.8 },
  364: { name: 'Bife', hunger: 8, saturation: 12.8 },
  319: { name: 'Costeleta Crua', hunger: 3, saturation: 1.8 },
  320: { name: 'Costeleta Assada', hunger: 8, saturation: 12.8 },
  366: { name: 'Frango Cru', hunger: 2, saturation: 1.2, chance: { 0.3: { type: Effect.HUNGER, duration: 600, amplifier: 0 } } },
  365: { name: 'Frango Assado', hunger: 6, saturation: 7.2 },
  423: { name: 'Carneiro Cru', hunger: 2, saturation: 1.2 },
  424: { name: 'Carneiro Assado', hunger: 6, saturation: 9.6 },
  411: { name: 'Coelho Cru', hunger: 3, saturation: 1.8 },
  412: { name: 'Coelho Assado', hunger: 5, saturation: 6.0 },
  413: { name: 'Ensopado de Coelho', hunger: 10, saturation: 12.0 },
  349: { name: 'Peixe Cru', hunger: 2, saturation: 0.4 },
  350: { name: 'Peixe Assado', hunger: 5, saturation: 6.0 },
  351: { name: 'Salmão Assado', hunger: 6, saturation: 9.6 },
  354: { name: 'Peixe-Palhaço', hunger: 1, saturation: 0.2 },
  352: { name: 'Baiacu', hunger: 1, saturation: 0.2, effects: [
    { type: Effect.HUNGER, duration: 300, amplifier: 2 },
    { type: Effect.NAUSEA, duration: 300, amplifier: 1 },
    { type: Effect.POISON, duration: 1200, amplifier: 3 },
  ]},
  357: { name: 'Biscoito', hunger: 2, saturation: 0.4 },
  360: { name: 'Melancia', hunger: 2, saturation: 1.2 },
  400: { name: 'Torta de Abóbora', hunger: 8, saturation: 4.8 },
  282: { name: 'Ensopado de Cogumelo', hunger: 6, saturation: 7.2 },
  367: { name: 'Carne Podre', hunger: 4, saturation: 0.8, chance: { 0.8: { type: Effect.HUNGER, duration: 600, amplifier: 0 } } },
  375: { name: 'Olho de Aranha', hunger: 2, saturation: 3.2, effects: [{ type: Effect.POISON, duration: 100, amplifier: 0 }] },
};

export const FOOD_NAMES = {};
for (const id in FOODS) FOOD_NAMES[FOODS[id].name.toLowerCase()] = parseInt(id);

export function isFood(id) { return !!FOODS[id]; }

export function canEat(p, foodId) {
  const food = FOODS[foodId];
  if (!food) return false;
  if (food.always) return true;
  return p.hunger < 20;
}

export function eatFood(p, foodId) {
  const food = FOODS[foodId];
  if (!food) return;
  p.hunger = Math.min(20, p.hunger + food.hunger);
  p.saturation = Math.min(p.hunger, p.saturation + food.saturation);
  p.stats.foodEaten++;
  if (food.effects) {
    for (const e of food.effects) addEffect(p, e.type, e.duration, e.amplifier, false, true);
  }
  if (food.chance) {
    for (const probStr in food.chance) {
      if (Math.random() < parseFloat(probStr)) {
        const e = food.chance[probStr];
        addEffect(p, e.type, e.duration, e.amplifier, false, true);
      }
    }
  }
}

// === Sono ===
export function canSleep(p, worldTime, isThundering) {
  const t = worldTime % 24000;
  const isNight = t >= 12541 && t <= 23458;
  if (!isNight && !isThundering) return { ok: false, reason: 'Você só pode dormir à noite' };
  return { ok: true };
}

// === Tick principal de sobrevivência ===
export function tickSurvival(p, world, ctx) {
  if (p.isDead) return;
  const { difficulty, gameRules, weather } = ctx;
  const pos = p.pos;

  // 1. Efeitos
  tickEffects(p);

  // 2. Rastreamento de queda
  const eyeBlock = world.getBlock(Math.floor(pos.x), Math.floor(pos.y + 1.62), Math.floor(pos.z));
  const eyeId = stateId(eyeBlock);
  const inWater = isWater(eyeId);
  const feetBlock = world.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  const feetId = stateId(feetBlock);

  if (!p.onGround && p.vel.y < 0) {
    p.fallDistance += -p.vel.y;
  }

  // Resetar queda em água/teia/escada/trepadeira/slime
  if (inWater || feetId === 30 || feetId === 165 || feetId === 106 || feetId === 79) {
    p.fallDistance = 0;
  }

  if (p.onGround && p.fallDistance > 0) {
    const dist = p.fallDistance;
    p.fallDistance = 0;
    const jumpBoost = getAmplifier(p, Effect.JUMP_BOOST);
    const effectiveDist = Math.max(0, dist - (jumpBoost >= 0 ? (jumpBoost + 1) : 0));
    if (effectiveDist > Dmg.FALL_BASE) {
      const dmg = Math.ceil(effectiveDist - Dmg.FALL_BASE);
      applyDamage(p, dmg, 'fall');
    }
  }

  // 3. Dano ambiental
  tickEnvDamage(p, world, ctx, eyeId, feetId);

  // 4. Burning tick
  if (p.fireTicks > 0) {
    p.burnTimer++;
    if (p.burnTimer >= 20) {
      p.burnTimer = 0;
      applyDamage(p, Dmg.BURN, 'burning');
    }
    p.fireTicks--;
    if (inWater || (weather && weather.isRainingAt(pos.x, pos.z, world))) {
      p.fireTicks = 0;
    }
  }

  // 5. Fome e regeneração
  tickHunger(p, difficulty, gameRules);

  // 6. Ar / afogamento
  if (inWater && !hasEffect(p, Effect.WATER_BREATHING)) {
    p.air--;
    if (p.air <= -20) {
      p.air = -20;
      p.drownTimer++;
      if (p.drownTimer >= 20) {
        p.drownTimer = 0;
        applyDamage(p, Dmg.DROWN, 'drown');
      }
    }
  } else {
    p.air = Math.min(300, p.air + 5);
    p.drownTimer = 0;
  }

  // 7. Timers
  if (p.hurtTime > 0) p.hurtTime--;
  if (p.hurtResistantTime > 0) p.hurtResistantTime--;

  // 8. Estatísticas
  p.stats.timePlayed++;
  p.stats.timeSinceDeath++;
  const spd = Math.hypot(p.vel.x, p.vel.z);
  if (spd > 0.1) {
    if (p.sprinting) p.stats.distanceSprinted += spd / 20;
    else p.stats.distanceWalked += spd / 20;
  }

  // 9. Morte
  if (p.health <= 0 && !p.isDead) {
    p.isDead = true;
    p.health = 0;
  }
}

function tickEnvDamage(p, world, ctx, eyeId, feetId) {
  const { difficulty, weather } = ctx;
  const pos = p.pos;

  // Vazio
  if (pos.y < -64) {
    p.voidTimer++;
    if (p.voidTimer >= 10) {
      p.voidTimer = 0;
      applyDamage(p, Dmg.VOID, 'void');
    }
  } else p.voidTimer = 0;

  // Sufocamento (cabeça em bloco sólido opaco)
  const headBlock = getBlock(eyeId);
  if (headBlock.solid && headBlock.opaque) {
    p.suffocateTimer++;
    if (p.suffocateTimer >= 10) {
      p.suffocateTimer = 0;
      applyDamage(p, Dmg.SUFFOCATE, 'suffocate');
    }
  } else p.suffocateTimer = 0;

  // Lava
  if (isLava(eyeId) || isLava(feetId)) {
    p.lavaTimer++;
    if (p.lavaTimer >= 10) {
      p.lavaTimer = 0;
      applyDamage(p, Dmg.LAVA, 'lava');
    }
    if (!hasEffect(p, Effect.FIRE_RESISTANCE)) p.fireTicks = Math.max(p.fireTicks, 300);
  } else p.lavaTimer = 0;

  // Fogo (bloco de fogo nos pés)
  if (feetId === 51 || eyeId === 51) {
    p.fireTimer++;
    if (p.fireTimer >= 10) {
      p.fireTimer = 0;
      applyDamage(p, Dmg.FIRE, 'fire');
    }
    p.fireTicks = Math.max(p.fireTicks, 160);
  } else p.fireTimer = 0;

  // Cacto
  const cx = Math.floor(pos.x), cy = Math.floor(pos.y), cz = Math.floor(pos.z);
  let touchingCactus = false;
  for (const [dx, dy, dz] of [[0,0,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0]]) {
    if (stateId(world.getBlock(cx+dx, cy+dy, cz+dz)) === 81) { touchingCactus = true; break; }
  }
  if (touchingCactus) {
    p.cactusTimer++;
    if (p.cactusTimer >= 10) {
      p.cactusTimer = 0;
      applyDamage(p, Dmg.CACTUS, 'cactus');
    }
  } else p.cactusTimer = 0;

  // Raio (se atingido — gerenciado pelo weather)
  if (p._lightningHit) {
    p._lightningHit = false;
    applyDamage(p, Dmg.LIGHTNING, 'lightning');
    p.fireTicks = Math.max(p.fireTicks, 160);
  }
}

function tickHunger(p, difficulty, gameRules) {
  // Processar exaustão
  if (p.exhaustion >= 4.0) {
    p.exhaustion -= 4.0;
    if (p.saturation > 0) p.saturation = Math.max(0, p.saturation - 1);
    else p.hunger = Math.max(0, p.hunger - 1);
  }

  // Regeneração natural (naturalRegeneration default true)
  if (gameRules.naturalRegeneration !== false && p.hunger >= 18 && p.health < p.maxHealth) {
    p.regenTimer++;
    if (p.regenTimer >= 80) {
      p.regenTimer = 0;
      p.health = Math.min(p.maxHealth, p.health + 1);
      p.exhaustion = Math.min(40, p.exhaustion + 3.0);
    }
  } else p.regenTimer = 0;

  // Pacífico: regenera mesmo com fome baixa
  if (difficulty === 'peaceful') {
    p.foodTimer++;
    if (p.foodTimer >= 20) {
      p.foodTimer = 0;
      if (p.health < p.maxHealth) p.health = Math.min(p.maxHealth, p.health + 1);
    }
    p.hunger = Math.min(20, p.hunger + 0.1);
    if (p.hunger > 20) p.hunger = 20;
    return;
  }
  p.foodTimer = 0;

  // Fome = 0 → dano de fome
  if (p.hunger <= 0) {
    p.starveTimer++;
    if (p.starveTimer >= 80) {
      p.starveTimer = 0;
      let stopAt = 0;
      if (difficulty === 'easy') stopAt = 10;
      else if (difficulty === 'normal') stopAt = 1;
      else stopAt = 0;
      if (p.health > stopAt) applyDamage(p, Dmg.STARVE, 'hunger');
    }
  } else p.starveTimer = 0;
}

export function respawn(p, spawnPoint) {
  p.health = p.maxHealth = 20;
  p.absorption = 0;
  p.hunger = 20;
  p.saturation = 5;
  p.exhaustion = 0;
  p.air = 300;
  p.xp = 0;
  p.xpLevel = 0;
  p.fallDistance = 0;
  p.fireTicks = 0;
  p.hurtTime = 0;
  p.hurtResistantTime = 0;
  p.lastDamage = 0;
  p.lastDamageSource = null;
  p.effects = [];
  p.isDead = false;
  p.eating = false;
  p.eatingTicks = 0;
  p.sleeping = false;
  p.pos.x = spawnPoint.x;
  p.pos.y = spawnPoint.y;
  p.pos.z = spawnPoint.z;
  p.vel.x = 0; p.vel.y = 0; p.vel.z = 0;
  p.stats.timeSinceDeath = 0;
}

export function serializeSurvival(p) {
  if (!p) return '{}';
  return JSON.stringify({
    health: p.health, maxHealth: p.maxHealth, absorption: p.absorption,
    hunger: p.hunger, saturation: p.saturation, exhaustion: p.exhaustion,
    air: p.air, xp: p.xp, xpLevel: p.xpLevel,
    fireTicks: p.fireTicks,
    effects: p.effects.map(e => ({ type: e.type, duration: e.duration, amplifier: e.amplifier, ambient: e.ambient, particles: e.particles })),
    spawnX: p.spawnX, spawnY: p.spawnY, spawnZ: p.spawnZ, hasBedSpawn: p.hasBedSpawn,
    stats: p.stats,
  });
}

export function deserializeSurvival(p, data) {
  if (!data) return;
  try {
    const d = typeof data === 'string' ? JSON.parse(data) : data;
    p.health = d.health ?? 20;
    p.maxHealth = d.maxHealth ?? 20;
    p.absorption = d.absorption ?? 0;
    p.hunger = d.hunger ?? 20;
    p.saturation = d.saturation ?? 5;
    p.exhaustion = d.exhaustion ?? 0;
    p.air = d.air ?? 300;
    p.xp = d.xp ?? 0;
    p.xpLevel = d.xpLevel ?? 0;
    p.fireTicks = d.fireTicks ?? 0;
    p.effects = (d.effects || []).map(e => ({ ...e, _fresh: false }));
    p.spawnX = d.spawnX ?? 0;
    p.spawnY = d.spawnY ?? 70;
    p.spawnZ = d.spawnZ ?? 0;
    p.hasBedSpawn = d.hasBedSpawn ?? false;
    if (d.stats) p.stats = { ...p.stats, ...d.stats };
  } catch (e) {}
}

export { getSpeedModifier, getMiningSpeedModifier, tickEffects };