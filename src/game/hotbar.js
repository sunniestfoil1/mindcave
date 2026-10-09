// Hotbar padrão + cores para a HUD (PRD 01 RF-070 + PRD 02). Registro de itens virá no PRD 06.
export const CREATIVE_DEFAULT_HOTBAR = [
  { id: 2, meta: 0 }, { id: 3, meta: 0 }, { id: 1, meta: 0 }, { id: 4, meta: 0 },
  { id: 5, meta: 0 }, { id: 17, meta: 0 }, { id: 18, meta: 0 }, { id: 50, meta: 0 }, { id: 89, meta: 0 },
];

export const DEFAULT_HOTBAR = Array(9).fill(null);

const BLOCK_COLOR = {
  0: 0x000000, 1: 0x7f7f7f, 2: 0x669c3c, 3: 0x866043, 4: 0x8a8a8a, 5: 0xa0824b, 7: 0x555555,
  8: 0x3a64c8, 9: 0x3a64c8, 10: 0xe04020, 11: 0xe04020, 12: 0xdbcfa3, 13: 0x787470, 14: 0xd8b430,
  15: 0xbec3b0, 16: 0x7f7f7f, 17: 0x96733c, 18: 0x3c822b, 19: 0xc8c850, 20: 0xcfe6e8,
  21: 0x2840b8, 22: 0x2840b8, 24: 0xdbcfa3, 30: 0xc0c0c0, 31: 0x509630, 35: 0xdddddd,
  37: 0xf0dc3c, 38: 0xd43232, 39: 0x966e46, 40: 0xc83232, 41: 0xdcb430, 42: 0xdcdcdc,
  45: 0x964637, 46: 0xb42820, 47: 0xa0824b, 48: 0x7a8070, 49: 0x1e1428, 50: 0xffd040,
  56: 0x64e6e6, 57: 0x64e6e6, 58: 0x8a6b40, 61: 0x646464, 73: 0xc82020, 78: 0xf0f8ff,
  79: 0xaac8e0, 80: 0xf0f8ff, 82: 0x9aa0a8, 87: 0x783232, 88: 0x64403c, 89: 0xdcb430,
  95: 0xcfe6e8, 98: 0x787878, 110: 0x6a6470, 112: 0x3c1e1e, 121: 0xdcd5a0, 129: 0x28c850,
  133: 0x28c850, 152: 0xc82020, 155: 0xebe8e0, 159: 0x9a7350, 165: 0x78c860, 168: 0x508c80,
  169: 0xb4e6dc, 170: 0xc8b440, 171: 0xdddddd, 173: 0x1e1e1e,
};

export function blockColor(id) {
  return '#' + (BLOCK_COLOR[id] ?? 0x888888).toString(16).padStart(6, '0');
}

// Lista de blocos para o inventário criativo (CA-01)
export const CREATIVE_BLOCKS = [
  1, 2, 3, 4, 5, 7, 12, 13, 17, 18, 20, 24, 35, 41, 42, 45, 46, 47, 48, 49,
  50, 56, 57, 58, 61, 79, 80, 82, 87, 88, 89, 95, 98, 121, 129, 133, 152, 155,
  159, 165, 168, 169, 170, 173, 8, 9, 10, 11, 78, 31, 37, 38, 39, 40,
];