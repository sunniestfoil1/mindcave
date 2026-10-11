// Registro data-driven de mobs da 1.8.9 — PRD 08 RF-001
// Categorias: hostile, passive, ambient, aquatic, neutral

export const MOB_CATEGORIES = {
  hostile: 'hostil',
  passive: 'passivo',
  ambient: 'ambiente',
  aquatic: 'aquático',
  neutral: 'neutro',
};

function M(id, namePt, props) {
  return { id, namePt, category: 'passive', width: 0.6, height: 1.8, eyeHeight: 1.6,
    maxHealth: 10, armor: 0, speed: 0.25, followRange: 16, attackDamage: 0,
    knockbackResistance: 0, isUndead: false, burnsInSun: false, xp: 0,
    drops: [], goals: [], spawnRules: {}, babyChance: 0,
    ...props };
}

export const MOB_TYPES = {
  // === Passivos ===
  pig: M('pig', 'Porco', {
    category: 'passive', width: 0.9, height: 0.9, eyeHeight: 0.7,
    maxHealth: 10, speed: 0.25, followRange: 10,
    drops: [{ id: 319, min: 1, max: 3 }], xp: 2,
    breedItem: 391, // carrot
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'panic', priority: 1 },
      { type: 'breed', priority: 2 },
      { type: 'tempt', priority: 3, item: 391 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'passive', grass: true, light: 9 },
  }),
  cow: M('cow', 'Vaca', {
    category: 'passive', width: 0.9, height: 1.4, eyeHeight: 1.2,
    maxHealth: 10, speed: 0.20, followRange: 10,
    drops: [{ id: 334, min: 0, max: 2 }, { id: 363, min: 1, max: 3 }], xp: 2,
    breedItem: 296, // wheat
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'panic', priority: 1 },
      { type: 'breed', priority: 2 },
      { type: 'tempt', priority: 3, item: 296 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'passive', grass: true, light: 9 },
  }),
  sheep: M('sheep', 'Ovelha', {
    category: 'passive', width: 0.9, height: 1.3, eyeHeight: 1.1,
    maxHealth: 8, speed: 0.23, followRange: 10,
    drops: [{ id: 35, min: 1, max: 1 }, { id: 423, min: 1, max: 2 }], xp: 2,
    breedItem: 296,
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'panic', priority: 1 },
      { type: 'breed', priority: 2 },
      { type: 'tempt', priority: 3, item: 296 },
      { type: 'eat_grass', priority: 4 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'passive', grass: true, light: 9 },
  }),
  chicken: M('chicken', 'Galinha', {
    category: 'passive', width: 0.4, height: 0.7, eyeHeight: 0.6,
    maxHealth: 4, speed: 0.20, followRange: 10,
    drops: [{ id: 288, min: 0, max: 2 }, { id: 366, min: 1, max: 1 }], xp: 1,
    breedItem: 295,
    canFly: true, fallsSlow: true,
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'panic', priority: 1 },
      { type: 'breed', priority: 2 },
      { type: 'tempt', priority: 3, item: 295 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'passive', grass: true, light: 9 },
  }),
  wolf: M('wolf', 'Lobo', {
    category: 'neutral', width: 0.6, height: 0.85, eyeHeight: 0.7,
    maxHealth: 8, speed: 0.25, followRange: 16, attackDamage: 4,
    drops: [], xp: 3,
    tameItem: 352, // bone
    tameMaxHealth: 20,
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'panic', priority: 1 },
      { type: 'melee_attack', priority: 3, target: 'player' },
      { type: 'nearest_target', priority: 3, target: 'player', range: 16 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'passive', grass: true, light: 9 },
  }),
  bat: M('bat', 'Morcego', {
    category: 'ambient', width: 0.5, height: 0.9, eyeHeight: 0.5,
    maxHealth: 6, speed: 0.10, followRange: 4,
    drops: [], xp: 0,
    canFly: true,
    goals: [
      { type: 'wander', priority: 5 },
    ],
    spawnRules: { category: 'ambient', light: 3, maxY: 63 },
  }),

  // === Hostis ===
  zombie: M('zombie', 'Zumbi', {
    category: 'hostile', width: 0.6, height: 1.95, eyeHeight: 1.74,
    maxHealth: 20, armor: 2, speed: 0.23, followRange: 40,
    attackDamage: 3, isUndead: true, burnsInSun: true, xp: 5,
    babyChance: 0.05,
    drops: [
      { id: 367, min: 0, max: 2 },
      { id: 265, min: 0, max: 1, rare: true },
      { id: 391, min: 0, max: 1, rare: true },
      { id: 392, min: 0, max: 1, rare: true },
    ],
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'flee_sun', priority: 1 },
      { type: 'panic', priority: 2 },
      { type: 'melee_attack', priority: 3 },
      { type: 'nearest_target', priority: 3, target: 'player', range: 40, checkInterval: 40 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24 },
  }),
  skeleton: M('skeleton', 'Esqueleto', {
    category: 'hostile', width: 0.6, height: 1.99, eyeHeight: 1.74,
    maxHealth: 20, armor: 0, speed: 0.25, followRange: 16,
    attackDamage: 2, isUndead: true, burnsInSun: true, xp: 5,
    drops: [
      { id: 352, min: 0, max: 2 }, // bones
      { id: 262, min: 0, max: 2 }, // arrows
    ],
    ranged: true, rangedRange: 15, rangedInterval: 40,
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'flee_sun', priority: 1 },
      { type: 'ranged_attack', priority: 3 },
      { type: 'nearest_target', priority: 3, target: 'player', range: 16, checkInterval: 40 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24 },
  }),
  creeper: M('creeper', 'Creeper', {
    category: 'hostile', width: 0.6, height: 1.7, eyeHeight: 1.44,
    maxHealth: 20, armor: 0, speed: 0.25, followRange: 16,
    attackDamage: 0, xp: 5, // damage is explosion
    explosionPower: 3,
    drops: [{ id: 289, min: 0, max: 2 }], // gunpowder
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'flee_sun', priority: 1 },
      { type: 'creeper_swell', priority: 2 },
      { type: 'melee_attack', priority: 3, noDamage: true },
      { type: 'nearest_target', priority: 3, target: 'player', range: 16, checkInterval: 40 },
      { type: 'avoid_entity', priority: 2, avoidType: 'cat' },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24 },
  }),
  spider: M('spider', 'Aranha', {
    category: 'hostile', width: 1.4, height: 0.9, eyeHeight: 0.65,
    maxHealth: 16, armor: 0, speed: 0.30, followRange: 16,
    attackDamage: 2, xp: 5,
    canClimb: true,
    neutralAboveLight: 12,
    drops: [
      { id: 287, min: 0, max: 2 }, // string
      { id: 375, min: 0, max: 1, rare: true, playerOnly: true }, // spider eye
    ],
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'panic', priority: 1 },
      { type: 'melee_attack', priority: 3 },
      { type: 'nearest_target', priority: 3, target: 'player', range: 16, checkInterval: 40 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24 },
  }),
  enderman: M('enderman', 'Enderman', {
    category: 'neutral', width: 0.6, height: 2.9, eyeHeight: 2.55,
    maxHealth: 40, armor: 0, speed: 0.30, followRange: 64,
    attackDamage: 7, xp: 5,
    canTeleport: true,
    drops: [{ id: 368, min: 0, max: 1 }], // ender pearl
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'panic', priority: 1 },
      { type: 'melee_attack', priority: 3 },
      { type: 'enderman_stare', priority: 3 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24, weight: 10 },
  }),
  slime: M('slime', 'Slime', {
    category: 'hostile', width: 0.51, height: 0.51, eyeHeight: 0.4,
    maxHealth: 16, armor: 0, speed: 0.25, followRange: 16,
    attackDamage: 2, xp: 4,
    jumps: true, size: 1,
    drops: [{ id: 341, min: 0, max: 2, sizeOnly: 1 }],
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'slime_jump', priority: 3 },
      { type: 'nearest_target', priority: 3, target: 'player', range: 16, checkInterval: 40 },
      { type: 'wander', priority: 5 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24, weight: 100, special: 'slime' },
  }),
  witch: M('witch', 'Bruxa', {
    category: 'hostile', width: 0.6, height: 1.95, eyeHeight: 1.74,
    maxHealth: 26, armor: 0, speed: 0.25, followRange: 16,
    attackDamage: 3, xp: 5,
    ranged: true, rangedRange: 10, rangedInterval: 60,
    drops: [
      { id: 374, min: 0, max: 2 }, { id: 348, min: 0, max: 2 },
      { id: 289, min: 0, max: 2 }, { id: 331, min: 0, max: 2 },
      { id: 375, min: 0, max: 1 }, { id: 353, min: 0, max: 1 },
      { id: 280, min: 0, max: 2 },
    ],
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'panic', priority: 1 },
      { type: 'ranged_attack', priority: 3 },
      { type: 'nearest_target', priority: 3, target: 'player', range: 16, checkInterval: 40 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24, weight: 5 },
  }),

  // === PRD 09: Zumbis Tecnológicos (RF-051) ===
  zombie_soldier: M('zombie_soldier', 'Zumbi Soldado', {
    category: 'hostile', width: 0.6, height: 1.95, eyeHeight: 1.74,
    maxHealth: 24, armor: 4, speed: 0.23, followRange: 40,
    attackDamage: 3, isUndead: true, burnsInSun: false, xp: 7,
    techVariant: true, techMinDifficulty: 1.5, techGlobalMin: 'easy',
    hasGun: true, gunType: 'pistol', gunRange: 16, gunInterval: 50, gunBurst: 3,
    drops: [
      { id: 456, min: 2, max: 6, chance: 0.3 },
      { id: 459, min: 1, max: 1, chance: 0.04, damaged: true, durabilityRange: [60, 240] },
    ],
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'flee_sun', priority: 1 },
      { type: 'panic', priority: 2 },
      { type: 'shoot_gun', priority: 3, range: 16, interval: 50, burst: 3 },
      { type: 'melee_attack', priority: 4 },
      { type: 'nearest_target', priority: 3, target: 'player', range: 40, checkInterval: 40 },
      { type: 'investigate_noise', priority: 4 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24 },
  }),
  zombie_miner: M('zombie_miner', 'Zumbi Minerador', {
    category: 'hostile', width: 0.6, height: 1.95, eyeHeight: 1.74,
    maxHealth: 20, armor: 2, speed: 0.23, followRange: 40,
    attackDamage: 3, isUndead: true, burnsInSun: true, xp: 6,
    techVariant: true, techMinDifficulty: 1.5, techGlobalMin: 'easy',
    canDig: true, digSpeed: 2, // iron pickaxe speed
    hasLantern: true,
    drops: [
      { id: 263, min: 1, max: 3, chance: 0.25 },
      { id: 265, min: 1, max: 3, chance: 0.25 },
      { id: 257, min: 1, max: 1, chance: 0.05, damaged: true, durabilityRange: [30, 125] },
    ],
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'flee_sun', priority: 1 },
      { type: 'panic', priority: 2 },
      { type: 'dig_to_target', priority: 3 },
      { type: 'melee_attack', priority: 4 },
      { type: 'nearest_target', priority: 3, target: 'player', range: 40, checkInterval: 40 },
      { type: 'investigate_noise', priority: 4 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24 },
  }),
  zombie_scout: M('zombie_scout', 'Zumbi Batedor', {
    category: 'hostile', width: 0.6, height: 1.95, eyeHeight: 1.74,
    maxHealth: 16, armor: 0, speed: 0.30, followRange: 40,
    attackDamage: 2, isUndead: true, burnsInSun: true, xp: 5,
    techVariant: true, techMinDifficulty: 2.0, techGlobalMin: 'normal',
    canCallReinforcements: true, reinforcementCount: 3, reinforcementCooldown: 600,
    drops: [
      { id: 331, min: 1, max: 3, chance: 1.0 },
      { id: 348, min: 1, max: 1, chance: 0.1 },
    ],
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'flee_sun', priority: 1 },
      { type: 'panic', priority: 2 },
      { type: 'call_reinforcements', priority: 3, range: 40, cooldown: 600 },
      { type: 'melee_attack', priority: 4 },
      { type: 'nearest_target', priority: 3, target: 'player', range: 40, checkInterval: 40 },
      { type: 'investigate_noise', priority: 4 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24 },
  }),
  zombie_sapper: M('zombie_sapper', 'Zumbi Sapador', {
    category: 'hostile', width: 0.6, height: 1.95, eyeHeight: 1.74,
    maxHealth: 20, armor: 2, speed: 0.23, followRange: 40,
    attackDamage: 3, isUndead: true, burnsInSun: true, xp: 7,
    techVariant: true, techMinDifficulty: 2.5, techGlobalMin: 'normal',
    canPlantCharge: true, chargeFuse: 40, chargePower: 3,
    suicideBomber: true, suicideFuse: 30, suicideRange: 2,
    drops: [
      { id: 289, min: 2, max: 5, chance: 1.0 },
      { id: 46, min: 1, max: 1, chance: 0.1 },
    ],
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'flee_sun', priority: 1 },
      { type: 'panic', priority: 2 },
      { type: 'plant_charge', priority: 3 },
      { type: 'melee_attack', priority: 4 },
      { type: 'nearest_target', priority: 3, target: 'player', range: 40, checkInterval: 40 },
      { type: 'investigate_noise', priority: 4 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24 },
  }),
  zombie_armored: M('zombie_armored', 'Zumbi Blindado', {
    category: 'hostile', width: 0.8, height: 2.1, eyeHeight: 1.84,
    maxHealth: 40, armor: 12, speed: 0.18, followRange: 40,
    attackDamage: 6, isUndead: true, burnsInSun: false, xp: 10,
    techVariant: true, techMinDifficulty: 2.5, techGlobalMin: 'normal',
    knockbackResistance: 0.8, immuneToSunFire: true,
    hasBackWeakspot: true, bulletResistance: 0.5,
    drops: [
      { id: 265, min: 2, max: 5, chance: 1.0 },
      { id: 42, min: 1, max: 1, chance: 0.05 },
    ],
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'panic', priority: 2 },
      { type: 'protect_back', priority: 2 },
      { type: 'melee_attack', priority: 3 },
      { type: 'nearest_target', priority: 3, target: 'player', range: 40, checkInterval: 40 },
      { type: 'investigate_noise', priority: 4 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24 },
  }),
  zombie_sniper: M('zombie_sniper', 'Zumbi Atirador de Elite', {
    category: 'hostile', width: 0.6, height: 1.95, eyeHeight: 1.74,
    maxHealth: 20, armor: 2, speed: 0.20, followRange: 64,
    attackDamage: 2, isUndead: true, burnsInSun: true, xp: 12,
    techVariant: true, techMinDifficulty: 3.5, techGlobalMin: 'hard',
    hasGun: true, gunType: 'bolt_rifle', gunRange: 60, gunInterval: 80, gunDamageMult: 0.6,
    hasLaserSight: true, laserDuration: 30,
    maintainDistance: true, minDistance: 30, maxDistance: 60,
    drops: [
      { id: 457, min: 1, max: 4, chance: 0.3 },
      { id: 464, min: 1, max: 1, chance: 0.03 },
      { id: 461, min: 1, max: 1, chance: 0.02, damaged: true, durabilityRange: [30, 90] },
    ],
    goals: [
      { type: 'swim', priority: 0 },
      { type: 'flee_sun', priority: 1 },
      { type: 'panic', priority: 2 },
      { type: 'maintain_distance', priority: 3, min: 30, max: 60 },
      { type: 'shoot_gun', priority: 3, range: 60, interval: 80, laser: 30 },
      { type: 'nearest_target', priority: 3, target: 'player', range: 64, checkInterval: 40 },
      { type: 'investigate_noise', priority: 4 },
      { type: 'wander', priority: 5 },
      { type: 'look_at_player', priority: 6 },
    ],
    spawnRules: { category: 'hostile', light: 7, minDistance: 24 },
  }),
};

export function getMobType(id) { return MOB_TYPES[id] || null; }

// Pesos de spawn por bioma (referência 1.8 RF-013)
// Zumbis tecnológicos são variantes — não aparecem nos pesos normais;
// são convertidos a partir de zumbis no mobSpawn.js quando techZombies=true
export const SPAWN_WEIGHTS = {
  hostile: { spider: 100, zombie: 100, skeleton: 100, creeper: 100, slime: 100, enderman: 10, witch: 5 },
  passive: { pig: 1, cow: 1, sheep: 1, chicken: 1 },
};

// Variantes tecnológicas (RF-050) — sorteadas quando um zumbi vira variante
export const TECH_ZOMBIE_VARIANTS = [
  { typeId: 'zombie_soldier', minDifficulty: 1.5, globalMin: 'easy' },
  { typeId: 'zombie_miner', minDifficulty: 1.5, globalMin: 'easy' },
  { typeId: 'zombie_scout', minDifficulty: 2.0, globalMin: 'normal' },
  { typeId: 'zombie_sapper', minDifficulty: 2.5, globalMin: 'normal' },
  { typeId: 'zombie_armored', minDifficulty: 2.5, globalMin: 'normal' },
  { typeId: 'zombie_sniper', minDifficulty: 3.5, globalMin: 'hard' },
];

// Mapeia dificuldade global → número
const DIFF_NUM = { peaceful: 0, easy: 1, normal: 2, hard: 3 };

export function getTechZombieVariantsForDifficulty(globalDifficulty, localDifficulty) {
  return TECH_ZOMBIE_VARIANTS.filter(v => {
    const globalOk = DIFF_NUM[v.globalMin] <= DIFF_NUM[globalDifficulty];
    const localOk = v.minDifficulty <= localDifficulty;
    return globalOk && localOk;
  });
}

// Limites por categoria (RF-010) — por 17×17 chunks
export const SPAWN_LIMITS = {
  hostile: 20, passive: 8, ambient: 5, aquatic: 3,
};