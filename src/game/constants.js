// Constantes globais do Mind Cave — referência para todos os PRDs (PRD 01 §6)
export const TPS = 20;
export const TICK_MS = 1000 / TPS;
export const DAY_LENGTH = 24000; // ticks (20 min reais)
export const WORLD_HEIGHT = 256;
export const SEA_LEVEL = 63;
export const WATER_FILL_LEVEL = 62; // água preenche Y <= 62
export const CHUNK_SIZE = 16;
export const SECTION_SIZE = 16;
export const SECTIONS_PER_CHUNK = 16; // 16 * 16 = 256
export const AUTOSAVE_TICKS = 900; // 45 s
export const RENDER_DISTANCE = 6; // padrão seguro p/ navegador (PRD pede 8; configurável no PRD 03)
export const SPAWN_RADIUS = 10;
export const ITEM_LIFETIME = 6000;
export const PICKUP_DELAY = 10;
export const CHAT_LIMIT = 100;
export const BUILD_VERSION = 'mc01-dev-1';

export const PLAYER = {
  width: 0.6,
  height: 1.8,
  eye: 1.62,
  eyeSneak: 1.54,
  walkSpeed: 4.317,
  sprintSpeed: 5.612,
  sneakSpeed: 1.31,
  gravity: 0.08,
  verticalDrag: 0.98,
  groundFriction: 0.546, // 0.6 * 0.91
  airFriction: 0.91,
  jump: 0.42,
  sprintJumpBonus: 0.2,
  stepHeight: 0.6,
  creativeSpeed: 10.92,
  creativeSprint: 21.6,
  fov: 70,
  reach: 4.5,
  reachCreative: 5.0,
  maxFallSpeed: -3.92,
};

export const FACING = {
  0: 'Sul (+Z)', 90: 'Oeste (-X)', 180: 'Norte (-Z)', 270: 'Leste (+X)',
};

// Sobrevivência (PRD 05)
export const SURVIVAL = {
  MAX_HEALTH: 20,
  MAX_HUNGER: 20,
  MAX_AIR: 300,
  HURT_TIME: 10,
  HURT_RESISTANT: 10,
  EAT_TICKS: 32,
  STARVE_INTERVAL: 80,
  REGEN_INTERVAL: 80,
  REGEN_HUNGER_MIN: 18,
  EXHAUSTION_PER_SAT: 4.0,
  SPRINT_HUNGER_MIN: 6,
  LIGHTNING_RADIUS: 3,
  AUTOSAVE_TICKS: 900,
};

export const DIFFICULTY_MODIFIERS = {
  peaceful: { mobDamage: 0, starveStop: 20, regen: true },
  easy: { mobDamage: 0.5, starveStop: 10, regen: false },
  normal: { mobDamage: 1.0, starveStop: 1, regen: false },
  hard: { mobDamage: 1.5, starveStop: 0, regen: false },
};

// Regras de jogo padrão (PRD 03/09)
export const DEFAULT_GAME_RULES = {
  doDaylightCycle: true,
  doFireTick: true,
  doMobSpawning: true,
  doMobLoot: true,
  doTileDrops: true,
  doEntityDrops: true,
  keepInventory: false,
  naturalRegeneration: true,
  mobGriefing: true,
  // PRD 09
  gunsEnabled: true,
  techZombies: true,
  techZombieChance: 0.15,
  gunDamageMultiplier: 1.0,
  explosionsBreakBlocks: true,
  friendlyFire: true,
};