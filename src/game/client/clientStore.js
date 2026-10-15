// Estado dos módulos do Mind Client: ligado/desligado e ajustes de cada módulo, salvo no localStorage deste navegador.
import { useSyncExternalStore } from 'react';
import { MODULES, MODULE_BY_ID } from './modules';

const KEY = 'mc.client.v1';
const listeners = new Set();
let version = 0;

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && typeof v === 'object') return v;
  } catch { /* sem localStorage ou valor corrompido */ }
  return {};
}
let state = load();
const ZERO = { x: 0, y: 0 };

function commit() {
  version++;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sem localStorage */ }
  for (const fn of listeners) fn();
}

// Cor de recorte do arco-íris do Hit Color: 256 cores calculadas uma vez (matiz de 0 a 360), sem conta por quadro
const RGB_LUT = (() => {
  const t = new Array(256);
  for (let i = 0; i < 256; i++) {
    const h = (i / 256) * 6, f = h - Math.floor(h), q = 1 - f;
    const [r, g, b] = [[1, f, 0], [q, 1, 0], [0, 1, f], [0, q, 1], [f, 0, 1], [1, 0, q]][Math.floor(h) % 6];
    t[i] = [r, g, b];
  }
  return t;
})();

// Modo de edição do HUD: não é salvo (sempre abre desligado). As posições dos widgets ficam em state.__layout como deslocamento
// em fração da janela ({ x, y }), somado à posição padrão de cada widget: funciona em qualquer tamanho de tela.
let editing = false;
function notify() { version++; for (const fn of listeners) fn(); }

export const clientStore = {
  isEditing() { return editing; },
  setEditing(on) { if (editing !== !!on) { editing = !!on; notify(); } },
  getPos(id) { return state.__layout?.[id] || ZERO; },
  setPos(id, x, y) { state = { ...state, __layout: { ...state.__layout, [id]: { x, y } } }; commit(); },
  resetLayout() { const { __layout, ...rest } = state; state = rest; commit(); },

  isOn(id) {
    const m = MODULE_BY_ID[id];
    if (!m || m.kind === 'soon') return false;
    const s = state[id];
    return s && typeof s.on === 'boolean' ? s.on : !!m.defaultOn;
  },
  setOn(id, on) {
    const m = MODULE_BY_ID[id];
    if (!m || m.kind === 'soon') return;
    state = { ...state, [id]: { ...state[id], on: !!on } };
    commit();
  },
  toggle(id) { this.setOn(id, !this.isOn(id)); },
  get(id, key) {
    const def = MODULE_BY_ID[id]?.settings?.find((s) => s.key === key)?.def;
    const v = state[id]?.[key];
    return v === undefined ? def : v;
  },
  set(id, key, value) {
    state = { ...state, [id]: { ...state[id], [key]: value } };
    commit();
  },
  reset() { state = {}; commit(); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  version() { return version; },

  // multiplicador de partículas (0 com o módulo desligado)
  particleScale() { return this.isOn('particles') ? this.get('particles', 'amount') / 100 : 0; },

  // cor do flash de dano: [r, g, b] de 0 a 1 e a mistura (0 a 1) com a textura
  hitFlash(timeMs) {
    const mix = this.get('hitcolor', 'intensity') / 100;
    const mode = this.get('hitcolor', 'mode');
    if (mode === 'rgb') return { rgb: RGB_LUT[Math.floor(timeMs / 8) & 255], mix };
    if (mode === 'custom') {
      const h = String(this.get('hitcolor', 'color') || '#ff3030').replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0'), 16) || 0;
      return { rgb: [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255], mix };
    }
    return { rgb: [1, 0, 0], mix };
  },
};

export function useClientStore() {
  return useSyncExternalStore(clientStore.subscribe, clientStore.version);
}

export { MODULES };
