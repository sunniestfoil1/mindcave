// Portais: o do Nether (1.8.9, BlockPortal: moldura de obsidiana, pederneira e aço) e o do Aether (moldura de glowstone, balde de água).
// As duas molduras seguem a mesma regra: interior de 2–21 de largura × 3–21 de altura, chão, lados e teto só do bloco da moldura (os 4 cantos
// podem ser qualquer coisa) e o interior só com o que a ativação aceita. O bloco do portal guarda o eixo na meta: 1 = plano ao longo de X, 2 = Z.
import { stateId, stateMeta, packState } from './chunk';

export const OBSIDIAN = 49, PORTAL = 90, FIRE = 51, GLOWSTONE = 89, AETHER_PORTAL = 215, HOLYSTONE = 211;
const AXES = { x: { dx: 1, dz: 0, meta: 1 }, z: { dx: 0, dz: 1, meta: 2 } };

export const KINDS = {
  nether: { name: 'nether', frame: OBSIDIAN, portal: PORTAL, dim: 'nether', floor: OBSIDIAN, interior: (id) => id === 0 || id === FIRE },
  aether: { name: 'aether', frame: GLOWSTONE, portal: AETHER_PORTAL, dim: 'aether', floor: HOLYSTONE, interior: (id) => id === 0 || id === FIRE || id === 8 || id === 9 },
};
export const kindOfPortalBlock = (id) => (id === PORTAL ? KINDS.nether : id === AETHER_PORTAL ? KINDS.aether : null);
export const kindOfFrameBlock = (id) => (id === OBSIDIAN ? KINDS.nether : id === GLOWSTONE ? KINDS.aether : null);

// Procura uma moldura válida cujo interior contém (x, y, z). Devolve { axis, cells: [[x, y, z]...] } ou null.
export function findPortalFrame(world, x, y, z, axisName, kind = KINDS.nether) {
  const { dx, dz } = AXES[axisName];
  const id = (a, b, c) => stateId(world.getBlock(a, b, c));
  const free = (a, b, c) => kind.interior(id(a, b, c));
  const F = kind.frame;
  if (!free(x, y, z)) return null;
  // desce até o chão da moldura
  let y0 = y;
  while (y0 > 1 && free(x, y0 - 1, z)) y0--;
  if (id(x, y0 - 1, z) !== F) return null;
  // largura: anda para os dois lados enquanto o chão for da moldura e o interior livre
  let lo = 0, hi = 0;
  while (lo > -21 && free(x + dx * (lo - 1), y0, z + dz * (lo - 1)) && id(x + dx * (lo - 1), y0 - 1, z + dz * (lo - 1)) === F) lo--;
  while (hi < 21 && free(x + dx * (hi + 1), y0, z + dz * (hi + 1)) && id(x + dx * (hi + 1), y0 - 1, z + dz * (hi + 1)) === F) hi++;
  if (id(x + dx * (lo - 1), y0, z + dz * (lo - 1)) !== F || id(x + dx * (hi + 1), y0, z + dz * (hi + 1)) !== F) return null;
  const width = hi - lo + 1;
  if (width < 2 || width > 21) return null;
  // altura: sobe até achar a linha do teto; as laterais têm de ser da moldura em toda a altura
  let h = 0;
  for (; h < 21; h++) {
    const yy = y0 + h;
    let open = 0;
    for (let k = lo; k <= hi; k++) if (free(x + dx * k, yy, z + dz * k)) open++;
    if (open === width) {   // linha de interior: as laterais têm de ser da moldura
      if (id(x + dx * (lo - 1), yy, z + dz * (lo - 1)) !== F || id(x + dx * (hi + 1), yy, z + dz * (hi + 1)) !== F) return null;
      continue;
    }
    let top = 0;   // linha cheia da moldura = teto (os cantos de cima ficam livres, como no jogo)
    for (let k = lo; k <= hi; k++) if (id(x + dx * k, yy, z + dz * k) === F) top++;
    if (top === width && h >= 3) break;
    return null;
  }
  if (h < 3 || h >= 21) return null;
  const cells = [];
  for (let j = 0; j < h; j++) for (let k = lo; k <= hi; k++) cells.push([x + dx * k, y0 + j, z + dz * k]);
  return { axis: axisName, cells };
}

// Acende o portal a partir de uma célula livre dentro da moldura. Devolve true se criou.
export function tryCreatePortal(world, x, y, z, onChange, kind = KINDS.nether) {
  for (const axis of ['x', 'z']) {
    const f = findPortalFrame(world, x, y, z, axis, kind);
    if (!f) continue;
    const st = packState(kind.portal, AXES[axis].meta);
    for (const [a, b, c] of f.cells) { world.setBlock(a, b, c, st); onChange?.(a, b, c, st); }
    return true;
  }
  return false;
}

// Depois de quebrar um bloco: portais vizinhos (de qualquer tipo) que perderam a moldura somem em cascata, todos de uma vez
// (BlockPortal.onNeighborBlockChange). Devolve quantos blocos de portal sumiram.
export function checkPortalIntegrity(world, x, y, z, onChange) {
  const id = (a, b, c) => stateId(world.getBlock(a, b, c));
  const queue = [];
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0, 0, 0]]) {
    if (kindOfPortalBlock(id(x + dx, y + dy, z + dz))) queue.push([x + dx, y + dy, z + dz]);
  }
  let removed = 0;
  while (queue.length) {
    const [a, b, c] = queue.pop();
    const st = world.getBlock(a, b, c);
    const kind = kindOfPortalBlock(stateId(st));
    if (!kind) continue;
    const { dx, dz } = (stateMeta(st) & 3) === 2 ? AXES.z : AXES.x;
    const ok = (nid) => nid === kind.frame || nid === kind.portal;
    if (ok(id(a + dx, b, c + dz)) && ok(id(a - dx, b, c - dz)) && ok(id(a, b + 1, c)) && ok(id(a, b - 1, c))) continue;
    world.setBlock(a, b, c, 0); onChange?.(a, b, c, 0); removed++;
    for (const [ex, ey, ez] of [[dx, 0, dz], [-dx, 0, -dz], [0, 1, 0], [0, -1, 0]]) if (id(a + ex, b + ey, c + ez) === kind.portal) queue.push([a + ex, b + ey, c + ez]);
  }
  return removed;
}

// Procura um portal do tipo perto de (x, z) no outro mundo: o mais próximo num raio, pelo menor y livre. Devolve { x, y, z, meta } ou null.
export function findNearbyPortal(world, x, y, z, radius, kind = KINDS.nether) {
  let best = null, bestD = Infinity;
  const id = (a, b, c) => stateId(world.getBlock(a, b, c));
  for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
    const d2 = dx * dx + dz * dz;
    if (d2 >= bestD) continue;
    for (let yy = 250; yy >= 1; yy--) {
      if (id(x + dx, yy, z + dz) === kind.portal && id(x + dx, yy - 1, z + dz) !== kind.portal) {
        best = { x: x + dx, y: yy, z: z + dz, meta: stateMeta(world.getBlock(x + dx, yy, z + dz)) };
        bestD = d2; break;
      }
    }
  }
  return best;
}

// Constrói um portal novo (moldura 4×5 + piso) com a base em (x, y, z), eixo X
export function buildPortal(world, x, y, z, onChange, kind = KINDS.nether) {
  const set = (a, b, c, id, meta = 0) => { const st = packState(id, meta); world.setBlock(a, b, c, st); onChange?.(a, b, c, st); };
  for (let i = -1; i <= 2; i++) for (let j = -1; j <= 3; j++) {
    const edge = i === -1 || i === 2 || j === -1 || j === 3;
    if (j === -1 && i >= 0 && i <= 1) { set(x + i, y - 1 + 0, z, kind.frame); continue; }
    if (edge) set(x + i, y + j, z, kind.frame);
    else set(x + i, y + j, z, kind.portal, 1);
  }
  // espaço livre dos dois lados e plataforma para pisar
  for (let a = -1; a <= 2; a++) for (let b = -1; b <= 1; b++) {
    if (b === 0) continue;
    set(x + a, y - 1, z + b, kind.floor);
    for (let h = 0; h <= 3; h++) set(x + a, y + h, z + b, 0);
  }
  // refaz o portal no meio (a limpeza acima não atinge z, só os lados)
  for (let i = 0; i <= 1; i++) for (let j = 0; j <= 2; j++) set(x + i, y + j, z, kind.portal, 1);
}
