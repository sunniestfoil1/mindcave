// Motor de receitas data-driven — PRD 06 RF-030..034
// Tipos: shaped (com formato), shapeless (sem formato)

// Receita shaped: { type:'shaped', pattern:['XX','X '], keys:{X:{id:5}}, result:{id:280,count:4} }
// Receita shapeless: { type:'shapeless', ingredients:[{id:339},{id:339},{id:339},{id:334}], result:{id:339,count:1} }

import { canStack, stack } from './inventory';
import REAL_RECIPES from './recipesReal.json';

const R = (pattern, keys, result) => ({ type: 'shaped', pattern, keys, result });
const S = (ingredients, result) => ({ type: 'shapeless', ingredients, result });

// Materiais de ferramentas: substitui 'planks' por qualquer tábua, 'log' por qualquer tronco
const PLANKS = { any: [5] }; // tábua de carvalho (simplificado: 1 tipo)
const LOG = { any: [17, 162] };
const COBBLE = { id: 4 };
const IRON = { id: 265 };
const STICK = { id: 280 };
const COAL = { id: 263 };
const STRING = { id: 287 };
const FLINT = { id: 318 };
const FEATHER = { id: 288 };
const GUNPOWDER = { id: 289 };
const SAND = { id: 12 };
const PAPER = { id: 339 };
const LEATHER = { id: 334 };
const BOOK = { id: 340 };
const REDSTONE = { id: 331 };
const IRON_BLOCK = { id: 42 };
const GOLD_BLOCK = { id: 41 };
const DIAMOND = { id: 264 };
const OBSIDIAN = { id: 49 };
const WHEAT = { id: 296 };
const SUGARCANE = { id: 83 };
const IRON_NUGGET = { id: 450 };
const GOLD_NUGGET = { id: 371 };
const IRON_INGOT = { id: 265 };
const GOLD_INGOT = { id: 266 };
const GLOWSTONE_DUST = { id: 348 };
const GLASS = { id: 20 };
const WOOL = { id: 35 };

// Peças de armas
const GUN_BARREL = { id: 451 };
const FIRING_MECHANISM = { id: 452 };
const WOODEN_STOCK = { id: 453 };
const GRIP = { id: 454 };
const SPRING = { id: 455 };
const CRAFTING_TABLE = { id: 58 };

function toolRecipes(prefix, ids, material) {
  // ids = [pickaxe, axe, shovel, hoe, sword]
  return [
    R(['MMM', ' S ', ' S '], { M: { id: material }, S: STICK }, { id: ids[0], count: 1 }), // picareta
    R(['MM', 'MS', ' S'], { M: { id: material }, S: STICK }, { id: ids[1], count: 1 }),    // machado (resolvido bug de coluna extra)
    R(['M', 'S', 'S'], { M: { id: material }, S: STICK }, { id: ids[2], count: 1 }),       // pá
    R(['MM', ' S', ' S'], { M: { id: material }, S: STICK }, { id: ids[3], count: 1 }),    // enxada
    R(['M', 'M', 'S'], { M: { id: material }, S: STICK }, { id: ids[4], count: 1 }),       // espada
  ];
}

function armorRecipes(ids, material) {
  return [
    // Capacete: MMM / M M (5 materiais MC 1.8.9)
    R(['MMM', 'M M'], { M: { id: material } }, { id: ids[0], count: 1 }),
    // Peitoral: M M / MMM / MMM
    R(['M M', 'MMM', 'MMM'], { M: { id: material } }, { id: ids[1], count: 1 }),
    // Calças: MMM / M M / M M
    R(['MMM', 'M M', 'M M'], { M: { id: material } }, { id: ids[2], count: 1 }),
    // Botas: M M / M M
    R(['M M', 'M M'], { M: { id: material } }, { id: ids[3], count: 1 }),
  ];
}

// Receitas escritas à mão (inclui as armas custom). As receitas reais do 1.8.9 vêm de recipesReal.json (scripts/gen-recipes.mjs).
export const BASE_RECIPES = [
  // Essenciais (Apêndice B)
  R(['L'], { L: { any: [17, 162] } }, { id: 5, count: 4 }),           // tronco → 4 tábuas
  R(['P', 'P'], { P: { id: 5 } }, { id: 280, count: 4 }),            // 2 tábuas → 4 gravetos
  R(['PP', 'PP'], { P: { id: 5 } }, { id: 58, count: 1 }),           // 4 tábuas → bancada
  R(['CCC', 'C C', 'CCC'], { C: COBBLE }, { id: 61, count: 1 }),     // 8 pedregulho → fornalha
  R(['PPP', 'P P', 'PPP'], { P: { id: 5 } }, { id: 54, count: 1 }),  // 8 tábuas → baú
  R(['C', 'S'], { C: COAL, S: STICK }, { id: 50, count: 4 }),        // carvão + graveto → 4 tochas

  // Ferramentas — Madeira
  ...toolRecipes('wood', [270, 271, 269, 290, 268], 5),
  // Ferramentas — Pedra
  ...toolRecipes('stone', [274, 275, 273, 291, 272], 4),
  // Ferramentas — Ferro
  ...toolRecipes('iron', [257, 258, 256, 292, 267], 265),
  // Ferramentas — Diamante
  ...toolRecipes('diamond', [278, 279, 277, 293, 276], 264),
  // Ferramentas — Ouro
  ...toolRecipes('gold', [285, 286, 284, 294, 283], 266),

  // Armaduras — Couro
  ...armorRecipes([298, 299, 300, 301], 334),
  // Armaduras — Ferro
  ...armorRecipes([306, 307, 308, 309], 265),
  // Armaduras — Diamante
  ...armorRecipes([310, 311, 312, 313], 264),
  // Armaduras — Ouro
  ...armorRecipes([314, 315, 316, 317], 266),

  // Arco e flecha (MC 1.8.9: 3 gravetos + 3 linhas)
  R([' SL', 'S L', ' SL'], { S: STICK, L: STRING }, { id: 261, count: 1 }),
  R(['SL ', 'S L', 'SL '], { S: STICK, L: STRING }, { id: 261, count: 1 }),
  // Flecha: sílex + graveto + pena (vertical)
  R(['F', 'S', 'P'], { F: FLINT, S: STICK, P: FEATHER }, { id: 262, count: 4 }),

  // Balde
  R(['I I', ' I '], { I: IRON }, { id: 325, count: 1 }),
  // Tesoura (2 ferros em diagonal)
  R([' I', 'I '], { I: IRON }, { id: 359, count: 1 }),
  R(['I ', ' I'], { I: IRON }, { id: 359, count: 1 }),
  // Isqueiro (shapeless: ferro + pederneira)
  S([{ id: 265 }, { id: 318 }], { id: 259, count: 1 }),

  // Tigela (3 tábuas em V)
  R(['P P', ' P '], { P: { id: 5 } }, { id: 281, count: 4 }),

  // Pão
  R(['WWW'], { W: WHEAT }, { id: 297, count: 1 }),

  // Escadas de mão
  R(['S S', 'SSS', 'S S'], { S: STICK }, { id: 65, count: 3 }),

  // Portas
  R(['PP', 'PP', 'PP'], { P: { id: 5 } }, { id: 324, count: 3 }),

  // Cama (Qualquer tábua e qualquer lã)
  R(['WWW', 'PPP'], { W: { id: 35 }, P: { id: 5 } }, { id: 355, count: 1 }),

  // TNT
  R(['GSG', 'SGS', 'GSG'], { G: GUNPOWDER, S: SAND }, { id: 46, count: 1 }),

  // Lajes: 3 blocos em linha → 6 lajes (a meta é o tipo: 0 pedra, 1 arenito, 3 pedregulho, 4 tijolos, 5 tijolos de pedra, 6 nether, 7 quartzo)
  R(['CCC'], { C: { id: 1 } }, { id: 44, meta: 0, count: 6 }),
  R(['CCC'], { C: { id: 24 } }, { id: 44, meta: 1, count: 6 }),
  R(['CCC'], { C: COBBLE }, { id: 44, meta: 3, count: 6 }),
  R(['CCC'], { C: { id: 45 } }, { id: 44, meta: 4, count: 6 }),
  R(['CCC'], { C: { id: 98 } }, { id: 44, meta: 5, count: 6 }),
  R(['CCC'], { C: { id: 112 } }, { id: 44, meta: 6, count: 6 }),
  R(['CCC'], { C: { id: 155 } }, { id: 44, meta: 7, count: 6 }),
  R(['CCC'], { C: { id: 5 } }, { id: 126, meta: 0, count: 6 }),
  R(['CCC'], { C: { id: 179 } }, { id: 182, meta: 0, count: 6 }),

  // Cercas e portão (1.8.9)
  R(['PSP', 'PSP'], { P: { id: 5 }, S: STICK }, { id: 85, count: 2 }),
  R(['NNN', 'NNN'], { N: { id: 112 } }, { id: 113, count: 6 }),
  R(['SPS', 'SPS'], { P: { id: 5 }, S: STICK }, { id: 107, count: 1 }),

  // Escadas: 6 blocos em degraus (nos dois sentidos) → 4 escadas
  ...[[5, 53], [4, 67], [45, 108], [98, 109], [112, 114], [24, 128], [155, 156], [179, 180]].flatMap(([src, out]) => [
    R(['C  ', 'CC ', 'CCC'], { C: { id: src } }, { id: out, count: 4 }),
    R(['  C', ' CC', 'CCC'], { C: { id: src } }, { id: out, count: 4 }),
  ]),

  // Blocos de minério → bloco
  R(['III', 'III', 'III'], { I: { id: 265 } }, { id: 42, count: 1 }),  // ferro → bloco
  R(['III', 'III', 'III'], { I: { id: 266 } }, { id: 41, count: 1 }),  // ouro → bloco
  R(['III', 'III', 'III'], { I: { id: 264 } }, { id: 57, count: 1 }),  // diamante → bloco
  R(['III', 'III', 'III'], { I: { id: 388 } }, { id: 133, count: 1 }), // esmeralda → bloco
  R(['III', 'III', 'III'], { I: { id: 331 } }, { id: 152, count: 1 }), // redstone → bloco
  R(['III', 'III', 'III'], { I: { id: 263 } }, { id: 173, count: 1 }), // carvão → bloco

  // Bloco → itens (9x)
  R(['I'], { I: { id: 42 } }, { id: 265, count: 9 }),  // 1 bloco ferro → 9 lingotes
  R(['I'], { I: { id: 41 } }, { id: 266, count: 9 }),  // 1 bloco ouro → 9 lingotes
  R(['I'], { I: { id: 57 } }, { id: 264, count: 9 }),  // 1 bloco diamante → 9 diamantes
  R(['I'], { I: { id: 133 } }, { id: 388, count: 9 }), // 1 bloco esmeralda → 9 esmeraldas
  R(['I'], { I: { id: 173 } }, { id: 263, count: 9 }), // 1 bloco carvão → 9 carvões
  R(['I'], { I: { id: 152 } }, { id: 331, count: 9 }), // 1 bloco redstone → 9 redstones

  // Vara de pescar (3 gravetos + 2 linhas)
  R(['  S', ' SL', 'S L'], { S: STICK, L: STRING }, { id: 346, count: 1 }),
  // Porta de ferro
  R(['II', 'II', 'II'], { I: IRON_INGOT }, { id: 330, count: 3 }),
  // Alçapão de madeira
  R(['PPP', 'PPP'], { P: { id: 5 } }, { id: 96, count: 2 }),
  // Cerca de madeira
  R(['PSP', 'PSP'], { P: { id: 5 }, S: STICK }, { id: 85, count: 3 }),
  // Portão de cerca
  R(['SPS', 'SPS'], { P: { id: 5 }, S: STICK }, { id: 107, count: 1 }),

  // Estante
  R(['PPP', 'BBB', 'PPP'], { P: { id: 5 }, B: BOOK }, { id: 47, count: 1 }),

  // Livro (shapeless: 3 papel + 1 couro)
  S([{ id: 339 }, { id: 339 }, { id: 339 }, { id: 334 }], { id: 340, count: 1 }),

  // Papel (3 canas em linha)
  R(['CCC'], { C: { id: 83 } }, { id: 339, count: 3 }),

  // Bússola: 4 ferros em cruz + redstone
  R([' I ', 'IRI', ' I '], { I: IRON, R: REDSTONE }, { id: 345, count: 1 }),

  // Relógio: 4 ouros em cruz + redstone
  R([' G ', 'GRG', ' G '], { G: { id: 266 }, R: REDSTONE }, { id: 347, count: 1 }),

  // Barco: 5 tábuas em U
  R(['P P', 'PPP'], { P: { id: 5 } }, { id: 333, count: 1 }),

  // Olho do Ender (shapeless)
  S([{ id: 368 }, { id: 377 }], { id: 381, count: 1 }),

  // Maçã dourada: maçã + 8 lingotes de ouro
  R(['GGG', 'GAG', 'GGG'], { G: { id: 266 }, A: { id: 260 } }, { id: 322, count: 1 }),

  // === PRD 09: Tecnologia e Armas de Fogo ===

  // Pepitas (bancada comum)
  R(['I'], { I: IRON_INGOT }, { id: 450, count: 9 }),        // 1 ferro → 9 pepitas
  R(['III','III','III'], { I: IRON_NUGGET }, { id: 265, count: 1 }), // 9 pepitas → 1 ferro

  // Bancada de Armeiro (bancada comum — RF-002)
  R(['III', 'PWP', 'PPP'], { I: IRON_INGOT, P: { id: 5 }, W: CRAFTING_TABLE }, { id: 177, count: 1 }),

  // === Receitas da Bancada de Armeiro (station: 'gunsmith') ===
  // Cano de ferro: 3 lingotes em linha
  { ...R(['III'], { I: IRON_INGOT }, { id: 451, count: 1 }), station: 'gunsmith' },
  // Mola (×4): 4 pepitas em zigue-zague
  { ...R(['N N',' N ','N N'], { N: IRON_NUGGET }, { id: 455, count: 4 }), station: 'gunsmith' },
  // Mecanismo de disparo: 2 ferro + 1 redstone + 1 sílex + 1 mola
  { ...S([{ id: 265 }, { id: 265 }, { id: 331 }, { id: 318 }, { id: 455 }], { id: 452, count: 1 }), station: 'gunsmith' },
  // Coronha de madeira: 3 tábuas em L
  { ...R(['P  ','P  ','PP '], { P: { id: 5 } }, { id: 453, count: 1 }), station: 'gunsmith' },
  // Empunhadura: 2 tábuas + 1 couro
  { ...S([{ id: 5 }, { id: 5 }, { id: 334 }], { id: 454, count: 1 }), station: 'gunsmith' },

  // Munição leve: 1 pepita ferro + 1 pólvora + 1 pepita ouro → 8
  { ...S([{ id: 450 }, { id: 289 }, { id: 371 }], { id: 456, count: 8 }), station: 'gunsmith' },
  // Munição pesada: 2 pepitas ferro + 2 pólvoras + 1 pepita ouro → 4
  { ...S([{ id: 450 }, { id: 450 }, { id: 289 }, { id: 289 }, { id: 371 }], { id: 457, count: 4 }), station: 'gunsmith' },
  // Cartucho de escopeta: 1 papel + 1 pólvora + 3 pepitas ferro → 4
  { ...S([{ id: 339 }, { id: 289 }, { id: 450 }, { id: 450 }, { id: 450 }], { id: 458, count: 4 }), station: 'gunsmith' },

  // Armas
  // Pistola: 1 cano + 1 mecanismo + 1 empunhadura
  { ...S([{ id: 451 }, { id: 452 }, { id: 454 }], { id: 459, count: 1 }), station: 'gunsmith' },
  // Escopeta: 2 canos + 1 mecanismo + 1 coronha
  { ...S([{ id: 451 }, { id: 451 }, { id: 452 }, { id: 453 }], { id: 460, count: 1 }), station: 'gunsmith' },
  // Rifle de ferrolho: 2 canos + 1 mecanismo + 1 coronha + 1 diamante
  { ...S([{ id: 451 }, { id: 451 }, { id: 452 }, { id: 453 }, { id: 264 }], { id: 461, count: 1 }), station: 'gunsmith' },
  // Carabina: 1 cano + 2 mecanismos + 1 coronha + 1 empunhadura + 1 ouro
  { ...S([{ id: 451 }, { id: 452 }, { id: 452 }, { id: 453 }, { id: 454 }, { id: 266 }], { id: 462, count: 1 }), station: 'gunsmith' },
  // Granada (×2): 1 ferro + 4 pólvoras + 1 sílex
  { ...S([{ id: 265 }, { id: 289 }, { id: 289 }, { id: 289 }, { id: 289 }, { id: 318 }], { id: 463, count: 2 }), station: 'gunsmith' },

  // Acessórios
  // Mira telescópica: 2 vidros + 2 ferros + 1 glowstone
  { ...R(['GIG','I I','GIG'], { G: GLASS, I: IRON_INGOT }, { id: 464, count: 1 }), station: 'gunsmith' },
  // Silenciador: 2 ferros + 3 lãs
  { ...R(['WWW','I I','WWW'], { W: WOOL, I: IRON_INGOT }, { id: 465, count: 1 }), station: 'gunsmith' },
  // Lanterna tática: 1 glowstone + 1 ferro + 1 vidro
  { ...S([{ id: 348 }, { id: 265 }, { id: 20 }], { id: 467, count: 1 }), station: 'gunsmith' },
  // Carregador estendido: 3 ferros + 1 mola
  { ...R(['I I','ISI','I I'], { I: IRON_INGOT, S: SPRING }, { id: 468, count: 1 }), station: 'gunsmith' },
];

// Receitas reais importadas (data/mc-1.8.9, MIT): { s: forma, r: [id, qtd, meta] } ou { l: ingredientes, r: [...] }; ingrediente = [id, meta] (meta −1 = qualquer)
function fromReal(r) {
  const [id, count, meta] = r.r;
  const result = { id, count, ...(meta ? { meta } : {}) };
  const ing = ([i, m]) => (m >= 0 ? { id: i, meta: m } : { id: i });
  if (r.s) {
    const keys = {}, letters = new Map();
    const pattern = r.s.map(row => row.map(c => {
      if (!c) return ' ';
      const k = c[0] + ':' + c[1];
      if (!letters.has(k)) { const L = String.fromCharCode(65 + letters.size); letters.set(k, L); keys[L] = ing(c); }
      return letters.get(k);
    }).join(''));
    return R(pattern, keys, result);
  }
  return S(r.l.map(ing), result);
}
export const RECIPES = [...BASE_RECIPES, ...REAL_RECIPES.map(fromReal)];

// Verifica se um ingrediente corresponde a um item do grid
function matchesIngredient(ingredient, item) {
  if (!item) return false;
  if (ingredient.any) return ingredient.any.includes(item.id);
  if (ingredient.id !== item.id) return false;
  if (ingredient.meta !== undefined && ingredient.meta !== (item.meta || 0)) return false;
  return true;
}

// Normaliza a grade: remove linhas/colunas vazias e retorna matriz NxM
function normalizeGrid(grid, size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      row.push(grid[idx] || null);
    }
    rows.push(row);
  }
  // Remove linhas vazias
  let minY = 0, maxY = rows.length - 1;
  while (minY <= maxY && rows[minY].every(c => !c)) minY++;
  while (maxY >= minY && rows[maxY].every(c => !c)) maxY--;
  if (minY > maxY) return null;
  // Remove colunas vazias
  let minX = 0, maxX = rows[0].length - 1;
  while (minX <= maxX && rows.every(r => !r[minX])) minX++;
  while (maxX >= minX && rows.every(r => !r[maxX])) maxX--;
  if (minX > maxX) return null;
  const result = [];
  for (let y = minY; y <= maxY; y++) {
    result.push(rows[y].slice(minX, maxX + 1));
  }
  return result;
}

// Converte padrão de receita em matriz normalizada (sem margens vazias)
function patternToGrid(recipe) {
  const raw = recipe.pattern.map(row => row.split('').map(c => c === ' ' ? null : c));
  let minY = 0, maxY = raw.length - 1;
  while (minY <= maxY && raw[minY].every(c => !c)) minY++;
  while (maxY >= minY && raw[maxY].every(c => !c)) maxY--;
  if (minY > maxY) return raw;
  const maxW = Math.max(...raw.map(r => r.length));
  let minX = 0, maxX = maxW - 1;
  while (minX <= maxX && raw.every(r => !r[minX])) minX++;
  while (maxX >= minX && raw.every(r => !r[maxX])) maxX--;
  if (minX > maxX) return raw;
  const result = [];
  for (let y = minY; y <= maxY; y++) {
    result.push(raw[y].slice(minX, maxX + 1));
  }
  return result;
}

// Verifica se uma grade normalizada corresponde a um padrão
function matchPattern(grid, pattern, keys) {
  if (grid.length !== pattern.length) return false;
  for (let y = 0; y < grid.length; y++) {
    if (grid[y].length !== pattern[y].length) return false;
    for (let x = 0; x < grid[y].length; x++) {
      const cell = grid[y][x];
      const key = pattern[y][x];
      if (key === null) {
        if (cell) return false;
      } else {
        const ingredient = keys[key];
        if (!ingredient) return false;
        if (!matchesIngredient(ingredient, cell)) return false;
      }
    }
  }
  return true;
}

// Espelha uma grade horizontalmente
function mirrorGrid(grid) {
  return grid.map(row => [...row].reverse());
}

// Encontra a receita que corresponde à grade
export function matchRecipe(grid, size, station = 'crafting') {
  const normalized = normalizeGrid(grid, size);
  if (!normalized) return null;

  for (const recipe of RECIPES) {
    // Filtrar por estação: 'crafting' exclui receitas 'gunsmith'; 'gunsmith' só aceita 'gunsmith'
    if (station === 'crafting' && recipe.station === 'gunsmith') continue;
    if (station === 'gunsmith' && recipe.station !== 'gunsmith') continue;
    if (recipe.type === 'shaped') {
      const pattern = patternToGrid(recipe);
      if (matchPattern(normalized, pattern, recipe.keys)) return recipe;
      // Espelhamento horizontal
      if (matchPattern(mirrorGrid(normalized), pattern, recipe.keys)) return recipe;
    } else if (recipe.type === 'shapeless') {
      // Conta itens na grade
      const items = [];
      for (const cell of grid) {
        if (cell) items.push(cell);
      }
      if (items.length !== recipe.ingredients.length) continue;
      // Verifica se cada ingrediente tem correspondência
      const used = new Array(items.length).fill(false);
      let allMatch = true;
      for (const ing of recipe.ingredients) {
        let found = false;
        for (let i = 0; i < items.length; i++) {
          if (!used[i] && matchesIngredient(ing, items[i])) {
            used[i] = true; found = true; break;
          }
        }
        if (!found) { allMatch = false; break; }
      }
      if (allMatch) return recipe;
    }
  }
  return null;
}

// Consome 1 de cada ingrediente da grade
export function consumeIngredients(grid) {
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]) {
      grid[i].count--;
      if (grid[i].count <= 0) grid[i] = null;
    }
  }
}

// Cria o resultado de uma receita
export function createResult(recipe) {
  if (!recipe) return null;
  return stack(recipe.result.id, recipe.result.count, recipe.result.meta || 0);
}