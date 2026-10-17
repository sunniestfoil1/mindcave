// Ladrilhos de bloco do pacote 1.8.9 (textures/blocks/<nome>.png) que o atlas carrega além dos básicos: cada nome aqui é o do arquivo.
// textures.js junta esta lista à de EXTRA_TILES; os blocos novos (blocksMore.js) apontam para estes nomes.
export const DYES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'silver', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];   // ordem do meta de lã/vidro/argila (1.8.9)

const names = [];
for (const w of ['spruce', 'birch', 'jungle', 'acacia', 'dark_oak']) names.push(`door_${w}_lower`, `door_${w}_upper`);
for (const c of DYES) names.push('wool_colored_' + c, 'glass_' + c, 'glass_pane_top_' + c, 'hardened_clay_stained_' + c);
names.push(
  'glass_pane_top', 'hardened_clay', 'ice_packed', 'grass_side_snowed',
  'stone_granite', 'stone_diorite', 'stone_andesite', 'stone_granite_smooth', 'stone_diorite_smooth', 'stone_andesite_smooth',
  'coarse_dirt', 'dirt_podzol_top', 'dirt_podzol_side', 'red_sand', 'sponge_wet',
  'sapling_oak', 'sapling_spruce', 'sapling_birch', 'sapling_jungle', 'sapling_acacia', 'sapling_roofed_oak',
  'fern', 'flower_blue_orchid', 'flower_allium', 'flower_houstonia', 'flower_oxeye_daisy', 'flower_tulip_red', 'flower_tulip_orange', 'flower_tulip_white', 'flower_tulip_pink',
  'double_plant_grass_bottom', 'double_plant_grass_top', 'double_plant_fern_bottom', 'double_plant_fern_top', 'double_plant_rose_bottom', 'double_plant_rose_top',
  'double_plant_syringa_bottom', 'double_plant_syringa_top', 'double_plant_paeonia_bottom', 'double_plant_paeonia_top',
  'double_plant_sunflower_bottom', 'double_plant_sunflower_top',
  'mushroom_block_skin_brown', 'mushroom_block_skin_red', 'mushroom_block_skin_stem', 'mushroom_block_inside',
  'stonebrick_mossy', 'stonebrick_cracked', 'stonebrick_carved',
  'sandstone_carved', 'sandstone_smooth', 'red_sandstone_carved', 'red_sandstone_smooth', 'red_sandstone_normal',
  'quartz_block_chiseled', 'quartz_block_chiseled_top', 'quartz_block_lines', 'quartz_block_lines_top',
  'prismarine_bricks', 'prismarine_dark', 'prismarine_rough',
  'noteblock', 'jukebox_top', 'jukebox_side', 'furnace_front_on', 'pumpkin_face_on', 'mob_spawner', 'beacon', 'command_block',
  'dispenser_front_horizontal', 'dropper_front_horizontal', 'piston_bottom', 'piston_inner', 'piston_side', 'piston_top_normal', 'piston_top_sticky',
  'endframe_top', 'endframe_side', 'endframe_eye', 'dragon_egg', 'enchanting_table_top', 'enchanting_table_side', 'enchanting_table_bottom',
  'iron_trapdoor', 'iron_bars', 'anvil_base', 'anvil_top_damaged_0', 'anvil_top_damaged_1', 'anvil_top_damaged_2',
  'brewing_stand', 'brewing_stand_base', 'cauldron_top', 'cauldron_side', 'cauldron_bottom', 'cauldron_inner',
  'cake_top', 'cake_side', 'cake_bottom', 'cake_inner', 'flower_pot', 'cocoa_stage_0', 'cocoa_stage_1', 'cocoa_stage_2',
  'trip_wire', 'trip_wire_source',
  'rail_normal', 'rail_normal_turned', 'rail_golden', 'rail_golden_powered', 'rail_detector', 'rail_detector_powered', 'rail_activator', 'rail_activator_powered',
  'daylight_detector_inverted_top', 'lever', 'redstone_torch_on', 'redstone_torch_off',
  // compostos do arquivo da entidade em textures.js (composeChest): baús do Ender e armadilhado, cabeça
  'ender_chest_top', 'ender_chest_side', 'ender_chest_front', 'trapped_chest_top', 'trapped_chest_side', 'trapped_chest_front', 'skull_front', 'skull_top', 'skull_side',
);
export const MORE_TILES = Object.fromEntries([...new Set(names)].map((n) => [n, n]));
