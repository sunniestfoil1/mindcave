// Cliente de mundo otimizado (Sodium / CM Client):
//  · Fusão de seções por coluna de chunk (1 único Draw Call opaco + 1 de água por chunk);
//  · Ordenação Front-to-Back (Early-Z Rejection) + Frustum Culling por BoundingBox da coluna;
//  · Cave/Altitude Culling: descarta seções subterrâneas profundas em chunks distantes quando o jogador está na superfície.
import { CHUNK_SIZE, WORLD_HEIGHT, SECTION_SIZE, SECTIONS_PER_CHUNK } from './constants';
import { chunkCoord, localCoord, chunkIndex, chunkKey, stateId, stateMeta } from './chunk';
import { generateChunk, getBiomeProvider } from './worldgen';
import { makeAtlas } from './textures';
import { getLight } from './lighting';
import { createSharedUniforms, makeOpaqueMaterial, makeWaterMaterial } from './materials';
import { MeshPool } from './meshPool';
import { computeChunkTint } from './biomeTint';
import { rebuildChunkColumnMesh, disposeMesh } from './sectionMesh';
import { buildSectionMesh, setLeafMode } from './mesher';
import { settingsStore } from './settingsStore';
import { isOpaque } from './blocks';

const CLEAN = 0, DIRTY = 1, SENT = 2;
const TASK_TIMEOUT_MS = 5000;
const GEN_TIMEOUT_MS = 12000;
const MAX_ATTEMPTS = 3;
const DISPATCH_BUDGET_MS = 1;
const DRAIN_BUDGET_MS = 2;
const UPLOAD_BUDGET_MS = 2;
const UPLOAD_MAX = 6;
const MAX_TIMEOUTS_PER_FRAME = 4;
const LIGHT_RADIUS = 6;
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function wallNonEmpty(data, sy, dx, dz) {
  const y0 = sy * SECTION_SIZE;
  const fixed = (dx === 1 || dz === 1) ? 0 : 15;
  for (let y = y0; y < y0 + SECTION_SIZE; y++) {
    for (let t = 0; t < CHUNK_SIZE; t++) {
      const idx = dx !== 0 ? fixed + 16 * (t + 16 * y) : t + 16 * (fixed + 16 * y);
      if (data[idx] !== 0) return true;
    }
  }
  return false;
}

export class ClientWorld {
  constructor(seed, deltas, generatorOpts) {
    this.seed = seed >>> 0;
    this.deltas = deltas || new Map();
    this.chunks = new Map();
    this.atlas = makeAtlas();
    this.uniforms = createSharedUniforms();
    this.uniforms.map.value = this.atlas.texture;
    const firstTile = Object.values(this.atlas.tiles)[0];
    if (firstTile) this.uniforms.uTileSize.value.set(firstTile.u1 - firstTile.u0, firstTile.v1 - firstTile.v0);
    this.opaqueMat = makeOpaqueMaterial(this.uniforms);
    this.waterMat = makeWaterMaterial(this.uniforms);
    this.generatorOpts = generatorOpts || { generatorId: 'open_legacy' };
    this._biomeProvider = null;
    this.scene = null;

    this._stash = new Map();
    this.pending = [];
    this.inflight = new Map();
    this.genInflight = new Map();
    this.uploadMap = new Map();
    this.inbox = [];
    this._inboxHead = 0;
    this.loadList = [];
    this._unsent = new Set();
    this._blockUpdates = new Map();
    this._taskId = 0;
    this._hasPos = false;
    this._pcx = 0; this._pcz = 0; this._psy = 4; this._radius = -1;
    this.meshFailures = [];
    this.stats = { dispatched: 0, completed: 0, errors: 0, timeouts: 0, uploaded: 0, generated: 0 };
    const leafMode = settingsStore.get('device.leaves') || 'default';
    setLeafMode(leafMode);
    this.pool = new MeshPool(
      { tiles: this.atlas.tiles, seed: this.seed, genOpts: this.generatorOpts, leaves: leafMode },
      (slot, msg) => { msg.slot = slot; this.inbox.push(msg); },
    );
    this._batchDepth = 0;
    this._immediateDirtySecs = new Map();
  }

  getBiomeAt(x, z) {
    if (!this._biomeProvider) {
      try { this._biomeProvider = getBiomeProvider(this.seed, this.generatorOpts); }
      catch { this._biomeProvider = () => null; }
    }
    return this._biomeProvider(x, z);
  }

  key(cx, cz) { return chunkKey(cx, cz); }

  getBlock(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    const c = this.chunks.get(chunkKey(chunkCoord(x), chunkCoord(z)));
    if (!c) return 0;
    return c.data[chunkIndex(localCoord(x), y, localCoord(z))];
  }

  getBlockId(x, y, z) { return stateId(this.getBlock(x, y, z)); }
  getBlockMeta(x, y, z) { return stateMeta(this.getBlock(x, y, z)); }
  hasChunkAt(x, z) { return this.chunks.has(chunkKey(chunkCoord(x), chunkCoord(z))); }
  getLight(x, y, z) { return getLight(this, x, y, z); }

  ensureChunk(cx, cz) {
    const c = this.chunks.get(chunkKey(cx, cz));
    if (c) return c;
    return this._installChunk(cx, cz, generateChunk(this.seed, cx, cz, this.generatorOpts));
  }

  _computeTint(cx, cz) { return computeChunkTint((x, z) => this.getBiomeAt(x, z), cx, cz); }

  _installChunk(cx, cz, data) {
    const k = chunkKey(cx, cz);
    const changes = new Map();
    const delta = this.deltas.get(k);
    if (delta) applyDelta(data, changes, delta);
    const stash = this._stash.get(k);
    if (stash) {
      for (const [idx, st] of stash.changes) { data[idx] = st; changes.set(idx, st); }
      this._stash.delete(k);
    }
    const c = {
      k, cx, cz, data, changes, tint: this._computeTint(cx, cz),
      lightData: null, lightVer: -1, ver: 0,
      baseX: cx * CHUNK_SIZE, baseZ: cz * CHUNK_SIZE,
      secState: new Uint8Array(SECTIONS_PER_CHUNK),
      secVer: new Uint32Array(SECTIONS_PER_CHUNK),
      secTries: new Uint8Array(SECTIONS_PER_CHUNK),
      secCount: new Uint16Array(SECTIONS_PER_CHUNK),
      secOpaqueData: new Array(SECTIONS_PER_CHUNK).fill(null),
      secWaterData: new Array(SECTIONS_PER_CHUNK).fill(null),
      colOpaqueMesh: null,
      colWaterMesh: null,
    };
    for (let i = 0; i < data.length; i++) if (data[i] !== 0) c.secCount[i >> 12]++;
    this.chunks.set(k, c);
    this._unsent.add(c);
    for (let sy = 0; sy < SECTIONS_PER_CHUNK; sy++) {
      if (c.secCount[sy] > 0) { c.secState[sy] = DIRTY; this._enqueue(c, sy); }
    }
    this._wakeNeighbors(c);
    return c;
  }

  refreshTints() {
    for (const c of this.chunks.values()) {
      c.tint = this._computeTint(c.cx, c.cz);
      this._unsent.add(c);
      this.markAllSectionsDirty(c);
    }
  }

  _wakeNeighbors(c) {
    for (const [dx, dz] of NEIGHBORS) {
      const nc = this.chunks.get(chunkKey(c.cx + dx, c.cz + dz));
      if (!nc) continue;
      for (let sy = 0; sy < SECTIONS_PER_CHUNK; sy++) {
        if (nc.secCount[sy] > 0 && wallNonEmpty(nc.data, sy, dx, dz)) this._markSectionDirty(nc, sy);
      }
    }
  }

  // Propaga luz básica dos 6 vizinhos na hora quando um bloco é quebrado, evitando que o buraco pisque escuro
  _patchImmediateLight(c, lx, y, lz, state) {
    if (!c.lightData) return;
    const idx = chunkIndex(lx, y, lz);
    if (state !== 0 && isOpaque(stateId(state))) {
      c.lightData[idx] = 0;
      return;
    }
    const wx = c.baseX + lx, wz = c.baseZ + lz;
    let maxSky = 0, maxBlk = 0;
    const dirs = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    for (let i = 0; i < 6; i++) {
      const nl = this.getLight(wx + dirs[i][0], y + dirs[i][1], wz + dirs[i][2]);
      const s = dirs[i][1] === 1 && nl.sky === 15 ? 15 : Math.max(0, nl.sky - 1);
      const b = Math.max(0, nl.block - 1);
      if (s > maxSky) maxSky = s;
      if (b > maxBlk) maxBlk = b;
    }
    c.lightData[idx] = (maxSky << 4) | maxBlk;
  }

  beginBatch() {
    this._batchDepth = (this._batchDepth || 0) + 1;
  }

  endBatch() {
    if (this._batchDepth > 0) this._batchDepth--;
    if (this._batchDepth === 0) {
      this.flushImmediateRebuilds();
    }
  }

  _queueImmediateSection(c, sy) {
    if (!c || sy < 0 || sy >= SECTIONS_PER_CHUNK) return;
    if (!this._immediateDirtySecs) this._immediateDirtySecs = new Map();
    this._immediateDirtySecs.set(`${c.k}:${sy}`, { c, sy });
  }

  // Se foram poucas seções (jogador minerando ou explosão contida), reconstrói na hora (0ms).
  // Se foi uma explosão em massa (> 12 seções simultâneas), delega aos Web Workers em paralelo sem congelar o frame!
  flushImmediateRebuilds() {
    if (!this._immediateDirtySecs || this._immediateDirtySecs.size === 0) return;
    const count = this._immediateDirtySecs.size;

    if (count <= 12 && this.scene) {
      const touchedChunks = new Set();
      for (const { c, sy } of this._immediateDirtySecs.values()) {
        if (this.chunks.get(c.k) !== c) continue;
        if (c.secCount[sy] === 0) {
          c.secOpaqueData[sy] = null;
          c.secWaterData[sy] = null;
        } else {
          const yBase = sy * SECTION_SIZE;
          const getBlockLocal = (lx, ly, lz) => c.data[chunkIndex(lx, yBase + ly, lz)];
          const getBlockAbs = (wx, wy, wz) => this.getBlock(wx, wy, wz);
          const getLightAbs = (wx, wy, wz) => this.getLight(wx, wy, wz);
          const res = buildSectionMesh(
            getBlockLocal,
            sy,
            c.baseX,
            c.baseZ,
            getBlockAbs,
            getLightAbs,
            this.atlas.tiles,
            c.tint
          );
          c.secOpaqueData[sy] = res.opaque;
          c.secWaterData[sy] = res.water;
        }
        touchedChunks.add(c);
      }
      for (const c of touchedChunks) {
        c.colOpaqueMesh = rebuildChunkColumnMesh(this.scene, c.colOpaqueMesh, c.secOpaqueData, this.opaqueMat, 0, c.cx, c.cz, 0);
        c.colWaterMesh = rebuildChunkColumnMesh(this.scene, c.colWaterMesh, c.secWaterData, this.waterMat, 1000, c.cx, c.cz, 0);
      }
    }

    this._immediateDirtySecs.clear();
  }

  // Reconstroi a seção 16³ sincronicamente na hora (0ms de latência visual ao quebrar/colocar blocos)
  _rebuildSectionImmediate(c, sy) {
    this._queueImmediateSection(c, sy);
    if (!this._batchDepth) this.flushImmediateRebuilds();
  }

  setBlock(x, y, z, state) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    const cx = chunkCoord(x), cz = chunkCoord(z);
    const c = this.ensureChunk(cx, cz);
    const sy = Math.floor(y / SECTION_SIZE);
    const lx = localCoord(x), lz = localCoord(z);
    const idx = chunkIndex(lx, y, lz);
    const old = c.data[idx];
    if (old !== state) {
      c.data[idx] = state;
      c.ver++;
      if (old === 0) c.secCount[sy]++;
      else if (state === 0) c.secCount[sy]--;

      // Em modo normal (1 bloco), atualiza a luz local na hora; em lote (explosão), os workers calculam juntos
      if (!this._batchDepth) {
        this._patchImmediateLight(c, lx, y, lz, state);
      }

      if (!this._unsent.has(c)) {
        let list = this._blockUpdates.get(c);
        if (!list) { list = []; this._blockUpdates.set(c, list); }
        list.push(idx, state);
      }

      // Se a alteração é perto do jogador (<= 2 chunks), enfileira para reconstrução imediata
      const isNearPlayer = Math.abs(cx - this._pcx) <= 2 && Math.abs(cz - this._pcz) <= 2;
      if (isNearPlayer && this.scene) {
        this._queueImmediateSection(c, sy);
        const ly = y % SECTION_SIZE;
        if (ly === 0 && sy > 0) this._queueImmediateSection(c, sy - 1);
        if (ly === SECTION_SIZE - 1 && sy < SECTIONS_PER_CHUNK - 1) this._queueImmediateSection(c, sy + 1);
        if (lx === 0) { const nc = this.chunks.get(chunkKey(cx - 1, cz)); if (nc) this._queueImmediateSection(nc, sy); }
        if (lx === CHUNK_SIZE - 1) { const nc = this.chunks.get(chunkKey(cx + 1, cz)); if (nc) this._queueImmediateSection(nc, sy); }
        if (lz === 0) { const nc = this.chunks.get(chunkKey(cx, cz - 1)); if (nc) this._queueImmediateSection(nc, sy); }
        if (lz === CHUNK_SIZE - 1) { const nc = this.chunks.get(chunkKey(cx, cz + 1)); if (nc) this._queueImmediateSection(nc, sy); }
      }

      // Continua agendando nos workers em segundo plano para recalcular a iluminação global exata
      this._markSectionDirty(c, sy);
      const ly = y % SECTION_SIZE;
      if (ly === 0 && sy > 0) this._markSectionDirty(c, sy - 1);
      if (ly === SECTION_SIZE - 1 && sy < SECTIONS_PER_CHUNK - 1) this._markSectionDirty(c, sy + 1);
      if (lx === 0) this._markNeighbor(cx - 1, cz, sy);
      if (lx === CHUNK_SIZE - 1) this._markNeighbor(cx + 1, cz, sy);
      if (lz === 0) this._markNeighbor(cx, cz - 1, sy);
      if (lz === CHUNK_SIZE - 1) this._markNeighbor(cx, cz + 1, sy);

      if (!this._batchDepth) {
        this.flushImmediateRebuilds();
      }
    }
    c.changes.set(idx, state);
    if (this.onBlockChange && !this._batchDepth) this.onBlockChange(x, y, z);
    return old;
  }

  _markNeighbor(cx, cz, sy) {
    const nc = this.chunks.get(chunkKey(cx, cz));
    if (nc) this._markSectionDirty(nc, sy);
  }

  markAllSectionsDirty(c) {
    for (let sy = 0; sy < SECTIONS_PER_CHUNK; sy++) {
      if (c.secCount[sy] > 0) this._markSectionDirty(c, sy);
    }
  }

  _markSectionDirty(c, sy) {
    c.secVer[sy]++;
    if (c.secState[sy] === CLEAN) {
      c.secState[sy] = DIRTY;
      this._enqueue(c, sy);
    }
  }

  _distOf(c, sy) {
    const dx = c.cx - this._pcx, dz = c.cz - this._pcz;
    const dy = sy - this._psy;
    return dx * dx + dz * dz + dy * dy * 1.2;
  }

  _enqueue(c, sy) {
    const e = { c, sy, d: this._distOf(c, sy) };
    let lo = 0, hi = this.pending.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.pending[mid].d > e.d) lo = mid + 1; else hi = mid;
    }
    this.pending.splice(lo, 0, e);
  }

  _resort() {
    for (const e of this.pending) e.d = this._distOf(e.c, e.sy);
    this.pending.sort((a, b) => b.d - a.d);
  }

  update(scene, px, pz, radius, py = 64) {
    this.scene = scene;
    const ccx = chunkCoord(px), ccz = chunkCoord(pz);
    this._psy = Math.floor(py / SECTION_SIZE);
    if (!this._hasPos || ccx !== this._pcx || ccz !== this._pcz || radius !== this._radius) {
      this._hasPos = true;
      this._pcx = ccx; this._pcz = ccz; this._radius = radius;
      this._unloadFar();
      this._rebuildLoadList();
      this._resort();
    }
    this._drain();
    this._dispatchGen();
    this._flushToPool();
    this._checkTimeouts();
    this._dispatchMesh();
    this.pool.flush();
  }

  _unloadFar() {
    const keep = this._radius;
    let any = false;
    for (const [k, c] of this.chunks) {
      if (Math.abs(c.cx - this._pcx) > keep || Math.abs(c.cz - this._pcz) > keep) {
        if (c.changes.size > 0) this._stash.set(k, { cx: c.cx, cz: c.cz, changes: c.changes });
        this._disposeChunkMeshes(c);
        this.chunks.delete(k);
        this._unsent.delete(c);
        this._blockUpdates.delete(c);
        this.pool.queueUnload(k);
        any = true;
      }
    }
    if (any) this.pending = this.pending.filter(e => this.chunks.get(e.c.k) === e.c);
  }

  _rebuildLoadList() {
    const r = this._radius;
    const list = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const cx = this._pcx + dx, cz = this._pcz + dz;
        if (!this.chunks.has(chunkKey(cx, cz))) list.push({ cx, cz, d: dx * dx + dz * dz });
      }
    }
    list.sort((a, b) => b.d - a.d);
    this.loadList = list;
  }

  _drain() {
    if (this._inboxHead >= this.inbox.length) return;
    const t0 = performance.now();
    while (this._inboxHead < this.inbox.length) {
      this._handle(this.inbox[this._inboxHead]);
      this.inbox[this._inboxHead++] = null;
      if (performance.now() - t0 > DRAIN_BUDGET_MS) break;
    }
    if (this._inboxHead >= this.inbox.length) { this.inbox.length = 0; this._inboxHead = 0; }
    else if (this._inboxHead > 256) { this.inbox = this.inbox.slice(this._inboxHead); this._inboxHead = 0; }
  }

  inboxSize() { return this.inbox.length - this._inboxHead; }

  _handle(msg) {
    switch (msg.type) {
      case 'generated': this._onGenerated(msg); break;
      case 'genError': this._onGenError(msg); break;
      case 'meshed': this._onMeshed(msg); break;
      case 'error': this._onMeshError(msg); break;
      default: break;
    }
  }

  _takeGen(msg) {
    const k = chunkKey(msg.cx, msg.cz);
    const g = this.genInflight.get(k);
    if (!g || g.id !== msg.id) return null;
    this.genInflight.delete(k);
    this.pool.release(g.slot);
    return k;
  }

  _onGenerated(msg) {
    const k = this._takeGen(msg);
    if (k === null || this.chunks.has(k)) return;
    if (Math.abs(msg.cx - this._pcx) > this._radius || Math.abs(msg.cz - this._pcz) > this._radius) return;
    this._installChunk(msg.cx, msg.cz, msg.blocks);
    this.stats.generated++;
  }

  _onGenError(msg) {
    const k = this._takeGen(msg);
    if (k === null) return;
    this.stats.errors++;
    console.error('[MeshWorker] erro ao gerar chunk', msg.cx, msg.cz, msg.error);
  }

  _onMeshError(msg) {
    const t = this.inflight.get(msg.id);
    if (!t) return;
    this.inflight.delete(msg.id);
    this.pool.release(t.slot);
    this.stats.errors++;
    this._failSection(t.c, t.sy, msg.error, MAX_ATTEMPTS);
  }

  _onMeshed(msg) {
    const t = this.inflight.get(msg.id);
    if (!t) return;
    this.inflight.delete(msg.id);
    this.pool.release(t.slot);
    const c = t.c;
    this.stats.completed++;
    if (this.chunks.get(c.k) !== c) return;
    const l = msg.light;
    if (l && l.ver > c.lightVer && l.ver <= c.ver) { c.lightData = l.data; c.lightVer = l.ver; }
    c.secTries[t.sy] = 0;
    this.uploadMap.set(c.k * 32 + t.sy, { c, sy: t.sy, opaque: msg.opaque, water: msg.water });
    if (c.secVer[t.sy] === t.ver) {
      c.secState[t.sy] = CLEAN;
    } else {
      c.secState[t.sy] = DIRTY;
      this._enqueue(c, t.sy);
    }
  }

  _dispatchGen() {
    if (this.loadList.length === 0) return;
    while (this.loadList.length && this.genInflight.size < this.pool.slots.length && this.pool.hasCapacity()) {
      const e = this.loadList.pop();
      const k = chunkKey(e.cx, e.cz);
      if (this.chunks.has(k) || this.genInflight.has(k)) continue;
      const slot = this.pool.acquire();
      if (slot < 0) { this.loadList.push(e); break; }
      const id = ++this._taskId;
      this.genInflight.set(k, { id, cx: e.cx, cz: e.cz, slot, sentAt: performance.now() });
      this.pool.queueGen(slot, [id, e.cx, e.cz]);
    }
  }

  _flushToPool() {
    if (this._unsent.size) {
      for (const c of this._unsent) {
        if (this.chunks.get(c.k) === c) this.pool.queueChunk(c);
      }
      this._unsent.clear();
    }
    if (this._blockUpdates.size) {
      for (const [c, list] of this._blockUpdates) {
        if (this.chunks.get(c.k) === c) this.pool.queueBlocks(c.k, c.ver, list);
      }
      this._blockUpdates.clear();
    }
  }

  _dispatchMesh() {
    if (this.pending.length === 0) return;
    const t0 = performance.now();
    while (this.pending.length && this.pool.hasCapacity()) {
      if (performance.now() - t0 > DISPATCH_BUDGET_MS) break;
      const e = this.pending.pop();
      const c = e.c, sy = e.sy;
      if (this.chunks.get(c.k) !== c || c.secState[sy] !== DIRTY) continue;
      const slot = this.pool.acquire();
      if (slot < 0) { this.pending.push(e); break; }
      const id = ++this._taskId;
      const ver = c.secVer[sy];
      c.secState[sy] = SENT;
      this.inflight.set(id, { c, sy, ver, slot, sentAt: t0 });
      const near = Math.abs(c.cx - this._pcx) <= LIGHT_RADIUS && Math.abs(c.cz - this._pcz) <= LIGHT_RADIUS;
      this.pool.queueTask(slot, [id, c.k, c.cx, c.cz, sy, ver, near ? 1 : 0]);
      this.stats.dispatched++;
    }
  }

  _checkTimeouts() {
    if (this.inflight.size === 0 && this.genInflight.size === 0) return;
    const now = performance.now();
    let n = 0;
    for (const [id, t] of this.inflight) {
      if (now - t.sentAt <= TASK_TIMEOUT_MS) continue;
      this.inflight.delete(id);
      this.pool.release(t.slot);
      this.stats.timeouts++;
      this._failSection(t.c, t.sy, 'timeout', 2);
      if (++n >= MAX_TIMEOUTS_PER_FRAME) return;
    }
    for (const [k, g] of this.genInflight) {
      if (now - g.sentAt <= GEN_TIMEOUT_MS) continue;
      this.genInflight.delete(k);
      this.pool.release(g.slot);
      this.stats.timeouts++;
      this.loadList.unshift({ cx: g.cx, cz: g.cz, d: 0 });
      if (++n >= MAX_TIMEOUTS_PER_FRAME) return;
    }
  }

  _failSection(c, sy, reason, maxTries) {
    if (this.chunks.get(c.k) !== c) return;
    c.secTries[sy]++;
    if (c.secTries[sy] < maxTries) {
      c.secState[sy] = DIRTY;
      this._enqueue(c, sy);
    } else {
      c.secState[sy] = CLEAN;
      this.meshFailures.push({ cx: c.cx, cz: c.cz, sy, reason });
    }
  }

  // Junta as seções do chunk num único Mesh por coluna e aplica Cave Culling para chunks distantes
  uploadMeshes() {
    if (this.uploadMap.size === 0 || !this.scene) return 0;
    const t0 = performance.now();
    const dirtyColumns = new Set();
    let n = 0;

    for (const [key, u] of this.uploadMap) {
      this.uploadMap.delete(key);
      const c = u.c;
      if (this.chunks.get(c.k) === c) {
        c.secOpaqueData[u.sy] = u.opaque || null;
        c.secWaterData[u.sy] = u.water || null;
        dirtyColumns.add(c);
      }
      if (dirtyColumns.size >= UPLOAD_MAX) break;
    }

    for (const c of dirtyColumns) {
      const distChunks = Math.max(Math.abs(c.cx - this._pcx), Math.abs(c.cz - this._pcz));
      // Cave Culling: se o jogador está acima do nível do mar (psy >= 4) e o chunk está a >= 3 chunks de distância,
      // ignora cavernas profundas abaixo de Y=48 (sy < 3), economizando milhares de vértices subterrâneos invisíveis.
      const minSy = (this._psy >= 4 && distChunks >= 3) ? 3 : 0;
      c.colOpaqueMesh = rebuildChunkColumnMesh(this.scene, c.colOpaqueMesh, c.secOpaqueData, this.opaqueMat, 0, c.cx, c.cz, minSy);
      c.colWaterMesh = rebuildChunkColumnMesh(this.scene, c.colWaterMesh, c.secWaterData, this.waterMat, 1000, c.cx, c.cz, minSy);
      this.stats.uploaded++;
      n++;
      if (performance.now() - t0 > UPLOAD_BUDGET_MS) break;
    }
    return n;
  }

  // Frustum Culling por coluna + Ordenação Front-to-Back (Early-Z Rejection na GPU)
  cullChunks(cameraPos, forwardDir, renderDistance, frustum) {
    const maxDistSq = ((renderDistance + 1.25) * 16) * ((renderDistance + 1.25) * 16);
    const camX = cameraPos.x, camZ = cameraPos.z;

    for (const c of this.chunks.values()) {
      const mOp = c.colOpaqueMesh;
      const mWa = c.colWaterMesh;
      if (!mOp && !mWa) continue;

      const dx = (c.baseX + 8) - camX;
      const dz = (c.baseZ + 8) - camZ;
      const distSq = dx * dx + dz * dz;

      let vis = distSq <= maxDistSq;
      if (vis && frustum) {
        const box = mOp?.geometry?.boundingBox || mWa?.geometry?.boundingBox;
        if (box && !frustum.intersectsBox(box)) {
          vis = false;
        }
      }

      if (mOp) {
        mOp.visible = vis;
        // Front-to-Back: desenha os chunks mais próximos primeiro (0..999) para ativar Early-Z na GPU
        if (vis) mOp.renderOrder = Math.min(999, (distSq * 0.01) | 0);
      }
      if (mWa) {
        mWa.visible = vis;
        if (vis) mWa.renderOrder = 1000 + Math.min(999, ((maxDistSq - distSq) * 0.01) | 0);
      }
    }
  }

  _disposeChunkMeshes(c) {
    if (!this.scene) return;
    if (c.colOpaqueMesh) { disposeMesh(this.scene, c.colOpaqueMesh); c.colOpaqueMesh = null; }
    if (c.colWaterMesh) { disposeMesh(this.scene, c.colWaterMesh); c.colWaterMesh = null; }
    if (c.secOpaqueData) c.secOpaqueData.fill(null);
    if (c.secWaterData) c.secWaterData.fill(null);
  }

  pendingMeshCount() { return this.pending.length + this.inflight.size + this.uploadMap.size; }
  loadBacklog() { return this.loadList.length + this.genInflight.size; }
  isIdle() { return this.pendingMeshCount() === 0 && this.loadBacklog() === 0 && this.inboxSize() === 0; }

  async warmUp(scene, px, pz, radius, py, timeoutMs = 4000, onProgress = null) {
    const t0 = performance.now();
    const expectedChunks = (radius * 2 + 1) * (radius * 2 + 1);
    for (;;) {
      this.update(scene, px, pz, radius, py);
      this.uploadMeshes();
      const currentChunks = this.chunks.size;
      const pct = Math.min(99, Math.floor((currentChunks / Math.max(1, expectedChunks)) * 100));
      if (onProgress) onProgress(pct, `Gerando chunks (${currentChunks}/${expectedChunks})...`);
      if (this.isIdle() || this.pool.slots.length === 0 || performance.now() - t0 > timeoutMs) break;
      await new Promise(r => setTimeout(r, 16));
    }
    if (onProgress) onProgress(100, 'Mundo pronto!');
  }

  dirtyChunks() {
    const out = [];
    for (const c of this.chunks.values()) if (c.changes.size > 0) out.push(c);
    for (const s of this._stash.values()) if (s.changes.size > 0) out.push(s);
    return out;
  }

  unloadMeshes() {
    for (const c of this.chunks.values()) { this._disposeChunkMeshes(c); this.markAllSectionsDirty(c); }
  }

  dispose() {
    for (const c of this.chunks.values()) this._disposeChunkMeshes(c);
    this.chunks.clear();
    this.pending.length = 0;
    this.uploadMap.clear();
    this.inflight.clear();
    this.genInflight.clear();
    this.inbox.length = 0;
    this.opaqueMat.dispose();
    this.waterMat.dispose();
    this.atlas.texture.dispose();
    this.pool.dispose();
  }

  onTntIgnite(x, y, z) {}
}

function applyDelta(data, changes, deltaBytes) {
  if (!deltaBytes || !deltaBytes.buffer) return;
  const dv = new DataView(deltaBytes.buffer, deltaBytes.byteOffset, deltaBytes.byteLength);
  let o = 0;
  const count = dv.getUint32(o, true); o += 4;
  for (let i = 0; i < count; i++) {
    const idx = dv.getUint32(o, true); o += 4;
    const st = dv.getUint16(o, true); o += 2;
    data[idx] = st;
    changes.set(idx, st);
  }
}

export function encodeDelta(changes) {
  const n = changes.size;
  const buf = new ArrayBuffer(4 + n * 6);
  const dv = new DataView(buf);
  let o = 0;
  dv.setUint32(o, n, true); o += 4;
  for (const [idx, st] of changes) {
    dv.setUint32(o, idx, true); o += 4;
    dv.setUint16(o, st, true); o += 2;
  }
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function decodeDelta(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}