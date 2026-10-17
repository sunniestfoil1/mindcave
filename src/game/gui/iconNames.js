// Nomes dos ícones de item no pacote 1.8.9 (textures/items/*.png) quando diferem do nome interno do registro.
// Itens sem ícone no pacote (peças das armas do Mind Cave, p. ex.) ficam fora e usam a cor do item.
const ITEM_FILE = {
  bow: 'bow_standby',
  wooden_sword: 'wood_sword', wooden_shovel: 'wood_shovel', wooden_pickaxe: 'wood_pickaxe', wooden_axe: 'wood_axe', wooden_hoe: 'wood_hoe',
  golden_sword: 'gold_sword', golden_shovel: 'gold_shovel', golden_pickaxe: 'gold_pickaxe', golden_axe: 'gold_axe', golden_hoe: 'gold_hoe',
  golden_helmet: 'gold_helmet', golden_chestplate: 'gold_chestplate', golden_leggings: 'gold_leggings', golden_boots: 'gold_boots',
  wheat_seeds: 'seeds_wheat', pumpkin_seeds: 'seeds_pumpkin', melon_seeds: 'seeds_melon',
  porkchop: 'porkchop_raw', cooked_porkchop: 'porkchop_cooked',
  beef: 'beef_raw', cooked_beef: 'beef_cooked',
  chicken: 'chicken_raw', cooked_chicken: 'chicken_cooked',
  rabbit: 'rabbit_raw', cooked_rabbit: 'rabbit_cooked',
  mutton: 'mutton_raw', cooked_mutton: 'mutton_cooked',
  fish: 'fish_cod_raw', cooked_fish: 'fish_cod_cooked', salmon: 'fish_salmon_raw', pufferfish: 'fish_pufferfish_raw', clownfish: 'fish_clownfish_raw',
  golden_apple: 'apple_golden', golden_apple_ench: 'apple_golden', golden_carrot: 'carrot_golden',
  baked_potato: 'potato_baked', poisonous_potato: 'potato_poisonous',
  wooden_door: 'door_wood', iron_door: 'door_iron',
  spruce_door: 'door_spruce', birch_door: 'door_birch', jungle_door: 'door_jungle', acacia_door: 'door_acacia', dark_oak_door: 'door_dark_oak',
  skull: 'skull_skeleton',
  bucket: 'bucket_empty', water_bucket: 'bucket_water', lava_bucket: 'bucket_lava',
  minecart: 'minecart_normal',
  redstone: 'redstone_dust',
  book: 'book_normal', writable_book: 'book_writable', written_book: 'book_written', enchanted_book: 'book_enchanted',
  slime_ball: 'slimeball',
  fishing_rod: 'fishing_rod_uncast',
  glass_bottle: 'potion_bottle_empty',
  potion: 'potion_bottle_drinkable',
  splash_potion: 'potion_bottle_splash',
  fermented_spider_eye: 'spider_eye_fermented',
  speckled_melon: 'melon_speckled',
  firework_charge: 'fireworks_charge',
  armor_stand: 'wooden_armorstand',
  banner: 'banner_base',
};

// Itens do registro que são blocos sem ícone próprio: usam a textura do bloco (nome do ladrilho do atlas)
const ITEM_AS_BLOCK_TILE = {
  farmland: 'farmland', lever: 'lever', stone_pressure_plate: 'stone', wooden_pressure_plate: 'planks',
  redstone_torch: 'redstone_torch', stone_button: 'stone', cactus: 'cactus_side', redstone_lamp: 'redstone_lamp',
  daylight_sensor: 'daylight_sensor', wheat_crop: 'wheat_stage_7',
};

// Corante (id 351): cada cor (meta 0–15) tem o seu arquivo no pacote, dye_powder_<cor>.png
const DYE_FILES = ['black', 'red', 'green', 'brown', 'blue', 'purple', 'cyan', 'silver', 'gray', 'pink', 'lime', 'yellow', 'light_blue', 'magenta', 'orange', 'white'];
export function itemIconFile(name, meta = 0) {
  if (name === 'dye') return 'dye_powder_' + DYE_FILES[(meta || 0) & 15];
  return ITEM_FILE[name] || name;
}
// Chave de cache do ícone: só o corante muda de ícone por meta
export const iconKey = (id, meta = 0) => (id === 351 ? `351:${(meta || 0) & 15}` : id);
export function itemBlockTile(name) { return ITEM_AS_BLOCK_TILE[name] || null; }

// Cor da tinta de bioma aplicada nos ícones (planície): grama e folhagem
export const ICON_TINT = { grass: '#91BD59', foliage: '#77AB2F' };
