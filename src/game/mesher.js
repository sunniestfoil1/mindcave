// Mesher: seções 16³ + greedy meshing + modelos não-cubo (cruz, caixas, líquidos).
// Convenções (MC24):
//  · atributo "color" = SÓ a tinta (bioma/lã); o sombreamento por face (1.8) vai multiplicado no "ao";
//  · a chave do greedy inclui a luz da célula da frente e o padrão de oclusão, para nunca fundir áreas de luz diferente;
//  · saída compacta: cores/luz/ao em Uint8 normalizado (menos memória e menos bytes para a GPU).
import { stateId, chunkIndex } from './chunk';
import { getBlock, isOpaque, tileForFace, getModelBox, WOOL_COLORS } from './blocks';
import { blockBoxes } from './shapes';

const NB = [[0, 1, 0], [0, -1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

const SS = 16; // section size

const FACES = [
  { dir: [0, 1, 0], face: 'top', sh: 1.0, na: 1, c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { dir: [0, -1, 0], face: 'bottom', sh: 0.5, na: 1, c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: [0, 0, -1], face: 'side', sh: 0.8, na: 2, c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
  { dir: [0, 0, 1], face: 'side', sh: 0.8, na: 2, c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { dir: [-1, 0, 0], face: 'side', sh: 0.6, na: 0, c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { dir: [1, 0, 0], face: 'side', sh: 0.6, na: 0, c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
];
const UV_CORNER = [[0, 0], [0, 1], [1, 1], [1, 0]];
// Planos cruzados a 45° (recuo de 0,05 como na 1.8)
const CROSS_PLANES = [
  [[0.05, 0, 0.05], [0.05, 1, 0.05], [0.95, 1, 0.95], [0.95, 0, 0.95]],
  [[0.95, 0, 0.05], [0.95, 1, 0.05], [0.05, 1, 0.95], [0.05, 0, 0.95]],
];

function isFluidId(id) { return id === 8 || id === 9 || id === 10 || id === 11; }

function fluidHeight(state) {
  const id = stateId(state);
  const meta = state & 0xf;
  if (id === 9 || id === 11) return 0.875;
  if (id === 8 || id === 10) {
    if (meta === 8) return 1.0;
    return Math.max(0, (8 - (meta || 1)) / 9);
  }
  return 0;
}

function fluidType(state) {
  const id = stateId(state);
  if (id === 8 || id === 9) return 'water';
  if (id === 10 || id === 11) return 'lava';
  return null;
}

// ===== Tinta =====
const TC = [1, 1, 1];
const DEFAULT_TINT = { grass: [0.569, 0.741, 0.349], foliage: [0.467, 0.671, 0.184], water: [0.247, 0.463, 0.894] };
const SPRUCE = [0.38, 0.6, 0.38];
const BIRCH = [0.502, 0.655, 0.333];

// Tinta (0..1) do bloco na coluna (lx, lz) do chunk, ou null se o bloco não é tingido.
// tint: Uint8Array(256 × 9) — [grama rgb, folhagem rgb, água rgb] por coluna.
function tintFor(block, face, meta, tint, lx, lz) {
  const id = block.id;
  if (id === 35 || id === 95 || id === 159 || id === 171) {
    const c = (WOOL_COLORS[meta & 15] || WOOL_COLORS[0])[0];
    TC[0] = ((c >> 16) & 255) / 255; TC[1] = ((c >> 8) & 255) / 255; TC[2] = (c & 255) / 255;
    return TC;
  }
  if (block.tintColor) return block.tintColor;
  const kind = block.tint;
  if (!kind) return null;
  if (id === 2 && face === 'bottom') return null;
  if (id === 18) {
    if ((meta & 3) === 1) return SPRUCE;
    if ((meta & 3) === 2) return BIRCH;
  }
  if (!tint) return DEFAULT_TINT[kind];
  const o = (lx + 16 * lz) * 9 + (kind === 'grass' ? 0 : kind === 'foliage' ? 3 : 6);
  TC[0] = tint[o] / 255; TC[1] = tint[o + 1] / 255; TC[2] = tint[o + 2] / 255;
  return TC;
}

// ===== Luz suave + oclusão ambiente por vértice =====
const BP = [0, 0, 0];
const P = [0, 0, 0];
const VOUT = { sky: 0, block: 0, ao: 1 };

function opaqueAt(getBlockAbs, x, y, z) { return isOpaque(stateId(getBlockAbs(x, y, z))); }

function vertexLightAO(getLightAbs, getBlockAbs, bx, by, bz, corner, dir, na) {
  const ta1 = (na + 1) % 3;
  const ta2 = (na + 2) % 3;
  BP[0] = bx; BP[1] = by; BP[2] = bz;
  const outNa = BP[na] + dir[na];
  const t1Lo = BP[ta1] + (corner[ta1] === 0 ? -1 : 0);
  const t2Lo = BP[ta2] + (corner[ta2] === 0 ? -1 : 0);

  // célula à frente da face: sua luz substitui a de células opacas (como o Minecraft faz)
  P[na] = outNa; P[ta1] = BP[ta1]; P[ta2] = BP[ta2];
  const lc = getLightAbs(P[0], P[1], P[2]);
  const cs = lc.sky, cb = lc.block;

  let skySum = 0, blockSum = 0;
  for (let a = 0; a < 2; a++) {
    const t1 = t1Lo + a;
    for (let b = 0; b < 2; b++) {
      const t2 = t2Lo + b;
      P[na] = outNa; P[ta1] = t1; P[ta2] = t2;
      if ((t1 === BP[ta1] && t2 === BP[ta2]) || opaqueAt(getBlockAbs, P[0], P[1], P[2])) {
        skySum += cs; blockSum += cb;
      } else {
        const l = getLightAbs(P[0], P[1], P[2]);
        skySum += l.sky; blockSum += l.block;
      }
    }
  }
  const d1 = corner[ta1] === 0 ? -1 : 1;
  const d2 = corner[ta2] === 0 ? -1 : 1;
  P[na] = outNa; P[ta1] = BP[ta1] + d1; P[ta2] = BP[ta2];
  const s1 = opaqueAt(getBlockAbs, P[0], P[1], P[2]);
  P[na] = outNa; P[ta1] = BP[ta1]; P[ta2] = BP[ta2] + d2;
  const s2 = opaqueAt(getBlockAbs, P[0], P[1], P[2]);
  P[na] = outNa; P[ta1] = BP[ta1] + d1; P[ta2] = BP[ta2] + d2;
  const cc = opaqueAt(getBlockAbs, P[0], P[1], P[2]);
  let ao;
  if (s1 && s2) ao = 0.5;
  else if (s1 || s2) ao = 0.7;
  else if (cc) ao = 0.85;
  else ao = 1.0;
  VOUT.sky = skySum / 4; VOUT.block = blockSum / 4; VOUT.ao = ao;
  return VOUT;
}

// Padrão de oclusão (8 vizinhos no plano da face, à frente dela) — entra na chave do greedy
function aoPattern(getBlockAbs, fx, fy, fz, na) {
  const ta1 = (na + 1) % 3, ta2 = (na + 2) % 3;
  let bits = 0, bit = 0;
  for (let d1 = -1; d1 <= 1; d1++) {
    for (let d2 = -1; d2 <= 1; d2++) {
      if (d1 === 0 && d2 === 0) continue;
      P[0] = fx; P[1] = fy; P[2] = fz;
      P[ta1] += d1; P[ta2] += d2;
      if (opaqueAt(getBlockAbs, P[0], P[1], P[2])) bits |= (1 << bit);
      bit++;
    }
  }
  return bits;
}

// Greedy merge: funde células adjacentes de mesma chave em retângulos
function mergeMask(mask, visited) {
  const rects = [];
  for (let a1 = 0; a1 < SS; a1++) {
    for (let a2 = 0; a2 < SS; a2++) {
      const idx = a1 * SS + a2;
      if (visited[idx] || mask[idx] === 0) continue;
      const key = mask[idx];
      let rw = 1;
      while (a2 + rw < SS && mask[a1 * SS + a2 + rw] === key && !visited[a1 * SS + a2 + rw]) rw++;
      let rh = 1;
      outer: while (a1 + rh < SS) {
        for (let i = 0; i < rw; i++) {
          if (mask[(a1 + rh) * SS + a2 + i] !== key || visited[(a1 + rh) * SS + a2 + i]) break outer;
        }
        rh++;
      }
      for (let da1 = 0; da1 < rh; da1++)
        for (let da2 = 0; da2 < rw; da2++)
          visited[(a1 + da1) * SS + a2 + da2] = 1;
      rects.push({ ra1: a1, ra2: a2, w: rw, h: rh, key });
    }
  }
  return rects;
}

// Verifica se uma seção 16³ é inteiramente ar (skip rápido)
export function isSectionEmpty(data, sectionY) {
  const yBase = sectionY * SS;
  for (let y = yBase; y < yBase + SS; y++)
    for (let x = 0; x < SS; x++)
      for (let z = 0; z < SS; z++)
        if (data[chunkIndex(x, y, z)] !== 0) return false;
  return true;
}

function newBuf() { return { pos: [], col: [], uv: [], light: [], ao: [], tileOrigin: [], idx: [] }; }

function pushVert(t, x, y, z, u, v, tile, tr, tg, tb, lb, ls, ao) {
  t.pos.push(x, y, z);
  t.col.push(tr, tg, tb);
  t.uv.push(u, v);
  t.tileOrigin.push(tile.u0, tile.v0);
  t.light.push(lb, ls);
  t.ao.push(ao);
}

// Caixa [x0,y0,z0,x1,y1,z1] com UV recortada pelas coordenadas (como os modelos JSON do Minecraft)
function emitBox(t, tTop, tBottom, tSide, tint, wx, wy, wz, box, l, getBlockAbs) {
  const tr = tint ? tint[0] : 1, tg = tint ? tint[1] : 1, tb = tint ? tint[2] : 1;
  for (let fi = 0; fi < 6; fi++) {
    const f = FACES[fi];
    const d = f.dir;
    const tile = d[1] === 1 ? tTop : (d[1] === -1 ? tBottom : tSide);
    const onEdge = (d[1] === 1 && box[4] >= 1) || (d[1] === -1 && box[1] <= 0)
      || (d[2] === -1 && box[2] <= 0) || (d[2] === 1 && box[5] >= 1)
      || (d[0] === -1 && box[0] <= 0) || (d[0] === 1 && box[3] >= 1);
    if (onEdge && opaqueAt(getBlockAbs, wx + d[0], wy + d[1], wz + d[2])) continue;
    const base = t.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      const c = f.c[i];
      const px = c[0] ? box[3] : box[0], py = c[1] ? box[4] : box[1], pz = c[2] ? box[5] : box[2];
      let u, v;
      if (d[1] === 1) { u = px; v = pz; }
      else if (d[1] === -1) { u = pz; v = px; }
      else if (d[2] === -1) { u = px; v = py; }
      else if (d[2] === 1) { u = 1 - px; v = py; }
      else if (d[0] === -1) { u = 1 - pz; v = py; }
      else { u = pz; v = py; }
      pushVert(t, wx + px, wy + py, wz + pz, u, v, tile, tr, tg, tb, l.block / 15, l.sky / 15, f.sh);
    }
    t.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

const clamp8 = (v) => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255));

function toGeo(b) {
  if (b.pos.length === 0) return null;
  const n = b.pos.length / 3;
  const colors = new Uint8Array(n * 3);
  for (let i = 0; i < colors.length; i++) colors[i] = clamp8(b.col[i]);
  const lights = new Uint8Array(n * 2);
  for (let i = 0; i < lights.length; i++) lights[i] = clamp8(b.light[i]);
  const aos = new Uint8Array(n);
  for (let i = 0; i < n; i++) aos[i] = clamp8(b.ao[i]);
  return {
    positions: new Float32Array(b.pos),
    colors,
    uvs: new Float32Array(b.uv),
    lights,
    aos,
    tileOrigins: new Float32Array(b.tileOrigin),
    indices: n < 65536 ? new Uint16Array(b.idx) : new Uint32Array(b.idx),
  };
}

export function buildSectionMesh(getBlockLocal, sectionY, baseX, baseZ, getBlockAbs, getLightAbs, tiles, tintArr) {
  const op = newBuf();
  const wa = newBuf();
  const yBase = sectionY * SS;

  // === Pass 1: modelos não-cubo (cruz, caixas, líquidos), um bloco por vez ===
  for (let x = 0; x < SS; x++) {
    for (let z = 0; z < SS; z++) {
      for (let ly = 0; ly < SS; ly++) {
        const s = getBlockLocal(x, ly, z);
        if (s === 0) continue;
        const id = stateId(s);
        if (id === 0) continue;
        const block = getBlock(id);
        const model = block.model || 'cube';
        if (model === 'cube' || model === 'none') continue;
        const meta = s & 0xf;
        const wx = baseX + x, wy = yBase + ly, wz = baseZ + z;
        const isWaterBlk = id === 8 || id === 9;
        const target = isWaterBlk ? wa : op;

        if (model === 'cross') {
          const l = getLightAbs(wx, wy, wz);
          const tint = tintFor(block, 'side', meta, tintArr, x, z);
          const tr = tint ? tint[0] : 1, tg = tint ? tint[1] : 1, tb = tint ? tint[2] : 1;
          const t = tiles[tileForFace(block, 'side', meta)] || tiles.error;
          for (const plane of CROSS_PLANES) {
            const base = target.pos.length / 3;
            for (let i = 0; i < 4; i++) {
              const c = plane[i];
              pushVert(target, wx + c[0], wy + c[1], wz + c[2], UV_CORNER[i][0], UV_CORNER[i][1], t, tr, tg, tb, l.block / 15, l.sky / 15, 1.0);
            }
            // os dois lados do plano (sem culling no Minecraft para plantas)
            target.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
            target.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
          }
        } else if (model === 'liquid') {
          const aboveState = getBlockAbs(wx, wy + 1, wz);
          const fluidAbove = isFluidId(stateId(aboveState));
          const selfH = fluidAbove ? 1.0 : fluidHeight(s);
          const corners = [];
          for (let ci = 0; ci < 4; ci++) {
            const cx = (ci === 2 || ci === 3) ? 1 : 0;
            const cz = (ci === 1 || ci === 2) ? 1 : 0;
            corners.push(fluidCornerHeight(getBlockAbs, wx, wy, wz, cx, cz, selfH, fluidAbove));
          }
          const tint = tintFor(block, 'top', meta, tintArr, x, z);
          const tr = tint ? tint[0] : 1, tg = tint ? tint[1] : 1, tb = tint ? tint[2] : 1;
          const t = tiles[tileForFace(block, 'top', meta)] || tiles.error;
          const l = getLightAbs(wx, wy, wz);
          const lb = l.block / 15, ls = l.sky / 15;
          const aboveId = stateId(aboveState);
          if (aboveId === 0 || (!isFluidId(aboveId) && !isOpaque(aboveId))) {
            const base = target.pos.length / 3;
            const cTop = [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]];
            for (let i = 0; i < 4; i++) {
              pushVert(target, wx + cTop[i][0], wy + corners[i], wz + cTop[i][2], UV_CORNER[i][0], UV_CORNER[i][1], t, tr, tg, tb, lb, ls, 1.0);
            }
            target.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
          const sideDirs = [
            { dir: [0, 0, -1], c: [[0, corners[0], 0], [0, 0, 0], [1, 0, 0], [1, corners[3], 0]], sh: 0.8 },
            { dir: [0, 0, 1], c: [[1, corners[2], 1], [1, 0, 1], [0, 0, 1], [0, corners[1], 1]], sh: 0.8 },
            { dir: [-1, 0, 0], c: [[0, corners[1], 1], [0, 0, 1], [0, 0, 0], [0, corners[0], 0]], sh: 0.6 },
            { dir: [1, 0, 0], c: [[1, corners[3], 0], [1, 0, 0], [1, 0, 1], [1, corners[2], 1]], sh: 0.6 },
          ];
          for (const sf of sideDirs) {
            const ns = getBlockAbs(wx + sf.dir[0], wy, wz + sf.dir[2]);
            const nid = stateId(ns);
            if (nid !== 0 && (isOpaque(nid) || (isFluidId(nid) && fluidType(ns) === fluidType(s)))) continue;
            const base = target.pos.length / 3;
            for (let i = 0; i < 4; i++) {
              const c = sf.c[i];
              pushVert(target, wx + c[0], wy + c[1], wz + c[2], UV_CORNER[i][0], UV_CORNER[i][1], t, tr, tg, tb, lb, ls, sf.sh);
            }
            target.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        } else if (model === 'slab' || model === 'stairs') {
          // Brilho vindo dos vizinhos (o próprio bloco barra a luz, como "useNeighborBrightness" da 1.8)
          // (getLightAbs devolve um objeto reutilizado: copiar os números a cada leitura)
          const own = getLightAbs(wx, wy, wz);
          let lb = own.block, ls = own.sky;
          for (let d = 0; d < 6; d++) {
            const nl = getLightAbs(wx + NB[d][0], wy + NB[d][1], wz + NB[d][2]);
            if (nl.block > lb) lb = nl.block;
            if (nl.sky > ls) ls = nl.sky;
          }
          const l = { block: lb, sky: ls };
          const boxes = blockBoxes(s, getBlockAbs, wx, wy, wz);
          const tTop = tiles[tileForFace(block, 'top', meta)] || tiles.error;
          const tBottom = tiles[tileForFace(block, 'bottom', meta)] || tiles.error;
          const tSide = tiles[tileForFace(block, 'side', meta)] || tiles.error;
          for (const box of boxes) emitBox(target, tTop, tBottom, tSide, null, wx, wy, wz, box, l, getBlockAbs);
        } else {
          // 'box' | 'carpet' | 'torch' | 'snow' → caixa do registro
          const l = getLightAbs(wx, wy, wz);
          const tint = tintFor(block, 'side', meta, tintArr, x, z);
          const box = getModelBox(block, meta);
          const tTop = tiles[tileForFace(block, 'top', meta)] || tiles.error;
          const tBottom = tiles[tileForFace(block, 'bottom', meta)] || tiles.error;
          const tSide = tiles[tileForFace(block, 'side', meta)] || tiles.error;
          emitBox(target, tTop, tBottom, tSide, tint, wx, wy, wz, box, l, getBlockAbs);
        }
      }
    }
  }

  // === Pass 2: greedy meshing para cubos ===
  const mask = new Float64Array(SS * SS);
  const visited = new Uint8Array(SS * SS);
  const p = [0, 0, 0];

  for (const f of FACES) {
    const na = f.na;
    const ta1 = (na + 1) % 3;
    const ta2 = (na + 2) % 3;
    const dir = f.dir;

    for (let layer = 0; layer < SS; layer++) {
      mask.fill(0);
      visited.fill(0);
      let any = false;

      for (let a1 = 0; a1 < SS; a1++) {
        for (let a2 = 0; a2 < SS; a2++) {
          p[na] = layer; p[ta1] = a1; p[ta2] = a2;
          const s = getBlockLocal(p[0], p[1], p[2]);
          if (s === 0) continue;
          const id = stateId(s);
          if (id === 0) continue;
          const block = getBlock(id);
          if ((block.model || 'cube') !== 'cube') continue;
          const wx = baseX + p[0], wy = yBase + p[1], wz = baseZ + p[2];
          const nid = stateId(getBlockAbs(wx + dir[0], wy + dir[1], wz + dir[2]));
          if (nid !== 0) {
            if (isOpaque(nid)) continue;
            if (nid === id && (isFluidId(id) || block.render === 'translucent' || block.cullSame)) continue;
          }
          const fl = getLightAbs(wx + dir[0], wy + dir[1], wz + dir[2]);
          const lightByte = (fl.sky << 4) | fl.block;
          const bits = aoPattern(getBlockAbs, wx + dir[0], wy + dir[1], wz + dir[2], na);
          mask[a1 * SS + a2] = s + 65536 * lightByte + 16777216 * bits;
          any = true;
        }
      }
      if (!any) continue;

      const rects = mergeMask(mask, visited);
      for (const rect of rects) {
        const { ra1, ra2, w: rw, h: rh, key } = rect;
        const state = key % 65536;
        const id = stateId(state);
        const meta = state & 0xf;
        const block = getBlock(id);
        const isWaterBlk = id === 8 || id === 9;
        const target = isWaterBlk ? wa : op;
        const t = tiles[tileForFace(block, f.face, meta)] || tiles.error;
        const sh = f.sh;

        const aoVals = [0, 0, 0, 0];
        const lv = [0, 0, 0, 0, 0, 0, 0, 0];
        const tcols = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
          const bp = [0, 0, 0];
          bp[na] = layer;
          bp[ta1] = (f.c[i][ta1] === 0) ? ra1 : ra1 + rh - 1;
          bp[ta2] = (f.c[i][ta2] === 0) ? ra2 : ra2 + rw - 1;
          const vl = vertexLightAO(getLightAbs, getBlockAbs, baseX + bp[0], yBase + bp[1], baseZ + bp[2], f.c[i], dir, na);
          aoVals[i] = vl.ao * sh;
          lv[i * 2] = vl.block / 15;
          lv[i * 2 + 1] = vl.sky / 15;
          // tinta da coluna do canto (interpolada ao longo do retângulo mesclado)
          const tt = tintFor(block, f.face, meta, tintArr, bp[0], bp[2]);
          tcols[i * 3] = tt ? tt[0] : 1; tcols[i * 3 + 1] = tt ? tt[1] : 1; tcols[i * 3 + 2] = tt ? tt[2] : 1;
        }

        // UV em unidades de tile; nas faces norte/sul o eixo "u" (horizontal) é X = a1, não a2
        const uScale = na === 2 ? rh : rw;
        const vScale = na === 2 ? rw : rh;
        const base = target.pos.length / 3;
        for (let i = 0; i < 4; i++) {
          const cp = [0, 0, 0];
          cp[na] = layer + f.c[i][na];
          cp[ta1] = (f.c[i][ta1] === 0) ? ra1 : ra1 + rh;
          cp[ta2] = (f.c[i][ta2] === 0) ? ra2 : ra2 + rw;
          pushVert(target, baseX + cp[0], yBase + cp[1], baseZ + cp[2],
            UV_CORNER[i][0] * uScale, UV_CORNER[i][1] * vScale, t,
            tcols[i * 3], tcols[i * 3 + 1], tcols[i * 3 + 2], lv[i * 2], lv[i * 2 + 1], aoVals[i]);
        }

        if (aoVals[0] + aoVals[2] > aoVals[1] + aoVals[3]) {
          target.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        } else {
          target.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
        }
      }
    }
  }

  return { opaque: toGeo(op), water: toGeo(wa) };
}

function fluidCornerHeight(getBlockAbs, wx, y, wz, cx, cz, selfH, fluidAbove) {
  if (fluidAbove) return 1.0;
  const dx0 = cx === 0 ? -1 : 0;
  const dx1 = dx0 + 1;
  const dz0 = cz === 0 ? -1 : 0;
  const dz1 = dz0 + 1;
  let h = 0, count = 0, hasSolid = false;
  for (const dx of [dx0, dx1]) {
    for (const dz of [dz0, dz1]) {
      const ns = getBlockAbs(wx + dx, y, wz + dz);
      const nid = stateId(ns);
      if (isFluidId(nid)) h += fluidHeight(ns);
      else if (nid !== 0 && getBlock(nid).solid) { h += 1.0; hasSolid = true; }
      count++;
    }
  }
  if (hasSolid) return 1.0;
  return Math.max(selfH, h / count);
}