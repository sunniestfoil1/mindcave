// Registro de blocos data-driven — PRD 02 RF-001. Adicionar bloco = adicionar entrada.
import { packState as packS } from './chunk';
import { registerMoreBlocks, onWall, WALL_META_DIR } from './blocksMore';

export const RenderType = { OPAQUE: 'opaque', CUTOUT: 'cutout', TRANSLUCENT: 'translucent' };

// Helper para criar entrada de bloco com defaults
// MC24-RF-012: bloco com modelo não-cubo NÃO é sólido nem opaco por padrão (plantas, tochas, tapetes…);
// a física e o mesher leem estas propriedades — nunca assumem "todo bloco é cubo".
function B(id, name, namePt, props) {
  const flat = !!props.model && props.model !== 'cube';
  return { id, name, namePt, solid: !flat, opaque: !flat, render: 'opaque',
           lightOpacity: flat ? 0 : 15, lightEmission: 0, slipperiness: 0.6, replaceable: false,
           soundCategory: 'stone', model: 'cube', drop: id, ...props };
}

const logFaces = (top, side) => ({ top, bottom: top, side });

export const BLOCKS = {
  0:  B(0, 'air', 'Ar', { solid: false, opaque: false, render: 'opaque', lightOpacity: 0, replaceable: true, drop: null, model: 'none' }),

  // Pedras
  1:  B(1, 'stone', 'Pedra', { hardness: 1.5, faces: { all: 'stone' }, drop: 4 }),
  2:  B(2, 'grass', 'Grama', { hardness: 0.6, faces: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, drop: 3, tint: 'grass' }),
  3:  B(3, 'dirt', 'Terra', { hardness: 0.5, faces: { all: 'dirt' }, drop: 3 }),
  4:  B(4, 'cobblestone', 'Pedregulho', { hardness: 2.0, faces: { all: 'cobblestone' }, drop: 4 }),
  7:  B(7, 'bedrock', 'Bedrock', { hardness: -1, faces: { all: 'bedrock' }, drop: null }),
  48: B(48, 'mossy_cobblestone', 'Pedregulho Musgoso', { hardness: 2.0, faces: { all: 'mossy_cobble' }, drop: 48 }),
  49: B(49, 'obsidian', 'Obsidiana', { hardness: 50, resistance: 6000, faces: { all: 'obsidian' }, drop: 49 }),
  98: B(98, 'stone_bricks', 'Tijolos de Pedra', { hardness: 2.0, faces: { all: 'stone_bricks' }, drop: 98 }),
  121: B(121, 'end_stone', 'Pedra do End', { hardness: 3.0, faces: { all: 'end_stone' }, drop: 121 }),
  87: B(87, 'netherrack', 'Netherrack', { hardness: 0.4, faces: { all: 'netherrack' }, drop: 87 }),
  110: B(110, 'mycelium', 'Micélio', { hardness: 0.6, faces: { top: 'mycelium_top', bottom: 'dirt', side: 'mycelium_side' }, drop: 3 }),
  112: B(112, 'nether_brick', 'Tijolo do Nether', { hardness: 2.0, faces: { all: 'nether_brick' }, drop: 112 }),
  168: B(168, 'prismarine', 'Prismarinho', { hardness: 1.5, faces: { all: 'prismarine' }, drop: 168 }),
  169: B(169, 'sea_lantern', 'Lanterna do Mar', { hardness: 0.3, faces: { all: 'sea_lantern' }, drop: 169, lightEmission: 15 }),

  // Terra/areia
  12: B(12, 'sand', 'Areia', { hardness: 0.5, faces: { all: 'sand' }, drop: 12, soundCategory: 'sand', falls: true }),
  13: B(13, 'gravel', 'Cascalho', { hardness: 0.6, faces: { all: 'gravel' }, drop: 13, soundCategory: 'gravel', falls: true }),
  82: B(82, 'clay', 'Argila', { hardness: 0.6, faces: { all: 'clay' }, drop: 82 }),
  88: B(88, 'soulsand', 'Areia das Almas', { hardness: 0.5, faces: { all: 'soulsand' }, drop: 88, speedFactor: 0.4, collH: 0.875 }),
  79: B(79, 'ice', 'Gelo', { hardness: 0.5, faces: { all: 'ice' }, drop: null, render: 'translucent', opaque: false, lightOpacity: 3, slipperiness: 0.98 }),
  80: B(80, 'snow_block', 'Bloco de Neve', { hardness: 0.2, faces: { all: 'snow' }, drop: 80, soundCategory: 'snow' }),

  // Madeira
  5:  B(5, 'planks', 'Tábuas de Carvalho', { hardness: 2.0, faces: { all: 'planks' }, drop: 5, soundCategory: 'wood' }),
  17: B(17, 'log', 'Tronco de Carvalho', { hardness: 2.0, faces: { top: 'log_top', bottom: 'log_top', side: 'log_side' }, drop: 17, axisByMeta: true, soundCategory: 'wood', variantMask: 3, dropMeta: true, variants: [logFaces('log_top', 'log_side'), logFaces('log_spruce_top', 'log_spruce_side'), logFaces('log_birch_top', 'log_birch_side'), logFaces('log_jungle_top', 'log_jungle_side')], variantNames: ['Tronco de Carvalho', 'Tronco de Pinheiro', 'Tronco de Bétula', 'Tronco da Selva'] }),
  18: B(18, 'leaves', 'Folhas de Carvalho', { hardness: 0.2, faces: { all: 'leaves' }, drop: null, render: 'cutout', opaque: false, cullSame: true, lightOpacity: 1, tint: 'foliage', variantMask: 3, variants: [{ all: 'leaves' }, { all: 'leaves_spruce' }, { all: 'leaves_birch' }, { all: 'leaves_jungle' }], variantNames: ['Folhas de Carvalho', 'Folhas de Pinheiro', 'Folhas de Bétula', 'Folhas da Selva'] }),
  47: B(47, 'bookshelf', 'Estante', { hardness: 1.5, faces: { top: 'planks', bottom: 'planks', side: 'bookshelf' }, drop: 47, soundCategory: 'wood' }),
  170: B(170, 'hay_block', 'Fardo de Feno', { hardness: 0.5, faces: { all: 'hay' }, drop: 170, soundCategory: 'grass', axisByMeta: true }),

  // Líquidos
  8:  B(8, 'flowing_water', 'Água Corrente', { solid: false, opaque: false, render: 'translucent', tint: 'water', faces: { all: 'water' }, drop: null, lightOpacity: 3, model: 'liquid', fluid: 'water', replaceable: true, slipperiness: 0.98 }),
  9:  B(9, 'water', 'Água', { solid: false, opaque: false, render: 'translucent', tint: 'water', faces: { all: 'water' }, drop: null, lightOpacity: 3, model: 'liquid', fluid: 'water', replaceable: true, slipperiness: 0.98 }),
  10: B(10, 'flowing_lava', 'Lava Corrente', { solid: false, opaque: false, render: 'opaque', faces: { all: 'lava' }, drop: null, lightOpacity: 15, lightEmission: 15, model: 'liquid', fluid: 'lava', replaceable: true }),
  11: B(11, 'lava', 'Lava', { solid: false, opaque: false, render: 'opaque', faces: { all: 'lava' }, drop: null, lightOpacity: 15, lightEmission: 15, model: 'liquid', fluid: 'lava', replaceable: true }),

  // Minérios e blocos minerais
  14: B(14, 'gold_ore', 'Minério de Ouro', { hardness: 3.0, faces: { all: 'gold_ore' }, drop: 14 }),
  15: B(15, 'iron_ore', 'Minério de Ferro', { hardness: 3.0, faces: { all: 'iron_ore' }, drop: 15 }),
  16: B(16, 'coal_ore', 'Minério de Carvão', { hardness: 3.0, faces: { all: 'coal_ore' }, drop: 16 }),
  21: B(21, 'lapis_ore', 'Minério de Lápis', { hardness: 3.0, faces: { all: 'lapis_ore' }, drop: 21 }),
  22: B(22, 'lapis_block', 'Bloco de Lápis', { hardness: 3.0, faces: { all: 'lapis_block' }, drop: 22 }),
  41: B(41, 'gold_block', 'Bloco de Ouro', { hardness: 3.0, faces: { all: 'gold_block' }, drop: 41, soundCategory: 'metal' }),
  42: B(42, 'iron_block', 'Bloco de Ferro', { hardness: 5.0, faces: { all: 'iron_block' }, drop: 42, soundCategory: 'metal' }),
  56: B(56, 'diamond_ore', 'Minério de Diamante', { hardness: 3.0, faces: { all: 'diamond_ore' }, drop: 56 }),
  57: B(57, 'diamond_block', 'Bloco de Diamante', { hardness: 5.0, faces: { all: 'diamond_block' }, drop: 57, soundCategory: 'metal' }),
  73: B(73, 'redstone_ore', 'Minério de Redstone', { hardness: 3.0, faces: { all: 'redstone_ore' }, drop: 73 }),
  129: B(129, 'emerald_ore', 'Minério de Esmeralda', { hardness: 3.0, faces: { all: 'emerald_ore' }, drop: 129 }),
  133: B(133, 'emerald_block', 'Bloco de Esmeralda', { hardness: 5.0, faces: { all: 'emerald_block' }, drop: 133 }),
  152: B(152, 'redstone_block', 'Bloco de Redstone', { hardness: 5.0, faces: { all: 'redstone_block' }, drop: 152 }),
  155: B(155, 'quartz_block', 'Bloco de Quartzo', { hardness: 0.8, faces: { all: 'quartz' }, drop: 155 }),
  173: B(173, 'coal_block', 'Bloco de Carvão', { hardness: 5.0, faces: { all: 'coal_block' }, drop: 173 }),

  // Fabricados
  20: B(20, 'glass', 'Vidro', { hardness: 0.3, faces: { all: 'glass' }, drop: null, render: 'cutout', opaque: false, cullSame: true, lightOpacity: 0 }),
  45: B(45, 'bricks', 'Tijolos', { hardness: 2.0, faces: { all: 'bricks' }, drop: 45 }),
  46: B(46, 'tnt', 'TNT', { hardness: 0, faces: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt' }, drop: 46, soundCategory: 'grass' }),
  89: B(89, 'glowstone', 'Glowstone', { hardness: 0.3, faces: { all: 'glowstone' }, drop: 89, lightEmission: 15 }),
  58: B(58, 'crafting_table', 'Bancada', { hardness: 2.5, faces: { top: 'crafting_top', bottom: 'planks', side: 'crafting_side' }, drop: 58, soundCategory: 'wood' }),
  26: B(26, 'bed', 'Cama', { hardness: 0.2, faces: { top: 'bed_head_top', side: 'bed_head_side', bottom: 'planks' }, drop: 355, model: 'bed', solid: true, opaque: false, lightOpacity: 0, render: 'opaque', soundCategory: 'wood' }),
  61: B(61, 'furnace', 'Fornalha', { hardness: 3.5, faces: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, drop: 61, orient: true }),
  95: B(95, 'stained_glass', 'Vidro Tingido', { hardness: 0.3, faces: { all: 'glass' }, drop: null, render: 'translucent', opaque: false, lightOpacity: 0, metaColors: true }),
  24: B(24, 'sandstone', 'Arenito', { hardness: 0.8, faces: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' }, drop: 24 }),

  // Lã, argila, tapete
  35: B(35, 'wool', 'Lã', { hardness: 0.8, faces: { all: 'wool' }, drop: 35, metaColors: true, soundCategory: 'wool' }),
  159: B(159, 'stained_clay', 'Argila Tingida', { hardness: 1.25, faces: { all: 'hardened_clay' }, drop: 159, metaColors: true }),
  171: B(171, 'carpet', 'Tapete', { hardness: 0.1, faces: { all: 'wool' }, drop: 171, metaColors: true, lightOpacity: 0, model: 'carpet', soundCategory: 'wool' }),

  // Especiais
  50: B(50, 'torch', 'Tocha', { hardness: 0, faces: { all: 'torch' }, drop: 50, lightEmission: 14, lightOpacity: 0, model: 'torch', solid: false, replaceable: true, soundCategory: 'wood' }),
  19: B(19, 'sponge', 'Esponja', { hardness: 0.6, faces: { all: 'sponge' }, drop: 19 }),
  30: B(30, 'web', 'Teia', { hardness: 4.0, faces: { all: 'web' }, drop: 30, render: 'cutout', lightOpacity: 1, model: 'cross', solid: false, speedFactor: 0.25 }),
  51: B(51, 'fire', 'Fogo', { solid: false, opaque: false, render: 'cutout', faces: { all: 'fire' }, drop: null, lightEmission: 15, lightOpacity: 0, model: 'fire', replaceable: true, hardness: 0 }),
  165: B(165, 'slime', 'Bloco de Slime', { hardness: 0, faces: { all: 'slime' }, drop: 165, slipperiness: 0.8, soundCategory: 'slime' }),

  // Plantas (cruz)
  31: B(31, 'tallgrass', 'Grama Alta', { hardness: 0, faces: { all: 'grass_plant' }, drop: null, render: 'cutout', lightOpacity: 0, model: 'cross', tint: 'grass', solid: false, replaceable: true, soundCategory: 'grass' }),
  37: B(37, 'flower', 'Dente-de-leão', { hardness: 0, faces: { all: 'flower_dandelion' }, drop: 37, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true, soundCategory: 'grass' }),
  6: B(6, 'sapling', 'Muda de carvalho', { hardness: 0, faces: { all: 'sapling_oak' }, drop: 6, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true, soundCategory: 'grass' }),
  38: B(38, 'rose', 'Papoula', { hardness: 0, faces: { all: 'flower_rose' }, drop: 38, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true, soundCategory: 'grass' }),
  39: B(39, 'brown_mushroom', 'Cogumelo Marrom', { hardness: 0, faces: { all: 'mushroom_brown' }, drop: 39, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true, lightEmission: 1 }),
  40: B(40, 'red_mushroom', 'Cogumelo Vermelho', { hardness: 0, faces: { all: 'mushroom_red' }, drop: 40, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true }),
  83: B(83, 'sugarcane', 'Cana-de-açúcar', { hardness: 0, faces: { all: 'sugarcane' }, drop: 83, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true }),
  111: B(111, 'lilypad', 'Vitória-régia', { hardness: 0.1, faces: { all: 'lilypad' }, drop: 111, render: 'cutout', lightOpacity: 0, model: 'box', box: [0, 0, 0, 1, 0.015625, 1], tintColor: [0.125, 0.5, 0.188], solid: false }),

  // Neve
  78: B(78, 'snow_layer', 'Camada de Neve', { hardness: 0.1, faces: { all: 'snow' }, drop: 78, lightOpacity: 0, model: 'snow', replaceable: true, soundCategory: 'snow' }),

  // Variantes de madeira (PRD 04)
  162: B(162, 'log2', 'Tronco de Acácia', { hardness: 2.0, faces: { top: 'log_acacia_top', bottom: 'log_acacia_top', side: 'log_acacia_side' }, drop: 162, axisByMeta: true, soundCategory: 'wood', variantMask: 1, dropMeta: true, variants: [logFaces('log_acacia_top', 'log_acacia_side'), logFaces('log_big_oak_top', 'log_big_oak_side')], variantNames: ['Tronco de Acácia', 'Tronco de Carvalho Escuro'] }),
  161: B(161, 'leaves2', 'Folhas de Acácia', { hardness: 0.2, faces: { all: 'leaves_acacia' }, drop: null, render: 'cutout', opaque: false, cullSame: true, lightOpacity: 1, tint: 'foliage', variantMask: 1, variants: [{ all: 'leaves_acacia' }, { all: 'leaves_big_oak' }], variantNames: ['Folhas de Acácia', 'Folhas de Carvalho Escuro'] }),

  // Blocos de cogumelo gigante
  99: B(99, 'brown_mushroom_block', 'Bloco de Cogumelo Marrom', { hardness: 0.2, faces: { all: 'mushroom_brown' }, drop: 99 }),
  100: B(100, 'red_mushroom_block', 'Bloco de Cogumelo Vermelho', { hardness: 0.2, faces: { all: 'mushroom_red' }, drop: 100 }),

  // Plantas e especiais (PRD 04)
  106: B(106, 'vine', 'Trepadeira', { hardness: 0.2, faces: { all: 'vine' }, tint: 'foliage', drop: 106, render: 'cutout', lightOpacity: 0, model: 'vine', solid: false, replaceable: true, soundCategory: 'grass' }),
  81: B(81, 'cactus', 'Cacto', { hardness: 0.4, faces: { top: 'cactus_top', bottom: 'cactus_bottom', side: 'cactus_side' }, drop: 81, render: 'cutout', lightOpacity: 0, model: 'box', box: [0.0625, 0, 0.0625, 0.9375, 1, 0.9375], solid: true, opaque: false }),
  141: B(141, 'carrots', 'Cenouras', { hardness: 0, faces: { all: 'carrots_stage_0' }, drop: 391, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true, soundCategory: 'grass' , variants: [{ all: 'carrots_stage_0' }, { all: 'carrots_stage_0' }, { all: 'carrots_stage_1' }, { all: 'carrots_stage_1' }, { all: 'carrots_stage_2' }, { all: 'carrots_stage_2' }, { all: 'carrots_stage_2' }, { all: 'carrots_stage_3' }]}),
  142: B(142, 'potatoes', 'Batatas', { hardness: 0, faces: { all: 'potatoes_stage_0' }, drop: 392, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true, soundCategory: 'grass' , variants: [{ all: 'potatoes_stage_0' }, { all: 'potatoes_stage_0' }, { all: 'potatoes_stage_1' }, { all: 'potatoes_stage_1' }, { all: 'potatoes_stage_2' }, { all: 'potatoes_stage_2' }, { all: 'potatoes_stage_2' }, { all: 'potatoes_stage_3' }]}),
  32: B(32, 'dead_bush', 'Arbusto Morto', { hardness: 0, faces: { all: 'dead_bush' }, drop: 32, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true, soundCategory: 'grass' }),
  174: B(174, 'packed_ice', 'Gelo Compactado', { hardness: 0.5, faces: { all: 'ice' }, drop: null, render: 'translucent', opaque: false, lightOpacity: 3, slipperiness: 0.98 }),
  86: B(86, 'pumpkin', 'Abóbora', { hardness: 1.0, faces: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face_off' }, drop: 86 , orient: true}),
  103: B(103, 'melon_block', 'Melância', { hardness: 1.0, faces: { top: 'melon_top', bottom: 'melon_top', side: 'melon_side' }, drop: 103 }),
  176: B(176, 'red_sandstone', 'Arenito Vermelho (antigo)', { hardness: 0.8, faces: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' }, drop: 176 }),

  // PRD 09: Bancada de Armeiro (RF-002)
  177: B(177, 'gunsmith_bench', 'Bancada de Armeiro', { hardness: 2.5, faces: { top: 'planks', bottom: 'planks', side: 'crafting_side' }, drop: 177, soundCategory: 'wood' }),

  // PRD 11: Redstone
  55: B(55, 'redstone_wire', 'Fio de Redstone', { hardness: 0, faces: { all: 'redstone_block' }, drop: 331, render: 'cutout', lightOpacity: 0, model: 'carpet', solid: false, replaceable: true, soundCategory: 'stone' }),
  69: B(69, 'lever', 'Alavanca', { hardness: 0.5, faces: { all: 'lever' }, drop: 69, render: 'cutout', lightOpacity: 0, model: 'torch', solid: false, replaceable: true, soundCategory: 'wood' }),
  70: B(70, 'stone_pressure_plate', 'Placa de Pressão de Pedra', { hardness: 0.5, faces: { all: 'stone' }, drop: 70, render: 'cutout', lightOpacity: 0, model: 'carpet', solid: false, replaceable: true, soundCategory: 'stone' }),
  72: B(72, 'wooden_pressure_plate', 'Placa de Pressão de Madeira', { hardness: 0.5, faces: { all: 'planks' }, drop: 72, render: 'cutout', lightOpacity: 0, model: 'carpet', solid: false, replaceable: true, soundCategory: 'wood' }),
  75: B(75, 'unlit_redstone_torch', 'Tocha de Redstone Apagada', { hardness: 0, faces: { all: 'redstone_torch_off' }, drop: 76, render: 'cutout', lightOpacity: 0, model: 'torch', solid: false, replaceable: true, soundCategory: 'wood' }),
  76: B(76, 'redstone_torch', 'Tocha de Redstone', { hardness: 0, faces: { all: 'redstone_torch_on' }, drop: 76, render: 'cutout', lightOpacity: 0, model: 'torch', solid: false, replaceable: true, lightEmission: 7, soundCategory: 'wood' }),
  77: B(77, 'stone_button', 'Botão de Pedra', { hardness: 0.5, faces: { all: 'stone' }, drop: 77, render: 'cutout', lightOpacity: 0, model: 'torch', solid: false, replaceable: true, soundCategory: 'stone' }),
  93: B(93, 'unpowered_repeater', 'Repetidor Desligado', { hardness: 0, faces: { top: 'repeater_off', bottom: 'stone_slab_top', side: 'stone_slab_side' }, drop: 356, render: 'cutout', lightOpacity: 0, model: 'box', box: [0, 0, 0, 1, 0.125, 1], solid: false, replaceable: true, soundCategory: 'stone' }),
  94: B(94, 'powered_repeater', 'Repetidor Ligado', { hardness: 0, faces: { top: 'repeater_on', bottom: 'stone_slab_top', side: 'stone_slab_side' }, drop: 356, render: 'cutout', lightOpacity: 0, model: 'box', box: [0, 0, 0, 1, 0.125, 1], solid: false, replaceable: true, soundCategory: 'stone' }),
  123: B(123, 'redstone_lamp', 'Lâmpada de Redstone', { hardness: 0.3, faces: { all: 'redstone_lamp_off' }, drop: 123 }),
  124: B(124, 'lit_redstone_lamp', 'Lâmpada Acesa', { hardness: 0.3, faces: { all: 'redstone_lamp_on' }, drop: 123, lightEmission: 15 }),
  149: B(149, 'unpowered_comparator', 'Comparador Desligado', { hardness: 0, faces: { top: 'comparator_off', bottom: 'stone_slab_top', side: 'stone_slab_side' }, drop: 404, render: 'cutout', lightOpacity: 0, model: 'box', box: [0, 0, 0, 1, 0.125, 1], solid: false, replaceable: true, soundCategory: 'stone' }),
  150: B(150, 'powered_comparator', 'Comparador Ligado', { hardness: 0, faces: { top: 'comparator_on', bottom: 'stone_slab_top', side: 'stone_slab_side' }, drop: 404, render: 'cutout', lightOpacity: 0, model: 'box', box: [0, 0, 0, 1, 0.125, 1], solid: false, replaceable: true, soundCategory: 'stone' }),
  151: B(151, 'daylight_sensor', 'Sensor de Luz', { hardness: 0.2, faces: { top: 'daylight_detector_top', bottom: 'stone_slab_top', side: 'daylight_detector_side' }, drop: 151, render: 'cutout', lightOpacity: 0, model: 'box', box: [0, 0, 0, 1, 0.375, 1], solid: false, replaceable: true, soundCategory: 'stone' }),
  154: B(154, 'hopper', 'Funil', { hardness: 3.0, faces: { top: 'hopper_top', bottom: 'hopper_outside', side: 'hopper_outside' }, drop: 154, soundCategory: 'metal' }),

  // PRD 11: Agricultura
  59: B(59, 'wheat_crop', 'Plantação de trigo', { hardness: 0, faces: { all: 'wheat_stage_7' }, drop: 296, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true, soundCategory: 'grass' , variants: [{ all: 'wheat_stage_0' }, { all: 'wheat_stage_1' }, { all: 'wheat_stage_2' }, { all: 'wheat_stage_3' }, { all: 'wheat_stage_4' }, { all: 'wheat_stage_5' }, { all: 'wheat_stage_6' }, { all: 'wheat_stage_7' }]}),
  60: B(60, 'farmland', 'Terra Arada', { hardness: 0.6, faces: { top: 'farmland_dry', bottom: 'dirt', side: 'dirt' }, variants: [{ top: 'farmland_dry', bottom: 'dirt', side: 'dirt' }, { top: 'farmland_dry', bottom: 'dirt', side: 'dirt' }, { top: 'farmland_dry', bottom: 'dirt', side: 'dirt' }, { top: 'farmland_dry', bottom: 'dirt', side: 'dirt' }, { top: 'farmland_dry', bottom: 'dirt', side: 'dirt' }, { top: 'farmland_dry', bottom: 'dirt', side: 'dirt' }, { top: 'farmland_dry', bottom: 'dirt', side: 'dirt' }, { top: 'farmland_wet', bottom: 'dirt', side: 'dirt' }], drop: 3, model: 'box', box: [0, 0, 0, 1, 0.9375, 1], solid: true, opaque: false, lightOpacity: 15 }),
  104: B(104, 'pumpkin_stem', 'Caule de Abóbora', { hardness: 0, faces: { all: 'pumpkin_stem_disconnected' }, drop: 361, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true, soundCategory: 'grass' , tint: 'foliage'}),
  105: B(105, 'melon_stem', 'Caule de Melancia', { hardness: 0, faces: { all: 'melon_stem_disconnected' }, drop: 362, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true, soundCategory: 'grass' , tint: 'foliage'}),
  115: B(115, 'nether_wart', 'Verruga do Nether', { hardness: 0, faces: { all: 'nether_wart_stage_0' }, drop: 372, render: 'cutout', lightOpacity: 0, model: 'cross', solid: false, replaceable: true, soundCategory: 'plant' , variants: [{ all: 'nether_wart_stage_0' }, { all: 'nether_wart_stage_1' }, { all: 'nether_wart_stage_1' }, { all: 'nether_wart_stage_2' }, { all: 'nether_wart_stage_2' }, { all: 'nether_wart_stage_2' }, { all: 'nether_wart_stage_2' }, { all: 'nether_wart_stage_2' }]}),
};

// Plantações usam a textura de grama (cinza no pacote) → recebem a tinta de grama do bioma
for (const cid of [59, 104, 105, 141, 142]) BLOCKS[cid].tint = 'grass';

export function getBlock(id) { return BLOCKS[id] || BLOCKS[1]; }
export function isSolid(id) { const b = BLOCKS[id]; return !!(b && b.solid); }
export function isOpaque(id) { const b = BLOCKS[id]; return !!(b && b.opaque); }
export function isAir(id) { return id === 0; }
export function isWater(id) { return id === 8 || id === 9; }
export function isLava(id) { return id === 10 || id === 11; }
export function isFluid(id) { return id === 8 || id === 9 || id === 10 || id === 11; }
export function isReplaceable(id) { const b = BLOCKS[id]; return !!(b && b.replaceable); }
export function lightOpacity(id) { const b = BLOCKS[id]; return b ? (b.lightOpacity ?? 15) : 15; }
export function lightEmission(id) { const b = BLOCKS[id]; return b ? (b.lightEmission ?? 0) : 0; }

// Direções horizontais (0 oeste, 1 norte, 2 leste, 3 sul): a meta & 3 de blocos orientados é o lado da frente (abóbora, fornalha...)
export const HFACES = [[-1, 0], [0, -1], [1, 0], [0, 1]];

// Cogumelo gigante (1.8.9): a meta diz em quais lados fica a pele (1..9 = canto/lado do chapéu, 14 = tudo, 15 = caule, 10 = caule nos lados, 0 = poros)
function hugeMushroomTile(skin, meta, dir) {
  const m = meta || 0;
  if (m === 14) return skin;
  if (m === 15) return 'mushroom_block_skin_stem';
  if (m === 10) return dir && dir[1] === 0 ? 'mushroom_block_skin_stem' : 'mushroom_block_inside';
  if (m >= 1 && m <= 9 && dir) {
    if (dir[1] === 1) return skin;
    if (dir[1] === -1) return 'mushroom_block_inside';
    const west = m === 1 || m === 4 || m === 7, east = m === 3 || m === 6 || m === 9, north = m <= 3, south = m >= 7;
    if ((dir[0] === -1 && west) || (dir[0] === 1 && east) || (dir[2] === -1 && north) || (dir[2] === 1 && south)) return skin;
  }
  return 'mushroom_block_inside';
}

export function tileForFace(block, face, meta, dir) {
  if (block.hugeMushroom && dir) return hugeMushroomTile(block.hugeMushroom, meta, dir);
  const f = (block.variants && block.variants[(meta || 0) & (block.variantMask ?? 7)]) || block.faces || {};
  // tronco deitado: as pontas (tile de topo) ficam nas faces ao longo do eixo da meta (bits 2-3: 0 = y, 1 = x, 2 = z, 3 = casca nos 6 lados)
  if (block.axisByMeta && dir && f.top && f.side) {
    const ax = ((meta || 0) >> 2) & 3;
    return (ax === 0 ? dir[1] !== 0 : ax === 1 ? dir[0] !== 0 : ax === 2 ? dir[2] !== 0 : false) ? f.top : f.side;
  }
  if (block.orient && dir && f.front && dir[1] === 0 && dir[0] === HFACES[(meta || 0) & 3][0] && dir[2] === HFACES[(meta || 0) & 3][1]) return f.front;
  if (f.all) return f.all;
  if (face === 'front' && f.front) return f.front;
  return f[face] || f.side || f.top || f.all;
}

export function blockTint(block, face, meta) {
  // Tint por bioma (placeholder: valores fixos aproximados de planície)
  if (block.tint === 'grass') return [0.53, 0.72, 0.28];
  if (block.tint === 'foliage') return [0.43, 0.65, 0.25];
  if (block.tint === 'water') return [0.25, 0.45, 0.75];
  return null;
}

const FULL_BOX = [0, 0, 0, 1, 1, 1];
const SEL_GRASS = [0.1, 0, 0.1, 0.9, 0.8, 0.9];
const SEL_FLOWER = [0.3, 0, 0.3, 0.7, 0.6, 0.7];
const SEL_TORCH = [0.4, 0, 0.4, 0.6, 0.6, 0.6];
const SEL_PLATE = [0.0625, 0, 0.0625, 0.9375, 0.0625, 0.9375];

// Caixa de seleção (contorno do bloco mirado) em coordenadas do bloco: [x0,y0,z0,x1,y1,z1]
export function getSelectionBox(id, meta = 0) {
  const b = BLOCKS[id];
  if (!b) return FULL_BOX;
  switch (b.model) {
    case 'cross': return (id === 37 || id === 38 || id === 39 || id === 40) ? SEL_FLOWER : SEL_GRASS;
    case 'torch': return (meta & 7) >= 1 && (meta & 7) <= 4 ? onWall(WALL_META_DIR[meta & 7], 0.5, 0.3125, 0.6875, 0.2, 0.85) : SEL_TORCH;
    case 'rail': return [0, 0, 0, 1, 0.125, 1];
    case 'carpet': return id === 171 ? [0, 0, 0, 1, 0.0625, 1] : SEL_PLATE;
    case 'snow': return [0, 0, 0, 1, ((meta & 7) + 1) / 8, 1];
    case 'box': return b.box || FULL_BOX;
    case 'slab': return (meta & 8) ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
    case 'bed': return [0, 0, 0, 1, 0.5625, 1];
    case 'fence': case 'gate': return [0.375, 0, 0.375, 0.625, 1, 0.625];
    case 'chest': return [0.0625, 0, 0.0625, 0.9375, 0.875, 0.9375];
    case 'portal': return (meta & 3) === 2 ? [0.375, 0, 0, 0.625, 1, 1] : [0, 0, 0.375, 1, 1, 0.625];
    case 'door': return [0, 0, 0, 1, 1, 1];
    default: return FULL_BOX;
  }
}

// Caixa do modelo "box"/"carpet"/"torch"/"snow" usada pelo mesher e pelo item na mão
export function getModelBox(block, meta = 0) {
  switch (block.model) {
    case 'carpet': return block.id === 171 ? [0, 0, 0, 1, 0.0625, 1] : [0, 0, 0, 1, 0.0625, 1];
    case 'torch': return [0.4375, 0, 0.4375, 0.5625, 0.625, 0.5625];
    case 'snow': return [0, 0, 0, 1, ((meta & 7) + 1) / 8, 1];
    case 'box': return block.box || FULL_BOX;
    default: return FULL_BOX;
  }
}


// === Lajes e escadas (1.8.9) ===
// Os modelos 'slab' e 'stairs' têm formas próprias (shapes.js). São sólidos (colisão por caixas) e não opacos (as faces dos
// vizinhos aparecem); lightOpacity 15 como no original, com o brilho da malha vindo dos vizinhos (mesher).
const FACES_STONE_SLAB = { top: 'stone_slab_top', bottom: 'stone_slab_top', side: 'stone_slab_side' };
const FACES_SANDSTONE = { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone_side' };
const FACES_QUARTZ = { top: 'quartz_top', bottom: 'quartz_bottom', side: 'quartz' };
const FACES_RED_SANDSTONE = { top: 'red_sandstone_top', bottom: 'red_sandstone_bottom', side: 'red_sandstone_side' };
const all = (t) => ({ all: t });

const STONE_SLAB_VARIANTS = [FACES_STONE_SLAB, FACES_SANDSTONE, all('planks'), all('cobblestone'), all('bricks'), all('stone_bricks'), all('nether_brick'), FACES_QUARTZ];
const STONE_SLAB_NAMES = ['Laje de Pedra', 'Laje de Arenito', 'Laje de Madeira (antiga)', 'Laje de Pedregulho', 'Laje de Tijolos', 'Laje de Tijolos de Pedra', 'Laje de Tijolos do Nether', 'Laje de Quartzo'];
const WOOD_SLAB_VARIANTS = ['planks', 'planks_spruce', 'planks_birch', 'planks_jungle', 'planks_acacia', 'planks_dark_oak'].map(all);
const WOOD_SLAB_NAMES = ['Laje de Carvalho', 'Laje de Pinheiro', 'Laje de Bétula', 'Laje da Selva', 'Laje de Acácia', 'Laje de Carvalho Escuro'];

function shaped(id, name, namePt, props) {
  return { ...B(id, name, namePt, { solid: true, opaque: false, lightOpacity: 15, render: 'opaque', ...props }) };
}

function addSlab(singleId, doubleId, name, namePt, variants, names, extra) {
  BLOCKS[singleId] = shaped(singleId, name, namePt, { model: 'slab', variants, variantNames: names, doubleId, drop: singleId, ...extra });
  // laje dupla: cubo comum; drop = 2 lajes (mining.js)
  BLOCKS[doubleId] = B(doubleId, 'double_' + name, 'Laje Dupla de ' + namePt.replace(/^Laje (de |da )?/, ''), { variants, variantNames: names, singleId, drop: singleId, faces: variants[0], ...extra });
}

addSlab(44, 43, 'stone_slab', 'Laje de Pedra', STONE_SLAB_VARIANTS, STONE_SLAB_NAMES, { hardness: 2.0 });
addSlab(126, 125, 'wooden_slab', 'Laje de Madeira', WOOD_SLAB_VARIANTS, WOOD_SLAB_NAMES, { hardness: 2.0, soundCategory: 'wood' });
addSlab(182, 181, 'stone_slab2', 'Laje de Arenito Vermelho', [FACES_RED_SANDSTONE], ['Laje de Arenito Vermelho'], { hardness: 2.0 });

const STAIRS = [
  [53, 'oak_stairs', 'Escada de Carvalho', all('planks'), 2.0, 'wood'],
  [67, 'stone_stairs', 'Escada de Pedregulho', all('cobblestone'), 2.0, 'stone'],
  [108, 'brick_stairs', 'Escada de Tijolos', all('bricks'), 2.0, 'stone'],
  [109, 'stone_brick_stairs', 'Escada de Tijolos de Pedra', all('stone_bricks'), 1.5, 'stone'],
  [114, 'nether_brick_stairs', 'Escada de Tijolos do Nether', all('nether_brick'), 2.0, 'stone'],
  [128, 'sandstone_stairs', 'Escada de Arenito', FACES_SANDSTONE, 0.8, 'stone'],
  [134, 'spruce_stairs', 'Escada de Pinheiro', all('planks_spruce'), 2.0, 'wood'],
  [135, 'birch_stairs', 'Escada de Bétula', all('planks_birch'), 2.0, 'wood'],
  [136, 'jungle_stairs', 'Escada da Selva', all('planks_jungle'), 2.0, 'wood'],
  [156, 'quartz_stairs', 'Escada de Quartzo', FACES_QUARTZ, 0.8, 'stone'],
  [163, 'acacia_stairs', 'Escada de Acácia', all('planks_acacia'), 2.0, 'wood'],
  [164, 'dark_oak_stairs', 'Escada de Carvalho Escuro', all('planks_dark_oak'), 2.0, 'wood'],
  [180, 'red_sandstone_stairs', 'Escada de Arenito Vermelho', FACES_RED_SANDSTONE, 0.8, 'stone'],
];
for (const [id, name, namePt, faces, hardness, snd] of STAIRS) {
  BLOCKS[id] = shaped(id, name, namePt, { model: 'stairs', faces, hardness, soundCategory: snd, drop: id });
}

// === Portas, cercas e portões (1.8.9) === formas em shapes.js; estados e regras lá
BLOCKS[64] = shaped(64, 'wooden_door', 'Porta de Carvalho', { model: 'door', hardness: 3.0, faces: { all: 'door_wood_lower' }, doorTiles: ['door_wood_lower', 'door_wood_upper'], drop: 324, lightOpacity: 0, soundCategory: 'wood', hiddenInCreative: true });
BLOCKS[71] = shaped(71, 'iron_door', 'Porta de Ferro', { model: 'door', hardness: 5.0, faces: { all: 'door_iron_lower' }, doorTiles: ['door_iron_lower', 'door_iron_upper'], drop: 330, lightOpacity: 0, soundCategory: 'metal', hiddenInCreative: true });
BLOCKS[85] = shaped(85, 'fence', 'Cerca de Carvalho', { model: 'fence', hardness: 2.0, faces: { all: 'planks' }, drop: 85, lightOpacity: 0, soundCategory: 'wood' });
BLOCKS[113] = shaped(113, 'nether_brick_fence', 'Cerca de Tijolos do Nether', { model: 'fence', hardness: 2.0, faces: { all: 'nether_brick' }, drop: 113, lightOpacity: 0 });
BLOCKS[107] = shaped(107, 'fence_gate', 'Portão de Carvalho', { model: 'gate', hardness: 2.0, faces: { all: 'planks' }, drop: 107, lightOpacity: 0, soundCategory: 'wood' });
// Portal do Nether: plano fino de 4/16 no eixo X (meta 1) ou Z (meta 2), translúcido e atravessável; entrar leva ao outro mundo
BLOCKS[90] = B(90, 'portal', 'Portal do Nether', { model: 'portal', hardness: -1, faces: { all: 'portal' }, drop: null, solid: false, opaque: false, render: 'translucent', lightOpacity: 0, lightEmission: 11, replaceable: false, soundCategory: 'glass' });
BLOCKS[153] = B(153, 'quartz_ore', 'Minério de Quartzo', { hardness: 3.0, faces: { all: 'quartz_ore' }, drop: 406 });
BLOCKS[54] = shaped(54, 'chest', 'Baú', { model: 'chest', hardness: 2.5, faces: { top: 'chest_top', bottom: 'planks', side: 'chest_side', front: 'chest_front' }, drop: 54, lightOpacity: 0, soundCategory: 'wood' });
BLOCKS[65] = shaped(65, 'ladder', 'Escada de Mão', { model: 'ladder', hardness: 0.4, faces: { all: 'ladder' }, drop: 65, render: 'cutout', lightOpacity: 0, soundCategory: 'wood', climbable: true });
BLOCKS[96] = shaped(96, 'trapdoor', 'Alçapão', { model: 'trapdoor', hardness: 3.0, faces: { all: 'trapdoor' }, drop: 96, render: 'cutout', lightOpacity: 0, soundCategory: 'wood' });
for (const [id, kind, on] of [[93, 'repeater', false], [94, 'repeater', true], [149, 'comparator', false], [150, 'comparator', true]]) BLOCKS[id].diode = { kind, on };
registerMoreBlocks({ BLOCKS, B, shaped });
export const SLAB_IDS = [44, 126, 182];
export const STAIR_IDS = STAIRS.map(s => s[0]);

// Nome exibido (a laje muda de nome conforme o tipo, guardado na meta)
export function blockDisplayName(id, meta = 0) {
  const b = BLOCKS[id];
  if (!b) return null;
  if (b.variantNames) return b.variantNames[meta & (b.variantMask ?? 7)] || b.namePt;
  return b.namePt;
}

// Nome do bloco para lookup por comando /give
export const BLOCK_NAMES = {};
for (const id in BLOCKS) {
  const b = BLOCKS[id];
  BLOCK_NAMES[b.name] = parseInt(id);
  BLOCK_NAMES[b.namePt.toLowerCase()] = parseInt(id);
}

export function packState(id, meta = 0) { return packS(id, meta); }