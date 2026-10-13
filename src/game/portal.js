// Portal do Nether (1.8.9, BlockPortal): moldura de obsidiana com interior de 2–21 de largura × 3–21 de altura, ativada com pederneira e aço.
// O bloco do portal (id 90) guarda o eixo na meta: 1 = plano ao longo de X, 2 = plano ao longo de Z.
import { stateId, stateMeta, packState } from './chunk';

export const OBSIDIAN = 49, PORTAL = 90, FIRE = 51;
const AXES = { x: { dx: 1, dz: 0, meta: 1 }, z: { dx: 0, dz: 1, meta: 2 } };

const isAir = (id) => id === 0 || id === FIRE;

// Procura uma moldura válida cujo interior contém (x, y, z). Devolve { axis, cells: [[x, y, z]...] } ou null.
export function findPortalFrame(world, x, y, z, axisName) {
  const { dx, dz } = AXES[axisName];
  const id = (a, b, c) => stateId(world.getBlock(a, b, c));
  if (!isAir(id(x, y, z))) return null;
  // desce até o chão de obsidiana
  let y0 = y;
  while (y0 > 1 && isAir(id(x, y0 - 1, z))) y0--;
  if (id(x, y0 - 1, z) !== OBSIDIAN) return null;
  // largura: anda para os dois lados enquanto o chão for obsidiana e o ar livre
  let lo = 0, hi = 0;
  while (lo > -21 && isAir(id(x + dx * (lo - 1), y0, z + dz * (lo - 1))) && id(x + dx * (lo - 1), y0 - 1, z + dz * (lo - 1)) === OBSIDIAN) lo--;
  while (hi < 21 && isAir(id(x + dx * (hi + 1), y0, z + dz * (hi + 1))) && id(x + dx * (hi + 1), y0 - 1, z + dz * (hi + 1)) === OBSIDIAN) hi++;
  if (id(x + dx * (lo - 1), y0, z + dz * (lo - 1)) !== OBSIDIAN || id(x + dx * (hi + 1), y0, z + dz * (hi + 1)) !== OBSIDIAN) return null;
  const width = hi - lo + 1;
  if (width < 2 || width > 21) return null;
  // altura: sobe até achar a linha de obsidiana do teto; as laterais têm de ser obsidiana em toda a altura
  let h = 0;
  for (; h < 21; h++) {
    const yy = y0 + h;
    const lside = id(x + dx * (lo - 1), yy, z + dz * (lo - 1)), rside = id(x + dx * (hi + 1), yy, z + dz * (hi + 1));
    if (lside !== OBSIDIAN || rside !== OBSIDIAN) return null;
    let free = 0;
    for (let k = lo; k <= hi; k++) if (isAir(id(x + dx * k, yy, z + dz * k))) free++;
    if (free === width) continue;
    // linha cheia de obsidiana = teto
    let top = 0;
    for (let k = lo; k <= hi; k++) if (id(x + dx * k, yy, z + dz * k) === OBSIDIAN) top++;
    if (top === width && h >= 3) break;
    return null;
  }
  if (h < 3 || h >= 21) return null;
  const cells = [];
  for (let j = 0; j < h; j++) for (let k = lo; k <= hi; k++) cells.push([x + dx * k, y0 + j, z + dz * k]);
  return { axis: axisName, cells };
}

// Acende o portal a partir de uma célula de ar dentro da moldura. Devolve true se criou.
export function tryCreatePortal(world, x, y, z, onChange) {
  for (const axis of ['x', 'z']) {
    const f = findPortalFrame(world, x, y, z, axis);
    if (!f) continue;
    const st = packState(PORTAL, AXES[axis].meta);
    for (const [a, b, c] of f.cells) { world.setBlock(a, b, c, st); onChange?.(a, b, c, st); }
    return true;
  }
  return false;
}

// Depois de quebrar um bloco: portais vizinhos que perderam a moldura somem em cascata (BlockPortal.onNeighborBlockChange)
export function checkPortalIntegrity(world, x, y, z, onChange) {
  const id = (a, b, c) => stateId(world.getBlock(a, b, c));
  const queue = [];
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0, 0, 0]]) {
    if (id(x + dx, y + dy, z + dz) === PORTAL) queue.push([x + dx, y + dy, z + dz]);
  }
  let removed = 0;
  while (queue.length) {
    const [a, b, c] = queue.pop();
    const st = world.getBlock(a, b, c);
    if (stateId(st) !== PORTAL) continue;
    const { dx, dz } = (stateMeta(st) & 3) === 2 ? AXES.z : AXES.x;
    const ok = (nid) => nid === OBSIDIAN || nid === PORTAL;
    if (ok(id(a + dx, b, c + dz)) && ok(id(a - dx, b, c - dz)) && ok(id(a, b + 1, c)) && ok(id(a, b - 1, c))) continue;
    world.setBlock(a, b, c, 0); onChange?.(a, b, c, 0); removed++;
    for (const [ex, ey, ez] of [[dx, 0, dz], [-dx, 0, -dz], [0, 1, 0], [0, -1, 0]]) if (id(a + ex, b + ey, c + ez) === PORTAL) queue.push([a + ex, b + ey, c + ez]);
  }
  return removed;
}

// Procura um portal perto de (x, z) no outro mundo: o mais próximo num raio, pelo menor y livre. Devolve { x, y, z, axisMeta } ou null.
export function findNearbyPortal(world, x, y, z, radius) {
  let best = null, bestD = Infinity;
  const id = (a, b, c) => stateId(world.getBlock(a, b, c));
  for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
    const d2 = dx * dx + dz * dz;
    if (d2 >= bestD) continue;
    for (let yy = 125; yy >= 1; yy--) {
      if (id(x + dx, yy, z + dz) === PORTAL && id(x + dx, yy - 1, z + dz) !== PORTAL) {
        best = { x: x + dx, y: yy, z: z + dz, meta: stateMeta(world.getBlock(x + dx, yy, z + dz)) };
        bestD = d2; break;
      }
    }
  }
  return best;
}

// Constrói um portal novo (moldura 4×5 + piso de obsidiana) com a base em (x, y, z), eixo X
export function buildPortal(world, x, y, z, onChange) {
  const set = (a, b, c, id, meta = 0) => { const st = packState(id, meta); world.setBlock(a, b, c, st); onChange?.(a, b, c, st); };
  for (let i = -1; i <= 2; i++) for (let j = -1; j <= 3; j++) {
    const edge = i === -1 || i === 2 || j === -1 || j === 3;
    if (j === -1 && i >= 0 && i <= 1) { set(x + i, y - 1 + 0, z, OBSIDIAN); continue; }
    if (edge) set(x + i, y + j, z, OBSIDIAN);
    else set(x + i, y + j, z, PORTAL, 1);
  }
  // espaço livre dos dois lados e plataforma de obsidiana para pisar
  for (let a = -1; a <= 2; a++) for (let b = -1; b <= 1; b++) {
    if (b === 0) continue;
    set(x + a, y - 1, z + b, OBSIDIAN);
    for (let h = 0; h <= 3; h++) set(x + a, y + h, z + b, 0);
  }
  // refaz o portal no meio (a limpeza acima não atinge z, só os lados)
  for (let i = 0; i <= 1; i++) for (let j = 0; j <= 2; j++) set(x + i, y + j, z, PORTAL, 1);
}
