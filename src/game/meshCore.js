// Núcleo dos workers (PRD 23/24): cada worker mantém um ESPELHO dos chunks (blocos + tinta + luz) e executa
// tarefas curtas — [id, chunk, seção, versão]. Nenhum dado de bloco trafega por tarefa (MC24-RF-002).
// A main thread envia UM lote por worker por quadro (tipo 'batch'), com tudo que mudou (MC24-RF-001).
import { buildSectionMesh, setLeafMode } from './mesher';
import { computeLightInto } from './lightCore';
import { generateChunk } from './worldgen';
import { createLightData, chunkKey } from './chunk';

const SH = 18;
const shellBlocks = new Uint16Array(SH * SH * SH);
const shellLight = new Uint8Array(SH * SH * SH);
const nbList = new Array(9).fill(null);
const GEO_KEYS = ['positions', 'colors', 'uvs', 'lights', 'aos', 'tileOrigins', 'indices'];

function sectionEmpty(blocks, sy) {
  const end = (sy + 1) * 4096;
  for (let i = sy * 4096; i < end; i++) if (blocks[i] !== 0) return false;
  return true;
}

// Monta o shell 18³ (seção + 1 bloco de borda) lendo direto dos 9 chunks vizinhos do espelho
function fillShell(sy) {
  const yBase = sy * 16;
  for (let sz = 0; sz < SH; sz++) {
    const wz = sz - 1;
    const cj = wz < 0 ? 0 : (wz > 15 ? 2 : 1);
    const lz = wz < 0 ? 15 : (wz > 15 ? 0 : wz);
    for (let syy = 0; syy < SH; syy++) {
      const wy = yBase + syy - 1;
      const row = SH * (syy + SH * sz);
      if (wy < 0 || wy >= 256) {
        const fill = wy < 0 ? 0 : 0xF0;
        for (let sx = 0; sx < SH; sx++) { shellBlocks[row + sx] = 0; shellLight[row + sx] = fill; }
        continue;
      }
      for (let sx = 0; sx < SH; sx++) {
        const wx = sx - 1;
        const ci = wx < 0 ? 0 : (wx > 15 ? 2 : 1);
        const lx = wx < 0 ? 15 : (wx > 15 ? 0 : wx);
        const nc = nbList[cj * 3 + ci];
        if (nc) {
          const i = lx + 16 * (lz + 16 * wy);
          shellBlocks[row + sx] = nc.blocks[i];
          shellLight[row + sx] = nc.light[i];
        } else {
          shellBlocks[row + sx] = 0;
          shellLight[row + sx] = 0xF0;
        }
      }
    }
  }
}

export class MeshMirror {
  constructor() {
    this.chunks = new Map();
    this.tiles = null;
    this.seed = 0;
    this.genOpts = null;
  }

  init(msg) { setLeafMode(msg.leaves); this.tiles = msg.tiles; this.seed = msg.seed >>> 0; this.genOpts = msg.genOpts || null; }

  setChunk(key, cx, cz, blocks, tint, ver) {
    this.chunks.set(key, { key, cx, cz, blocks, tint, light: null, ver, lightSent: -1 });
  }

  unload(key) { this.chunks.delete(key); }

  applyBlocks(key, ver, list) {
    const c = this.chunks.get(key);
    if (!c) return;
    for (let i = 0; i < list.length; i += 2) c.blocks[list[i]] = list[i + 1];
    c.ver = ver;
    c.light = null;
  }

  // Luz calculada sob demanda e guardada no espelho
  _light(c) {
    if (!c.light) {
      c.light = createLightData();
      computeLightInto(c.blocks, c.light);
    }
    return c.light;
  }

  // wantLight: devolve a luz do chunk central à main thread (só perto do jogador), uma vez por versão
  mesh(key, cx, cz, sy, wantLight) {
    const c = this.chunks.get(key);
    if (!c) throw new Error('chunk ' + cx + ',' + cz + ' ausente no espelho do worker');
    this._light(c);
    let lightOut = null;
    if (wantLight && c.lightSent !== c.ver) {
      c.lightSent = c.ver;
      lightOut = { key: c.key, ver: c.ver, data: c.light.slice() };
    }
    if (sectionEmpty(c.blocks, sy)) return { opaque: null, water: null, light: lightOut };

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = (dx === 0 && dz === 0) ? c : (this.chunks.get(chunkKey(cx + dx, cz + dz)) || null);
        nbList[(dz + 1) * 3 + dx + 1] = n;
        if (n && n !== c) this._light(n);
      }
    }
    fillShell(sy);

    const yBase = sy * 16, baseX = cx * 16, baseZ = cz * 16;
    const getBlockLocal = (x, ly, z) => shellBlocks[(x + 1) + 18 * ((ly + 1) + 18 * (z + 1))];
    const getBlockAbs = (x, y, z) => {
      const sx = x - baseX + 1, syy = y - yBase + 1, sz = z - baseZ + 1;
      if (sx < 0 || sx > 17 || syy < 0 || syy > 17 || sz < 0 || sz > 17) return 0;
      return shellBlocks[sx + 18 * (syy + 18 * sz)];
    };
    const L = { sky: 0, block: 0 }; // objeto reutilizado: o mesher consome o valor imediatamente
    const getLightAbs = (x, y, z) => {
      const sx = x - baseX + 1, syy = y - yBase + 1, sz = z - baseZ + 1;
      if (sx < 0 || sx > 17 || syy < 0 || syy > 17 || sz < 0 || sz > 17) { L.sky = 0; L.block = 0; return L; }
      const l = shellLight[sx + 18 * (syy + 18 * sz)];
      L.sky = (l >> 4) & 15; L.block = l & 15;
      return L;
    };
    const geo = buildSectionMesh(getBlockLocal, sy, baseX, baseZ, getBlockAbs, getLightAbs, this.tiles, c.tint);
    return { opaque: geo.opaque, water: geo.water, light: lightOut };
  }
}

function collect(g, transfer) {
  if (!g) return;
  for (const k of GEO_KEYS) if (g[k] && g[k].buffer) transfer.push(g[k].buffer);
}

function doMesh(mirror, t, reply) {
  // t = [id, key, cx, cz, sy, ver, wantLight]
  const id = t[0], key = t[1], sy = t[4], ver = t[5];
  try {
    const r = mirror.mesh(key, t[2], t[3], sy, t[6]);
    const transfer = [];
    collect(r.opaque, transfer);
    collect(r.water, transfer);
    if (r.light) transfer.push(r.light.data.buffer);
    reply({ type: 'meshed', id, key, sy, ver, opaque: r.opaque, water: r.water, light: r.light }, transfer);
  } catch (err) {
    reply({ type: 'error', id, key, sy, error: String(err && err.message ? err.message : err) }, []);
  }
}

function doGen(mirror, t, reply) {
  // t = [id, cx, cz]
  try {
    const blocks = generateChunk(mirror.seed, t[1], t[2], mirror.genOpts || { generatorId: 'open_legacy' });
    reply({ type: 'generated', id: t[0], cx: t[1], cz: t[2], blocks }, [blocks.buffer]);
  } catch (err) {
    reply({ type: 'genError', id: t[0], cx: t[1], cz: t[2], error: String(err && err.message ? err.message : err) }, []);
  }
}

// Protocolo comum ao worker real e ao modo de reserva na main thread.
// Lote: { type:'batch', un:[keys], ch:[{key,cx,cz,ver,blocks,tint}], bl:[[key,ver,list]], gn:[[id,cx,cz]], ts:[[id,key,cx,cz,sy,ver,wl]] }
export function handleMeshMessage(mirror, msg, reply) {
  if (msg.type === 'init') { mirror.init(msg); return; }
  if (msg.type !== 'batch') return;
  if (msg.un) for (const k of msg.un) mirror.unload(k);
  if (msg.ch) for (const c of msg.ch) mirror.setChunk(c.key, c.cx, c.cz, c.blocks, c.tint, c.ver);
  if (msg.bl) for (const b of msg.bl) mirror.applyBlocks(b[0], b[1], b[2]);
  if (msg.gn) for (const t of msg.gn) doGen(mirror, t, reply);
  if (msg.ts) for (const t of msg.ts) doMesh(mirror, t, reply);
}