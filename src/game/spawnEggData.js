// Ovos de spawn (item 383): a meta é o id da entidade do 1.8.9 (EntityList), as duas cores são as do registro oficial (primária = casca, secundária = pintas).
// Só entram os mobs que o jogo tem; o ovo de um mob novo é uma linha aqui.
export const SPAWN_EGGS = {
  50: { mob: 'creeper', namePt: 'Creeper', c1: 894731, c2: 0 },
  51: { mob: 'skeleton', namePt: 'Esqueleto', c1: 12698049, c2: 4802889 },
  52: { mob: 'spider', namePt: 'Aranha', c1: 3419431, c2: 11013646 },
  54: { mob: 'zombie', namePt: 'Zumbi', c1: 44975, c2: 7969893 },
  55: { mob: 'slime', namePt: 'Slime', c1: 5349438, c2: 8306542 },
  57: { mob: 'zombie_pigman', namePt: 'Porco-Zumbi', c1: 15373203, c2: 5009705 },
  58: { mob: 'enderman', namePt: 'Enderman', c1: 1447446, c2: 0 },
  65: { mob: 'bat', namePt: 'Morcego', c1: 4996656, c2: 986895 },
  66: { mob: 'witch', namePt: 'Bruxa', c1: 3407872, c2: 5349438 },
  90: { mob: 'pig', namePt: 'Porco', c1: 15771042, c2: 14377823 },
  91: { mob: 'sheep', namePt: 'Ovelha', c1: 15198183, c2: 16758197 },
  92: { mob: 'cow', namePt: 'Vaca', c1: 4470310, c2: 10592673 },
  93: { mob: 'chicken', namePt: 'Galinha', c1: 10592673, c2: 16711680 },
  95: { mob: 'wolf', namePt: 'Lobo', c1: 14144467, c2: 13545366 },
};

// variantNames esparso (índice = meta): o catálogo do criativo percorre só os índices que existem
export const SPAWN_EGG_NAMES = [];
for (const [meta, e] of Object.entries(SPAWN_EGGS)) SPAWN_EGG_NAMES[meta] = 'Ovo de ' + e.namePt;
