// Blocos do 1.8.9 que faltavam no registro e as variações (meta) dos que já existiam. Chamado no fim de blocks.js: registerMoreBlocks(...).
// Dureza e ferramenta vêm do catálogo real (blockCatalog.js, gerado dos dados do 1.8.9); aqui ficam o visual (ladrilhos e modelo) e o comportamento.
// Modelos novos: 'multi' (várias caixas: parede, vidraça, bigorna, caldeirão...), 'rail' (trilho no chão) e os de parede (alavanca, botão).
import { CATALOG } from './blockCatalog';
import { DYES, SKULL_TYPES } from './tilesMore';

const DF = [[-1, 0], [0, -1], [1, 0], [0, 1]];   // direções 0 oeste, 1 norte, 2 leste, 3 sul (a mesma ordem de DOOR_FACES)

// caixa encostada na parede do lado i (a parede fica na direção DF[i]): espessura t, faixa lateral [a0, a1] e vertical [y0, y1]
export function onWall(i, t, a0, a1, y0, y1) {
  const [dx, dz] = DF[i];
  if (dx !== 0) return [dx < 0 ? 0 : 1 - t, y0, a0, dx < 0 ? t : 1, y1, a1];
  return [a0, y0, dz < 0 ? 0 : 1 - t, a1, y1, dz < 0 ? t : 1];
}
// meta de tocha/alavanca/botão: 0 no chão, 1 parede em -X, 2 parede em +X, 3 parede em -Z, 4 parede em +Z, 5 teto (alavanca/botão) — como no 1.8.9
export const WALL_META_DIR = [-1, 0, 2, 1, 3];   // meta → índice em DF da parede onde está preso
export const SKULL_BLOCKS = [144, 198, 199, 200, 201];   // item 397: meta = tipo
export const DIR_WALL_META = [1, 3, 2, 4];       // índice em DF → meta
// Vaso de flor (1.8.9): a meta diz o que está plantado. tile = desenho da planta; item = o que volta quando se tira ou quebra o vaso
export const POT_CONTENTS = [null,
  { tile: 'flower_rose', item: { id: 38, meta: 0 } }, { tile: 'flower_dandelion', item: { id: 37, meta: 0 } },
  { tile: 'sapling_oak', item: { id: 6, meta: 0 } }, { tile: 'sapling_spruce', item: { id: 6, meta: 1 } }, { tile: 'sapling_birch', item: { id: 6, meta: 2 } }, { tile: 'sapling_jungle', item: { id: 6, meta: 3 } },
  { tile: 'mushroom_red', item: { id: 40, meta: 0 } }, { tile: 'mushroom_brown', item: { id: 39, meta: 0 } }, { tile: 'cactus_side', item: { id: 81, meta: 0 }, box: true },
  { tile: 'dead_bush', item: { id: 32, meta: 0 } }, { tile: 'fern', item: { id: 31, meta: 2 } }, { tile: 'sapling_acacia', item: { id: 6, meta: 4 } }, { tile: 'sapling_roofed_oak', item: { id: 6, meta: 5 } }];
// item na mão → meta do vaso
export function potMetaFor(id, meta) { return POT_CONTENTS.findIndex((c, i) => c && c.item.id === id && c.item.meta === (id === 6 || id === 31 ? meta : 0) && i > 0); }

export function registerMoreBlocks({ BLOCKS, B, shaped }) {
  const cat = (id) => CATALOG[id] || {};
  // definição com dureza e colheita do catálogo
  const def = (id, name, namePt, props, mk = B) => {
    const c = cat(id);
    const p = { hardness: c.h ?? 1, ...props };
    if (c.t && !p.harvest) p.harvest = { tool: c.t, level: c.l };
    if (c.e && p.lightEmission === undefined) p.lightEmission = c.e;
    BLOCKS[id] = mk(id, name, namePt, p);
    return BLOCKS[id];
  };
  const multi = (id, name, namePt, boxes, props = {}) => def(id, name, namePt, { model: 'multi', multi: boxes, solid: true, opaque: false, lightOpacity: 0, render: 'cutout', ...props }, shaped);
  const all = (t) => ({ all: t });
  const variantsOf = (list) => list.map((f) => (typeof f === 'string' ? all(f) : f));

  // ===== correções e variações dos blocos que já existiam =====
  const patch = (id, props) => { if (BLOCKS[id]) Object.assign(BLOCKS[id], props); };
  patch(26, { hiddenInCreative: true });   // a cama sai pelo item (355); o bloco sozinho é só metade dela
  patch(1, { variantMask: 7, variants: variantsOf(['stone', 'stone_granite', 'stone_granite_smooth', 'stone_diorite', 'stone_diorite_smooth', 'stone_andesite', 'stone_andesite_smooth']), variantNames: ['Pedra', 'Granito', 'Granito Polido', 'Diorito', 'Diorito Polido', 'Andesito', 'Andesito Polido'] });
  patch(3, { variantMask: 3, dropMeta: true, variants: [all('dirt'), all('coarse_dirt'), { top: 'dirt_podzol_top', bottom: 'dirt', side: 'dirt_podzol_side' }], variantNames: ['Terra', 'Terra Grossa', 'Podzol'] });
  patch(12, { variantMask: 1, dropMeta: true, variants: [all('sand'), all('red_sand')], variantNames: ['Areia', 'Areia Vermelha'] });
  patch(5, { variantMask: 7, dropMeta: true, variants: variantsOf(['planks', 'planks_spruce', 'planks_birch', 'planks_jungle', 'planks_acacia', 'planks_dark_oak']), variantNames: ['Tábuas de Carvalho', 'Tábuas de Pinheiro', 'Tábuas de Bétula', 'Tábuas da Selva', 'Tábuas de Acácia', 'Tábuas de Carvalho Escuro'] });
  patch(6, { variantMask: 7, dropMeta: true, variants: variantsOf(['sapling_oak', 'sapling_spruce', 'sapling_birch', 'sapling_jungle', 'sapling_acacia', 'sapling_roofed_oak']), variantNames: ['Muda de Carvalho', 'Muda de Pinheiro', 'Muda de Bétula', 'Muda da Selva', 'Muda de Acácia', 'Muda de Carvalho Escuro'] });
  patch(19, { variantMask: 1, dropMeta: true, variants: [all('sponge'), all('sponge_wet')], variantNames: ['Esponja', 'Esponja Molhada'] });
  patch(24, { variantMask: 3, dropMeta: true, variants: ['sandstone_side', 'sandstone_carved', 'sandstone_smooth'].map((s) => ({ top: 'sandstone_top', bottom: 'sandstone_bottom', side: s })), variantNames: ['Arenito', 'Arenito Entalhado', 'Arenito Liso'] });
  patch(31, { variantMask: 3, variants: [all('grass_plant'), all('grass_plant'), all('fern')], variantNames: ['Grama Alta', 'Grama Alta', 'Samambaia'] });
  patch(98, { variantMask: 3, dropMeta: true, variants: variantsOf(['stone_bricks', 'stonebrick_mossy', 'stonebrick_cracked', 'stonebrick_carved']), variantNames: ['Tijolos de Pedra', 'Tijolos de Pedra Musgosos', 'Tijolos de Pedra Rachados', 'Tijolos de Pedra Entalhados'] });
  const quartz = [{ top: 'quartz_top', bottom: 'quartz_bottom', side: 'quartz' }, { top: 'quartz_block_chiseled_top', bottom: 'quartz_block_chiseled_top', side: 'quartz_block_chiseled' },
    { top: 'quartz_block_lines_top', bottom: 'quartz_block_lines_top', side: 'quartz_block_lines' }];
  patch(155, { variantMask: 7, dropMeta: true, variants: [quartz[0], quartz[1], quartz[2], quartz[2], quartz[2]], variantNames: ['Bloco de Quartzo', 'Quartzo Entalhado', 'Pilar de Quartzo', 'Pilar de Quartzo', 'Pilar de Quartzo'] });
  patch(168, { variantMask: 3, dropMeta: true, variants: variantsOf(['prismarine', 'prismarine_bricks', 'prismarine_dark']), variantNames: ['Prismarinho', 'Tijolos de Prismarinho', 'Prismarinho Escuro'] });
  patch(38, { variantMask: 15, variants: variantsOf(['flower_rose', 'flower_blue_orchid', 'flower_allium', 'flower_houstonia', 'flower_tulip_red', 'flower_tulip_orange', 'flower_tulip_white', 'flower_tulip_pink', 'flower_oxeye_daisy']),
    variantNames: ['Papoula', 'Orquídea Azul', 'Allium', 'Houstonia', 'Tulipa Vermelha', 'Tulipa Laranja', 'Tulipa Branca', 'Tulipa Rosa', 'Margarida'], dropMeta: true });
  // cores de verdade (16 texturas por cor) no lugar da tinta aproximada
  const dyeNames = ['Branca', 'Laranja', 'Magenta', 'Azul Clara', 'Amarela', 'Verde-Limão', 'Rosa', 'Cinza', 'Cinza Clara', 'Ciano', 'Roxa', 'Azul', 'Marrom', 'Verde', 'Vermelha', 'Preta'];
  const dyeNamesM = dyeNames.map((n) => n.replace(/a$/, 'o'));   // masculino: "Argila Branca" / "Vidro Branco"
  const byDye = (prefix) => DYES.map((c) => all(prefix + c));
  patch(35, { variantMask: 15, dropMeta: true, metaColors: false, variants: byDye('wool_colored_'), variantNames: dyeNames.map((n) => 'Lã ' + n) });
  patch(95, { variantMask: 15, dropMeta: true, metaColors: false, variants: byDye('glass_'), variantNames: dyeNamesM.map((n) => 'Vidro ' + n), drop: null });
  patch(159, { variantMask: 15, dropMeta: true, metaColors: false, variants: byDye('hardened_clay_stained_'), variantNames: dyeNames.map((n) => 'Argila ' + n) });
  patch(171, { variantMask: 15, dropMeta: true, metaColors: false, variants: byDye('wool_colored_'), variantNames: dyeNames.map((n) => 'Tapete ' + n) });
  // blocos de cogumelo: o cubo inteiro com a textura da pele (cada face decide entre pele e poros pelo meta; ver tileForFace)
  patch(99, { faces: { all: 'mushroom_block_skin_brown' }, hugeMushroom: 'mushroom_block_skin_brown', hardness: 0.2 });
  patch(100, { faces: { all: 'mushroom_block_skin_red' }, hugeMushroom: 'mushroom_block_skin_red', hardness: 0.2 });
  patch(174, { faces: all('ice_packed'), render: 'opaque', opaque: true, lightOpacity: 15 });
  // 176 é o arenito vermelho que o jogo tinha antes (o de verdade é o 179): continua existindo para os mundos antigos, mas sai do criativo
  patch(176, { faces: { top: 'red_sandstone_top', bottom: 'red_sandstone_bottom', side: 'red_sandstone_normal' }, hiddenInCreative: true });
  patch(22, { harvest: { tool: 'pickaxe', level: 1 } });
  patch(152, { harvest: { tool: 'pickaxe', level: 0 } });
  patch(70, { harvest: { tool: 'pickaxe', level: 0 } });
  patch(154, { harvest: { tool: 'pickaxe', level: 0 } });

  // planta alta (rosa, peônia, girassol, lilás, grama e samambaia altas): dois blocos; a de baixo guarda o tipo (bits 0-2), a de cima tem o bit 8
  const DP = ['sunflower', 'syringa', 'grass', 'fern', 'rose', 'paeonia'];
  def(175, 'double_plant', 'Planta Alta', { model: 'doubleplant', hardness: 0, solid: false, opaque: false, lightOpacity: 0, render: 'cutout', replaceable: true, soundCategory: 'grass', dropMeta: true, variantMask: 7,
    variants: DP.map((n) => all(`double_plant_${n}_bottom`)), variantNames: ['Girassol', 'Lilás', 'Grama Alta Dupla', 'Samambaia Alta', 'Roseira', 'Peônia'], faces: all('double_plant_sunflower_bottom'), doublePlant: DP });

  // ===== cubos =====
  const furnaceSide = { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side' };
  def(23, 'dispenser', 'Ejetor', { faces: { ...furnaceSide, front: 'dispenser_front_horizontal' }, orient: true, drop: 23 });
  def(158, 'dropper', 'Largador', { faces: { ...furnaceSide, front: 'dropper_front_horizontal' }, orient: true, drop: 158 });
  def(25, 'noteblock', 'Bloco de Notas', { faces: all('noteblock'), soundCategory: 'wood' });
  def(84, 'jukebox', 'Jukebox', { faces: { top: 'jukebox_top', bottom: 'jukebox_side', side: 'jukebox_side' }, soundCategory: 'wood' });
  def(62, 'lit_furnace', 'Fornalha', { faces: { ...furnaceSide, front: 'furnace_front_on' }, orient: true, drop: 61, lightEmission: 13, hiddenInCreative: true });
  def(74, 'lit_redstone_ore', 'Minério de Redstone', { faces: all('redstone_ore'), lightEmission: 9, dropLike: 73, drop: 73, hiddenInCreative: true });
  def(91, 'lit_pumpkin', 'Lanterna de Abóbora', { faces: { top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face_on' }, orient: true, lightEmission: 15, soundCategory: 'wood' });
  def(97, 'monster_egg', 'Bloco Infestado', { variantMask: 7, variants: variantsOf(['stone', 'cobblestone', 'stone_bricks', 'stonebrick_mossy', 'stonebrick_cracked', 'stonebrick_carved']),
    variantNames: ['Pedra Infestada', 'Pedregulho Infestado', 'Tijolos de Pedra Infestados', 'Tijolos Musgosos Infestados', 'Tijolos Rachados Infestados', 'Tijolos Entalhados Infestados'], drop: null, faces: all('stone') });
  def(52, 'mob_spawner', 'Gerador de Monstros', { faces: all('mob_spawner'), render: 'cutout', opaque: false, lightOpacity: 3, drop: null });
  def(138, 'beacon', 'Sinalizador', { faces: all('beacon'), render: 'cutout', opaque: false, lightOpacity: 0, lightEmission: 15 });
  def(137, 'command_block', 'Bloco de Comando', { faces: all('command_block'), hardness: -1, drop: null });
  def(172, 'hardened_clay', 'Argila Endurecida', { faces: all('hardened_clay') });
  const redSand = (side) => ({ top: 'red_sandstone_top', bottom: 'red_sandstone_bottom', side });
  def(179, 'red_sandstone_block', 'Arenito Vermelho', { variantMask: 3, dropMeta: true, variants: [redSand('red_sandstone_normal'), redSand('red_sandstone_carved'), redSand('red_sandstone_smooth')], variantNames: ['Arenito Vermelho', 'Arenito Vermelho Entalhado', 'Arenito Vermelho Liso'], faces: redSand('red_sandstone_normal') });
  def(166, 'barrier', 'Barreira', { model: 'none', solid: true, opaque: false, lightOpacity: 0, hardness: -1, drop: null, render: 'cutout' });
  // pistão: cubo com a face de frente; a posição estendida (meta & 8) é só o corpo com o encaixe vazio
  const pistonFaces = (top) => ({ top, bottom: 'piston_bottom', side: 'piston_side', front: top });
  def(33, 'piston', 'Pistão', { faces: pistonFaces('piston_top_normal'), orient: true });
  def(29, 'sticky_piston', 'Pistão Pegajoso', { faces: pistonFaces('piston_top_sticky'), orient: true });
  multi(34, 'piston_head', 'Cabeça do Pistão', (m) => [[0, 0, 0, 1, 0.25, 1], [0.375, 0.25, 0.375, 0.625, 1, 0.625]], { faces: { top: 'piston_top_normal', bottom: 'piston_bottom', side: 'piston_side' }, hiddenInCreative: true, drop: null, render: 'opaque' });
  def(36, 'piston_extension', 'Pistão em Movimento', { model: 'none', solid: false, opaque: false, lightOpacity: 0, hardness: -1, drop: null, hiddenInCreative: true });

  // ===== caixas únicas =====
  multi(120, 'end_portal_frame', 'Moldura do Portal do End', (m) => {
    const b = [[0, 0, 0, 1, 0.8125, 1, { top: 'endframe_top', bottom: 'end_stone', side: 'endframe_side' }]];
    if (m & 4) b.push([0.25, 0.8125, 0.25, 0.75, 1, 0.75, 'endframe_eye']);
    return b;
  }, { faces: { top: 'endframe_top', bottom: 'end_stone', side: 'endframe_side' }, hardness: -1, drop: null, lightEmission: 1, render: 'opaque' });
  // ovo do dragão: oito camadas empilhadas (as do modelo do pacote); cada camada mostra a janela da textura que cobre as suas coordenadas
  const EGG = [[6, 15, 10, 16], [5, 14, 11, 15], [5, 13, 11, 14], [3, 11, 13, 13], [2, 8, 14, 11], [1, 3, 15, 8], [2, 1, 14, 3], [3, 0, 13, 1]];   // x0, y0, x1, y1 (z igual a x)
  multi(122, 'dragon_egg', 'Ovo do Dragão', () => EGG.map(([a, y0, b, y1]) => [a / 16, y0 / 16, a / 16, b / 16, y1 / 16, b / 16, 'dragon_egg', (16 - y1 - y0) / 16]).reverse(), { faces: all('dragon_egg'), lightEmission: 1, render: 'opaque' });
  multi(116, 'enchanting_table', 'Mesa de Encantamento', () => [[0, 0, 0, 1, 0.75, 1]], { faces: { top: 'enchanting_table_top', bottom: 'enchanting_table_bottom', side: 'enchanting_table_side' }, render: 'opaque' });
  // vaso de flor: fundo, quatro paredes de 1/16 e a terra por dentro (antes era uma caixa só: por dentro dava para ver através)
  multi(140, 'flower_pot', 'Vaso de Flor', () => [
    [0.3125, 0, 0.3125, 0.6875, 0.0625, 0.6875, 'flower_pot'],
    [0.3125, 0, 0.3125, 0.6875, 0.375, 0.375, 'flower_pot'], [0.3125, 0, 0.625, 0.6875, 0.375, 0.6875, 'flower_pot'],
    [0.3125, 0, 0.375, 0.375, 0.375, 0.625, 'flower_pot'], [0.625, 0, 0.375, 0.6875, 0.375, 0.625, 'flower_pot'],
    [0.375, 0.0625, 0.375, 0.625, 0.25, 0.625, 'dirt'],
  ], { faces: all('flower_pot'), drop: 390, potPlants: POT_CONTENTS, hiddenInCreative: true });
  // cabeças (no 1.8.9 o tipo mora na entidade do bloco; aqui cada tipo é um bloco, e a meta guarda para onde o rosto olha)
  const SKULL_NAMES = ['Cabeça de Esqueleto', 'Cabeça de Esqueleto Wither', 'Cabeça de Zumbi', 'Cabeça de Steve', 'Cabeça de Creeper'];
  [144, 198, 199, 200, 201].forEach((id, t) => def(id, 'skull_' + SKULL_TYPES[t], SKULL_NAMES[t], { model: 'skull', skullType: SKULL_TYPES[t], solid: true, opaque: false, lightOpacity: 0, render: 'opaque', hardness: 1, drop: 397, faces: { all: `skull_${SKULL_TYPES[t]}_front` }, hiddenInCreative: true, soundCategory: 'stone' }, shaped));
  multi(92, 'cake', 'Bolo', (m) => [[0.0625 + (m & 7) * 0.125, 0, 0.0625, 0.9375, 0.5, 0.9375]], { faces: { top: 'cake_top', bottom: 'cake_bottom', side: 'cake_side' }, drop: null, hiddenInCreative: true, render: 'opaque' });
  multi(127, 'cocoa', 'Cacau', (m) => { const s = (m >> 2) & 3; const w = 0.1875 + s * 0.0625; return [[0.5 - w, 0.25 - s * 0.03, 0.5 - w, 0.5 + w, 0.75, 0.5 + w]]; },
    { faces: all('cocoa_stage_2'), variantMask: 0, drop: 351, hiddenInCreative: true });
  def(147, 'light_weighted_pressure_plate', 'Placa de Pressão (Ouro)', { faces: all('gold_block'), model: 'carpet', solid: false, lightOpacity: 0, render: 'opaque', replaceable: true, soundCategory: 'metal' });
  def(148, 'heavy_weighted_pressure_plate', 'Placa de Pressão (Ferro)', { faces: all('iron_block'), model: 'carpet', solid: false, lightOpacity: 0, render: 'opaque', replaceable: true, soundCategory: 'metal' });
  def(178, 'daylight_sensor_inverted', 'Sensor de Luz Invertido', { faces: { top: 'daylight_detector_inverted_top', bottom: 'stone_slab_top', side: 'daylight_detector_side' }, model: 'box', box: [0, 0, 0, 1, 0.375, 1], solid: false, opaque: false, lightOpacity: 0, render: 'cutout', replaceable: true, hardness: 0.2, harvest: undefined, drop: 151, hiddenInCreative: true });
  def(119, 'end_portal', 'Portal do End', { model: 'box', box: [0, 0, 0, 1, 0.75, 1], faces: all('obsidian'), solid: false, opaque: false, lightOpacity: 0, hardness: -1, drop: null, render: 'opaque', lightEmission: 1, hiddenInCreative: true });

  // ===== chaves de madeira (cada madeira com a sua textura) =====
  const WOODS = [['spruce', 'Pinheiro', 'planks_spruce'], ['birch', 'Bétula', 'planks_birch'], ['jungle', 'Selva', 'planks_jungle'], ['acacia', 'Acácia', 'planks_acacia'], ['dark_oak', 'Carvalho Escuro', 'planks_dark_oak']];
  WOODS.forEach(([n, pt, plank], i) => {
    def(188 + i, n + '_fence', 'Cerca de ' + pt, { model: 'fence', faces: all(plank), solid: true, opaque: false, lightOpacity: 0, render: 'opaque', soundCategory: 'wood' }, shaped);
    def(183 + i, n + '_fence_gate', 'Portão de ' + pt, { model: 'gate', faces: all(plank), solid: true, opaque: false, lightOpacity: 0, render: 'opaque', soundCategory: 'wood' }, shaped);
    const dn = n === 'dark_oak' ? 'dark_oak' : n;
    def(193 + i, n + '_door', 'Porta de ' + pt, { model: 'door', faces: all(`door_${dn}_lower`), doorTiles: [`door_${dn}_lower`, `door_${dn}_upper`], drop: 427 + i, lightOpacity: 0, soundCategory: 'wood', hiddenInCreative: true, solid: true, opaque: false, render: 'opaque' }, shaped);
  });
  def(167, 'iron_trapdoor', 'Alçapão de Ferro', { model: 'trapdoor', faces: all('iron_trapdoor'), render: 'cutout', solid: true, opaque: false, lightOpacity: 0, soundCategory: 'metal' }, shaped);
  def(143, 'wooden_button', 'Botão de Madeira', { model: 'multi', multi: buttonBoxes, faces: all('planks'), solid: false, opaque: false, lightOpacity: 0, render: 'opaque', replaceable: true, soundCategory: 'wood' }, shaped);
  // botão e alavanca de pedra/madeira passam a ter forma de verdade (antes eram um graveto no meio do bloco)
  Object.assign(BLOCKS[77], { model: 'multi', multi: buttonBoxes, solid: false, opaque: false, lightOpacity: 0, render: 'opaque' });
  Object.assign(BLOCKS[69], { model: 'multi', multi: leverBoxes, solid: false, opaque: false, lightOpacity: 0, render: 'opaque' });

  // ===== vidraças e grades =====
  const paneConnects = (id) => { const b = BLOCKS[id]; return !!b && (b.pane || (b.solid && b.opaque && (b.model || 'cube') === 'cube')); };
  const paneBoxes = (post, arm, h) => (m, getState, x, y, z, kind) => {
    const conn = DF.map(([dx, dz]) => !!getState && paneConnects((getState(x + dx, y, z + dz) >> 4) & 0xfff));
    const none = !conn.some(Boolean);
    const hh = kind === 'collide' ? h : 1;
    const out = [[0.5 - post, 0, 0.5 - post, 0.5 + post, hh, 0.5 + post]];
    const a = 0.5 - arm, b = 0.5 + arm;
    if (conn[0] || none) out.push([0, 0, a, 0.5 - post, hh, b]);
    if (conn[1] || none) out.push([a, 0, 0, b, hh, 0.5 - post]);
    if (conn[2] || none) out.push([0.5 + post, 0, a, 1, hh, b]);
    if (conn[3] || none) out.push([a, 0, 0.5 + post, b, hh, 1]);
    return out;
  };
  const pane = (id, name, namePt, props) => multi(id, name, namePt, paneBoxes(0.0625, 0.0625, 1), { pane: true, lightOpacity: 0, ...props });
  pane(102, 'glass_pane', 'Vidraça', { faces: { top: 'glass_pane_top', bottom: 'glass_pane_top', side: 'glass' }, drop: null, soundCategory: 'glass' });
  pane(101, 'iron_bars', 'Grade de Ferro', { faces: { top: 'iron_bars', bottom: 'iron_bars', side: 'iron_bars' }, soundCategory: 'metal' });
  pane(160, 'stained_glass_pane', 'Vidraça Tingida', {
    variantMask: 15, dropMeta: true, drop: null, soundCategory: 'glass',
    variants: DYES.map((c) => ({ top: 'glass_pane_top_' + c, bottom: 'glass_pane_top_' + c, side: 'glass_' + c })), variantNames: dyeNames.map((n) => 'Vidraça ' + n), faces: { top: 'glass_pane_top', side: 'glass' },
  });
  BLOCKS[160].render = 'translucent';
  // ===== muro de pedregulho =====
  const wallBoxes = (m, getState, x, y, z, kind) => {
    const conn = DF.map(([dx, dz]) => { if (!getState) return false; const id = (getState(x + dx, y, z + dz) >> 4) & 0xfff; const b = BLOCKS[id]; return !!b && (b.wallLike || (b.solid && b.opaque && (b.model || 'cube') === 'cube') || b.model === 'gate'); });
    const h = kind === 'collide' ? 1.5 : 1, ah = kind === 'collide' ? 1.5 : 0.8125;
    const out = [[0.25, 0, 0.25, 0.75, h, 0.75]];
    if (conn[0]) out.push([0, 0, 0.3125, 0.25, ah, 0.6875]);
    if (conn[1]) out.push([0.3125, 0, 0, 0.6875, ah, 0.25]);
    if (conn[2]) out.push([0.75, 0, 0.3125, 1, ah, 0.6875]);
    if (conn[3]) out.push([0.3125, 0, 0.75, 0.6875, ah, 1]);
    return out;
  };
  multi(139, 'cobblestone_wall', 'Muro de Pedregulho', wallBoxes, { wallLike: true, render: 'opaque', variantMask: 1, dropMeta: true, variants: [all('cobblestone'), all('mossy_cobble')], variantNames: ['Muro de Pedregulho', 'Muro de Pedregulho Musgoso'], faces: all('cobblestone') });

  // ===== bigorna, caldeirão, suporte de poções =====
  multi(145, 'anvil', 'Bigorna', (m) => {
    const alongZ = (m & 1) === 0;
    const r = (b) => (alongZ ? b : [b[2], b[1], b[0], b[5], b[4], b[3]]);
    const top = 'anvil_top_damaged_' + Math.min(2, (m >> 2) & 3);
    return [
      [...r([0.125, 0, 0.125, 0.875, 0.25, 0.875]), 'anvil_base'],
      [...r([0.25, 0.25, 0.1875, 0.75, 0.3125, 0.8125]), 'anvil_base'],
      [...r([0.375, 0.3125, 0.25, 0.625, 0.625, 0.75]), 'anvil_base'],
      [...r([0.1875, 0.625, 0, 0.8125, 1, 1]), { top, bottom: 'anvil_base', side: 'anvil_base' }],
    ];
  }, { faces: { top: 'anvil_top_damaged_0', bottom: 'anvil_base', side: 'anvil_base' }, render: 'opaque', soundCategory: 'anvil', hardness: 5 });
  multi(118, 'cauldron', 'Caldeirão', (m) => {
    const w = 0.125, side = { top: 'cauldron_top', bottom: 'cauldron_bottom', side: 'cauldron_side' };
    const b = [
      [0, 0.1875, 0, 1, 0.3125, 1, { top: 'cauldron_inner', bottom: 'cauldron_bottom', side: 'cauldron_side' }],
      [0, 0.3125, 0, 1, 1, w, side], [0, 0.3125, 1 - w, 1, 1, 1, side], [0, 0.3125, w, w, 1, 1 - w, side], [1 - w, 0.3125, w, 1, 1, 1 - w, side],
      [0, 0, 0, 0.25, 0.1875, 0.25, 'cauldron_side'], [0.75, 0, 0, 1, 0.1875, 0.25, 'cauldron_side'], [0, 0, 0.75, 0.25, 0.1875, 1, 'cauldron_side'], [0.75, 0, 0.75, 1, 0.1875, 1, 'cauldron_side'],
    ];
    if ((m & 3) > 0) b.push([w, 0.3125, w, 1 - w, 0.3125 + (m & 3) * 0.1875, 1 - w, 'water']);
    return b;
  }, { faces: { top: 'cauldron_top', bottom: 'cauldron_bottom', side: 'cauldron_side' }, drop: 380, hiddenInCreative: true, render: 'opaque' });
  multi(117, 'brewing_stand', 'Suporte de Poções', () => [
    [0.4375, 0.125, 0.4375, 0.5625, 0.875, 0.5625, 'brewing_stand'],
    [0.0625, 0, 0.0625, 0.375, 0.125, 0.375, 'brewing_stand_base'], [0.0625, 0, 0.625, 0.375, 0.125, 0.9375, 'brewing_stand_base'], [0.625, 0, 0.3125, 0.9375, 0.125, 0.6875, 'brewing_stand_base'],
  ], { faces: all('brewing_stand'), drop: 379, hiddenInCreative: true });

  // funil: tigela larga em cima, tronco e bico (os dados do catálogo trazem dureza e ferramenta)
  multi(154, 'hopper', 'Funil', () => [
    [0, 0.625, 0, 1, 0.6875, 1, { top: 'hopper_top', bottom: 'hopper_outside', side: 'hopper_outside' }],
    [0, 0.6875, 0, 0.125, 1, 1, 'hopper_outside'], [0.875, 0.6875, 0, 1, 1, 1, 'hopper_outside'], [0.125, 0.6875, 0, 0.875, 1, 0.125, 'hopper_outside'], [0.125, 0.6875, 0.875, 0.875, 1, 1, 'hopper_outside'],
    [0.25, 0.25, 0.25, 0.75, 0.625, 0.75, 'hopper_outside'], [0.375, 0, 0.375, 0.625, 0.25, 0.625, 'hopper_outside'],
  ], { faces: { top: 'hopper_top', bottom: 'hopper_outside', side: 'hopper_outside' }, render: 'opaque', soundCategory: 'metal' });

  // ===== placas e sinais =====
  multi(63, 'standing_sign', 'Placa', (m) => {
    const alongX = ((m >> 2) & 1) === 1;
    return [[0.4375, 0, 0.4375, 0.5625, 0.5, 0.5625, 'log_side'], alongX ? [0.0625, 0.5, 0.4375, 0.9375, 1, 0.5625, 'planks'] : [0.4375, 0.5, 0.0625, 0.5625, 1, 0.9375, 'planks']];
  }, { faces: all('planks'), drop: 323, hiddenInCreative: true, soundCategory: 'wood', replaceable: false, solid: false });
  multi(68, 'wall_sign', 'Placa', (m) => [onWall(WALL_META_DIR[Math.max(1, m & 7)] ?? 1, 0.125, 0.0625, 0.9375, 0.28125, 0.78125)], { faces: all('planks'), drop: 323, hiddenInCreative: true, soundCategory: 'wood', solid: false });
  // ===== fios =====
  multi(131, 'tripwire_hook', 'Gancho do Fio', (m) => [onWall(WALL_META_DIR[Math.min(4, Math.max(1, m & 7))], 0.1875, 0.4375, 0.5625, 0.25, 0.75)], { faces: all('trip_wire_source'), solid: false, lightOpacity: 0, drop: 131 });
  multi(132, 'tripwire', 'Fio', (m) => [(m & 1) ? [0.4375, 0.0625, 0, 0.5625, 0.125, 1] : [0, 0.0625, 0.4375, 1, 0.125, 0.5625]], { faces: all('trip_wire'), solid: false, drop: 287, hiddenInCreative: true, replaceable: true });

  // ===== trilhos =====
  const rail = (id, name, namePt, tiles, powered) => def(id, name, namePt, { model: 'rail', rail: { tiles, powered }, faces: all(tiles[0]), solid: false, opaque: false, lightOpacity: 0, render: 'cutout', replaceable: true, soundCategory: 'metal' });
  rail(66, 'rail', 'Trilho', ['rail_normal', 'rail_normal_turned'], false);
  rail(27, 'golden_rail', 'Trilho Elétrico', ['rail_golden', 'rail_golden_powered'], true);
  rail(28, 'detector_rail', 'Trilho Detector', ['rail_detector', 'rail_detector_powered'], true);
  rail(157, 'activator_rail', 'Trilho Ativador', ['rail_activator', 'rail_activator_powered'], true);

  // ===== baús especiais (mesmo modelo do baú; texturas compostas do arquivo da entidade) =====
  def(130, 'ender_chest', 'Baú do Ender', { model: 'chest', chestTiles: ['ender_chest_top', 'ender_chest_side', 'ender_chest_front'], faces: { top: 'ender_chest_top', side: 'ender_chest_side', front: 'ender_chest_front' }, solid: true, opaque: false, lightOpacity: 0, render: 'opaque', soundCategory: 'stone', lightEmission: 7 }, shaped);
  def(146, 'trapped_chest', 'Baú Armadilhado', { model: 'chest', chestTiles: ['trapped_chest_top', 'trapped_chest_side', 'trapped_chest_front'], faces: { top: 'trapped_chest_top', side: 'trapped_chest_side', front: 'trapped_chest_front' }, solid: true, opaque: false, lightOpacity: 0, render: 'opaque', soundCategory: 'wood' }, shaped);
}

// botão: placa de 6×4×2 px na parede (apertado: 1 px); no chão fica deitado (meta 0); no teto (meta 5), de cabeça para baixo
function buttonBoxes(m) {
  const pressed = (m & 8) !== 0, t = pressed ? 0.0625 : 0.125, d = m & 7;
  if (d === 0) return [[0.3125, 0, 0.375, 0.6875, t, 0.625]];
  if (d === 5) return [[0.3125, 1 - t, 0.375, 0.6875, 1, 0.625]];
  return [onWall(WALL_META_DIR[d] ?? 0, t, 0.3125, 0.6875, 0.375, 0.625)];
}
// alavanca: base de pedra + haste; ligada (meta & 8) a haste aponta para cima, desligada para baixo
function leverBoxes(m) {
  const on = (m & 8) !== 0, d = m & 7;
  const stone = 'cobblestone';
  if (d === 0) return [[0.3125, 0, 0.25, 0.6875, 0.125, 0.75, stone], [0.4375, 0.125, 0.4375, 0.5625, 0.6875, 0.5625, 'lever']];
  if (d === 5) return [[0.3125, 0.875, 0.25, 0.6875, 1, 0.75, stone], [0.4375, 0.3125, 0.4375, 0.5625, 0.875, 0.5625, 'lever']];
  const i = WALL_META_DIR[d] ?? 0;
  const base = onWall(i, 0.1875, 0.3125, 0.6875, 0.25, 0.75);
  const [dx, dz] = DF[i];
  // haste: sai da base para fora da parede e sobe (ligada) ou desce (desligada)
  const y0 = on ? 0.5 : 0.2, y1 = on ? 0.8 : 0.5;
  const stick = dx !== 0 ? [dx < 0 ? 0.1875 : 0.5, y0, 0.4375, dx < 0 ? 0.5 : 0.8125, y1, 0.5625] : [0.4375, y0, dz < 0 ? 0.1875 : 0.5, 0.5625, y1, dz < 0 ? 0.5 : 0.8125];
  return [[...base, stone], [...stick, 'lever']];
}
