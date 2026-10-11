// Mineração exata 1.8.9: tempo, ferramenta, colheita, drops, durabilidade — PRD 06 RF-060..063
import { BLOCKS, getBlock } from './blocks';
import { ITEMS, TOOL_MATERIALS, getToolMaterial } from './items';
import { getAmplifier, Effect } from './effects';
import { stateId } from './chunk';
import { packState } from './chunk';

// Tabela de colheita: blockId → { tool: 'pickaxe'|'axe'|'shovel'|'sword'|'shears'|null, level: 0-3 }
export const HARVEST = {
  1: { tool: 'pickaxe', level: 0 },   // pedra (exige qualquer picareta)
  4: { tool: 'pickaxe', level: 0 },   // pedregulho
  14: { tool: 'pickaxe', level: 2 },  // minério de ouro (exige ferro/ouro/diamante)
  15: { tool: 'pickaxe', level: 1 },  // minério de ferro (exige pedra/ferro/diamante)
  16: { tool: 'pickaxe', level: 0 },  // minério de carvão
  21: { tool: 'pickaxe', level: 1 },  // minério de lápis
  22: { tool: 'pickaxe', level: 0 },  // bloco de lápis
  41: { tool: 'pickaxe', level: 2 },  // bloco de ouro
  42: { tool: 'pickaxe', level: 1 },  // bloco de ferro
  45: { tool: 'pickaxe', level: 0 },  // tijolos
  48: { tool: 'pickaxe', level: 0 },  // pedregulho musgoso
  49: { tool: 'pickaxe', level: 3 },  // obsidiana
  56: { tool: 'pickaxe', level: 2 },  // minério de diamante
  57: { tool: 'pickaxe', level: 2 },  // bloco de diamante
  61: { tool: 'pickaxe', level: 0 },  // fornalha
  73: { tool: 'pickaxe', level: 2 },  // minério de redstone
  89: { tool: 'pickaxe', level: 0 },  // glowstone
  98: { tool: 'pickaxe', level: 0 },  // tijolos de pedra
  112: { tool: 'pickaxe', level: 0 }, // tijolo do nether
  121: { tool: 'pickaxe', level: 0 }, // pedra do end
  129: { tool: 'pickaxe', level: 2 }, // minério de esmeralda
  133: { tool: 'pickaxe', level: 2 }, // bloco de esmeralda
  152: { tool: 'pickaxe', level: 2 }, // bloco de redstone
  155: { tool: 'pickaxe', level: 0 }, // bloco de quartzo
  159: { tool: 'pickaxe', level: 0 }, // argila tingida
  168: { tool: 'pickaxe', level: 0 }, // prismarinho
  173: { tool: 'pickaxe', level: 0 }, // bloco de carvão
  175: { tool: 'pickaxe', level: 0 }, // tijolos musgosos
  24: { tool: 'pickaxe', level: 0 },  // arenito
  176: { tool: 'pickaxe', level: 0 }, // arenito vermelho
  // lajes e escadas: de pedra exigem picareta; de madeira o machado é só o mais rápido
  44: { tool: 'pickaxe', level: 0 }, 43: { tool: 'pickaxe', level: 0 }, 182: { tool: 'pickaxe', level: 0 }, 181: { tool: 'pickaxe', level: 0 },
  67: { tool: 'pickaxe', level: 0 }, 108: { tool: 'pickaxe', level: 0 }, 109: { tool: 'pickaxe', level: 0 }, 114: { tool: 'pickaxe', level: 0 },
  128: { tool: 'pickaxe', level: 0 }, 156: { tool: 'pickaxe', level: 0 }, 180: { tool: 'pickaxe', level: 0 },
  126: { tool: 'axe', level: 0 }, 125: { tool: 'axe', level: 0 },
  53: { tool: 'axe', level: 0 }, 134: { tool: 'axe', level: 0 }, 135: { tool: 'axe', level: 0 }, 136: { tool: 'axe', level: 0 },
  163: { tool: 'axe', level: 0 }, 164: { tool: 'axe', level: 0 },
  // Pá
  2: { tool: 'shovel', level: 0 },    // grama
  3: { tool: 'shovel', level: 0 },    // terra
  12: { tool: 'shovel', level: 0 },   // areia
  13: { tool: 'shovel', level: 0 },   // cascalho
  80: { tool: 'shovel', level: 0 },   // bloco de neve
  78: { tool: 'shovel', level: 0 },   // camada de neve
  82: { tool: 'shovel', level: 0 },   // argila
  88: { tool: 'shovel', level: 0 },   // areia das almas
  110: { tool: 'shovel', level: 0 },  // micélio
  // Machado
  5: { tool: 'axe', level: 0 },       // tábuas
  17: { tool: 'axe', level: 0 },      // tronco
  47: { tool: 'axe', level: 0 },      // estante
  58: { tool: 'axe', level: 0 },      // bancada
  162: { tool: 'axe', level: 0 },     // tronco2
  // Espada (plantas)
  18: { tool: 'sword', level: 0 },    // folhas (rápido com espada)
  161: { tool: 'sword', level: 0 },   // folhas2
  86: { tool: 'sword', level: 0 },    // abóbora
  103: { tool: 'sword', level: 0 },   // melancia
  // Tesoura
  30: { tool: 'shears', level: 0 },   // teia (rápido com tesoura/espada)
  31: { tool: 'shears', level: 0 },   // grama alta
  106: { tool: 'shears', level: 0 },  // trepadeira
};

// Tabela de drops especiais: blockId → função(tool) → { id, count, meta }[] ou null para drop padrão
export const DROP_TABLE = {
  1: () => [{ id: 4, count: 1 }],           // pedra → pedregulho
  2: () => [{ id: 2, count: 1 }],           // grama → bloco de grama
  14: (tool) => canHarvest(14, tool) ? [{ id: 14, count: 1 }] : [],  // minério de ouro → bloco
  15: (tool) => canHarvest(15, tool) ? [{ id: 15, count: 1 }] : [],  // minério de ferro → bloco
  16: (tool) => canHarvest(16, tool) ? [{ id: 263, count: 1 }] : [],   // minério de carvão → carvão
  21: (tool) => canHarvest(21, tool) ? [{ id: 351, count: 4 + Math.floor(Math.random() * 5), meta: 4 }] : [], // lápis
  56: (tool) => canHarvest(56, tool) ? [{ id: 264, count: 1 }] : [],   // diamante
  73: (tool) => canHarvest(73, tool) ? [{ id: 331, count: 4 + Math.floor(Math.random() * 2) }] : [], // redstone
  129: (tool) => canHarvest(129, tool) ? [{ id: 388, count: 1 }] : [],  // esmeralda
  89: () => [{ id: 348, count: 2 + Math.floor(Math.random() * 3) }],   // glowstone → pó
  13: () => Math.random() < 0.1 ? [{ id: 318, count: 1 }] : [{ id: 13, count: 1 }], // cascalho → 10% sílex
  18: (tool) => {
    const drops = [];
    if (tool && tool.id === 359) drops.push({ id: 18, count: 1 }); // tesoura → folhas
    if (Math.random() < 0.05) drops.push({ id: 6, count: 1 }); // muda (1/20)
    if (Math.random() < 0.005) drops.push({ id: 260, count: 1 }); // maçã (1/200)
    return drops;
  },
  31: (tool) => {
    if (tool && tool.id === 359) return [{ id: 31, count: 1 }]; // tesoura → grama
    return Math.random() < 0.125 ? [{ id: 295, count: 1 }] : [];  // 1/8 sementes
  },
  143: () => Math.random() < 0.6 ? [{ id: 280, count: 1 + Math.floor(Math.random() * 2) }] : [], // arbusto morto → gravetos
  47: () => [{ id: 339, count: 3 }],   // estante → 3 livros
  103: () => [{ id: 360, count: 3 + Math.floor(Math.random() * 5) }], // melancia → 3-7 fatias
  82: () => [{ id: 336, count: 4 }],   // argila → 4 bolas
  80: () => [{ id: 332, count: 4 }],   // bloco de neve → 4 bolas
  30: (tool) => (tool && tool.id === 359) ? [{ id: 30, count: 1 }] : [{ id: 287, count: 1 }], // teia → linha (ou bloco com tesoura)
  106: (tool) => (tool && tool.id === 359) ? [{ id: 106, count: 1 }] : [],  // trepadeira → só com tesoura
  20: () => [],                        // vidro → nada
  79: () => [],                        // gelo → nada
  51: () => [],                        // fogo → nada
  78: () => [],                        // camada de neve → nada sem pá
  7: () => [],                         // bedrock → nada
};

// XP por minério
export const ORE_XP = {
  14: () => 0, 15: () => 0, 16: () => Math.floor(Math.random() * 3),
  21: () => 2 + Math.floor(Math.random() * 4), 56: () => 3 + Math.floor(Math.random() * 5),
  73: () => 1 + Math.floor(Math.random() * 5), 129: () => 3 + Math.floor(Math.random() * 5),
};

// Só estes blocos EXIGEM ferramenta para dropar (1.8.9: Material.isToolNotRequired() == false).
// Terra, areia, madeira, folhas etc. dropam com a mão; HARVEST abaixo só diz qual ferramenta é mais rápida.
const NEEDS_TOOL = new Set([
  ...Object.entries(HARVEST).filter(([, h]) => h.tool === 'pickaxe').map(([id]) => Number(id)),
  78, 80, 30, // camada de neve e bloco de neve (pá), teia (espada/tesoura)
]);

// Verifica se a ferramenta pode colher o bloco (dropa)
export function canHarvest(blockId, tool) {
  if (!NEEDS_TOOL.has(blockId)) return true;
  if (!tool) return false;
  const item = ITEMS[tool.id];
  if (!item) return false;
  if (blockId === 30) return tool.id === 359 || (!!item.weapon && !item.tool); // teia: tesoura ou espada
  if (!item.tool) return false;
  const h = HARVEST[blockId];
  if (item.tool.type !== h.tool) return false;
  const mat = TOOL_MATERIALS[item.tool.material];
  return mat ? mat.harvest >= h.level : false;
}

// Velocidade base da ferramenta contra o bloco (ItemTool/ItemSword/ItemShears.getStrVsBlock)
const SWORD_PLANTS = new Set([18, 161, 86, 103, 106, 31, 175]);
function toolSpeed(blockId, tool) {
  if (!tool) return 1;
  const item = ITEMS[tool.id];
  if (!item) return 1;
  if (tool.id === 359) return blockId === 30 || blockId === 18 || blockId === 161 || blockId === 106 ? 15 : blockId === 35 ? 5 : 1;
  if (item.weapon && !item.tool) return blockId === 30 ? 15 : SWORD_PLANTS.has(blockId) ? 1.5 : 1;
  const h = HARVEST[blockId];
  if (item.tool && h && item.tool.type === h.tool) return TOOL_MATERIALS[item.tool.material].speed;
  return 1;
}

// Calcula o tempo de quebra em ticks (1.8.9 exato)
export function getMiningTime(blockId, tool, effects = [], inWater = false, onGround = true) {
  const block = getBlock(blockId);
  if (!block || block.hardness < 0) return Infinity; // inquebrável
  if (block.hardness === 0) return 0; // instantâneo (flores, tochas)

  const canDrop = canHarvest(blockId, tool);

  // 1. Velocidade da ferramenta
  const speed0 = toolSpeed(blockId, tool);
  let speed = speed0;

  // 2. Eficiência (encantamento) — simplificado: não implementado ainda
  // speed += efficiency^2 + 1 (se a ferramenta é adequada)

  // 3. Pressa / Fadiga
  const haste = getAmplifier({ effects }, Effect.HASTE);
  if (haste >= 0) speed *= (1 + 0.2 * (haste + 1));
  const fatigue = getAmplifier({ effects }, Effect.MINING_FATIGUE);
  if (fatigue >= 0) speed *= Math.pow(0.3, fatigue + 1);

  // 4. Debaixo d'água sem afinidade: ÷5
  if (inWater) speed /= 5;

  // 5. Sem estar no chão: ÷5
  if (!onGround) speed /= 5;

  // 6. Progresso por tick
  const divisor = canDrop ? 30 : 100;
  const progressPerTick = speed / block.hardness / divisor;

  if (progressPerTick <= 0) return Infinity;
  return Math.ceil(1 / progressPerTick);
}

// Calcula drops de um bloco
export function getDrops(blockId, tool, meta = 0) {
  const blk = getBlock(blockId);
  // Lajes: a simples dropa 1 do mesmo tipo; a dupla dropa 2 (a meta guarda o tipo, o bit 8 é só a metade)
  if (blk && (blk.model === 'slab' || blk.singleId)) {
    if (!canHarvest(blockId, tool)) return [];
    return [{ id: blk.singleId || blockId, count: blk.singleId ? 2 : 1, meta: meta & 7 }];
  }
  const dropFn = DROP_TABLE[blockId];
  if (dropFn) return dropFn(tool);
  // Drop padrão: o próprio bloco (se puder colher)
  if (canHarvest(blockId, tool)) {
    const block = getBlock(blockId);
    if (block && block.drop !== null && block.drop !== undefined) {
      return [{ id: block.drop, count: 1 }];
    }
    return [{ id: blockId, count: 1 }];
  }
  return [];
}

// Dano à ferramenta por quebrar bloco
export function getToolDamage(blockId, tool) {
  const block = getBlock(blockId);
  if (!block || block.hardness === 0) return 0; // blocos de dureza 0 não gastam
  if (!tool) return 0;
  const item = ITEMS[tool.id];
  if (!item) return 0;
  if (item.weapon && !item.tool) return 2; // espadas gastam 2
  return 1; // ferramentas gastam 1
}

// Verifica se a ferramenta quebrou (durabilidade chegou a 0)
export function isToolBroken(tool) {
  if (!tool) return false;
  const item = ITEMS[tool.id];
  if (!item || !item.durability) return false;
  return (tool.data?.durability || 0) >= item.durability;
}

// Aplica dano à ferramenta
export function damageTool(tool, amount = 1) {
  if (!tool) return tool;
  const item = ITEMS[tool.id];
  if (!item || !item.durability) return tool;
  if (!tool.data) tool.data = {};
  tool.data.durability = (tool.data.durability || 0) + amount;
  return tool;
}

// Calcula durabilidade restante (0-1)
export function getDurabilityRatio(tool) {
  if (!tool) return 1;
  const item = ITEMS[tool.id];
  if (!item || !item.durability) return 1;
  return 1 - (tool.data?.durability || 0) / item.durability;
}