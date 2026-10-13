// Efeitos de status (1.8.9) — PRD 05 RF-100..101
export const Effect = {
  SPEED: 1, SLOWNESS: 2, HASTE: 3, MINING_FATIGUE: 4, STRENGTH: 5,
  INSTANT_HEALTH: 6, INSTANT_DAMAGE: 7, JUMP_BOOST: 8, NAUSEA: 9,
  REGENERATION: 10, RESISTANCE: 11, FIRE_RESISTANCE: 12, WATER_BREATHING: 13,
  INVISIBILITY: 14, BLINDNESS: 15, NIGHT_VISION: 16, HUNGER: 17,
  WEAKNESS: 18, POISON: 19, WITHER: 20, HEALTH_BOOST: 21, ABSORPTION: 22,
  SATURATION: 23,
};

export const EFFECT_INFO = {
  [Effect.SPEED]: { name: 'Velocidade', cmd: 'speed', color: '#7f7fff' },
  [Effect.SLOWNESS]: { name: 'Lentidão', cmd: 'slowness', color: '#4a4a4a' },
  [Effect.HASTE]: { name: 'Pressa', cmd: 'haste', color: '#d9d960' },
  [Effect.MINING_FATIGUE]: { name: 'Fadiga', cmd: 'mining_fatigue', color: '#4a4a3a' },
  [Effect.STRENGTH]: { name: 'Força', cmd: 'strength', color: '#932424' },
  [Effect.INSTANT_HEALTH]: { name: 'Cura', cmd: 'instant_health', color: '#fcd36a' },
  [Effect.INSTANT_DAMAGE]: { name: 'Dano', cmd: 'instant_damage', color: '#430a09' },
  [Effect.JUMP_BOOST]: { name: 'Super Pulo', cmd: 'jump_boost', color: '#22ff22' },
  [Effect.NAUSEA]: { name: 'Náusea', cmd: 'nausea', color: '#55aa00' },
  [Effect.REGENERATION]: { name: 'Regeneração', cmd: 'regeneration', color: '#cd5cab' },
  [Effect.RESISTANCE]: { name: 'Resistência', cmd: 'resistance', color: '#9953ff' },
  [Effect.FIRE_RESISTANCE]: { name: 'Resist. Fogo', cmd: 'fire_resistance', color: '#e4a000' },
  [Effect.WATER_BREATHING]: { name: 'Respiração', cmd: 'water_breathing', color: '#2e97ff' },
  [Effect.INVISIBILITY]: { name: 'Invisibilidade', cmd: 'invisibility', color: '#7f8392' },
  [Effect.BLINDNESS]: { name: 'Cegueira', cmd: 'blindness', color: '#1f1f23' },
  [Effect.NIGHT_VISION]: { name: 'Visão Noturna', cmd: 'night_vision', color: '#1f1fa1' },
  [Effect.HUNGER]: { name: 'Fome', cmd: 'hunger', color: '#587653' },
  [Effect.WEAKNESS]: { name: 'Fraqueza', cmd: 'weakness', color: '#48423a' },
  [Effect.POISON]: { name: 'Veneno', cmd: 'poison', color: '#4e9331' },
  [Effect.WITHER]: { name: 'Wither', cmd: 'wither', color: '#352a27' },
  [Effect.HEALTH_BOOST]: { name: 'Vigor', cmd: 'health_boost', color: '#f87d23' },
  [Effect.ABSORPTION]: { name: 'Absorção', cmd: 'absorption', color: '#fcd36a' },
  [Effect.SATURATION]: { name: 'Saturação', cmd: 'saturation', color: '#f82423' },
};

export const EFFECT_BY_NAME = {};
for (const id in EFFECT_INFO) EFFECT_BY_NAME[EFFECT_INFO[id].cmd] = parseInt(id);

export function addEffect(p, type, duration, amplifier = 0, ambient = false, particles = true) {
  if (!p) return;
  if (!Array.isArray(p.effects)) p.effects = [];
  const e = p.effects.find(e => e.type === type);
  if (e) {
    if (amplifier > e.amplifier) { e.amplifier = amplifier; e.duration = duration; }
    else if (duration > e.duration) e.duration = duration;
  } else {
    p.effects.push({ type, duration, amplifier, ambient, particles, _fresh: true });
    applyInstantOnAdd(p, type, amplifier);
  }
}

function applyInstantOnAdd(p, type, amplifier) {
  if (!p) return;
  if (type === Effect.INSTANT_HEALTH) {
    p.health = Math.min(p.maxHealth || 20, (p.health || 0) + 4 * Math.pow(2, amplifier));
  } else if (type === Effect.INSTANT_DAMAGE) {
    p.health = (p.health || 0) - 6 * Math.pow(2, amplifier);
  } else if (type === Effect.SATURATION) {
    p.hunger = Math.min(20, (p.hunger || 0) + amplifier + 1);
    p.saturation = Math.min(p.hunger, (p.saturation || 0) + amplifier + 1);
  } else if (type === Effect.HEALTH_BOOST) {
    const bonus = 4 * (amplifier + 1);
    p.maxHealth = 20 + bonus;
    p.health = (p.health || 0) + bonus;
  } else if (type === Effect.ABSORPTION) {
    p.absorption = (p.absorption || 0) + 4 * (amplifier + 1);
  }
}

function revertPersistentEffect(p, type) {
  if (!p) return;
  if (type === Effect.HEALTH_BOOST) {
    p.maxHealth = 20;
    p.health = Math.min(p.health || 20, p.maxHealth);
  }
}

export function removeEffect(p, type) {
  if (!p) return;
  if (!Array.isArray(p.effects)) { p.effects = []; return; }
  revertPersistentEffect(p, type);
  p.effects = p.effects.filter(e => e.type !== type);
}

export function clearEffects(p) {
  if (!p) return;
  if (!Array.isArray(p.effects)) { p.effects = []; return; }
  for (const e of p.effects) revertPersistentEffect(p, e.type);
  p.effects = [];
}

export function hasEffect(p, type) {
  if (!p) return false;
  const list = Array.isArray(p.effects) ? p.effects : (Array.isArray(p) ? p : []);
  return list.some(e => e && e.type === type);
}

export function getAmplifier(p, type) {
  if (!p) return -1;
  const list = Array.isArray(p.effects) ? p.effects : (Array.isArray(p) ? p : []);
  const e = list.find(e => e && e.type === type);
  return e ? e.amplifier : -1;
}

export function tickEffects(p) {
  if (!p || !Array.isArray(p.effects)) return;
  for (let i = p.effects.length - 1; i >= 0; i--) {
    const e = p.effects[i];
    if (!e) continue;
    e._fresh = false;
    if (e.duration <= 0) {
      revertPersistentEffect(p, e.type);
      p.effects.splice(i, 1);
      continue;
    }
    e.duration--;
    const amp = e.amplifier + 1;
    switch (e.type) {
      case Effect.REGENERATION:
        if (p.health < p.maxHealth && e.duration % Math.max(1, Math.floor(50 / amp)) === 0)
          p.health = Math.min(p.maxHealth, p.health + 1);
        break;
      case Effect.POISON:
        if (p.health > 1 && e.duration % 25 === 0) p.health = Math.max(1, p.health - 1);
        break;
      case Effect.WITHER:
        if (e.duration % 40 === 0) p.health = Math.max(0, p.health - 1);
        break;
      case Effect.HUNGER:
        p.exhaustion += 0.025 * amp;
        break;
    }
  }
}

export function getSpeedModifier(p) {
  let mod = 1;
  const sp = getAmplifier(p, Effect.SPEED);
  if (sp >= 0) mod *= 1 + 0.2 * (sp + 1);
  const sl = getAmplifier(p, Effect.SLOWNESS);
  if (sl >= 0) mod *= 1 - 0.15 * (sl + 1);
  return Math.max(0, mod);
}

export function getMiningSpeedModifier(p) {
  let mod = 1;
  const h = getAmplifier(p, Effect.HASTE);
  if (h >= 0) mod *= 1 + 0.2 * (h + 1);
  const f = getAmplifier(p, Effect.MINING_FATIGUE);
  if (f >= 0) mod *= Math.pow(0.3, f + 1);
  return mod;
}