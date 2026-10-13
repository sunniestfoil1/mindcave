// Registro de itens da 1.8.9 — PRD 06 RF-001..003
// Blocos usam seus próprios IDs (0-175); itens usam IDs 256+

export const TOOL_MATERIALS = {
  wood:    { name: 'Madeira',  speed: 2,  harvest: 0, durability: 59 },
  stone:   { name: 'Pedra',    speed: 4,  harvest: 1, durability: 131 },
  iron:    { name: 'Ferro',    speed: 6,  harvest: 2, durability: 250 },
  diamond: { name: 'Diamante', speed: 8,  harvest: 3, durability: 1561 },
  gold:    { name: 'Ouro',     speed: 12, harvest: 0, durability: 32 },
};

export const ARMOR_MATERIALS = {
  leather:  { name: 'Couro',    points: [1,3,2,1], durability: [55,80,75,65] },
  gold:     { name: 'Ouro',     points: [2,5,3,1], durability: [77,112,105,91] },
  chain:    { name: 'Malha',    points: [2,5,4,1], durability: [165,240,225,195] },
  iron:     { name: 'Ferro',    points: [2,6,5,2], durability: [165,240,225,195] },
  diamond:  { name: 'Diamante', points: [3,8,6,3], durability: [363,528,495,429] },
};

const MAT_COLORS = { wood: 0x8b5a2b, stone: 0x808080, iron: 0xd8d8d8, diamond: 0x4eeee4, gold: 0xfcee4d };
const ARM_COLORS = { leather: 0x8b5a2b, gold: 0xfcee4d, chain: 0x444444, iron: 0xd8d8d8, diamond: 0x4eeee4 };

function I(id, name, namePt, props) {
  return { id, name, namePt, maxStack: 64, category: 'misc', ...props };
}

function tool(id, name, namePt, type, material) {
  const m = TOOL_MATERIALS[material];
  const dmg = { sword: [5,5,6,7,8], axe: [4,4,5,6,7], pickaxe: [3,3,4,5,6], shovel: [2,2,3,4,5], hoe: [1,1,1,1,1] };
  const matIdx = ['wood','gold','stone','iron','diamond'].indexOf(material);
  return I(id, name, namePt, {
    maxStack: 1, durability: m.durability, category: 'tools',
    tool: { type, material }, weaponDamage: dmg[type][matIdx],
    color: MAT_COLORS[material],
  });
}

function armor(id, name, namePt, slot, material) {
  const m = ARMOR_MATERIALS[material];
  return I(id, name, namePt, {
    maxStack: 1, durability: m.durability[slot], category: 'combat',
    armor: { slot, material }, color: ARM_COLORS[material],
  });
}

export const ITEMS = {
  // Materiais
  280: I(280, 'stick', 'Graveto', { color: 0x8b5a2b, category: 'materials', fuel: 100 }),
  263: I(263, 'coal', 'Carvão', { color: 0x1a1a1a, category: 'materials', fuel: 1600 }),
  264: I(264, 'diamond', 'Diamante', { color: 0x4eeee4, category: 'materials' }),
  265: I(265, 'iron_ingot', 'Lingote de Ferro', { color: 0xd8d8d8, category: 'materials' }),
  266: I(266, 'gold_ingot', 'Lingote de Ouro', { color: 0xfcee4d, category: 'materials' }),
  371: I(371, 'gold_nugget', 'Pepita de Ouro', { color: 0xfcee4d, category: 'materials' }),
  388: I(388, 'emerald', 'Esmeralda', { color: 0x17dd62, category: 'materials' }),
  287: I(287, 'string', 'Linha', { color: 0xf0f0f0, category: 'materials' }),
  288: I(288, 'feather', 'Pena', { color: 0xf0f0f0, category: 'materials' }),
  289: I(289, 'gunpowder', 'Pólvora', { color: 0x444444, category: 'materials' }),
  318: I(318, 'flint', 'Sílex', { color: 0x3a3a3a, category: 'materials' }),
  334: I(334, 'leather', 'Couro', { color: 0x8b5a2b, category: 'materials' }),
  335: I(335, 'brick', 'Tijolo', { color: 0x9b5b4b, category: 'materials' }),
  336: I(336, 'clay_ball', 'Bola de Argila', { color: 0xa0a0b0, category: 'materials' }),
  337: I(337, 'paper', 'Papel', { color: 0xf0f0e0, category: 'materials' }),
  339: I(339, 'book', 'Livro', { color: 0xc08040, category: 'materials' }),
  340: I(340, 'slime_ball', 'Bola de Slime', { color: 0x60c060, category: 'materials' }),
  331: I(331, 'redstone', 'Redstone', { color: 0xff2020, category: 'materials' }),
  348: I(348, 'glowstone_dust', 'Pó de Glowstone', { color: 0xffd060, category: 'materials' }),
  368: I(368, 'ender_pearl', 'Pérola do Ender', { color: 0x18e07a, maxStack: 16, category: 'materials' }),
  381: I(381, 'ender_eye', 'Olho do Ender', { color: 0x18e07a, category: 'materials' }),
  369: I(369, 'blaze_rod', 'Vara de Blaze', { color: 0xe0a020, category: 'materials', fuel: 2400 }),
  377: I(377, 'blaze_powder', 'Pó de Blaze', { color: 0xe0a020, category: 'materials' }),
  370: I(370, 'ghast_tear', 'Lágrima de Ghast', { color: 0xe0e0e0, category: 'materials' }),
  378: I(378, 'magma_cream', 'Creme de Magma', { color: 0xc06030, category: 'materials' }),
  375: I(375, 'spider_eye', 'Olho de Aranha', { color: 0x602080, food: true, category: 'materials' }),
  376: I(376, 'fermented_spider_eye', 'Olho Fermentado', { color: 0x8040a0, category: 'materials' }),
  382: I(382, 'speckled_melon', 'Melancia Reluzente', { color: 0xe0e040, category: 'materials' }),
  399: I(399, 'nether_star', 'Estrela do Nether', { color: 0xffffff, rarity: 'epic', category: 'materials' }),
  406: I(406, 'quartz', 'Quartzo', { color: 0xe8e8e8, category: 'materials' }),
  405: I(405, 'netherbrick', 'Tijolo do Nether', { color: 0x402020, category: 'materials' }),
  409: I(409, 'prismarine_shard', 'Fragmento de Prism.', { color: 0x60a080, category: 'materials' }),
  410: I(410, 'prismarine_crystals', 'Cristais de Prism.', { color: 0x60c0a0, category: 'materials' }),
  374: I(374, 'glass_bottle', 'Garrafa de Vidro', { color: 0xc0e0f0, category: 'misc' }),
  384: I(384, 'experience_bottle', 'Garrafa de XP', { color: 0x80ff40, rarity: 'rare', category: 'misc' }),
  372: I(372, 'nether_wart', 'Verruga do Nether', { color: 0xc02020, category: 'materials' }),
  296: I(296, 'wheat', 'Trigo', { color: 0xc0a040, category: 'materials' }),
  295: I(295, 'wheat_seeds', 'Sementes', { color: 0x80a040, category: 'materials' }),
  361: I(361, 'pumpkin_seeds', 'Sementes de Abóbora', { color: 0x80a040, category: 'materials' }),
  362: I(362, 'melon_seeds', 'Sementes de Melancia', { color: 0x608040, category: 'materials' }),
  353: I(353, 'sugar', 'Açúcar', { color: 0xf0f0f0, category: 'materials' }),
  411: I(411, 'rabbit_hide', 'Pele de Coelho', { color: 0xa08060, category: 'materials' }),
  412: I(412, 'rabbit_foot', 'Pé de Coelho', { color: 0xc0a080, category: 'materials' }),
  351: I(351, 'dye', 'Corante', { color: 0xc040c0, metaColors: true, category: 'materials' }),
  332: I(332, 'snowball', 'Bola de Neve', { maxStack: 16, color: 0xf0f0f0, category: 'misc' }),

  // Ferramentas
  270: tool(270, 'wooden_pickaxe', 'Picareta de Madeira', 'pickaxe', 'wood'),
  274: tool(274, 'stone_pickaxe', 'Picareta de Pedra', 'pickaxe', 'stone'),
  257: tool(257, 'iron_pickaxe', 'Picareta de Ferro', 'pickaxe', 'iron'),
  278: tool(278, 'diamond_pickaxe', 'Picareta de Diamante', 'pickaxe', 'diamond'),
  285: tool(285, 'golden_pickaxe', 'Picareta de Ouro', 'pickaxe', 'gold'),
  271: tool(271, 'wooden_axe', 'Machado de Madeira', 'axe', 'wood'),
  275: tool(275, 'stone_axe', 'Machado de Pedra', 'axe', 'stone'),
  258: tool(258, 'iron_axe', 'Machado de Ferro', 'axe', 'iron'),
  279: tool(279, 'diamond_axe', 'Machado de Diamante', 'axe', 'diamond'),
  286: tool(286, 'golden_axe', 'Machado de Ouro', 'axe', 'gold'),
  269: tool(269, 'wooden_shovel', 'Pá de Madeira', 'shovel', 'wood'),
  273: tool(273, 'stone_shovel', 'Pá de Pedra', 'shovel', 'stone'),
  256: tool(256, 'iron_shovel', 'Pá de Ferro', 'shovel', 'iron'),
  277: tool(277, 'diamond_shovel', 'Pá de Diamante', 'shovel', 'diamond'),
  284: tool(284, 'golden_shovel', 'Pá de Ouro', 'shovel', 'gold'),
  290: tool(290, 'wooden_hoe', 'Enxada de Madeira', 'hoe', 'wood'),
  291: tool(291, 'stone_hoe', 'Enxada de Pedra', 'hoe', 'stone'),
  292: tool(292, 'iron_hoe', 'Enxada de Ferro', 'hoe', 'iron'),
  293: tool(293, 'diamond_hoe', 'Enxada de Diamante', 'hoe', 'diamond'),
  294: tool(294, 'golden_hoe', 'Enxada de Ouro', 'hoe', 'gold'),

  // Espadas
  268: I(268, 'wooden_sword', 'Espada de Madeira', { maxStack:1, durability:59, weaponDamage:5, weapon:true, color:0x8b5a2b, category:'combat' }),
  272: I(272, 'stone_sword', 'Espada de Pedra', { maxStack:1, durability:131, weaponDamage:6, weapon:true, color:0x808080, category:'combat' }),
  267: I(267, 'iron_sword', 'Espada de Ferro', { maxStack:1, durability:250, weaponDamage:7, weapon:true, color:0xd8d8d8, category:'combat' }),
  276: I(276, 'diamond_sword', 'Espada de Diamante', { maxStack:1, durability:1561, weaponDamage:8, weapon:true, color:0x4eeee4, category:'combat' }),
  283: I(283, 'golden_sword', 'Espada de Ouro', { maxStack:1, durability:32, weaponDamage:5, weapon:true, color:0xfcee4d, category:'combat' }),

  // Arco e flecha
  261: I(261, 'bow', 'Arco', { maxStack:1, durability:384, weapon:true, color:0x8b5a2b, category:'combat' }),
  262: I(262, 'arrow', 'Flecha', { color:0x806040, category:'combat' }),

  // Armaduras — Couro
  298: armor(298, 'leather_helmet', 'Capacete de Couro', 0, 'leather'),
  299: armor(299, 'leather_chestplate', 'Peitoral de Couro', 1, 'leather'),
  300: armor(300, 'leather_leggings', 'Calças de Couro', 2, 'leather'),
  301: armor(301, 'leather_boots', 'Botas de Couro', 3, 'leather'),
  // Ouro
  314: armor(314, 'golden_helmet', 'Capacete de Ouro', 0, 'gold'),
  315: armor(315, 'golden_chestplate', 'Peitoral de Ouro', 1, 'gold'),
  316: armor(316, 'golden_leggings', 'Calças de Ouro', 2, 'gold'),
  317: armor(317, 'golden_boots', 'Botas de Ouro', 3, 'gold'),
  // Malha
  302: armor(302, 'chainmail_helmet', 'Capacete de Malha', 0, 'chain'),
  303: armor(303, 'chainmail_chestplate', 'Peitoral de Malha', 1, 'chain'),
  304: armor(304, 'chainmail_leggings', 'Calças de Malha', 2, 'chain'),
  305: armor(305, 'chainmail_boots', 'Botas de Malha', 3, 'chain'),
  // Ferro
  306: armor(306, 'iron_helmet', 'Capacete de Ferro', 0, 'iron'),
  307: armor(307, 'iron_chestplate', 'Peitoral de Ferro', 1, 'iron'),
  308: armor(308, 'iron_leggings', 'Calças de Ferro', 2, 'iron'),
  309: armor(309, 'iron_boots', 'Botas de Ferro', 3, 'iron'),
  // Diamante
  310: armor(310, 'diamond_helmet', 'Capacete de Diamante', 0, 'diamond'),
  311: armor(311, 'diamond_chestplate', 'Peitoral de Diamante', 1, 'diamond'),
  312: armor(312, 'diamond_leggings', 'Calças de Diamante', 2, 'diamond'),
  313: armor(313, 'diamond_boots', 'Botas de Diamante', 3, 'diamond'),

  // Utilitários
  281: I(281, 'bowl', 'Tigela', { color: 0x8b5a2b, category: 'materials' }),
  325: I(325, 'bucket', 'Balde', { maxStack:16, color:0xa0a0a0, category:'misc' }),
  326: I(326, 'water_bucket', 'Balde de Água', { maxStack:1, color:0x3060c0, category:'misc' }),
  327: I(327, 'lava_bucket', 'Balde de Lava', { maxStack:1, color:0xc04020, fuel:20000, category:'misc' }),
  259: I(259, 'flint_and_steel', 'Pederneira e Aço', { maxStack:1, durability:64, color:0x808080, category:'tools' }),
  359: I(359, 'shears', 'Tesoura', { maxStack:1, durability:238, color:0xc0c0c0, category:'tools', tool:{ type:'shears' } }),
  346: I(346, 'fishing_rod', 'Vara de Pescar', { maxStack:1, durability:64, color:0x8b5a2b, category:'tools' }),
  345: I(345, 'compass', 'Bússola', { color:0xc0c0c0, category:'misc' }),
  347: I(347, 'clock', 'Relógio', { color:0xffd060, category:'misc' }),
  333: I(333, 'boat', 'Barco', { maxStack:16, color:0x8b5a2b, category:'transport' }),
  328: I(328, 'minecart', 'Carrinho', { maxStack:1, color:0x606060, category:'transport' }),
  329: I(329, 'saddle', 'Sela', { maxStack:1, color:0x8b5a2b, category:'transport' }),
  355: I(355, 'bed', 'Cama', { maxStack:1, color:0xc04040, category:'decor' }),
  321: I(321, 'painting', 'Pintura', { maxStack:16, color:0xc0a040, category:'decor' }),
  323: I(323, 'sign', 'Placa', { maxStack:16, color:0x8b5a2b, category:'decor' }),
  324: I(324, 'wooden_door', 'Porta de Carvalho', { color:0x8b5a2b, category:'decor' }),
  330: I(330, 'iron_door', 'Porta de Ferro', { color:0xc0c0c0, category:'decor' }),
  385: I(385, 'item_frame', 'Moldura', { maxStack:16, color:0x8b5a2b, category:'decor' }),
  390: I(390, 'flower_pot', 'Vaso de Flor', { color:0xa06040, category:'decor' }),
  415: I(415, 'armor_stand', 'Suporte de Armadura', { maxStack:16, color:0xc0c0c0, category:'decor' }),
  380: I(380, 'cauldron', 'Caldeirão', { color:0x606060, category:'decor' }),
  379: I(379, 'brewing_stand', 'Suporte de Poções', { color:0x808080, category:'decor' }),
  356: I(356, 'repeater', 'Repetidor', { color:0x808080, category:'redstone' }),
  404: I(404, 'comparator', 'Comparador', { color:0x808080, category:'redstone' }),
  425: I(425, 'banner', 'Estandarte', { maxStack:16, color:0xc04040, category:'decor' }),
  403: I(403, 'enchanted_book', 'Livro Encantado', { maxStack:1, rarity:'rare', color:0xc0a0ff, category:'misc' }),
  386: I(386, 'writable_book', 'Livro e Pena', { maxStack:1, color:0xc08040, category:'misc' }),
  387: I(387, 'written_book', 'Livro Escrito', { maxStack:1, color:0xa06020, category:'misc' }),
  419: I(419, 'lead', 'Guia', { maxStack:1, color:0x806040, category:'misc' }),
  420: I(420, 'name_tag', 'Etiqueta', { maxStack:1, color:0xc0c080, category:'misc' }),
  398: I(398, 'carrot_on_a_stick', 'Cenoura na Vara', { maxStack:1, color:0x80a040, category:'transport' }),
  401: I(401, 'firework_charge', 'Estrela de Fogos', { color:0xc04040, category:'misc' }),
  402: I(402, 'fireworks', 'Fogos de Artifício', { maxStack:1, color:0xc04040, category:'misc' }),
  344: I(344, 'spawn_egg', 'Ovo de Spawn', { maxStack:16, color:0xc0c0c0, category:'misc' }),

  // Comidas (IDs alinham com FOODS do survival.js)
  260: I(260, 'apple', 'Maçã', { food:true, color:0xc02020, category:'food' }),
  322: I(322, 'golden_apple', 'Maçã Dourada', { food:true, maxStack:64, color:0xffd040, rarity:'rare', category:'food' }),
  466: I(466, 'golden_apple_ench', 'Maçã Dourada Encantada', { food:true, maxStack:1, color:0xffe080, rarity:'epic', category:'food' }),
  297: I(297, 'bread', 'Pão', { food:true, color:0xc0a040, category:'food' }),
  391: I(391, 'carrot', 'Cenoura', { food:true, color:0xff8020, category:'food' }),
  392: I(392, 'potato', 'Batata', { food:true, color:0xc0c080, category:'food' }),
  393: I(393, 'baked_potato', 'Batata Assada', { food:true, color:0xc08040, category:'food' }),
  394: I(394, 'poisonous_potato', 'Batata Venenosa', { food:true, color:0xa0a060, category:'food' }),
  396: I(396, 'golden_carrot', 'Cenoura Dourada', { food:true, color:0xffd040, category:'food' }),
  363: I(363, 'beef', 'Carne Crua', { food:true, color:0xa04040, category:'food' }),
  364: I(364, 'cooked_beef', 'Bife', { food:true, color:0x804020, category:'food' }),
  319: I(319, 'porkchop', 'Costeleta Crua', { food:true, color:0xe8a0a0, category:'food' }),
  320: I(320, 'cooked_porkchop', 'Costeleta Assada', { food:true, color:0xa06040, category:'food' }),
  366: I(366, 'chicken', 'Frango Cru', { food:true, color:0xe0c0a0, category:'food' }),
  365: I(365, 'cooked_chicken', 'Frango Assado', { food:true, color:0xc08040, category:'food' }),
  423: I(423, 'mutton', 'Carneiro Cru', { food:true, color:0xa06060, category:'food' }),
  424: I(424, 'cooked_mutton', 'Carneiro Assado', { food:true, color:0x804030, category:'food' }),
  411: I(411, 'rabbit', 'Coelho Cru', { food:true, color:0xa08080, category:'food' }),
  412: I(412, 'cooked_rabbit', 'Coelho Assado', { food:true, color:0x806040, category:'food' }),
  413: I(413, 'rabbit_stew', 'Ensopado de Coelho', { food:true, maxStack:1, color:0x806040, category:'food' }),
  349: I(349, 'fish', 'Peixe Cru', { food:true, color:0xc0c0c0, category:'food' }),
  350: I(350, 'cooked_fish', 'Peixe Assado', { food:true, color:0xc08060, category:'food' }),
  351: I(351, 'salmon', 'Salmão Assado', { food:true, color:0xd06040, category:'food' }),
  354: I(354, 'clownfish', 'Peixe-Palhaço', { food:true, color:0xff8040, category:'food' }),
  352: I(352, 'pufferfish', 'Baiacu', { food:true, color:0xc0e040, category:'food' }),
  357: I(357, 'cookie', 'Biscoito', { food:true, color:0xc0a060, category:'food' }),
  360: I(360, 'melon', 'Melancia', { food:true, color:0xe04040, category:'food' }),
  400: I(400, 'pumpkin_pie', 'Torta de Abóbora', { food:true, color:0xc08040, category:'food' }),
  282: I(282, 'mushroom_stew', 'Ensopado de Cogumelo', { food:true, maxStack:1, color:0xc08040, category:'food' }),
  367: I(367, 'rotten_flesh', 'Carne Podre', { food:true, color:0x604040, category:'food' }),

  // Discos
  2256: I(2256, 'record_13', 'Disco 13', { maxStack:1, color:0x202020, category:'misc' }),
  2257: I(2257, 'record_cat', 'Disco cat', { maxStack:1, color:0x404040, category:'misc' }),
  2258: I(2258, 'record_blocks', 'Disco blocks', { maxStack:1, color:0x606060, category:'misc' }),
  2259: I(2259, 'record_chirp', 'Disco chirp', { maxStack:1, color:0x808080, category:'misc' }),
  2260: I(2260, 'record_far', 'Disco far', { maxStack:1, color:0xa0a0a0, category:'misc' }),
  2261: I(2261, 'record_mall', 'Disco mall', { maxStack:1, color:0xc0c0c0, category:'misc' }),
  2262: I(2262, 'record_mellohi', 'Disco mellohi', { maxStack:1, color:0xe0e0e0, category:'misc' }),
  2263: I(2263, 'record_stal', 'Disco stal', { maxStack:1, color:0x303030, category:'misc' }),
  2264: I(2264, 'record_strad', 'Disco strad', { maxStack:1, color:0x505050, category:'misc' }),
  2265: I(2265, 'record_ward', 'Disco ward', { maxStack:1, color:0x707070, category:'misc' }),
  2266: I(2266, 'record_11', 'Disco 11', { maxStack:1, color:0x909090, category:'misc' }),
  2267: I(2267, 'record_wait', 'Disco wait', { maxStack:1, color:0xb0b0b0, category:'misc' }),

  // === PRD 09: Tecnologia e Armas de Fogo ===
  450: I(450, 'iron_nugget', 'Pepita de Ferro', { color: 0xddddaa, category: 'materials' }),
  451: I(451, 'gun_barrel', 'Cano de Ferro', { maxStack:16, color: 0x888888, category: 'materials' }),
  452: I(452, 'firing_mechanism', 'Mecanismo de Disparo', { maxStack:16, color: 0x664422, category: 'materials' }),
  453: I(453, 'wooden_stock', 'Coronha de Madeira', { maxStack:16, color: 0x8b5a2b, category: 'materials' }),
  454: I(454, 'grip', 'Empunhadura', { maxStack:16, color: 0x5a3a2a, category: 'materials' }),
  455: I(455, 'spring', 'Mola', { color: 0xccccaa, category: 'materials' }),
  456: I(456, 'light_ammo', 'Munição Leve', { color: 0xddcc88, category: 'combat' }),
  457: I(457, 'heavy_ammo', 'Munição Pesada', { color: 0xcc8844, category: 'combat' }),
  458: I(458, 'shotgun_shell', 'Cartucho de Escopeta', { color: 0xcc2222, category: 'combat' }),
  459: I(459, 'pistol', 'Pistola', { maxStack:1, durability:600, color:0x4a4a4a, category:'combat', weapon:true, gun:'pistol' }),
  460: I(460, 'shotgun', 'Escopeta', { maxStack:1, durability:400, color:0x5a3a2a, category:'combat', weapon:true, gun:'shotgun' }),
  461: I(461, 'bolt_rifle', 'Rifle de Ferrolho', { maxStack:1, durability:300, color:0x3a2a1a, category:'combat', weapon:true, gun:'bolt_rifle' }),
  462: I(462, 'carbine', 'Carabina', { maxStack:1, durability:800, color:0x2a2a3a, category:'combat', weapon:true, gun:'carbine' }),
  463: I(463, 'grenade', 'Granada de Mão', { maxStack:16, color:0x4a5a3a, category:'combat' }),
  464: I(464, 'scope', 'Mira Telescópica', { maxStack:1, color:0x223344, category:'combat', accessory:'scope' }),
  465: I(465, 'silencer', 'Silenciador', { maxStack:1, color:0x333333, category:'combat', accessory:'silencer' }),
  467: I(467, 'tactical_light', 'Lanterna Tática', { maxStack:1, color:0xffdd44, category:'combat', accessory:'tactical_light' }),
  468: I(468, 'extended_mag', 'Carregador Estendido', { maxStack:1, color:0x555555, category:'combat', accessory:'extended_mag' }),

  // PRD 11: Redstone (blocos como itens)
  69: I(69, 'lever', 'Alavanca', { maxStack:1, color:0x808080, category:'redstone' }),
  70: I(70, 'stone_pressure_plate', 'Placa de Pressão de Pedra', { color:0x808080, category:'redstone' }),
  72: I(72, 'wooden_pressure_plate', 'Placa de Pressão de Madeira', { color:0x8b5a2b, category:'redstone' }),
  76: I(76, 'redstone_torch', 'Tocha de Redstone', { color:0xff0000, category:'redstone' }),
  77: I(77, 'stone_button', 'Botão de Pedra', { color:0x808080, category:'redstone' }),
  123: I(123, 'redstone_lamp', 'Lâmpada de Redstone', { color:0xffdd44, category:'redstone' }),
  151: I(151, 'daylight_sensor', 'Sensor de Luz', { color:0x808080, category:'redstone' }),
  154: I(154, 'hopper', 'Funil', { maxStack:1, color:0x808080, category:'redstone' }),

  // PRD 11: Agricultura
  60: I(60, 'farmland', 'Terra Arada', { color:0x8b5a2b, category:'building' }),
  81: I(81, 'cactus', 'Cacto', { color:0x4a7a3a, category:'decor' }),
  115: I(115, 'nether_wart', 'Verruga do Nether', { color:0xc02020, category:'materials' }),
};

// Lookup por nome
export const ITEM_NAMES = {};
for (const id in ITEMS) {
  ITEM_NAMES[ITEMS[id].name] = parseInt(id);
  ITEM_NAMES[ITEMS[id].namePt.toLowerCase()] = parseInt(id);
}

//getItem: procura em ITEMS, depois em BLOCKS
import { BLOCKS } from './blocks';
export function getItem(id) { return ITEMS[id] || BLOCKS[id] || null; }

export function getItemName(id) {
  const item = getItem(id);
  return item ? item.namePt : '???';
}

export function itemColor(id) {
  const item = getItem(id);
  if (item && item.color) return '#' + item.color.toString(16).padStart(6, '0');
  if (BLOCKS[id]) {
    // Fallback: usa a primeira cor das faces
    return '#888888';
  }
  return '#444444';
}

export function getMaxStack(id) {
  const item = getItem(id);
  return item ? (item.maxStack || 64) : 64;
}

export function isTool(id) {
  const item = ITEMS[id];
  return !!(item && item.tool);
}

export function isArmor(id) {
  const item = ITEMS[id];
  return !!(item && item.armor);
}

export function isWeapon(id) {
  const item = ITEMS[id];
  return !!(item && item.weapon);
}

export function isGun(id) {
  const item = ITEMS[id];
  return !!(item && item.gun);
}

export function isAccessory(id) {
  const item = ITEMS[id];
  return !!(item && item.accessory);
}

export function getArmorPoints(armorSlots) {
  let total = 0;
  for (const slot of armorSlots) {
    if (!slot) continue;
    const item = ITEMS[slot.id];
    if (item && item.armor) {
      const mat = ARMOR_MATERIALS[item.armor.material];
      total += mat.points[item.armor.slot];
    }
  }
  return total;
}

export function getToolMaterial(item) {
  if (!item || !item.tool) return null;
  return TOOL_MATERIALS[item.tool.material];
}

// Abas do inventário criativo
export const CREATIVE_TABS = [
  { id: 'building', name: 'Construção' },
  { id: 'decor', name: 'Decoração' },
  { id: 'redstone', name: 'Redstone' },
  { id: 'transport', name: 'Transporte' },
  { id: 'misc', name: 'Diversos' },
  { id: 'search', name: 'Pesquisar' },
  { id: 'food', name: 'Comidas' },
  { id: 'tools', name: 'Ferramentas' },
  { id: 'combat', name: 'Combate' },
  { id: 'materials', name: 'Materiais' },
  { id: 'technology', name: 'Tecnologia' },
];