// Gerador de texturas procedurais 16×16 (PRD 01 RF-080, PRD 02 RF-100/101).
import * as THREE from 'three';
import { mulberry32 } from './prng';
import { loadPack, getPackCanvas, getPackJson, MC } from './pack';

const TILE = 16;
const COLS = 16;
const ATLAS = TILE * COLS; // 256

function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }
function shade(base, vary, rng) {
  const v = (rng() - 0.5) * 2 * vary;
  return [clamp255(base[0] + v), clamp255(base[1] + v), clamp255(base[2] + v), 255];
}

const DRAWERS = {
  error: (x, y, r) => {
    const checker = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
    return checker ? [255, 0, 255, 255] : [0, 0, 0, 255];
  },
  stone: (x, y, r) => shade([127, 127, 127], 12, r),
  dirt: (x, y, r) => shade([134, 96, 67], 14, r),
  grass_top: (x, y, r) => shade([102, 156, 60], 16, r),
  grass_side: (x, y, r) => {
    if (y < 3 + (Math.floor((x * 13) % 4))) { const v = shade([170, 170, 170], 14, r); return [v[0], v[1], v[2], 255]; }
    const d = shade([134, 96, 67], 14, r);
    return [d[0], d[1], d[2], 230];
  },
  cactus_side: (x, y, r) => (x % 4 === 1 && y % 3 === 0 ? [20, 60, 20, 255] : shade([14, 110, 42], 10, r)),
  cactus_top: (x, y, r) => shade([40, 140, 60], 10, r),
  cactus_bottom: (x, y, r) => shade([20, 100, 40], 10, r),
  dead_bush: (x, y, r) => {
    if (Math.abs(x - 7.5) > 6 || y < 4 || (x + y) % 3 === 0) return [0, 0, 0, 0];
    return shade([120, 80, 40], 14, r);
  },
  vine: (x, y, r) => (r() > 0.45 ? [0, 0, 0, 0] : shade([90, 140, 70], 14, r)),
  cobblestone: (x, y, r) => {
    const cell = (Math.floor(x / 4) * 7 + Math.floor(y / 4) * 3) % 3;
    return shade([110 + cell * 8, 110 + cell * 8, 110 + cell * 8], 16, r);
  },
  mossy_cobble: (x, y, r) => {
    const base = shade([110, 110, 110], 16, r);
    if (r() > 0.7) return shade([70, 100, 55], 10, r);
    return base;
  },
  planks: (x, y, r) => {
    const line = y % 4 === 0 ? -22 : 0;
    const seam = x % 8 === 0 ? -16 : 0;
    return shade([160, 130, 75], 8, r).map((c, i) => (i < 3 ? clamp255(c + line + seam) : c));
  },
  bedrock: (x, y, r) => shade([85, 85, 85], 28, r),
  water: (x, y, r) => {
    const wave = Math.sin((x + y) * 0.8) * 6;
    return [clamp255(50 + wave), clamp255(90 + wave), clamp255(200 + wave), 255];
  },
  lava: (x, y, r) => {
    const wave = Math.sin((x + y) * 0.6) * 12;
    return [clamp255(220 + wave), clamp255(100 + wave * 0.5), clamp255(20), 255];
  },
  sand: (x, y, r) => shade([219, 207, 163], 10, r),
  gravel: (x, y, r) => shade([120, 116, 112], 20, r),
  clay: (x, y, r) => shade([160, 165, 170], 8, r),
  soulsand: (x, y, r) => {
    const face = (x + y * 3) % 7 < 2 ? -20 : 0;
    return shade([100, 75, 60], 12, r).map((c, i) => (i < 3 ? clamp255(c + face) : c));
  },
  snow: (x, y, r) => shade([245, 250, 255], 5, r),
  ice: (x, y, r) => {
    const crack = (x + y) % 5 === 0 ? -15 : 0;
    return shade([170, 200, 230], 10, r).map((c, i) => (i < 3 ? clamp255(c + crack) : c));
  },
  iron_ore: (x, y, r) => {
    const spot = (Math.floor(x / 3) + Math.floor(y / 3)) % 4 === 0 && r() > 0.5;
    return spot ? [200, 165, 130, 255] : shade([127, 127, 127], 12, r);
  },
  coal_ore: (x, y, r) => {
    const spot = (Math.floor(x / 3) + Math.floor(y / 3) + 2) % 4 === 0 && r() > 0.5;
    return spot ? [40, 40, 40, 255] : shade([127, 127, 127], 12, r);
  },
  gold_ore: (x, y, r) => {
    const spot = (Math.floor(x / 3) + Math.floor(y / 3) + 1) % 4 === 0 && r() > 0.5;
    return spot ? [220, 180, 40, 255] : shade([127, 127, 127], 12, r);
  },
  diamond_ore: (x, y, r) => {
    const spot = (Math.floor(x / 3) + Math.floor(y / 3)) % 4 === 0 && r() > 0.5;
    return spot ? [100, 230, 230, 255] : shade([127, 127, 127], 12, r);
  },
  lapis_ore: (x, y, r) => {
    const spot = (Math.floor(x / 3) + Math.floor(y / 3) + 3) % 4 === 0 && r() > 0.5;
    return spot ? [40, 60, 180, 255] : shade([127, 127, 127], 12, r);
  },
  emerald_ore: (x, y, r) => {
    const spot = (Math.floor(x / 3) + Math.floor(y / 3) + 2) % 4 === 0 && r() > 0.5;
    return spot ? [40, 200, 80, 255] : shade([127, 127, 127], 12, r);
  },
  redstone_ore: (x, y, r) => {
    const spot = (Math.floor(x / 3) + Math.floor(y / 3)) % 4 === 0 && r() > 0.5;
    return spot ? [200, 30, 30, 255] : shade([127, 127, 127], 12, r);
  },
  lapis_block: (x, y, r) => shade([40, 60, 180], 8, r),
  gold_block: (x, y, r) => shade([220, 180, 40], 8, r),
  iron_block: (x, y, r) => shade([220, 220, 220], 6, r),
  diamond_block: (x, y, r) => shade([100, 230, 230], 8, r),
  emerald_block: (x, y, r) => shade([40, 200, 80], 8, r),
  redstone_block: (x, y, r) => shade([200, 30, 30], 8, r),
  coal_block: (x, y, r) => shade([30, 30, 30], 8, r),
  quartz: (x, y, r) => shade([235, 232, 225], 6, r),
  log_top: (x, y, r) => {
    const dx = x - 7.5, dy = y - 7.5;
    const ring = Math.floor(Math.sqrt(dx * dx + dy * dy)) % 2 === 0 ? 18 : 0;
    return shade([164, 130, 70], 6, r).map((c, i) => (i < 3 ? clamp255(c + ring - 10) : c));
  },
  log_side: (x, y, r) => {
    const bark = x % 4 === 0 ? -26 : 0;
    return shade([150, 115, 60], 10, r).map((c, i) => (i < 3 ? clamp255(c + bark) : c));
  },
  leaves: (x, y, r) => {
    if (r() > 0.78) return [0, 0, 0, 0];
    return shade([60, 130, 45], 20, r);
  },
  glass: (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return [205, 230, 235, 255];
    if (x - y === 0 || x + y === 15) return [225, 245, 245, 200];
    return [0, 0, 0, 0];
  },
  stone_bricks: (x, y, r) => {
    const line = y % 8 === 0 ? -22 : (x % 8 === 0 && y % 8 < 4 ? -22 : 0);
    return shade([120, 120, 120], 8, r).map((c, i) => (i < 3 ? clamp255(c + line) : c));
  },
  end_stone: (x, y, r) => shade([220, 215, 165], 10, r),
  netherrack: (x, y, r) => shade([120, 50, 50], 18, r),
  nether_brick: (x, y, r) => shade([60, 30, 30], 8, r),
  prismarine: (x, y, r) => shade([80, 140, 130], 14, r),
  sea_lantern: (x, y, r) => shade([180, 230, 220], 12, r),
  mycelium_top: (x, y, r) => {
    const grey = r() > 0.5;
    return grey ? shade([120, 100, 110], 12, r) : shade([90, 80, 90], 12, r);
  },
  mycelium_side: (x, y, r) => {
    if (y < 3 + (Math.floor((x * 13) % 4))) return shade([120, 100, 110], 12, r);
    return shade([134, 96, 67], 14, r);
  },
  obsidian: (x, y, r) => {
    const dark = (x * 7 + y * 3) % 5 === 0 ? -15 : 0;
    return shade([30, 20, 40], 8, r).map((c, i) => (i < 3 ? clamp255(c + dark) : c));
  },
  bricks: (x, y, r) => {
    const row = Math.floor(y / 4);
    const offset = row % 2 ? 4 : 0;
    const line = y % 4 === 0 || (x + offset) % 8 === 0 ? -40 : 0;
    return shade([150, 70, 55], 8, r).map((c, i) => (i < 3 ? clamp255(c + line) : c));
  },
  wool: (x, y, r) => shade([235, 235, 235], 10, r),
  hardened_clay: (x, y, r) => shade([160, 115, 90], 8, r),
  tnt_top: (x, y, r) => shade([180, 40, 30], 6, r),
  tnt: (x, y, r) => {
    const band = y > 6 && y < 10 ? [220, 220, 220, 255] : shade([180, 40, 30], 6, r);
    return band;
  },
  glowstone: (x, y, r) => {
    const spot = r() > 0.6;
    return spot ? [255, 240, 180, 255] : shade([220, 180, 100], 14, r);
  },
  crafting_top: (x, y, r) => {
    const grid = (x % 5 === 0 || y % 5 === 0) ? -30 : 0;
    return shade([160, 130, 75], 8, r).map((c, i) => (i < 3 ? clamp255(c + grid) : c));
  },
  crafting_side: (x, y, r) => {
    const tool = (x > 2 && x < 6 && y > 3 && y < 8) ? [120, 120, 120, 255] : shade([160, 130, 75], 8, r);
    return tool;
  },
  bookshelf: (x, y, r) => {
    if (y < 2 || y > 13) return shade([160, 130, 75], 8, r);
    const bookColors = [[180, 50, 50], [50, 80, 160], [180, 160, 50], [60, 140, 60], [140, 80, 160], [180, 120, 40]];
    const col = Math.floor(x / 3);
    const c = bookColors[col % bookColors.length];
    const line = (y === 2 || y === 13) ? -20 : 0;
    return shade(c, 8, r).map((v, i) => (i < 3 ? clamp255(v + line) : v));
  },
  furnace_top: (x, y, r) => shade([100, 100, 100], 8, r),
  furnace_side: (x, y, r) => shade([100, 100, 100], 8, r),
  furnace_front: (x, y, r) => {
    if (x > 4 && x < 12 && y > 3 && y < 10) return shade([60, 60, 60], 6, r);
    return shade([100, 100, 100], 8, r);
  },
  sandstone_top: (x, y, r) => shade([220, 210, 165], 6, r),
  sandstone_bottom: (x, y, r) => shade([200, 190, 150], 6, r),
  sandstone_side: (x, y, r) => {
    const line = y < 2 ? -20 : (y > 13 ? -15 : 0);
    return shade([220, 210, 165], 6, r).map((c, i) => (i < 3 ? clamp255(c + line) : c));
  },
  sponge: (x, y, r) => {
    const hole = r() > 0.7 ? [180, 160, 60, 255] : shade([220, 200, 80], 8, r);
    return hole;
  },
  web: (x, y, r) => {
    const cx = x - 7.5, cy = y - 7.5;
    const d = Math.sqrt(cx * cx + cy * cy);
    const a = Math.atan2(cy, cx);
    if (d < 1 || (Math.abs(a) < 0.3 || Math.abs(a - Math.PI) < 0.3 || Math.abs(a + Math.PI) < 0.3 || Math.abs(a - Math.PI/2) < 0.3 || Math.abs(a + Math.PI/2) < 0.3)) return [220, 220, 220, 180];
    return [0, 0, 0, 0];
  },
  slime: (x, y, r) => shade([120, 200, 100], 12, r),
  hay: (x, y, r) => {
    const line = y % 4 === 0 ? -20 : 0;
    return shade([200, 180, 60], 8, r).map((c, i) => (i < 3 ? clamp255(c + line) : c));
  },
  grass_plant: (x, y, r) => {
    const cx = x - 7.5;
    if (Math.abs(cx) > 5 + r() * 2) return [0, 0, 0, 0];
    return shade([80, 140, 50], 20, r);
  },
  flower_dandelion: (x, y, r) => {
    if (y > 9 && Math.abs(x - 7.5) < 2.5) return shade([240, 220, 60], 8, r);
    if (Math.abs(x - 7.5) > 4) return [0, 0, 0, 0];
    return shade([60, 140, 40], 12, r);
  },
  flower_rose: (x, y, r) => {
    if (y > 9 && Math.abs(x - 7.5) < 2.5) return shade([220, 50, 50], 8, r);
    if (Math.abs(x - 7.5) > 4) return [0, 0, 0, 0];
    return shade([60, 140, 40], 12, r);
  },
  mushroom_brown: (x, y, r) => {
    if (y > 8 && Math.abs(x - 7.5) < 4 - (12 - y) * 0.5) return shade([150, 110, 70], 8, r);
    if (y > 5 && Math.abs(x - 7.5) < 2) return shade([230, 225, 220], 6, r);
    return [0, 0, 0, 0];
  },
  mushroom_red: (x, y, r) => {
    if (y > 8 && Math.abs(x - 7.5) < 4 - (12 - y) * 0.5) {
      const dot = r() > 0.7;
      return dot ? [255, 255, 255, 255] : shade([200, 50, 50], 8, r);
    }
    if (y > 5 && Math.abs(x - 7.5) < 2) return shade([230, 225, 220], 6, r);
    return [0, 0, 0, 0];
  },
  sugarcane: (x, y, r) => {
    if (Math.abs(x - 7.5) > 2) return [0, 0, 0, 0];
    return shade([170, 200, 80], 10, r);
  },
  lilypad: (x, y, r) => {
    const cx = x - 7.5, cy = y - 7.5;
    if (Math.sqrt(cx * cx + cy * cy) > 7) return [0, 0, 0, 0];
    return shade([70, 130, 40], 12, r);
  },
  torch: (x, y, r) => {
    const cx = x - 7.5;
    if (y > 12) return shade([255, 220, 100], 20, r);
    if (Math.abs(cx) > 1) return [0, 0, 0, 0];
    return shade([150, 110, 60], 6, r);
  },
  fire: (x, y, r) => {
    if (r() > 0.6) return [255, 200, 50, 255];
    if (r() > 0.4) return [255, 100, 20, 200];
    return [0, 0, 0, 0];
  },
  bed_head_top: (x, y, r) => (y < 4 ? shade([240, 240, 240], 6, r) : shade([170, 25, 25], 10, r)),
  bed_feet_top: (x, y, r) => shade([170, 25, 25], 10, r),
  bed_head_side: (x, y, r) => (y < 9 ? shade([170, 25, 25], 8, r) : shade([139, 90, 43], 10, r)),
  bed_feet_side: (x, y, r) => (y < 9 ? shade([170, 25, 25], 8, r) : shade([139, 90, 43], 10, r)),
  bed_head_end: (x, y, r) => (y < 9 ? shade([240, 240, 240], 6, r) : shade([139, 90, 43], 10, r)),
  bed_feet_end: (x, y, r) => (y < 9 ? shade([170, 25, 25], 8, r) : shade([139, 90, 43], 10, r)),
};

const TILE_ORDER = [
  'error', 'stone', 'dirt', 'grass_top', 'grass_side', 'cobblestone', 'planks', 'bedrock', 'water',
  'sand', 'gravel', 'iron_ore', 'coal_ore', 'log_top', 'log_side', 'leaves', 'glass',
  'stone_bricks', 'bricks', 'wool', 'lava', 'mossy_cobble', 'obsidian', 'sand', 'sandstone_top',
  'sandstone_bottom', 'sandstone_side', 'clay', 'soulsand', 'snow', 'ice', 'gold_ore', 'diamond_ore',
  'lapis_ore', 'emerald_ore', 'redstone_ore', 'gold_block', 'iron_block', 'diamond_block', 'emerald_block',
  'redstone_block', 'coal_block', 'quartz', 'lapis_block', 'netherrack', 'nether_brick', 'prismarine',
  'sea_lantern', 'mycelium_top', 'mycelium_side', 'end_stone', 'hardened_clay', 'tnt', 'glowstone',
  'crafting_top', 'crafting_side', 'furnace_top', 'furnace_side', 'furnace_front', 'sponge', 'web',
  'slime', 'hay', 'tnt_top', 'bookshelf', 'grass_plant', 'flower_dandelion', 'flower_rose', 'mushroom_brown',
  'mushroom_red', 'sugarcane', 'lilypad', 'torch', 'fire',
  'cactus_side', 'cactus_top', 'cactus_bottom', 'dead_bush', 'vine',
  'stone_slab_top', 'stone_slab_side', 'quartz_top', 'quartz_bottom', 'planks_spruce', 'planks_birch', 'planks_jungle',
  'planks_acacia', 'planks_dark_oak', 'red_sandstone_top', 'red_sandstone_bottom', 'red_sandstone_side',
  'bed_head_top', 'bed_feet_top', 'bed_head_side', 'bed_feet_side', 'bed_head_end', 'bed_feet_end',
  'door_wood_lower', 'door_wood_upper', 'door_iron_lower', 'door_iron_upper',
  'ladder', 'trapdoor', 'chest_top', 'chest_side', 'chest_front',
];

let _cache = null;

export function makeAtlas() {
  if (_cache) return _cache;
  const rawH = Math.ceil(TILE_ORDER.length / COLS) * TILE;
  const atlasH = Math.pow(2, Math.ceil(Math.log2(rawH)));
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS; canvas.height = atlasH;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const tiles = {};
  TILE_ORDER.forEach((name, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x0 = col * TILE, y0 = row * TILE;
    const drawer = DRAWERS[name] || DRAWERS.stone;
    const rng = mulberry32(i * 1013 + 7);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const c = drawer(x, y, rng);
        if (!c || c[3] === 0) continue;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
        ctx.fillRect(x0 + x, y0 + y, 1, 1);
      }
    }
    // u0, v0 = canto superior esquerdo EXATO do tile no canvas (0..1);
    // u1, v1 = canto inferior direito EXATO do tile no canvas (0..1).
    // O shader faz (1.0 - localV) e clampa a meia-texel dentro do tile, impedindo 100% da "geada"/bleeding.
    tiles[name] = {
      u0: x0 / ATLAS,
      v0: y0 / canvas.height,
      u1: (x0 + TILE) / ATLAS,
      v1: (y0 + TILE) / canvas.height,
    };
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.premultiplyAlpha = false;
  texture.anisotropy = 1;
  texture.needsUpdate = true;

  _cache = { texture, tiles, canvas, ctx };
  return _cache;
}

const MC_TEXTURE_MAP = {
  'stone': 'stone', 'dirt': 'dirt', 'grass_top': 'grass_top', 'grass_side': 'grass_side',
  'cobblestone': 'cobblestone', 'planks': 'planks_oak', 'bedrock': 'bedrock', 'water': 'water_still',
  'sand': 'sand', 'gravel': 'gravel', 'iron_ore': 'iron_ore', 'coal_ore': 'coal_ore',
  'log_top': 'log_oak_top', 'log_side': 'log_oak', 'leaves': 'leaves_oak', 'glass': 'glass',
  'stone_bricks': 'stonebrick', 'bricks': 'brick', 'wool': 'wool_colored_white', 'lava': 'lava_still',
  'mossy_cobble': 'cobblestone_mossy', 'obsidian': 'obsidian', 'sandstone_top': 'sandstone_top',
  'sandstone_bottom': 'sandstone_bottom', 'sandstone_side': 'sandstone_normal', 'clay': 'clay',
  'soulsand': 'soul_sand', 'snow': 'snow', 'ice': 'ice', 'gold_ore': 'gold_ore',
  'diamond_ore': 'diamond_ore', 'lapis_ore': 'lapis_ore', 'emerald_ore': 'emerald_ore',
  'redstone_ore': 'redstone_ore', 'gold_block': 'gold_block', 'iron_block': 'iron_block',
  'diamond_block': 'diamond_block', 'emerald_block': 'emerald_block', 'redstone_block': 'redstone_block',
  'coal_block': 'coal_block', 'quartz': 'quartz_block_side', 'lapis_block': 'lapis_block',
  'netherrack': 'netherrack', 'nether_brick': 'nether_brick', 'prismarine': 'prismarine_rough',
  'sea_lantern': 'sea_lantern', 'mycelium_top': 'mycelium_top', 'mycelium_side': 'mycelium_side',
  'end_stone': 'end_stone', 'hardened_clay': 'hardened_clay', 'tnt': 'tnt_side', 'tnt_top': 'tnt_top',
  'glowstone': 'glowstone', 'crafting_top': 'crafting_table_top', 'crafting_side': 'crafting_table_side',
  'furnace_top': 'furnace_top', 'furnace_side': 'furnace_side', 'furnace_front': 'furnace_front_off',
  'bookshelf': 'bookshelf',
  'sponge': 'sponge', 'web': 'web', 'slime': 'slime', 'hay': 'hay_block_side',
  'grass_plant': 'tallgrass', 'flower_dandelion': 'flower_dandelion', 'flower_rose': 'flower_rose',
  'mushroom_brown': 'mushroom_brown', 'mushroom_red': 'mushroom_red', 'sugarcane': 'reeds',
  'lilypad': 'waterlily', 'torch': 'torch_on', 'fire': 'fire_layer_0',
  'cactus_side': 'cactus_side', 'cactus_top': 'cactus_top', 'cactus_bottom': 'cactus_bottom',
  'dead_bush': 'deadbush', 'vine': 'vine',
  'stone_slab_top': 'stone_slab_top', 'stone_slab_side': 'stone_slab_side', 'quartz_top': 'quartz_block_top',
  'quartz_bottom': 'quartz_block_bottom', 'planks_spruce': 'planks_spruce', 'planks_birch': 'planks_birch',
  'planks_jungle': 'planks_jungle', 'planks_acacia': 'planks_acacia', 'planks_dark_oak': 'planks_big_oak',
  'ladder': 'ladder', 'trapdoor': 'trapdoor',
  'door_wood_lower': 'door_wood_lower', 'door_wood_upper': 'door_wood_upper', 'door_iron_lower': 'door_iron_lower', 'door_iron_upper': 'door_iron_upper',
  'bed_head_top': 'bed_head_top', 'bed_feet_top': 'bed_feet_top', 'bed_head_side': 'bed_head_side',
  'bed_feet_side': 'bed_feet_side', 'bed_head_end': 'bed_head_end', 'bed_feet_end': 'bed_feet_end',
  'red_sandstone_top': 'red_sandstone_top', 'red_sandstone_bottom': 'red_sandstone_bottom', 'red_sandstone_side': 'red_sandstone_normal',
};

const EXTRA_TILES = { sapling_oak: 'sapling_oak' };
for (let i = 0; i < 8; i++) EXTRA_TILES['wheat_stage_' + i] = 'wheat_stage_' + i;
for (let i = 0; i < 4; i++) { EXTRA_TILES['carrots_stage_' + i] = 'carrots_stage_' + i; EXTRA_TILES['potatoes_stage_' + i] = 'potatoes_stage_' + i; }
for (let i = 0; i < 3; i++) EXTRA_TILES['nether_wart_stage_' + i] = 'nether_wart_stage_' + i;
for (const n of ['pumpkin_top', 'pumpkin_side', 'pumpkin_face_off', 'pumpkin_face_on', 'melon_top', 'melon_side', 'redstone_lamp_off', 'redstone_lamp_on',
  'hopper_top', 'hopper_outside', 'lever', 'pumpkin_stem_disconnected', 'melon_stem_disconnected', 'farmland_dry', 'farmland_wet',
  'repeater_off', 'repeater_on', 'comparator_off', 'comparator_on', 'daylight_detector_top', 'daylight_detector_side',
  'portal', 'quartz_ore']) EXTRA_TILES[n] = n;
for (const t of Object.keys(EXTRA_TILES)) if (!TILE_ORDER.includes(t)) TILE_ORDER.push(t);
Object.assign(MC_TEXTURE_MAP, EXTRA_TILES);

let _realLoaded = false;
let _loadingPromise = null;
let _atlasVersion = 0;
const _anims = [];

function tileRect(idx) {
  return { x0: (idx % COLS) * TILE, y0: Math.floor(idx / COLS) * TILE };
}

function drawFrame(ctx, cv, frame, idx) {
  const { x0, y0 } = tileRect(idx);
  const w = cv.width;
  ctx.clearRect(x0, y0, TILE, TILE);
  ctx.drawImage(cv, 0, frame * w, w, w, x0, y0, TILE, TILE);
}

async function composeGrassSide(ctx) {
  const base = await getPackCanvas(MC + 'textures/blocks/grass_side.png');
  const ovl = await getPackCanvas(MC + 'textures/blocks/grass_side_overlay.png');
  if (!base) return;
  const tmp = document.createElement('canvas');
  tmp.width = TILE; tmp.height = TILE;
  const t = tmp.getContext('2d');
  t.drawImage(base, 0, 0, base.width, base.width, 0, 0, TILE, TILE);
  const img = t.getImageData(0, 0, TILE, TILE);
  for (let p = 3; p < img.data.length; p += 4) if (img.data[p] > 0) img.data[p] = 230;
  if (ovl) {
    const t2 = document.createElement('canvas');
    t2.width = TILE; t2.height = TILE;
    const c2 = t2.getContext('2d');
    c2.drawImage(ovl, 0, 0, ovl.width, ovl.width, 0, 0, TILE, TILE);
    const o = c2.getImageData(0, 0, TILE, TILE).data;
    for (let p = 0; p < o.length; p += 4) {
      if (o[p + 3] > 0) { img.data[p] = o[p]; img.data[p + 1] = o[p + 1]; img.data[p + 2] = o[p + 2]; img.data[p + 3] = 255; }
    }
  }
  t.putImageData(img, 0, 0);
  const { x0, y0 } = tileRect(TILE_ORDER.indexOf('grass_side'));
  ctx.clearRect(x0, y0, TILE, TILE);
  ctx.drawImage(tmp, x0, y0);
}

async function composeChest(ctx) {
  const src = await getPackCanvas(MC + 'textures/entity/chest/normal.png');
  if (!src) return;
  const draw = (name, fn) => {
    const idx = TILE_ORDER.indexOf(name);
    const { x0, y0 } = tileRect(idx);
    ctx.clearRect(x0, y0, TILE, TILE);
    const t = document.createElement('canvas'); t.width = TILE; t.height = TILE;
    const c = t.getContext('2d'); c.imageSmoothingEnabled = false;
    fn(c);
    ctx.drawImage(t, x0, y0);
  };
  const lidH = TILE * 5 / 15, bodyH = TILE - lidH;
  draw('chest_top', (c) => c.drawImage(src, 14, 0, 14, 14, 0, 0, TILE, TILE));
  draw('chest_side', (c) => { c.drawImage(src, 0, 14, 14, 5, 0, 0, TILE, lidH); c.drawImage(src, 0, 33, 14, 10, 0, lidH, TILE, bodyH); });
  draw('chest_front', (c) => { c.drawImage(src, 14, 14, 14, 5, 0, 0, TILE, lidH); c.drawImage(src, 14, 33, 14, 10, 0, lidH, TILE, bodyH); c.drawImage(src, 1, 1, 2, 4, 7, lidH - 1, 2, 4); });
}

export function loadRealTextures(force = false) {
  if (_realLoaded && !force) return Promise.resolve(true);
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = (async () => {
    if (!_cache) makeAtlas();
    try {
      const ok = await loadPack();
      if (!ok) return false;
      const { ctx, texture } = _cache;
      _anims.length = 0;
      await Promise.all(TILE_ORDER.map(async (name, idx) => {
        const mc = MC_TEXTURE_MAP[name];
        if (!mc || name === 'grass_side') return;
        const path = MC + 'textures/blocks/' + mc + '.png';
        const cv = await getPackCanvas(path);
        if (!cv) return;
        drawFrame(ctx, cv, 0, idx);
        const frames = Math.floor(cv.height / cv.width);
        if (frames > 1) {
          const meta = await getPackJson(path + '.mcmeta');
          const a = meta && meta.animation ? meta.animation : {};
          const order = Array.isArray(a.frames) && a.frames.length
            ? a.frames.map(f => (typeof f === 'number' ? f : f.index))
            : Array.from({ length: frames }, (_, i) => i);
          _anims.push({ idx, strip: cv, order, frametime: Math.max(1, a.frametime || 1), cur: 0 });
        }
      }));
      await composeGrassSide(ctx);
      await composeChest(ctx);
      texture.needsUpdate = true;
      _atlasVersion++;
      _realLoaded = true;
      return true;
    } catch (e) {
      console.error('[Textures] Falha ao carregar texturas do pacote:', e);
      return false;
    } finally {
      _loadingPromise = null;
    }
  })();
  return _loadingPromise;
}

export async function reloadRealTextures() {
  _realLoaded = false;
  _anims.length = 0;
  return loadRealTextures(true);
}

export function tickTextureAnimations(tick) {
  if (!_realLoaded || _anims.length === 0 || !_cache) return;
  let dirty = false;
  for (const a of _anims) {
    const step = Math.floor(tick / a.frametime) % a.order.length;
    if (step === a.cur) continue;
    a.cur = step;
    drawFrame(_cache.ctx, a.strip, a.order[step], a.idx);
    dirty = true;
  }
  if (dirty) _cache.texture.needsUpdate = true;
}

export function getAtlasTileCanvas(name) {
  if (!_cache) makeAtlas();
  const idx = TILE_ORDER.indexOf(name);
  if (idx < 0) return null;
  const { x0, y0 } = tileRect(idx);
  const cv = document.createElement('canvas');
  cv.width = TILE; cv.height = TILE;
  cv.getContext('2d').drawImage(_cache.canvas, x0, y0, TILE, TILE, 0, 0, TILE, TILE);
  return cv;
}

export function getAtlasVersion() { return _atlasVersion; }
export function isRealTexturesLoaded() { return _realLoaded; }