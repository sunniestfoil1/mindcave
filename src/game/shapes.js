// Formas dos blocos que não são cubo cheio: lajes e escadas (1.8.9).
// Uma única fonte de caixas para colisão (physics), malha (mesher), mira/contorno e ícones.
//
// Laje (ids 44/126/182): meta & 7 = tipo, meta & 8 = metade de cima. A laje dupla (43/125/181) é cubo comum.
// Escada: meta & 3 = direção em que sobe (0 leste +x, 1 oeste −x, 2 sul +z, 3 norte −z), meta & 4 = de cabeça para baixo.
// A forma da escada (reta, canto interno, canto externo) depende das escadas vizinhas, como em BlockStairs.getStairsShape.
import { BLOCKS } from './blocks';

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
export function hasShape(block) { return !!block && (block.model === 'slab' || block.model === 'stairs'); }

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

export function slabBox(meta) {
  return (meta & 8) ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
}

// Caixas do bloco em (x, y, z) no estado dado (relativas ao bloco). getState(x, y, z) devolve o estado do vizinho.
// Para blocos sem forma própria devolve null (quem chama usa o cubo/caixa do registro).
export function blockBoxes(state, getState, x, y, z) {
  const b = BLOCKS[stateIdOf(state)];
  if (!b) return null;
  if (b.model === 'slab') return [slabBox(stateMetaOf(state))];
  if (b.model === 'stairs') return stairBoxes(stateMetaOf(state), getState ? stairShape(getState, x, y, z) : 'straight');
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

// Onde e como colocar uma laje/escada. hit = { x, y, z, nx, ny, nz, hy } (hy = altura absoluta do ponto clicado).
// Devolve { x, y, z, id, meta } ou null se o bloco não tem forma própria.
//  · laje: metade de cima se clicou na face de baixo ou na metade de cima de uma face lateral; clicar na face aberta
//    de uma laje igual (ou colocar onde já há a outra metade) a transforma em laje dupla;
//  · escada: sobe na direção em que o jogador olha (0 leste, 1 oeste, 2 sul, 3 norte), invertida se clicou na metade de cima.
export function computePlacement(placing, slotMeta, hit, yaw, getState) {
  if (!hasShape(placing)) return null;
  const px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
  const fracY = hit.hy !== undefined ? hit.hy - hit.y : 0.5;
  const upper = hit.ny === -1 || (hit.ny === 0 && fracY > 0.5);
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
