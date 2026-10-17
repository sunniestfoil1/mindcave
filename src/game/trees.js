import { JRandom } from './jrandom';
// Geradores de árvore do 1.8.9 (WorldGenTrees, WorldGenForest, WorldGenTaiga1/2, WorldGenSwamp, WorldGenShrub, WorldGenBigTree,
// WorldGenMegaPineTree, WorldGenMegaJungle, WorldGenSavannaTree, WorldGenCanopyTree), portados do MCP na mesma ordem de sorteios.
// Cada gerador recebe um "mundo" com get(x,y,z) → estado, set(x,y,z,estado), id(x,y,z) e isAir(x,y,z) e um JRandom, e devolve se plantou.
const f = Math.fround;
const st = (id, meta = 0) => ((id & 0xfff) << 4) | (meta & 15);
const sid = (s) => (s >> 4) & 0xfff;
const smeta = (s) => s & 15;

// ids
const STONE = 1, GRASS = 2, DIRT = 3, SAPLING = 6, WATER_F = 8, WATER = 9, LAVA_F = 10, LAVA = 11, LOG = 17, LEAVES = 18, VINE = 106,
  FARMLAND = 60, LEAVES2 = 161, LOG2 = 162, ICE = 79, PACKED_ICE = 174;
const PLANTS = new Set([6, 30, 31, 32, 37, 38, 39, 40, 50, 51, 55, 59, 65, 66, 69, 70, 72, 75, 76, 77, 78, 83, 104, 105, 106, 111, 115, 127, 141, 142, 178]);
const isLiquid = (id) => id >= 8 && id <= 11;
const matSolid = (id) => id !== 0 && !isLiquid(id) && !PLANTS.has(id);
const NOT_FULL = new Set([18, 161, 20, 95, 79, 174, 81, 44, 43, 126, 53, 67, 108, 109, 134, 135, 136, 156, 163, 164, 180, 182, 85, 113, 107, 54, 26, 64, 71, 96, 102, 101, 160, 65, 171]);
const isFull = (id) => matSolid(id) && !NOT_FULL.has(id);
const isLeaf = (id) => id === LEAVES || id === LEAVES2;

// ---- helpers de bloco ----
const logState = (variant, axis = 0) => (variant < 4 ? st(LOG, variant + axis * 4) : st(LOG2, (variant - 4) + axis * 4));
const OAK = 0, SPRUCE = 1, BIRCH = 2, JUNGLE = 3, ACACIA = 4, DARK_OAK = 5;
const leafState = (variant) => (variant < 4 ? st(LEAVES, variant) : st(LEAVES2, variant - 4));

// func_150523_a: onde uma árvore pode crescer (ar, folha, grama, terra, tronco, muda, vinha)
const canReplaceTree = (id) => id === 0 || isLeaf(id) || id === GRASS || id === DIRT || id === LOG || id === LOG2 || id === SAPLING || id === VINE;
const dirtUnder = (R, x, y, z) => { if (R.id(x, y, z) !== DIRT || smeta(R.get(x, y, z)) !== 0) { if (R.id(x, y, z) !== DIRT) R.set(x, y, z, st(DIRT)); } };

// ---- árvores ----
function checkColumn(R, x, y, z, h, radiusFor, okFn) {
  for (let j = y; j <= y + 1 + h; j++) {
    const k = radiusFor(j - y);
    for (let l = x - k; l <= x + k; l++) for (let i1 = z - k; i1 <= z + k; i1++) {
      if (j < 0 || j >= 256) return false;
      if (!okFn(R.id(l, j, i1))) return false;
    }
  }
  return true;
}

// WorldGenTrees (carvalho/selva pequena): minHeight 4; vinesGrow só na selva
export function genTrees(R, rand, x, y, z, { minHeight = 4, wood = OAK, leaf = OAK, vines = false } = {}) {
  const i = rand.nextInt(3) + minHeight;
  if (y < 1 || y + i + 1 > 256) return false;
  const ok = checkColumn(R, x, y, z, i, (d) => (d === 0 ? 0 : d >= 1 + i - 2 ? 2 : 1), canReplaceTree);
  if (!ok) return false;
  const below = R.id(x, y - 1, z);
  if ((below === GRASS || below === DIRT || below === FARMLAND) && y < 256 - i - 1) {
    dirtUnder(R, x, y - 1, z);
    const k2 = 3, l2 = 0;
    for (let i3 = y - k2 + i; i3 <= y + i; i3++) {
      const i4 = i3 - (y + i);
      const j1 = l2 + 1 - Math.trunc(i4 / 2);
      for (let k1 = x - j1; k1 <= x + j1; k1++) {
        const l1 = k1 - x;
        for (let i2 = z - j1; i2 <= z + j1; i2++) {
          const j2 = i2 - z;
          if (Math.abs(l1) !== j1 || Math.abs(j2) !== j1 || (rand.nextInt(2) !== 0 && i4 !== 0)) {
            const b = R.id(k1, i3, i2);
            if (b === 0 || isLeaf(b) || b === VINE) R.set(k1, i3, i2, leafState(leaf));
          }
        }
      }
    }
    const vine = (px, py, pz, bit) => R.set(px, py, pz, st(VINE, bit));
    for (let j3 = 0; j3 < i; j3++) {
      const b = R.id(x, y + j3, z);
      if (b === 0 || isLeaf(b) || b === VINE) {
        R.set(x, y + j3, z, logState(wood));
        if (vines && j3 > 0) {
          if (rand.nextInt(3) > 0 && R.isAir(x - 1, y + j3, z)) vine(x - 1, y + j3, z, 8);
          if (rand.nextInt(3) > 0 && R.isAir(x + 1, y + j3, z)) vine(x + 1, y + j3, z, 2);
          if (rand.nextInt(3) > 0 && R.isAir(x, y + j3, z - 1)) vine(x, y + j3, z - 1, 1);
          if (rand.nextInt(3) > 0 && R.isAir(x, y + j3, z + 1)) vine(x, y + j3, z + 1, 4);
        }
      }
    }
    if (vines) {
      const hang = (px, py, pz, bit) => {
        vine(px, py, pz, bit);
        let n = 4;
        for (py = py - 1; R.isAir(px, py, pz) && n > 0; n--) { vine(px, py, pz, bit); py--; }
      };
      for (let k3 = y - 3 + i; k3 <= y + i; k3++) {
        const j4 = k3 - (y + i);
        const k4 = 2 - Math.trunc(j4 / 2);
        for (let l4 = x - k4; l4 <= x + k4; l4++) for (let i5 = z - k4; i5 <= z + k4; i5++) {
          if (isLeaf(R.id(l4, k3, i5))) {
            if (rand.nextInt(4) === 0 && R.isAir(l4 - 1, k3, i5)) hang(l4 - 1, k3, i5, 8);
            if (rand.nextInt(4) === 0 && R.isAir(l4 + 1, k3, i5)) hang(l4 + 1, k3, i5, 2);
            if (rand.nextInt(4) === 0 && R.isAir(l4, k3, i5 - 1)) hang(l4, k3, i5 - 1, 1);
            if (rand.nextInt(4) === 0 && R.isAir(l4, k3, i5 + 1)) hang(l4, k3, i5 + 1, 4);
          }
        }
      }
      if (rand.nextInt(5) === 0 && i > 5) {
        // cacau (sem bloco no jogo): só consome o mesmo sorteio
        for (let l3 = 0; l3 < 2; l3++) for (let d = 0; d < 4; d++) { if (rand.nextInt(4 - l3) === 0) rand.nextInt(3); }
      }
    }
    return true;
  }
  return false;
}

// WorldGenForest (bétula): useExtraRandomHeight = bétula alta
export function genBirch(R, rand, x, y, z, tall) {
  let i = rand.nextInt(3) + 5;
  if (tall) i += rand.nextInt(7);
  if (y < 1 || y + i + 1 > 256) return false;
  if (!checkColumn(R, x, y, z, i, (d) => (d === 0 ? 0 : d >= 1 + i - 2 ? 2 : 1), canReplaceTree)) return false;
  const below = R.id(x, y - 1, z);
  if ((below === GRASS || below === DIRT || below === FARMLAND) && y < 256 - i - 1) {
    dirtUnder(R, x, y - 1, z);
    for (let i2 = y - 3 + i; i2 <= y + i; i2++) {
      const k2 = i2 - (y + i);
      const l2 = 1 - Math.trunc(k2 / 2);
      for (let i3 = x - l2; i3 <= x + l2; i3++) {
        const j1 = i3 - x;
        for (let k1 = z - l2; k1 <= z + l2; k1++) {
          const l1 = k1 - z;
          if (Math.abs(j1) !== l2 || Math.abs(l1) !== l2 || (rand.nextInt(2) !== 0 && k2 !== 0)) {
            const b = R.id(i3, i2, k1);
            if (b === 0 || isLeaf(b)) R.set(i3, i2, k1, leafState(BIRCH));
          }
        }
      }
    }
    for (let j2 = 0; j2 < i; j2++) { const b = R.id(x, y + j2, z); if (b === 0 || isLeaf(b)) R.set(x, y + j2, z, logState(BIRCH)); }
    return true;
  }
  return false;
}

// WorldGenTaiga1 (pinheiro fino)
export function genTaiga1(R, rand, x, y, z) {
  const i = rand.nextInt(5) + 7;
  const j = i - rand.nextInt(2) - 3;
  const k = i - j;
  const l = 1 + rand.nextInt(k + 1);
  if (y < 1 || y + i + 1 > 256) return false;
  if (!checkColumn(R, x, y, z, i, (d) => (d < j ? 0 : l), canReplaceTree)) return false;
  const below = R.id(x, y - 1, z);
  if ((below === GRASS || below === DIRT) && y < 256 - i - 1) {
    dirtUnder(R, x, y - 1, z);
    let k2 = 0;
    for (let l2 = y + i; l2 >= y + j; l2--) {
      for (let j3 = x - k2; j3 <= x + k2; j3++) {
        const k3 = j3 - x;
        for (let i2 = z - k2; i2 <= z + k2; i2++) {
          const j2 = i2 - z;
          if (Math.abs(k3) !== k2 || Math.abs(j2) !== k2 || k2 <= 0) { if (!isFull(R.id(j3, l2, i2))) R.set(j3, l2, i2, leafState(SPRUCE)); }
        }
      }
      if (k2 >= 1 && l2 === y + j + 1) k2--;
      else if (k2 < l) k2++;
    }
    for (let i3 = 0; i3 < i - 1; i3++) { const b = R.id(x, y + i3, z); if (b === 0 || isLeaf(b)) R.set(x, y + i3, z, logState(SPRUCE)); }
    return true;
  }
  return false;
}

// WorldGenTaiga2 (abeto em camadas)
export function genTaiga2(R, rand, x, y, z) {
  const i = rand.nextInt(4) + 6;
  const j = 1 + rand.nextInt(2);
  const k = i - j;
  const l = 2 + rand.nextInt(2);
  if (y < 1 || y + i + 1 > 256) return false;
  if (!checkColumn(R, x, y, z, i, (d) => (d < j ? 0 : l), (b) => b === 0 || isLeaf(b))) return false;
  const below = R.id(x, y - 1, z);
  if ((below === GRASS || below === DIRT || below === FARMLAND) && y < 256 - i - 1) {
    dirtUnder(R, x, y - 1, z);
    let i3 = rand.nextInt(2), j3 = 1, k3 = 0;
    for (let l3 = 0; l3 <= k; l3++) {
      const j4 = y + i - l3;
      for (let i2 = x - i3; i2 <= x + i3; i2++) {
        const j2 = i2 - x;
        for (let k2 = z - i3; k2 <= z + i3; k2++) {
          const l2 = k2 - z;
          if (Math.abs(j2) !== i3 || Math.abs(l2) !== i3 || i3 <= 0) { if (!isFull(R.id(i2, j4, k2))) R.set(i2, j4, k2, leafState(SPRUCE)); }
        }
      }
      if (i3 >= j3) { i3 = k3; k3 = 1; j3++; if (j3 > l) j3 = l; } else i3++;
    }
    const i4 = rand.nextInt(3);
    for (let k4 = 0; k4 < i - i4; k4++) { const b = R.id(x, y + k4, z); if (b === 0 || isLeaf(b)) R.set(x, y + k4, z, logState(SPRUCE)); }
    return true;
  }
  return false;
}

// WorldGenSwamp (carvalho do pântano, com vinhas)
export function genSwamp(R, rand, x, y, z) {
  const i = rand.nextInt(4) + 5;
  while (isLiquid(R.id(x, y - 1, z)) && R.id(x, y - 1, z) !== 0 && (R.id(x, y - 1, z) === WATER || R.id(x, y - 1, z) === WATER_F)) y--;
  if (y < 1 || y + i + 1 > 256) return false;
  let flag = true;
  for (let j = y; j <= y + 1 + i && flag; j++) {
    let k = 1;
    if (j === y) k = 0;
    if (j >= y + 1 + i - 2) k = 3;
    for (let l = x - k; l <= x + k && flag; l++) for (let i1 = z - k; i1 <= z + k && flag; i1++) {
      if (j >= 0 && j < 256) {
        const b = R.id(l, j, i1);
        if (b !== 0 && !isLeaf(b)) { if (b !== WATER && b !== WATER_F) flag = false; else if (j > y) flag = false; }
      } else flag = false;
    }
  }
  if (!flag) return false;
  const below = R.id(x, y - 1, z);
  if ((below === GRASS || below === DIRT) && y < 256 - i - 1) {
    dirtUnder(R, x, y - 1, z);
    for (let l1 = y - 3 + i; l1 <= y + i; l1++) {
      const k2 = l1 - (y + i);
      const i3 = 2 - Math.trunc(k2 / 2);
      for (let k3 = x - i3; k3 <= x + i3; k3++) {
        const l3 = k3 - x;
        for (let j1 = z - i3; j1 <= z + i3; j1++) {
          const k1 = j1 - z;
          if (Math.abs(l3) !== i3 || Math.abs(k1) !== i3 || (rand.nextInt(2) !== 0 && k2 !== 0)) { if (!isFull(R.id(k3, l1, j1))) R.set(k3, l1, j1, leafState(OAK)); }
        }
      }
    }
    for (let i2 = 0; i2 < i; i2++) { const b = R.id(x, y + i2, z); if (b === 0 || isLeaf(b) || b === WATER_F || b === WATER) R.set(x, y + i2, z, logState(OAK)); }
    const hang = (px, py, pz, bit) => { R.set(px, py, pz, st(VINE, bit)); let n = 4; for (py--; R.isAir(px, py, pz) && n > 0; n--) { R.set(px, py, pz, st(VINE, bit)); py--; } };
    for (let j2 = y - 3 + i; j2 <= y + i; j2++) {
      const l2 = j2 - (y + i);
      const j3 = 2 - Math.trunc(l2 / 2);
      for (let i4 = x - j3; i4 <= x + j3; i4++) for (let j4 = z - j3; j4 <= z + j3; j4++) {
        if (isLeaf(R.id(i4, j2, j4))) {
          if (rand.nextInt(4) === 0 && R.isAir(i4 - 1, j2, j4)) hang(i4 - 1, j2, j4, 8);
          if (rand.nextInt(4) === 0 && R.isAir(i4 + 1, j2, j4)) hang(i4 + 1, j2, j4, 2);
          if (rand.nextInt(4) === 0 && R.isAir(i4, j2, j4 - 1)) hang(i4, j2, j4 - 1, 1);
          if (rand.nextInt(4) === 0 && R.isAir(i4, j2, j4 + 1)) hang(i4, j2, j4 + 1, 4);
        }
      }
    }
    return true;
  }
  return false;
}

// WorldGenShrub (arbusto da selva)
export function genShrub(R, rand, x, y, z) {
  for (;;) { const b = R.id(x, y, z); if ((b === 0 || isLeaf(b)) && y > 0) y--; else break; }
  const b1 = R.id(x, y, z);
  if (b1 === DIRT || b1 === GRASS) {
    y++;
    R.set(x, y, z, logState(JUNGLE));
    for (let i = y; i <= y + 2; i++) {
      const k = 2 - (i - y);
      for (let l = x - k; l <= x + k; l++) {
        const i1 = l - x;
        for (let j1 = z - k; j1 <= z + k; j1++) {
          const k1 = j1 - z;
          if (Math.abs(i1) !== k || Math.abs(k1) !== k || rand.nextInt(2) !== 0) { if (!isFull(R.id(l, i, j1))) R.set(l, i, j1, leafState(OAK)); }
        }
      }
    }
  }
  return true;
}

// WorldGenBigTree (carvalho grande)
export function genBigTree(R, rand0, x, y, z, leafDistanceLimit = 4) {
  const rand = new JRandom(rand0.nextLong());   // WorldGenBigTree guarda um Random próprio, semeado pelo do chamador
  const base = { x, y, z };
  let heightLimit = 5 + rand.nextInt(12);
  const heightAttenuation = 0.618, branchSlope = 0.381, scaleWidth = 1.0, leafDensity = 1.0;
  const gd = (dx, dy, dz) => { const a = Math.abs(dx), b = Math.abs(dy), c = Math.abs(dz); return c > a && c > b ? c : b > a ? b : a; };
  const checkLine = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const i = gd(dx, dy, dz);
    if (i === 0) return -1;
    const fx = f(dx / i), fy = f(dy / i), fz = f(dz / i);
    for (let j = 0; j <= i; j++) {
      const px = Math.floor(a.x + f(0.5 + f(j * fx))), py = Math.floor(a.y + f(0.5 + f(j * fy))), pz = Math.floor(a.z + f(0.5 + f(j * fz)));
      if (!canReplaceTree(R.id(px, py, pz))) return j;
    }
    return -1;
  };
  // validTreeLocation
  const bb = R.id(x, y - 1, z);
  if (bb !== DIRT && bb !== GRASS && bb !== FARMLAND) return false;
  {
    const i = checkLine(base, { x, y: y + heightLimit - 1, z });
    if (i !== -1) { if (i < 6) return false; heightLimit = i; }
  }
  // generateLeafNodeList
  let height = Math.trunc(heightLimit * heightAttenuation);
  if (height >= heightLimit) height = heightLimit - 1;
  let i = Math.trunc(1.382 + Math.pow(leafDensity * heightLimit / 13, 2));
  if (i < 1) i = 1;
  const j = y + height;
  let k = heightLimit - leafDistanceLimit;
  const nodes = [{ x, y: y + k, z, by: j }];
  const layerSize = (h) => {
    if (h < f(heightLimit * f(0.3))) return -1;
    const ff = f(heightLimit / 2);
    const f1 = f(ff - h);
    let f2 = f(Math.sqrt(f(f(ff * ff) - f(f1 * f1))));
    if (f1 === 0) f2 = ff;
    else if (Math.abs(f1) >= ff) return 0;
    return f(f2 * f(0.5));
  };
  for (; k >= 0; k--) {
    const fs = layerSize(k);
    if (fs >= 0) {
      for (let l = 0; l < i; l++) {
        const d0 = scaleWidth * fs * (rand.nextFloat() + 0.328);
        const d1 = f(rand.nextFloat() * 2) * Math.PI;
        const d2 = d0 * Math.sin(d1) + 0.5, d3 = d0 * Math.cos(d1) + 0.5;
        const bp = { x: Math.floor(x + d2), y: Math.floor(y + (k - 1)), z: Math.floor(z + d3) };
        const bp1 = { x: bp.x, y: bp.y + leafDistanceLimit, z: bp.z };
        if (checkLine(bp, bp1) === -1) {
          const i1 = x - bp.x, j1 = z - bp.z;
          const d4 = bp.y - Math.sqrt(i1 * i1 + j1 * j1) * branchSlope;
          const k1 = d4 > j ? j : Math.trunc(d4);
          const bp2 = { x, y: k1, z };
          if (checkLine(bp2, bp) === -1) nodes.push({ x: bp.x, y: bp.y, z: bp.z, by: bp2.y });
        }
      }
    }
  }
  // folhas
  const leafAt = (cx, cy, cz, size) => {
    const ii = Math.trunc(size + 0.618);
    for (let jj = -ii; jj <= ii; jj++) for (let kk = -ii; kk <= ii; kk++) {
      if (Math.pow(Math.abs(jj) + 0.5, 2) + Math.pow(Math.abs(kk) + 0.5, 2) <= size * size) {
        const b = R.id(cx + jj, cy, cz + kk);
        if (b === 0 || isLeaf(b)) R.set(cx + jj, cy, cz + kk, leafState(OAK));
      }
    }
  };
  const leafSize = (n) => (n >= 0 && n < leafDistanceLimit ? (n !== 0 && n !== leafDistanceLimit - 1 ? 3 : 2) : -1);
  for (const n of nodes) for (let q = 0; q < leafDistanceLimit; q++) leafAt(n.x, n.y + q, n.z, leafSize(q));
  // tronco (e galhos): linha entre dois pontos com eixo do tronco
  const line = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const ii = gd(dx, dy, dz);
    const fx = f(dx / ii), fy = f(dy / ii), fz = f(dz / ii);
    for (let jj = 0; jj <= ii; jj++) {
      const px = Math.floor(a.x + f(0.5 + f(jj * fx))), py = Math.floor(a.y + f(0.5 + f(jj * fy))), pz = Math.floor(a.z + f(0.5 + f(jj * fz)));
      const ax = Math.abs(px - a.x), az = Math.abs(pz - a.z), m = Math.max(ax, az);
      let axis = 0;
      if (m > 0) axis = ax === m ? 1 : az === m ? 2 : 0;
      R.set(px, py, pz, logState(OAK, axis));
    }
  };
  line(base, { x, y: y + height, z });
  for (const n of nodes) {
    const by = n.by;
    const bp = { x, y: by, z };
    if (!(bp.x === n.x && bp.y === n.y && bp.z === n.z) && by - y >= heightLimit * 0.2) line(bp, n);
  }
  return true;
}

// WorldGenHugeTrees (mega pinheiro / mega selva): base 2×2
function hugeOk(R, x, y, z, h) {
  if (y < 1 || y + h + 1 > 256) return false;
  for (let i = 0; i <= 1 + h; i++) {
    const j = i === 0 ? 1 : 2;
    for (let k = -j; k <= j; k++) for (let l = -j; l <= j; l++) {
      if (y + i < 0 || y + i >= 256 || !canReplaceTree(R.id(x + k, y + i, z + l))) return false;
    }
  }
  const below = R.id(x, y - 1, z);
  if ((below === GRASS || below === DIRT) && y >= 2) {
    dirtUnder(R, x, y - 1, z); dirtUnder(R, x + 1, y - 1, z); dirtUnder(R, x, y - 1, z + 1); dirtUnder(R, x + 1, y - 1, z + 1);
    return true;
  }
  return false;
}
function hugeLeaves(R, x, y, z, r, leaf) {
  const i = r * r;
  for (let j = -r; j <= r + 1; j++) for (let k = -r; k <= r + 1; k++) {
    const l = j - 1, i1 = k - 1;
    if (j * j + k * k <= i || l * l + i1 * i1 <= i || j * j + i1 * i1 <= i || l * l + k * k <= i) {
      const b = R.id(x + j, y, z + k);
      if (b === 0 || isLeaf(b)) R.set(x + j, y, z + k, leaf);
    }
  }
}
function hugeLeaves2(R, x, y, z, r, leaf) {
  const i = r * r;
  for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
    if (j * j + k * k <= i) { const b = R.id(x + j, y, z + k); if (b === 0 || isLeaf(b)) R.set(x + j, y, z + k, leaf); }
  }
}
export function genMegaPine(R, rand, x, y, z, useBaseHeight) {
  const base = 13, extra = 15;
  let h = rand.nextInt(3) + base;
  if (extra > 1) h += rand.nextInt(extra);
  if (!hugeOk(R, x, y, z, h)) return false;
  // func_150541_c: copas em cones
  {
    const i = rand.nextInt(5) + (useBaseHeight ? base : 3);
    let j = 0;
    for (let k = y + h - i; k <= y + h; k++) {
      const l = y + h - k;
      const i1 = 0 + Math.floor(f(f(l / i) * f(3.5)));
      hugeLeaves(R, x, k, z, i1 + (l > 0 && i1 === j && (k & 1) === 0 ? 1 : 0), leafState(SPRUCE));
      j = i1;
    }
  }
  const wood = logState(SPRUCE);
  for (let j = 0; j < h; j++) {
    for (const [dx, dz] of [[0, 0], ...(j < h - 1 ? [[1, 0], [1, 1], [0, 1]] : [])]) {
      const b = R.id(x + dx, y + j, z + dz);
      if (b === 0 || isLeaf(b)) R.set(x + dx, y + j, z + dz, wood);
    }
  }
  // func_180711_a: podzol ao redor
  const podzolAt = (px, pz) => {
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i) !== 2 || Math.abs(j) !== 2) {
      for (let q = 2; q >= -3; q--) {
        const b = R.id(px + i, y + q, pz + j);
        if (b === GRASS || b === DIRT) { R.set(px + i, y + q, pz + j, st(DIRT, 2)); break; }
        if (b !== 0 && q < 0) break;
      }
    }
  };
  podzolAt(x - 1, z - 1); podzolAt(x + 2, z - 1); podzolAt(x - 1, z + 2); podzolAt(x + 2, z + 2);
  for (let i = 0; i < 5; i++) { const j = rand.nextInt(64), k = j % 8, l = Math.trunc(j / 8); if (k === 0 || k === 7 || l === 0 || l === 7) podzolAt(x - 3 + k, z - 3 + l); }
  return true;
}
export function genMegaJungle(R, rand, x, y, z) {
  const base = 10, extra = 20;
  let i = rand.nextInt(3) + base;
  if (extra > 1) i += rand.nextInt(extra);
  if (!hugeOk(R, x, y, z, i)) return false;
  const leaf = leafState(JUNGLE), wood = logState(JUNGLE);
  for (let j = -2; j <= 0; j++) hugeLeaves(R, x, y + i + j, z, 3 - j, leaf);
  for (let j = y + i - 2 - rand.nextInt(4); j > y + Math.trunc(i / 2); j -= 2 + rand.nextInt(4)) {
    const fa = f(f(rand.nextFloat() * f(Math.PI)) * 2);
    let k = x + Math.trunc(0.5 + jcos(fa) * 4), l = z + Math.trunc(0.5 + jsin(fa) * 4);
    for (let i1 = 0; i1 < 5; i1++) {
      k = x + Math.trunc(1.5 + jcos(fa) * i1); l = z + Math.trunc(1.5 + jsin(fa) * i1);
      R.set(k, j - 3 + Math.trunc(i1 / 2), l, wood);
    }
    const j2 = 1 + rand.nextInt(2);
    for (let k1 = j - j2; k1 <= j; k1++) hugeLeaves2(R, k, k1, l, 1 - (k1 - j), leaf);
  }
  const vine = (px, py, pz, bit) => { if (rand.nextInt(3) > 0 && R.isAir(px, py, pz)) R.set(px, py, pz, st(VINE, bit)); };
  for (let i2 = 0; i2 < i; i2++) {
    const put = (px, pz) => canReplaceTree(R.id(px, y + i2, pz));
    if (put(x, z)) {
      R.set(x, y + i2, z, wood);
      if (i2 > 0) { vine(x - 1, y + i2, z, 8); vine(x, y + i2, z - 1, 1); }
    }
    if (i2 < i - 1) {
      if (put(x + 1, z)) { R.set(x + 1, y + i2, z, wood); if (i2 > 0) { vine(x + 2, y + i2, z, 2); vine(x + 1, y + i2, z - 1, 1); } }
      if (put(x + 1, z + 1)) { R.set(x + 1, y + i2, z + 1, wood); if (i2 > 0) { vine(x + 2, y + i2, z + 1, 2); vine(x + 1, y + i2, z + 2, 4); } }
      if (put(x, z + 1)) { R.set(x, y + i2, z + 1, wood); if (i2 > 0) { vine(x - 1, y + i2, z + 1, 8); vine(x, y + i2, z + 2, 4); } }
    }
  }
  return true;
}
function jcos(v) { return Math.fround(Math.cos(v)); }
function jsin(v) { return Math.fround(Math.sin(v)); }

// WorldGenSavannaTree (acácia)
export function genSavannaTree(R, rand, x, y, z) {
  const i = rand.nextInt(3) + rand.nextInt(3) + 5;
  if (y < 1 || y + i + 1 > 256) return false;
  if (!checkColumn(R, x, y, z, i, (d) => (d === 0 ? 0 : d >= 1 + i - 2 ? 2 : 1), canReplaceTree)) return false;
  const below = R.id(x, y - 1, z);
  if (!((below === GRASS || below === DIRT) && y < 256 - i - 1)) return false;
  dirtUnder(R, x, y - 1, z);
  const DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];   // S, W, N, E (EnumFacing.Plane.HORIZONTAL.random usa nextInt(4))
  const dir = DIRS[rand.nextInt(4)];
  const k2 = i - rand.nextInt(4) - 1;
  let l2 = 3 - rand.nextInt(3);
  let i3 = x, j1 = z, k1 = 0;
  const log = logState(ACACIA), leaf = leafState(ACACIA);
  const putLeaf = (px, py, pz) => { const b = R.id(px, py, pz); if (b === 0 || isLeaf(b)) R.set(px, py, pz, leaf); };
  for (let l1 = 0; l1 < i; l1++) {
    const i2 = y + l1;
    if (l1 >= k2 && l2 > 0) { i3 += dir[0]; j1 += dir[1]; l2--; }
    const b = R.id(i3, i2, j1);
    if (b === 0 || isLeaf(b)) { R.set(i3, i2, j1, log); k1 = i2; }
  }
  let top = { x: i3, y: k1, z: j1 };
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) if (Math.abs(a) !== 3 || Math.abs(b) !== 3) putLeaf(top.x + a, top.y, top.z + b);
  top = { x: top.x, y: top.y + 1, z: top.z };
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) putLeaf(top.x + a, top.y, top.z + b);
  putLeaf(top.x + 2, top.y, top.z); putLeaf(top.x - 2, top.y, top.z); putLeaf(top.x, top.y, top.z + 2); putLeaf(top.x, top.y, top.z - 2);
  i3 = x; j1 = z;
  const dir1 = DIRS[rand.nextInt(4)];
  if (dir1 !== dir) {
    const l3 = k2 - rand.nextInt(2) - 1;
    let k4 = 1 + rand.nextInt(3);
    k1 = 0;
    for (let l4 = l3; l4 < i && k4 > 0; k4--) {
      if (l4 >= 1) {
        const j2 = y + l4;
        i3 += dir1[0]; j1 += dir1[1];
        const b = R.id(i3, j2, j1);
        if (b === 0 || isLeaf(b)) { R.set(i3, j2, j1, log); k1 = j2; }
      }
      l4++;
    }
    if (k1 > 0) {
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (Math.abs(a) !== 2 || Math.abs(b) !== 2) putLeaf(i3 + a, k1, j1 + b);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) putLeaf(i3 + a, k1 + 1, j1 + b);
    }
  }
  return true;
}

// WorldGenCanopyTree (carvalho escuro, tronco 2×2)
export function genCanopy(R, rand, x, y, z) {
  const i = rand.nextInt(3) + rand.nextInt(2) + 6;
  if (y < 1 || y + i + 1 >= 256) return false;
  const below = R.id(x, y - 1, z);
  if (below !== GRASS && below !== DIRT) return false;
  for (let l = 0; l <= i + 1; l++) {
    let i1 = 1;
    if (l === 0) i1 = 0;
    if (l >= i - 1) i1 = 2;
    for (let j1 = -i1; j1 <= i1; j1++) for (let k1 = -i1; k1 <= i1; k1++) if (!canReplaceTree(R.id(x + j1, y + l, z + k1))) return false;
  }
  dirtUnder(R, x, y - 1, z); dirtUnder(R, x + 1, y - 1, z); dirtUnder(R, x, y - 1, z + 1); dirtUnder(R, x + 1, y - 1, z + 1);
  const DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];
  const dir = DIRS[rand.nextInt(4)];
  const i1 = i - rand.nextInt(4);
  let j1 = 2 - rand.nextInt(3);
  let k1 = x, l1 = z;
  const i2 = y + i - 1;
  const log = logState(DARK_OAK), leaf = leafState(DARK_OAK);
  const putLog = (px, py, pz) => { if (canReplaceTree(R.id(px, py, pz))) R.set(px, py, pz, log); };
  const putLeaf = (px, py, pz) => { if (R.id(px, py, pz) === 0) R.set(px, py, pz, leaf); };
  for (let j2 = 0; j2 < i; j2++) {
    if (j2 >= i1 && j1 > 0) { k1 += dir[0]; l1 += dir[1]; j1--; }
    const k2 = y + j2;
    const b = R.id(k1, k2, l1);
    if (b === 0 || isLeaf(b)) { putLog(k1, k2, l1); putLog(k1 + 1, k2, l1); putLog(k1, k2, l1 + 1); putLog(k1 + 1, k2, l1 + 1); }
  }
  for (let i3 = -2; i3 <= 0; i3++) for (let l3 = -2; l3 <= 0; l3++) {
    let k4 = -1;
    putLeaf(k1 + i3, i2 + k4, l1 + l3); putLeaf(1 + k1 - i3, i2 + k4, l1 + l3); putLeaf(k1 + i3, i2 + k4, 1 + l1 - l3); putLeaf(1 + k1 - i3, i2 + k4, 1 + l1 - l3);
    if ((i3 > -2 || l3 > -1) && (i3 !== -1 || l3 !== -2)) {
      k4 = 1;
      putLeaf(k1 + i3, i2 + k4, l1 + l3); putLeaf(1 + k1 - i3, i2 + k4, l1 + l3); putLeaf(k1 + i3, i2 + k4, 1 + l1 - l3); putLeaf(1 + k1 - i3, i2 + k4, 1 + l1 - l3);
    }
  }
  if (rand.nextBoolean()) { putLeaf(k1, i2 + 2, l1); putLeaf(k1 + 1, i2 + 2, l1); putLeaf(k1 + 1, i2 + 2, l1 + 1); putLeaf(k1, i2 + 2, l1 + 1); }
  for (let j3 = -3; j3 <= 4; j3++) for (let i4 = -3; i4 <= 4; i4++) {
    if ((j3 !== -3 || i4 !== -3) && (j3 !== -3 || i4 !== 4) && (j3 !== 4 || i4 !== -3) && (j3 !== 4 || i4 !== 4) && (Math.abs(j3) < 3 || Math.abs(i4) < 3)) putLeaf(k1 + j3, i2, l1 + i4);
  }
  for (let k3 = -1; k3 <= 2; k3++) for (let j4 = -1; j4 <= 2; j4++) {
    if ((k3 < 0 || k3 > 1 || j4 < 0 || j4 > 1) && rand.nextInt(3) <= 0) {
      const l4 = rand.nextInt(3) + 2;
      for (let i5 = 0; i5 < l4; i5++) putLog(x + k3, i2 - i5 - 1, z + j4);
      for (let j5 = -1; j5 <= 1; j5++) for (let l2 = -1; l2 <= 1; l2++) putLeaf(k1 + k3 + j5, i2, l1 + j4 + l2);
      for (let k5 = -2; k5 <= 2; k5++) for (let l5 = -2; l5 <= 2; l5++) if (Math.abs(k5) !== 2 || Math.abs(l5) !== 2) putLeaf(k1 + k3 + k5, i2 - 1, l1 + j4 + l5);
    }
  }
  return true;
}

