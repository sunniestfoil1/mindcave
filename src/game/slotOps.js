// Operações de slot no estilo do Container.slotClick do 1.8.9: clique esquerdo/direito, shift-click, duplo clique (junta tudo) e arrastar para
// distribuir. Cada slot é uma "ref" { get, set, group, armorSlot?, output?, afterTake?, accepts? } — a interface não conhece arrays.
import { canStack, mergeStacks } from './inventory';
import { getMaxStack, ITEMS } from './items';

export const arrRef = (arr, i, extra = {}) => ({ get: () => arr[i], set: (v) => { arr[i] = v; }, arr, index: i, ...extra });
export const objRef = (obj, key, extra = {}) => ({ get: () => obj[key], set: (v) => { obj[key] = v; }, arr: obj, index: key, ...extra });

// Slot de armadura só aceita a peça do seu tipo (ninguém usa os 4 slots de armadura como depósito)
export function accepts(r, item) {
  if (!item) return true;
  if (r.output) return false;
  if (r.armorSlot !== undefined) { const d = ITEMS[item.id]; return !!(d && d.armor && d.armor.slot === r.armorSlot); }
  return r.accepts ? !!r.accepts(item) : true;
}

const clone = (s) => ({ ...s });

// Slot de saída (resultado da bancada, saída da fornalha): só retira
function clickOutput(inv, r) {
  const it = r.get();
  if (!it) return false;
  if (!inv.cursor) { inv.cursor = clone(it); r.set(null); r.afterTake?.(it); return true; }
  if (canStack(inv.cursor, it) && inv.cursor.count + it.count <= getMaxStack(it.id)) {
    inv.cursor.count += it.count; r.set(null); r.afterTake?.(it); return true;
  }
  return false;
}

export function leftClick(inv, r) {
  if (r.output) return clickOutput(inv, r);
  const slot = r.get();
  if (!inv.cursor) { if (slot) { inv.cursor = slot; r.set(null); } return true; }
  if (!accepts(r, inv.cursor)) return false;
  if (!slot) { r.set(inv.cursor); inv.cursor = null; return true; }
  if (canStack(slot, inv.cursor)) { inv.cursor = mergeStacks(slot, inv.cursor); return true; }
  r.set(inv.cursor); inv.cursor = slot; return true;
}

export function rightClick(inv, r) {
  if (r.output) return clickOutput(inv, r);
  const slot = r.get();
  if (!inv.cursor) {
    if (!slot) return false;
    const half = Math.ceil(slot.count / 2);
    inv.cursor = { ...slot, count: half };
    slot.count -= half;
    r.set(slot.count > 0 ? slot : null);
    return true;
  }
  if (!accepts(r, inv.cursor)) return false;
  if (!slot) {
    r.set({ ...inv.cursor, count: 1 });
    inv.cursor.count--; if (inv.cursor.count <= 0) inv.cursor = null;
    return true;
  }
  if (canStack(slot, inv.cursor) && slot.count < getMaxStack(slot.id)) {
    slot.count++; inv.cursor.count--; if (inv.cursor.count <= 0) inv.cursor = null;
    return true;
  }
  return false;
}

// Empilha `item` nos slots (primeiro nos que já têm o mesmo item, depois nos vazios). Devolve a sobra (ou null). Muta item.
export function mergeInto(refs, item) {
  for (const r of refs) {
    const s = r.get();
    if (s && canStack(s, item) && accepts(r, item)) { item = mergeStacks(s, item); if (!item) return null; }
  }
  for (const r of refs) {
    if (!r.get() && accepts(r, item)) { r.set(item); return null; }
  }
  return item;
}

function canFit(refs, item) {
  let remaining = item.count; const max = getMaxStack(item.id);
  for (const r of refs) { const s = r.get(); if (s && canStack(s, item) && accepts(r, item)) remaining -= Math.min(max - s.count, remaining); if (remaining <= 0) return true; }
  for (const r of refs) { if (!r.get() && accepts(r, item)) remaining -= Math.min(max, remaining); if (remaining <= 0) return true; }
  return remaining <= 0;
}

// Shift-click: leva o item de r para os destinos (hotbar primeiro, depois o inventário de cima — a ordem vem de `targets`).
// Resultado de fabricação: fabrica enquanto couber (como na 1.8.9). `equip`: slot de armadura livre para peças de armadura.
export function shiftMove(inv, r, targets, equip = null) {
  if (r.output) {
    let moved = false;
    for (let guard = 0; guard < 64; guard++) {
      const it = r.get();
      if (!it || !canFit(targets, it)) break;
      const copy = clone(it);
      if (mergeInto(targets, copy)) break;
      r.set(null); r.afterTake?.(it); moved = true;
      if (!r.repeatable) break; // fornalha: só tira a pilha; bancada: repete enquanto a receita seguir valendo
    }
    return moved;
  }
  const item = r.get();
  if (!item) return false;
  if (equip && r.armorSlot === undefined) {
    const d = ITEMS[item.id];
    const er = d && d.armor ? equip(d.armor.slot) : null;
    if (er && !er.get()) { er.set({ ...item, count: 1 }); item.count--; r.set(item.count > 0 ? item : null); return true; }
  }
  const before = item.count;
  const left = mergeInto(targets, item);
  r.set(left);
  return !left || left.count !== before;
}

// Duplo clique: com um item no cursor, junta no cursor tudo do mesmo tipo (pilhas incompletas primeiro)
export function collectAll(inv, refs) {
  const c = inv.cursor;
  if (!c) return false;
  const max = getMaxStack(c.id);
  for (let pass = 0; pass < 2 && c.count < max; pass++) {
    for (const r of refs) {
      if (r.output || r.armorSlot !== undefined) continue;
      const s = r.get();
      if (!s || !canStack(s, c)) continue;
      if (pass === 0 && s.count >= max) continue;
      const take = Math.min(s.count, max - c.count);
      c.count += take; s.count -= take;
      if (s.count <= 0) r.set(null);
      if (c.count >= max) break;
    }
  }
  return true;
}

// Arrastar com o botão pressionado sobre vários slots: esquerdo divide igualmente, direito põe 1 em cada
export function applyDrag(inv, refs, button) {
  const c = inv.cursor;
  if (!c || refs.length < 2) return false;
  const max = getMaxStack(c.id);
  const ok = refs.filter((r) => { const s = r.get(); return accepts(r, c) && (!s || canStack(s, c)); });
  if (ok.length < 2) return false;
  const per = button === 2 ? 1 : Math.max(1, Math.floor(c.count / ok.length));
  for (const r of ok) {
    if (c.count <= 0) break;
    const s = r.get();
    const have = s ? s.count : 0;
    const add = Math.min(per, max - have, c.count);
    if (add <= 0) continue;
    if (s) s.count += add; else r.set({ ...c, count: add });
    c.count -= add;
  }
  if (c.count <= 0) inv.cursor = null;
  return true;
}

// Clique fora da janela com algo no cursor (1.8.9): o botão esquerdo joga a pilha inteira, o direito joga 1. Devolve true se jogou algo.
export function dropCursorOutside(inv, button) {
  const c = inv.cursor;
  if (!c || !c.id) return false;
  const n = button === 2 ? 1 : (c.count || 1);
  inv.dropOut?.({ id: c.id, count: n, meta: c.meta || 0 });
  const left = (c.count || 1) - n;
  inv.cursor = left > 0 ? { ...c, count: left } : null;
  return true;
}
