// Registro de armas, munição, acessórios e peças — PRD 09 RF-001..013
// IDs de itens: 450-468 (faixa livre). Bloco Bancada de Armeiro: 177.

// === IDs de itens ===
export const GUN_ITEM_IDS = {
  iron_nugget: 450, gun_barrel: 451, firing_mechanism: 452, wooden_stock: 453,
  grip: 454, spring: 455, light_ammo: 456, heavy_ammo: 457, shotgun_shell: 458,
  pistol: 459, shotgun: 460, bolt_rifle: 461, carbine: 462, grenade: 463,
  scope: 464, silencer: 465, tactical_light: 467, extended_mag: 468,
};

export const GUNSMITH_BLOCK_ID = 177;

// === Munições (RF-010) ===
export const AMMO_TYPES = {
  light:   { id: 456, name: 'light_ammo',   namePt: 'Munição Leve',        color: 0xddcc88, maxStack: 64 },
  heavy:   { id: 457, name: 'heavy_ammo',   namePt: 'Munição Pesada',      color: 0xcc8844, maxStack: 64 },
  shotgun: { id: 458, name: 'shotgun_shell', namePt: 'Cartucho de Escopeta', color: 0xcc2222, maxStack: 64 },
};

export function getAmmoType(id) {
  for (const k in AMMO_TYPES) if (AMMO_TYPES[k].id === id) return k;
  return null;
}

// === Acessórios (RF-013) ===
export const ACCESSORIES = {
  scope:          { id: 464, name: 'scope',          namePt: 'Mira Telescópica',     color: 0x223344, compatible: ['bolt_rifle', 'carbine'],   slot: 'top' },
  silencer:       { id: 465, name: 'silencer',       namePt: 'Silenciador',          color: 0x333333, compatible: ['pistol', 'carbine', 'bolt_rifle'], slot: 'muzzle' },
  tactical_light: { id: 467, name: 'tactical_light', namePt: 'Lanterna Tática',      color: 0xffdd44, compatible: ['pistol', 'shotgun', 'bolt_rifle', 'carbine'], slot: 'rail' },
  extended_mag:   { id: 468, name: 'extended_mag',   namePt: 'Carregador Estendido', color: 0x555555, compatible: ['pistol', 'carbine'],         slot: 'mag' },
};

export function getAccessoryDef(id) {
  for (const k in ACCESSORIES) if (ACCESSORIES[k].id === id) return { key: k, ...ACCESSORIES[k] };
  return null;
}

// === Armas (RF-011) ===
// damage: por projétil; fireRate: tiros/s (semi) ou tiros/s (auto); magSize: carregador
// reloadTime: ticks; effectiveRange/maxRange: blocos; damageFalloff: % do dano no alcance final
// spreadHip/spreadADS: graus; recoilV: graus vertical; durability: tiros; ammoType: chave
export const GUNS = {
  pistol: {
    id: 459, name: 'pistol', namePt: 'Pistola', color: 0x4a4a4a,
    damage: 5, fireRate: 4, magSize: 12, reloadTime: 30,
    effectiveRange: 32, maxRange: 64, damageFalloff: 0.6,
    spreadHip: 1.5, spreadADS: 0.3, recoilV: 2,
    durability: 600, ammoType: 'light',
    fireModes: ['semi'], automatic: false, twoHanded: false, pellets: 1,
    bulletSpeed: 20, bulletGravity: 0.01, bulletLifetime: 10,
    recoilPattern: 'fixed',
  },
  shotgun: {
    id: 460, name: 'shotgun', namePt: 'Escopeta', color: 0x5a3a2a,
    damage: 2.5, fireRate: 3.75, magSize: 6, reloadTime: 12,
    effectiveRange: 12, maxRange: 24, damageFalloff: 0.2,
    spreadHip: 6.0, spreadADS: 6.0, recoilV: 6,
    durability: 400, ammoType: 'shotgun',
    fireModes: ['pump'], automatic: false, twoHanded: true, pellets: 8,
    bulletSpeed: 15, bulletGravity: 0.01, bulletLifetime: 8,
    perShellReload: true, recoilPattern: 'fixed',
  },
  bolt_rifle: {
    id: 461, name: 'bolt_rifle', namePt: 'Rifle de Ferrolho', color: 0x3a2a1a,
    damage: 16, fireRate: 0.8, magSize: 5, reloadTime: 50,
    effectiveRange: 128, maxRange: 192, damageFalloff: 0.8,
    spreadHip: 2.5, spreadADS: 0.0, recoilV: 8,
    durability: 300, ammoType: 'heavy',
    fireModes: ['bolt'], automatic: false, twoHanded: true, pellets: 1,
    bulletSpeed: 30, bulletGravity: 0.005, bulletLifetime: 15,
    armorPenetration: 0.4, headshotMult: 2.0, recoilPattern: 'fixed',
  },
  carbine: {
    id: 462, name: 'carbine', namePt: 'Carabina', color: 0x2a2a3a,
    damage: 3, fireRate: 8, magSize: 24, reloadTime: 40,
    effectiveRange: 48, maxRange: 96, damageFalloff: 0.5,
    spreadHip: 2.0, spreadADS: 0.6, recoilV: 1.2,
    durability: 800, ammoType: 'light',
    fireModes: ['auto', 'burst', 'semi'], automatic: true, twoHanded: true, pellets: 1,
    bulletSpeed: 22, bulletGravity: 0.01, bulletLifetime: 12,
    recoilPattern: 'increasing', burstCount: 3, burstInterval: 3,
  },
};

export const GRENADE_ITEM_ID = 463;
export const GRENADE_FUSE_TICKS = 60;
export const GRENADE_POWER = 2.5;

export function getGunDef(id) {
  for (const k in GUNS) if (GUNS[k].id === id) return { key: k, ...GUNS[k] };
  return null;
}

export function isGunItem(id) {
  return !!getGunDef(id);
}

export function isAmmoItem(id) {
  return !!getAmmoType(id);
}

export function isAccessoryItem(id) {
  return !!getAccessoryDef(id);
}

// === Estado runtime da arma (guardado em item.data) ===
export function createGunState(gunKey, accessories = {}) {
  const gun = GUNS[gunKey];
  if (!gun) return null;
  const magSize = accessories.extendedMag ? Math.floor(gun.magSize * 1.5) : gun.magSize;
  return {
    gunKey,
    ammoInMag: 0,
    fireModeIndex: 0,
    durability: gun.durability,
    accessories: { scope: null, silencer: null, tactical_light: null, extended_mag: null, ...accessories },
  };
}

export function getGunState(item) {
  if (!item || !item.data || !item.data.gunKey) return null;
  return item.data;
}

export function getFireMode(item) {
  const state = getGunState(item);
  if (!state) return null;
  const gun = GUNS[state.gunKey];
  return gun.fireModes[state.fireModeIndex % gun.fireModes.length];
}

// Multiplicador de carregador com acessório
export function getEffectiveMagSize(item) {
  const state = getGunState(item);
  if (!state) return 0;
  const gun = GUNS[state.gunKey];
  return state.accessories?.extended_mag ? Math.floor(gun.magSize * 1.5) : gun.magSize;
}

// Multiplicador de tempo de recarga com carregador estendido
export function getEffectiveReloadTime(item) {
  const state = getGunState(item);
  if (!state) return 0;
  const gun = GUNS[state.gunKey];
  const mult = state.accessories?.extended_mag ? 1.2 : 1.0;
  return Math.round(gun.reloadTime * mult);
}

// === Materiais e peças (RF-001) ===
export const GUN_PARTS = [
  { id: 450, name: 'iron_nugget', namePt: 'Pepita de Ferro', color: 0xddddaa, maxStack: 64, category: 'materials' },
  { id: 451, name: 'gun_barrel', namePt: 'Cano de Ferro', color: 0x888888, maxStack: 16, category: 'materials' },
  { id: 452, name: 'firing_mechanism', namePt: 'Mecanismo de Disparo', color: 0x664422, maxStack: 16, category: 'materials' },
  { id: 453, name: 'wooden_stock', namePt: 'Coronha de Madeira', color: 0x8b5a2b, maxStack: 16, category: 'materials' },
  { id: 454, name: 'grip', namePt: 'Empunhadura', color: 0x5a3a2a, maxStack: 16, category: 'materials' },
  { id: 455, name: 'spring', namePt: 'Mola', color: 0xccccaa, maxStack: 64, category: 'materials' },
];

// === Itens a adicionar ao registro de itens (items.js) ===
export function getGunItemDefs() {
  const items = {};
  // Partes
  for (const p of GUN_PARTS) {
    items[p.id] = { id: p.id, name: p.name, namePt: p.namePt, maxStack: p.maxStack, color: p.color, category: p.category };
  }
  // Munição
  for (const k in AMMO_TYPES) {
    const a = AMMO_TYPES[k];
    items[a.id] = { id: a.id, name: a.name, namePt: a.namePt, maxStack: a.maxStack, color: a.color, category: 'combat' };
  }
  // Armas (como itens com gun metadata)
  for (const k in GUNS) {
    const g = GUNS[k];
    items[g.id] = { id: g.id, name: g.name, namePt: g.namePt, maxStack: 1, color: g.color, category: 'combat', gun: g.name, durability: g.durability, weapon: true };
  }
  // Granada
  items[GRENADE_ITEM_ID] = { id: GRENADE_ITEM_ID, name: 'grenade', namePt: 'Granada de Mão', maxStack: 16, color: 0x4a5a3a, category: 'combat' };
  // Acessórios
  for (const k in ACCESSORIES) {
    const a = ACCESSORIES[k];
    items[a.id] = { id: a.id, name: a.name, namePt: a.namePt, maxStack: 1, color: a.color, category: 'combat', accessory: k };
  }
  return items;
}

// === Dano com queda de distância (RF-032) ===
export function calculateBulletDamage(gun, distance, isHeadshot) {
  let dmg = gun.damage;
  // Queda linear entre alcance efetivo e máximo
  if (distance > gun.effectiveRange && gun.maxRange > gun.effectiveRange) {
    const t = Math.min(1, (distance - gun.effectiveRange) / (gun.maxRange - gun.effectiveRange));
    dmg *= 1 - (1 - gun.damageFalloff) * t;
  }
  // Tiro na cabeça
  if (isHeadshot) {
    dmg *= gun.headshotMult || 1.5;
  }
  return dmg;
}

// === Dispersão com multiplicadores de movimento (RF-033) ===
export function calculateSpread(gun, player, ads, inventory) {
  const item = inventory ? player.hotbar[player.selectedSlot] : null;
  const state = getGunState(item);
  const hasScope = state?.accessories?.scope;
  let base = ads ? gun.spreadADS : gun.spreadHip;
  // Multiplicadores de movimento
  let mult = 1.0;
  if (player.sprinting) mult = 2.5;
  else if (!player.onGround) mult = 3.0;
  else if (player.sneaking) mult = 0.7;
  else if (Math.hypot(player.vel?.x || 0, player.vel?.z || 0) > 0.5) mult = 1.5;
  // Silenciador reduz levemente a dispersão
  if (state?.accessories?.silencer) base *= 0.9;
  return base * mult;
}

// === Atração de mobs por ruído (RF-038) ===
export function getNoiseRadius(silenced) {
  return silenced ? 16 : 32;
}

// === Game rules defaults ===
export const GUN_GAME_RULES = {
  gunsEnabled: true,
  techZombies: true,
  techZombieChance: 0.15,
  gunDamageMultiplier: 1.0,
  explosionsBreakBlocks: true,
  friendlyFire: true,
};