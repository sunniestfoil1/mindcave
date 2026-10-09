// Inventário: ItemStack, estado, regras de clique 1.8.9 — PRD 06 RF-010..014
import { getItem, getMaxStack, isArmor, ITEMS } from './items';

// Cria uma pilha de itens
export function stack(id, count = 1, meta = 0, data = null) {
  if (!id || count <= 0) return null;
  return { id, count, meta, data };
}

// Verifica se duas pilhas podem se empilhar
export function canStack(a, b) {
  if (!a || !b) return false;
  return a.id === b.id && a.meta === b.meta && JSON.stringify(a.data || null) === JSON.stringify(b.data || null);
}

// Mescla b em a o máximo possível; retorna sobra de b
export function mergeStacks(a, b) {
  if (!a || !b || !canStack(a, b)) return b;
  const max = getMaxStack(a.id);
  const space = max - a.count;
  if (space <= 0) return b;
  const toMove = Math.min(space, b.count);
  a.count += toMove;
  b.count -= toMove;
  return b.count > 0 ? b : null;
}

// Cria inventário do jogador
export function createInventory() {
  return {
    main: new Array(27).fill(null),
    hotbar: new Array(9).fill(null),
    armor: new Array(4).fill(null),
    crafting: new Array(4).fill(null), // 2x2
    craftResult: null,
    cursor: null,
  };
}

// Adiciona item ao inventário (main + hotbar); retorna sobra
export function addItem(inv, item) {
  if (!item) return null;
  const max = getMaxStack(item.id);
  // Tenta empilhar em slots existentes (main primeiro, depois hotbar)
  for (const arr of [inv.main, inv.hotbar]) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] && canStack(arr[i], item) && arr[i].count < max) {
        item = mergeStacks(arr[i], item);
        if (!item) return null;
      }
    }
  }
  // Tenta slots vazios
  for (const arr of [inv.main, inv.hotbar]) {
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i]) {
        arr[i] = item;
        return null;
      }
    }
  }
  return item; // sobra
}

// Remove count de um slot
export function takeFromSlot(arr, index, count = 1) {
  const slot = arr[index];
  if (!slot) return null;
  const taken = { ...slot, count: Math.min(count, slot.count) };
  slot.count -= taken.count;
  if (slot.count <= 0) arr[index] = null;
  return taken;
}

// === Regras de clique 1.8.9 ===

// Clique esquerdo: pega tudo / troca / coloca tudo
export function leftClick(inv, getSlot, setSlot) {
  const slot = getSlot();
  if (!inv.cursor) {
    // Pega a pilha inteira
    if (slot) { inv.cursor = slot; setSlot(null); }
  } else {
    if (!slot) {
      setSlot(inv.cursor); inv.cursor = null;
    } else if (canStack(slot, inv.cursor)) {
      inv.cursor = mergeStacks(slot, inv.cursor);
    } else {
      // Troca
      setSlot(inv.cursor); inv.cursor = slot;
    }
  }
}

// Clique direito: pega metade / coloca 1
export function rightClick(inv, getSlot, setSlot) {
  const slot = getSlot();
  if (!inv.cursor) {
    if (!slot) return;
    const half = Math.ceil(slot.count / 2);
    inv.cursor = { ...slot, count: half };
    slot.count -= half;
    setSlot(slot.count > 0 ? slot : null);
  } else {
    if (!slot) {
      setSlot({ ...inv.cursor, count: 1 });
      inv.cursor.count--;
      if (inv.cursor.count <= 0) inv.cursor = null;
    } else if (canStack(slot, inv.cursor)) {
      const max = getMaxStack(slot.id);
      if (slot.count < max) {
        slot.count++;
        inv.cursor.count--;
        if (inv.cursor.count <= 0) inv.cursor = null;
      }
    }
  }
}

// Shift+clique: move entre seções
export function shiftClick(inv, section, index) {
  let from, to, isArmorSlot = false;
  if (section === 'main') { from = inv.main; to = inv.hotbar; }
  else if (section === 'hotbar') { from = inv.hotbar; to = inv.main; }
  else if (section === 'armor') {
    // Armadura fica (não move)
    return;
  } else if (section === 'crafting') {
    // Resultado de crafting: cria o máximo possível
    if (index === 'result' && inv.craftResult) {
      while (inv.craftResult) {
        const leftover = addItem(inv, { ...inv.craftResult });
        if (leftover) break;
        // Re-consome ingredientes e recalcula (chamador faz isso)
        break;
      }
    }
    return;
  } else return;

  const item = from[index];
  if (!item) return;
  // Se é armadura, move para o slot correto
  const armorItem = isArmor(item.id);
  if (armorItem) {
    const slot = ITEMS[item.id].armor.slot;
    if (!inv.armor[slot]) {
      inv.armor[slot] = item;
      from[index] = null;
      return;
    }
  }
  // Move para a outra seção
  for (let i = 0; i < to.length; i++) {
    if (!to[i]) { to[i] = item; from[index] = null; return; }
    if (canStack(to[i], item)) {
      const leftover = mergeStacks(to[i], item);
      if (!leftover) { from[index] = null; return; }
      from[index] = leftover;
    }
  }
}

// Serialização
export function serializeInventory(inv) {
  if (!inv) return '{}';
  const s = (arr) => (arr || []).map(item => item ? { id: item.id, count: item.count, meta: item.meta || 0 } : null);
  return JSON.stringify({
    main: s(inv.main), hotbar: s(inv.hotbar), armor: s(inv.armor),
  });
}

export function deserializeInventory(inv, data) {
  if (!data) return;
  try {
    const d = typeof data === 'string' ? JSON.parse(data) : data;
    if (d.main) inv.main = d.main.map(item => item ? { ...item, data: null } : null);
    if (d.hotbar) inv.hotbar = d.hotbar.map(item => item ? { ...item, data: null } : null);
    if (d.armor) inv.armor = d.armor.map(item => item ? { ...item, data: null } : null);
  } catch (e) {}
}

// Conta total de itens de um ID no inventário
export function countItems(inv, id) {
  let count = 0;
  for (const arr of [inv.main, inv.hotbar]) {
    for (const slot of arr) {
      if (slot && slot.id === id) count += slot.count;
    }
  }
  return count;
}

// Remove n itens de um ID do inventário
export function removeItems(inv, id, n) {
  let remaining = n;
  for (const arr of [inv.main, inv.hotbar]) {
    for (let i = 0; i < arr.length; i++) {
      if (remaining <= 0) return true;
      if (arr[i] && arr[i].id === id) {
        const take = Math.min(remaining, arr[i].count);
        arr[i].count -= take;
        remaining -= take;
        if (arr[i].count <= 0) arr[i] = null;
      }
    }
  }
  return remaining <= 0;
}

// Verifica se o inventário tem n itens de um ID
export function hasItems(inv, id, n) {
  return countItems(inv, id) >= n;
}