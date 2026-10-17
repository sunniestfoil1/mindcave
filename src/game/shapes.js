// Formas dos blocos que não são cubo cheio: lajes e escadas (1.8.9).
// Uma única fonte de caixas para colisão (physics), malha (mesher), mira/contorno e ícones.
//
// Laje (ids 44/126/182): meta & 7 = tipo, meta & 8 = metade de cima. A laje dupla (43/125/181) é cubo comum.
// Escada: meta & 3 = direção em que sobe (0 leste +x, 1 oeste −x, 2 sul +z, 3 norte −z), meta & 4 = de cabeça para baixo.
// A forma da escada (reta, canto interno, canto externo) depende das escadas vizinhas, como em BlockStairs.getStairsShape.
import { BLOCKS } from './blocks';
import { WALL_META_DIR, DIR_WALL_META } from './blocksMore';

const FULL = [0, 0, 0, 1, 1, 1];

// direção 0..3 → vetor (x, z)
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const dirIndex = (dx, dz) => DIRS.findIndex(d => d[0] === dx && d[1] === dz);
// anti-horário visto de cima: N → O → S → L → N, em (x, z): (x, z) → (z, −x)
const ccw = (d) => dirIndex(DIRS[d][1], -DIRS[d][0]);
const cw = (d) => dirIndex(-DIRS[d][1], DIRS[d][0]);
const opposite = (d) => dirIndex(-DIRS[d][0], -DIRS[d][1]);

export function isSlabBlock(block) { return !!block && block.model === 'slab'; }
export function isStairsBlock(block) { return !!block && block.model === 'stairs'; }
export const BED_HEIGHT = 0.5625; // 9/16
const SHAPED_MODELS = new Set(['slab', 'stairs', 'bed', 'door', 'fence', 'gate', 'chest', 'ladder', 'trapdoor', 'multi', 'skull']);
export const RAIL_IDS = new Set([27, 28, 66, 157]);
export function hasShape(block) { return !!block && SHAPED_MODELS.has(block.model); }

const stateIdOf = (s) => (s >> 4) & 0xfff;
const stateMetaOf = (s) => s & 0xf;

function stairInfo(state) {
  if (!state) return null;
  const b = BLOCKS[stateIdOf(state)];
  if (!isStairsBlock(b)) return null;
  const m = stateMetaOf(state);
  return { facing: m & 3, flipped: (m & 4) !== 0 };
}

// Forma da escada em (x, y, z): 'straight' | 'inner_left' | 'inner_right' | 'outer_left' | 'outer_right'
export function stairShape(getState, x, y, z) {
  const me = stairInfo(getState(x, y, z));
  if (!me) return 'straight';
  const f = me.facing;
  const neighbor = (d) => stairInfo(getState(x + DIRS[d][0], y, z + DIRS[d][1]));
  const canTake = (d) => {
    const n = neighbor(d);
    return !n || n.facing !== me.facing || n.flipped !== me.flipped;
  };
  const front = neighbor(f);
  if (front && front.flipped === me.flipped && (front.facing >> 1) !== (f >> 1) && canTake(opposite(front.facing))) {
    return front.facing === ccw(f) ? 'outer_left' : 'outer_right';
  }
  const back = neighbor(opposite(f));
  if (back && back.flipped === me.flipped && (back.facing >> 1) !== (f >> 1) && canTake(back.facing)) {
    return back.facing === ccw(f) ? 'inner_left' : 'inner_right';
  }
  return 'straight';
}

// metade voltada para a direção d (0..3)
function halfBox(d, y0, y1) {
  const [dx, dz] = DIRS[d];
  const x0 = dx > 0 ? 0.5 : 0, x1 = dx < 0 ? 0.5 : 1;
  const z0 = dz > 0 ? 0.5 : 0, z1 = dz < 0 ? 0.5 : 1;
  return [x0, y0, z0, x1, y1, z1];
}
// quarto no canto entre as direções a e b (perpendiculares)
function quarterBox(a, b, y0, y1) {
  const dx = DIRS[a][0] + DIRS[b][0], dz = DIRS[a][1] + DIRS[b][1];
  return [dx > 0 ? 0.5 : 0, y0, dz > 0 ? 0.5 : 0, dx < 0 ? 0.5 : 1, y1, dz < 0 ? 0.5 : 1];
}

// Caixas da escada: base (meia laje) + degrau em cima (ou embaixo, se invertida)
export function stairBoxes(meta, shape = 'straight') {
  const f = meta & 3, flipped = (meta & 4) !== 0;
  const base = flipped ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
  const y0 = flipped ? 0 : 0.5, y1 = flipped ? 0.5 : 1;
  const boxes = [base];
  switch (shape) {
    case 'outer_left': boxes.push(quarterBox(f, ccw(f), y0, y1)); break;
    case 'outer_right': boxes.push(quarterBox(f, cw(f), y0, y1)); break;
    case 'inner_left': boxes.push(halfBox(f, y0, y1), quarterBox(opposite(f), ccw(f), y0, y1)); break;
    case 'inner_right': boxes.push(halfBox(f, y0, y1), quarterBox(opposite(f), cw(f), y0, y1)); break;
    default: boxes.push(halfBox(f, y0, y1));
  }
  return boxes;
}

// Cama (1.8.9): meta & 3 = direção do pé para a cabeceira (0 sul +z, 1 oeste −x, 2 norte −z, 3 leste +x); meta & 8 = metade da cabeça.
export const BED_DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];
export function bedPartner(x, z, meta) {
  const [dx, dz] = BED_DIRS[meta & 3];
  return (meta & 8) ? { x: x - dx, z: z - dz } : { x: x + dx, z: z + dz };
}

export function slabBox(meta) {
  return (meta & 8) ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
}

// === Portas, cercas e portões (1.8.9) ===
// Porta: 2 blocos. Metade de baixo: meta & 3 = direção do olhar de quem a colocou (0 oeste, 1 norte, 2 leste, 3 sul), meta & 4 = aberta.
// Metade de cima: meta & 8, meta & 1 = dobradiça à direita. A placa fecha no lado perto de quem colocou (oposto ao olhar) e, aberta,
// gira para a parede do lado da dobradiça. O estado (aberta/fechada) vive só na metade de baixo; a de cima lê dela.
export const DOOR_FACES = [[-1, 0], [0, -1], [1, 0], [0, 1]];
export const DOOR_T = 3 / 16;
const dcw = (v) => [-v[1], v[0]];  // horário visto de cima
const dccw = (v) => [v[1], -v[0]]; // anti-horário

export function isDoorBlock(b) { return !!b && b.model === 'door'; }

// Estado completo da porta a partir de qualquer uma das metades
export function doorInfo(state, getState, x, y, z) {
  const upper = (stateMetaOf(state) & 8) !== 0;
  const lowerState = upper ? getState(x, y - 1, z) : state;
  const upperState = upper ? state : getState(x, y + 1, z);
  const lm = isDoorBlock(BLOCKS[stateIdOf(lowerState)]) ? stateMetaOf(lowerState) : 0;
  const um = isDoorBlock(BLOCKS[stateIdOf(upperState)]) ? stateMetaOf(upperState) : 0;
  return { upper, facing: lm & 3, open: (lm & 4) !== 0, hingeRight: (um & 1) !== 0 };
}

export function doorBoxes(info) {
  const F = DOOR_FACES[info.facing];
  const wall = info.open ? (info.hingeRight ? dcw(F) : dccw(F)) : [-F[0], -F[1]];
  const [wx, wz] = wall;
  const xr = wx < 0 ? [0, DOOR_T] : wx > 0 ? [1 - DOOR_T, 1] : [0, 1];
  const zr = wz < 0 ? [0, DOOR_T] : wz > 0 ? [1 - DOOR_T, 1] : [0, 1];
  return [[xr[0], 0, zr[0], xr[1], 1, zr[1]]];
}

// Cerca: conecta com cercas da mesma família, portões de lado e blocos cheios opacos (BlockFence.canConnectTo)
export function isFenceBlock(b) { return !!b && b.model === 'fence'; }
// todas as cercas de madeira (carvalho, pinheiro, bétula, selva, acácia, carvalho escuro) se conectam entre si; a do Nether só com ela mesma
export const WOOD_FENCES = new Set([85, 188, 189, 190, 191, 192]);
export const WOOD_GATES = new Set([107, 183, 184, 185, 186, 187]);
const sameFenceFamily = (a, b) => a === b || (WOOD_FENCES.has(a) && WOOD_FENCES.has(b));
function fenceConnects(fenceId, n) {
  const id = stateIdOf(n);
  if (id === 0) return false;
  const b = BLOCKS[id];
  if (!b) return false;
  if (b.model === 'fence') return sameFenceFamily(id, fenceId);
  if (b.model === 'gate') return WOOD_FENCES.has(fenceId);
  return !!(b.solid && b.opaque && b.model === 'cube');
}
// índices 0 oeste, 1 norte, 2 leste, 3 sul
export function fenceConnections(fenceId, getState, x, y, z) {
  return DOOR_FACES.map(([dx, dz], i) => {
    const n = getState(x + dx, y, z + dz);
    const nb = BLOCKS[stateIdOf(n)];
    if (nb && nb.model === 'gate') {
      const gf = DOOR_FACES[stateMetaOf(n) & 3];
      return WOOD_FENCES.has(fenceId) && (gf[0] !== 0) !== (dx !== 0); // portão de lado: o vão do portão tem de apontar para a cerca
    }
    return fenceConnects(fenceId, n);
  });
}

export function fenceBoxes(conn, kind) {
  const h = kind === 'collide' ? 1.5 : 1;
  const boxes = [[0.375, 0, 0.375, 0.625, h, 0.625]];
  const arm = (i, y0, y1, th) => {
    const a = 0.5 - th, b = 0.5 + th;
    return [[0, y0, a, 0.375, y1, b], [a, y0, 0, b, y1, 0.375], [0.625, y0, a, 1, y1, b], [a, y0, 0.625, b, y1, 1]][i];
  };
  conn.forEach((c, i) => {
    if (!c) return;
    if (kind === 'render') { boxes.push(arm(i, 0.375, 0.5625, 0.0625), arm(i, 0.75, 0.9375, 0.0625)); }
    else boxes.push(arm(i, 0, h, 0.125));
  });
  return boxes;
}

// Portão: meta & 3 = direção do olhar (como a porta); as barras correm perpendiculares a ela. meta & 4 = aberto.
export function gateBoxes(meta, kind) {
  const F = DOOR_FACES[meta & 3], open = (meta & 4) !== 0;
  const alongX = F[0] === 0; // barras ao longo de X quando o portão olha para norte/sul
  const mk = (a0, a1, y0, y1, t0, t1) => (alongX ? [a0, y0, t0, a1, y1, t1] : [t0, y0, a0, t1, y1, a1]);
  const posts = [mk(0, 0.125, 0.3125, 1, 0.375, 0.625), mk(0.875, 1, 0.3125, 1, 0.375, 0.625)];
  if (kind === 'collide') return open ? [] : [mk(0, 1, 0, 1.5, 0.375, 0.625)];
  if (kind === 'select') return open ? posts : [mk(0, 1, 0.3125, 1, 0.375, 0.625)];
  if (!open) return [...posts, mk(0.125, 0.875, 0.375, 0.5625, 0.4375, 0.5625), mk(0.125, 0.875, 0.75, 0.9375, 0.4375, 0.5625), mk(0.4375, 0.5625, 0.5625, 0.75, 0.4375, 0.5625)];
  // aberto: as barras giram 90° e ficam junto de cada poste, apontando para o lado do olhar
  const sx = F[0], sz = F[1]; // lado para onde abre
  const out = [...posts];
  for (const a of [0, 0.875]) {
    const lo = sx + sz > 0 ? 0.625 : 0, hi = sx + sz > 0 ? 1 : 0.375;
    out.push(alongX ? [a, 0.375, lo, a + 0.125, 0.5625, hi] : [lo, 0.375, a, hi, 0.5625, a + 0.125]);
    out.push(alongX ? [a, 0.75, lo, a + 0.125, 0.9375, hi] : [lo, 0.75, a, hi, 0.9375, a + 0.125]);
  }
  return out;
}

// === Baú, escada de mão e alçapão (1.8.9) === (direções na ordem de DOOR_FACES: 0 oeste, 1 norte, 2 leste, 3 sul)
// Baú: caixa de 14/16 com 1/16 de folga; meta = lado da frente (de frente para quem o colocou).
export const CHEST_BOX = [0.0625, 0, 0.0625, 0.9375, 0.875, 0.9375];
// Escada de mão: placa de 2/16 encostada na parede; meta = para onde a escada olha (oposto à parede).
export function ladderBox(meta) {
  const F = DOOR_FACES[meta & 3], T = 0.125;
  const xr = F[0] === 0 ? [0, 1] : F[0] > 0 ? [0, T] : [1 - T, 1];
  const zr = F[1] === 0 ? [0, 1] : F[1] > 0 ? [0, T] : [1 - T, 1];
  return [xr[0], 0, zr[0], xr[1], 1, zr[1]];
}
// Alçapão: meta & 3 = lado da dobradiça, & 4 = aberto, & 8 = metade de cima. Fechado é uma placa de 3/16 no chão ou no teto;
// aberto vira uma placa vertical na parede do lado da dobradiça.
export function trapdoorBox(meta) {
  const T = 3 / 16;
  if ((meta & 4) === 0) return (meta & 8) ? [0, 1 - T, 0, 1, 1, 1] : [0, 0, 0, 1, T, 1];
  const H = DOOR_FACES[meta & 3];
  const xr = H[0] === 0 ? [0, 1] : H[0] < 0 ? [0, T] : [1 - T, 1];
  const zr = H[1] === 0 ? [0, 1] : H[1] < 0 ? [0, T] : [1 - T, 1];
  return [xr[0], 0, zr[0], xr[1], 1, zr[1]];
}
export function isLadderBlock(b) { return !!b && b.model === 'ladder'; }


// === Trilhos (1.8.9) === a forma sai dos trilhos vizinhos (BlockRailBase): reta, curva (só o trilho comum) ou subida.
// Devolve { rot, rise, curve }: rot gira a textura (0 norte-sul, 1 leste-oeste; curvas: 0 NE, 1 SE, 2 SO, 3 NO); rise 1 sobe para leste, 2 oeste, 3 norte, 4 sul.
export function railShape(state, getState, x, y, z) {
  const id = stateIdOf(state);
  const at = (dx, dy, dz) => RAIL_IDS.has(stateIdOf(getState(x + dx, y + dy, z + dz)));
  const link = (dx, dz) => at(dx, 0, dz) || at(dx, 1, dz) || at(dx, -1, dz);
  const E = link(1, 0), W = link(-1, 0), N = link(0, -1), S = link(0, 1);
  if (id === 66) {
    if (S && E && !N && !W) return { rot: 1, rise: 0, curve: true };
    if (S && W && !N && !E) return { rot: 2, rise: 0, curve: true };
    if (N && W && !S && !E) return { rot: 3, rise: 0, curve: true };
    if (N && E && !S && !W) return { rot: 0, rise: 0, curve: true };
  }
  const alongX = (E || W) && !(N || S) ? true : (N || S) && !(E || W) ? false : (E && W) ? true : (N && S) ? false : (E || W);
  if (alongX) {
    if (at(1, 1, 0)) return { rot: 1, rise: 1, curve: false };
    if (at(-1, 1, 0)) return { rot: 1, rise: 2, curve: false };
    return { rot: 1, rise: 0, curve: false };
  }
  if (at(0, 1, -1)) return { rot: 0, rise: 3, curve: false };
  if (at(0, 1, 1)) return { rot: 0, rise: 4, curve: false };
  return { rot: 0, rise: 0, curve: false };
}

// Caixas do bloco em (x, y, z) no estado dado (relativas ao bloco). getState(x, y, z) devolve o estado do vizinho.
// kind: 'collide' (física), 'select' (mira e contorno) ou 'render' (malha). Lajes, escadas e cama usam a mesma caixa nos três.
// Para blocos sem forma própria devolve null (quem chama usa o cubo/caixa do registro).
export function blockBoxes(state, getState, x, y, z, kind = 'select') {
  const b = BLOCKS[stateIdOf(state)];
  if (!b) return null;
  if (b.model === 'slab') return [slabBox(stateMetaOf(state))];
  if (b.model === 'bed') return [[0, 0, 0, 1, BED_HEIGHT, 1]];
  if (b.model === 'stairs') return stairBoxes(stateMetaOf(state), getState ? stairShape(getState, x, y, z) : 'straight');
  if (b.model === 'door') return doorBoxes(doorInfo(state, getState || (() => 0), x, y, z));
  if (b.model === 'fence') return fenceBoxes(getState ? fenceConnections(stateIdOf(state), getState, x, y, z) : [false, false, false, false], kind);
  if (b.model === 'gate') return gateBoxes(stateMetaOf(state), kind);
  if (b.model === 'chest') return [CHEST_BOX];
  if (b.model === 'skull') return [[0.25, 0, 0.25, 0.75, 0.5, 0.75]];
  if (b.model === 'ladder') return [ladderBox(stateMetaOf(state))];
  if (b.model === 'trapdoor') return [trapdoorBox(stateMetaOf(state))];
  if (b.model === 'multi') return b.multi(stateMetaOf(state), getState, x, y, z, kind);
  return null;
}

// Interseção raio × caixa (método das lajes). Devolve { t, nx, ny, nz } da entrada ou null.
export function rayBox(ox, oy, oz, dx, dy, dz, box, maxT) {
  let tmin = 0, tmax = maxT;
  let nx = 0, ny = 0, nz = 0;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    const lo = box[a], hi = box[a + 3];
    if (Math.abs(d[a]) < 1e-12) {
      if (o[a] < lo || o[a] > hi) return null;
      continue;
    }
    let t1 = (lo - o[a]) / d[a], t2 = (hi - o[a]) / d[a];
    let sign = -1; // entra pela face "lo": normal aponta para −eixo
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; sign = 1; }
    if (t1 > tmin) { tmin = t1; nx = ny = nz = 0; if (a === 0) nx = sign; else if (a === 1) ny = sign; else nz = sign; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return { t: tmin, nx, ny, nz };
}


// Blocos que dependem de onde se clicou: presos na parede (tocha, alavanca, botão, placa, gancho), de pé no chão (placa em pé)
// e orientados pelo olhar (bigorna, trilho). Devolve { invalid: true } quando não há onde prender.
const WALL_BOUND = new Set([50, 75, 76, 69, 77, 143, 68, 131]);
export const isWallBound = (id) => WALL_BOUND.has(id);
const solidCube = (b) => !!b && b.solid && b.opaque && (b.model || 'cube') === 'cube';
// Onde cada planta pode ficar (BlockBush.canPlaceBlockOn e as classes de cada uma no 1.8.9): só em terra que sustenta planta
const GROWS_ON_SOIL = (b) => b === 2 || b === 3 || b === 60;                     // grama, terra, terra arada
const isFullCube = (b) => { const d = BLOCKS[b]; return !!d && d.solid && d.opaque && (d.model || 'cube') === 'cube'; };
const waterAt = (getState, x, y, z) => { const i = stateIdOf(getState(x, y, z)); return i === 8 || i === 9; };
export const PLANT_RULES = {
  6: (g, x, y, z) => GROWS_ON_SOIL(stateIdOf(g(x, y - 1, z))),
  31: (g, x, y, z) => GROWS_ON_SOIL(stateIdOf(g(x, y - 1, z))),
  37: (g, x, y, z) => GROWS_ON_SOIL(stateIdOf(g(x, y - 1, z))),
  38: (g, x, y, z) => GROWS_ON_SOIL(stateIdOf(g(x, y - 1, z))),
  32: (g, x, y, z) => [12, 172, 159, 3, 2].includes(stateIdOf(g(x, y - 1, z))),   // arbusto morto: areia, argila endurecida ou terra
  39: (g, x, y, z) => isFullCube(stateIdOf(g(x, y - 1, z))) || stateIdOf(g(x, y - 1, z)) === 110,
  40: (g, x, y, z) => isFullCube(stateIdOf(g(x, y - 1, z))) || stateIdOf(g(x, y - 1, z)) === 110,
  59: (g, x, y, z) => stateIdOf(g(x, y - 1, z)) === 60, 141: (g, x, y, z) => stateIdOf(g(x, y - 1, z)) === 60, 142: (g, x, y, z) => stateIdOf(g(x, y - 1, z)) === 60,
  104: (g, x, y, z) => stateIdOf(g(x, y - 1, z)) === 60, 105: (g, x, y, z) => stateIdOf(g(x, y - 1, z)) === 60,
  115: (g, x, y, z) => stateIdOf(g(x, y - 1, z)) === 88,                           // verruga do Nether: areia das almas
  83: (g, x, y, z) => {                                                            // cana: sobre outra cana, ou grama/terra/areia ao lado de água
    const b = stateIdOf(g(x, y - 1, z));
    if (b === 83) return true;
    return [2, 3, 12].includes(b) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => waterAt(g, x + dx, y - 1, z + dz));
  },
  81: (g, x, y, z) => {                                                            // cacto: areia ou outro cacto, e nada sólido nos quatro lados
    const b = stateIdOf(g(x, y - 1, z));
    if (b !== 12 && b !== 81) return false;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dz]) => { const i = stateIdOf(g(x + dx, y, z + dz)); return i === 0 || !(BLOCKS[i] && BLOCKS[i].solid); });
  },
  111: (g, x, y, z) => waterAt(g, x, y - 1, z) && stateIdOf(g(x, y, z)) === 0,     // vitória-régia: em cima da água
};
export function plantCanStay(id, g, x, y, z) { const r = PLANT_RULES[id]; return !r || r(g, x, y, z); }

export function placeSpecial(placing, slotMeta, hit, yaw, getState) {
  if (!placing) return null;
  const id = placing.id;
  const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
  if (PLANT_RULES[id] && id !== 111 && !PLANT_RULES[id](getState, px, py, pz)) return { invalid: true };
  const lookIdx = [3, 0, 1, 2][Math.floor(yaw * 2 / Math.PI + 0.5) & 3]; // direção do olhar, na ordem de DOOR_FACES
  const clicked = BLOCKS[stateIdOf(getState(hit.x, hit.y, hit.z))];
  if (WALL_BOUND.has(id)) {
    // tocha, alavanca, botão, placa na parede, gancho: o lado clicado decide onde prende
    const sideIdx = hit.ny === 0 ? DOOR_FACES.findIndex(d => d[0] === -hit.nx && d[1] === -hit.nz) : -1;
    const floorOk = hit.ny === 1 && (solidCube(clicked) || (id === 50 || id === 75 || id === 76) && clicked && (clicked.model === 'fence' || clicked.model === 'multi' && clicked.wallLike));
    if (sideIdx >= 0 && solidCube(clicked)) {
      const meta = DIR_WALL_META[sideIdx];
      return { x: px, y: py, z: pz, id, meta };
    }
    if (id === 68 || id === 131) return { invalid: true };
    if (floorOk) return { x: px, y: py, z: pz, id, meta: id === 50 || id === 75 || id === 76 ? 5 : 0 };
    if (hit.ny === -1 && (id === 69 || id === 77 || id === 143) && solidCube(clicked)) return { x: px, y: py, z: pz, id, meta: 5 };
    return { invalid: true };
  }
  if (id === 106) { // trepadeira: cola no lado clicado (bits 1 sul, 2 oeste, 4 norte, 8 leste) ou pende da face de baixo de um bloco; clicar de novo no mesmo vão soma os lados
    if (hit.ny === 1 || !solidCube(clicked)) return { invalid: true };
    const bit = hit.ny === -1 ? 0 : (-hit.nz === 1 ? 1 : -hit.nx === -1 ? 2 : -hit.nz === -1 ? 4 : 8);
    const here = getState(px, py, pz);
    const cur = stateIdOf(here) === 106 ? stateMetaOf(here) : 0;
    return { x: px, y: py, z: pz, id, meta: cur | bit };
  }
  if (id === 175) { // planta alta: precisa de grama, terra ou terra arada embaixo e de espaço para as duas metades
    const below = stateIdOf(getState(px, py - 1, pz));
    const up = getState(px, py + 1, pz);
    const upB = BLOCKS[stateIdOf(up)];
    if (![2, 3, 60].includes(below) || (stateIdOf(up) !== 0 && !(upB && upB.replaceable))) return { invalid: true };
    return { x: px, y: py, z: pz, id, meta: slotMeta & 7 };
  }
  if (id === 63) { // placa em pé: aponta para o jogador; meta bit 2 = eixo (0 leste-oeste, 1 norte-sul)
    if (hit.ny !== 1 || !clicked || !clicked.solid) return { invalid: true };
    return { x: px, y: py, z: pz, id, meta: (lookIdx & 1) << 2 };
  }
  if (id === 145) return { x: px, y: py, z: pz, id, meta: (lookIdx & 1) | ((slotMeta & 3) << 2) }; // bigorna: o eixo gira com o olhar, o dano vem do item
  if (RAIL_IDS.has(id)) {
    if (hit.ny !== 1 || !clicked || !clicked.solid || !clicked.opaque) return { invalid: true };
    return { x: px, y: py, z: pz, id, meta: 0 };
  }
  if (id === 131) return null;
  // blocos que precisam de chão sólido embaixo (placas, tapetes, bolo, vaso...) — a regra única fica em needsFloor()
  if (needsFloor(id)) {
    const below = BLOCKS[stateIdOf(getState(px, py - 1, pz))];
    if (!below || !(below.solid && (below.opaque || below.model === 'slab' || below.model === 'stairs' || below.model === 'fence'))) return { invalid: true };
  }
  return null;
}
// blocos que quebram sem chão sólido embaixo
const FLOOR_BOUND = new Set([63, 66, 27, 28, 157, 70, 72, 147, 148, 171, 55, 92, 140, 93, 94, 149, 150, 151, 178, 132, 144, 198, 199, 200, 201]);
export const needsFloor = (id) => FLOOR_BOUND.has(id);
export const FLOOR_BOUND_IDS = FLOOR_BOUND;

// Onde e como colocar uma laje/escada. hit = { x, y, z, nx, ny, nz, hy } (hy = altura absoluta do ponto clicado).
// Devolve { x, y, z, id, meta } ou null se o bloco não tem forma própria.
//  · laje: metade de cima se clicou na face de baixo ou na metade de cima de uma face lateral; clicar na face aberta
//    de uma laje igual (ou colocar onde já há a outra metade) a transforma em laje dupla;
//  · escada: sobe na direção em que o jogador olha (0 leste, 1 oeste, 2 sul, 3 norte), invertida se clicou na metade de cima.
export function computePlacement(placing, slotMeta, hit, yaw, getState) {
  if (placing && placing.orient) { // bloco cheio orientado (abóbora, fornalha...): a frente olha para o jogador
    const li = [3, 0, 1, 2][Math.floor(yaw * 2 / Math.PI + 0.5) & 3];
    return { x: hit.x + hit.nx, y: hit.y + hit.ny, z: hit.z + hit.nz, id: placing.id, meta: (li + 2) & 3 };
  }
  const special = placeSpecial(placing, slotMeta, hit, yaw, getState);
  if (special) return special;
  if (!placing || !['slab', 'stairs', 'gate', 'chest', 'ladder', 'trapdoor', 'skull'].includes(placing.model)) return null;
  const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
  const fracY = hit.hy !== undefined ? hit.hy - hit.y : 0.5;
  const upper = hit.ny === -1 || (hit.ny === 0 && fracY > 0.5);
  const lookIdx = [3, 0, 1, 2][Math.floor(yaw * 2 / Math.PI + 0.5) & 3]; // direção do olhar na ordem de DOOR_FACES
  const normalIdx = hit.ny === 0 ? DOOR_FACES.findIndex(d => d[0] === hit.nx && d[1] === hit.nz) : -1;
  if (placing.model === 'chest' || placing.model === 'skull') return { x: px, y: py, z: pz, id: placing.id, meta: (lookIdx + 2) & 3 }; // a frente olha para o jogador
  if (placing.model === 'ladder') {
    // só em parede lateral e de bloco cheio opaco; a escada olha para fora da parede
    const wall = getState(hit.x, hit.y, hit.z);
    const wb = BLOCKS[stateIdOf(wall)];
    if (normalIdx < 0 || !wb || !wb.solid || !wb.opaque || wb.model !== 'cube') return { invalid: true };
    return { x: px, y: py, z: pz, id: placing.id, meta: normalIdx };
  }
  if (placing.model === 'trapdoor') {
    if (normalIdx >= 0) return { x: px, y: py, z: pz, id: placing.id, meta: ((normalIdx + 2) & 3) | (fracY > 0.5 ? 8 : 0) };
    return { x: px, y: py, z: pz, id: placing.id, meta: lookIdx | (hit.ny === -1 ? 8 : 0) };
  }
  if (placing.model === 'gate') {
    const i = Math.floor(yaw * 2 / Math.PI + 0.5) & 3;
    return { x: px, y: py, z: pz, id: placing.id, meta: [3, 0, 1, 2][i] }; // sul, oeste, norte, leste → ordem de DOOR_FACES
  }
  if (placing.model === 'stairs') {
    const i = Math.floor(yaw * 2 / Math.PI + 0.5) & 3;
    return { x: px, y: py, z: pz, id: placing.id, meta: [2, 1, 3, 0][i] | (upper ? 4 : 0) };
  }
  const variant = slotMeta & 7;
  const clicked = getState(hit.x, hit.y, hit.z);
  if (stateIdOf(clicked) === placing.id && (stateMetaOf(clicked) & 7) === variant
    && ((hit.ny === 1 && !(stateMetaOf(clicked) & 8)) || (hit.ny === -1 && (stateMetaOf(clicked) & 8)))) {
    return { x: hit.x, y: hit.y, z: hit.z, id: placing.doubleId, meta: variant };
  }
  const here = getState(px, py, pz);
  if (stateIdOf(here) === placing.id && (stateMetaOf(here) & 7) === variant && (!!(stateMetaOf(here) & 8)) !== upper) {
    return { x: px, y: py, z: pz, id: placing.doubleId, meta: variant };
  }
  return { x: px, y: py, z: pz, id: placing.id, meta: variant | (upper ? 8 : 0) };
}

export { FULL as FULL_BOX_SHAPE };
