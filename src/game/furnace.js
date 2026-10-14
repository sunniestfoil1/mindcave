// Fornalha: combustíveis, receitas de fundição, tick — PRD 06 RF-040..042

// Combustíveis: itemId → ticks de queima
export const FUELS = {
  327: 20000,    // balde de lava
  173: 16000,    // bloco de carvão
  369: 2400,     // vara de blaze
  263: 1600,     // carvão
  5: 300,        // tábuas
  17: 300,       // tronco
  162: 300,      // tronco2
  47: 300,       // estante
  58: 300,       // bancada
  54: 300,       // baú
  280: 100,      // graveto
  // Laje de madeira: 150 (não temos ID separado)
};

export function getFuelTime(itemId) {
  return FUELS[itemId] || 0;
}

export function isFuel(itemId) {
  return getFuelTime(itemId) > 0;
}

// Receitas de fundição: inputId → { outputId, xp }
export const SMELTING = {
  15: { out: 265, xp: 0.7 },      // minério de ferro → lingote
  14: { out: 266, xp: 1.0 },      // minério de ouro → lingote
  12: { out: 20, xp: 0.1 },       // areia → vidro
  4: { out: 1, xp: 0.1 },         // pedregulho → pedra
  337: { out: 336, xp: 0.3 },     // bola de argila → tijolo
  82: { out: 159, xp: 0.35 },     // bloco de argila → argila endurecida
  17: { out: 263, xp: 0.15, meta: 1 }, // tronco → carvão vegetal (meta 1)
  162: { out: 263, xp: 0.15, meta: 1 }, // tronco2 → carvão vegetal
  81: { out: 351, xp: 1.0, meta: 2 },   // cacto (ID 81) → corante verde
  363: { out: 364, xp: 0.35 },    // carne crua → bife
  319: { out: 320, xp: 0.35 },    // costeleta crua → assada
  365: { out: 366, xp: 0.35 },    // frango cru → assado
  423: { out: 424, xp: 0.35 },    // carneiro cru → assado
  411: { out: 412, xp: 0.35 },    // coelho cru → assado
  392: { out: 393, xp: 0.35 },    // batata → assada
  349: { out: 350, xp: 0.35 },    // peixe cru → assado
  56: { out: 264, xp: 1.0 },      // minério de diamante → diamante
  129: { out: 388, xp: 1.0 },     // minério de esmeralda → esmeralda
  21: { out: 351, xp: 0.2, meta: 4 }, // lápis → lápis (corante)
  73: { out: 331, xp: 0.7 },      // redstone → redstone
  16: { out: 263, xp: 0.1 },      // minério de carvão → carvão
  98: { out: 98, xp: 0.1 },       // tijolos de pedra → rachado (meta diferente, simplificado)
  87: { out: 112, xp: 0.1 },      // netherrack → tijolo do nether
};

export function getSmeltingResult(itemId) {
  return SMELTING[itemId] || null;
}

// Estado da fornalha
export function createFurnaceState() {
  return {
    input: null,    // { id, count, meta }
    fuel: null,     // { id, count, meta }
    output: null,   // { id, count, meta }
    burnTime: 0,    // ticks restantes do combustível atual
    cookTime: 0,    // progresso de fundição (0-200)
    totalBurn: 0,   // tempo total do combustível atual (para a barra)
  };
}

// Tick da fornalha — chamar a cada tick do mundo
export function tickFurnace(state) {
  let changed = false;

  // Se não está queimando e tem combustível, consome um
  if (state.burnTime <= 0 && state.fuel && state.input) {
    const result = getSmeltingResult(state.input.id);
    if (result && (!state.output || (state.output.id === result.out && state.output.count < 64))) {
      state.burnTime = getFuelTime(state.fuel.id);
      state.totalBurn = state.burnTime;
      state.fuel.count--;
      if (state.fuel.count <= 0) {
        // Balde de lava vira balde vazio
        if (state.fuel.id === 327) state.fuel = { id: 325, count: 1, meta: 0 };
        else state.fuel = null;
      }
      changed = true;
    }
  }

  // Se está queimando e tem entrada válida
  if (state.burnTime > 0 && state.input) {
    const result = getSmeltingResult(state.input.id);
    if (result && (!state.output || (state.output.id === result.out && state.output.count < 64))) {
      state.cookTime++;
      state.burnTime--;
      changed = true;
      if (state.cookTime >= 200) {
        // Funde!
        if (!state.output) state.output = { id: result.out, count: 1, meta: result.meta || 0 };
        else state.output.count++;
        state.input.count--;
        if (state.input.count <= 0) state.input = null;
        state.cookTime = 0;
      }
    } else {
      state.cookTime = 0;
    }
  } else if (state.burnTime > 0) {
    state.burnTime--;
    changed = true;
  }

  return changed;
}

export function isFurnaceActive(state) {
  return state.burnTime > 0;
}