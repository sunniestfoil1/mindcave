// Cliente de mundo (PRD 23/24): blocos na main thread; geração, luz e meshing nos workers.
// Cada seção 16³ tem um estado: LIMPA → SUJA (na fila) → ENVIADA (em um worker) → resultado na fila de upload → LIMPA.
// Orçamentos por quadro: respostas dos workers 2 ms · despacho 1 ms · upload à GPU 2 ms · mensagens ≤ 1 lote/worker.
import { CHUNK_SIZE, WORLD_HEIGHT, SECTION_SIZE, SECTIONS_PER_CHUNK } from './constants';
import { chunkCoord, localCoord, chunkIndex, chunkKey } from './chunk';
import { generateChunk, getBiomeProvider } from './worldgen';
import { makeAtlas } from './textures';
import { getLight } from './lighting';
import { createSharedUniforms, makeOpaqueMaterial, makeWaterMaterial } from './materials';
import { MeshPool } from './meshPool';
import { computeChunkTint } from './biomeTint';
import { fillSectionMesh, disposeMesh } from './sectionMesh';

const CLEAN = 0, DIRTY = 1, SENT = 2;
const TASK_TIMEOUT_MS = 5000;   // tarefa sem resposta é cancelada e reenviada depois, pelo agendador normal
const GEN_TIMEOUT_MS = 12000;
const MAX_ATTEMPTS = 3;
const DISPATCH_BUDGET_MS = 1;
const DRAIN_BUDGET_MS = 2;      // MC24-RF-003: respostas aplicadas com orçamento
const UPLOAD_BUDGET_MS = 2;
const UPLOAD_MAX = 4;
const MAX_TIMEOUTS_PER_FRAME = 4;
const LIGHT_RADIUS = 6;         // só chunks perto do jogador devolvem a luz à main thread
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// A parede da seção do vizinho (em cx+dx, cz+dz) voltada ao chunk recém-chegado tem blocos?
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
    // Tile size uniform (mesmo para todos os tiles: 16px no atlas)
    const firstTile = Object.values(this.atlas.tiles)[0];
    if (firstTile) this.uniforms.uTileSize.value.set(firstTile.u1 - firstTile.u0, firstTile.v1 - firstTile.v0);
    this.opaqueMat = makeOpaqueMaterial(this.uniforms);
    this.waterMat = makeWaterMaterial(this.uniforms);
    this.generatorOpts = generatorOpts || { generatorId: 'open_legacy' };
    this._biomeProvider = null;
    this.scene = null;

    // Alterações de chunks descarregados que ainda não foram salvas (não perder ao sair do raio)
    this._stash = new Map();

    // Pipeline
    this.pending = [];          // seções SUJAS, ordenadas por distância (a mais próxima no FIM → pop())
    this.inflight = new Map();  // id → { c, sy, ver, slot, sentAt }
    this.genInflight = new Map(); // chave do chunk → { id, cx, cz, slot, sentAt }
    this.uploadMap = new Map(); // seção → resultado pronto aguardando upload à GPU
    this.inbox = [];            // respostas dos workers (processadas com orçamento)
    this._inboxHead = 0;
    this.loadList = [];         // chunks a gerar (mais próximo no fim)
    this._unsent = new Set();   // chunks ainda não enviados aos workers
    this._blockUpdates = new Map(); // chunk → [idx, estado, ...] pendentes de envio
    this._taskId = 0;
    this._hasPos = false;
    this._pcx = 0; this._pcz = 0; this._psy = 0; this._radius = -1;
    this.meshFailures = [];
    this.stats = { dispatched: 0, completed: 0, errors: 0, timeouts: 0, uploaded: 0, generated: 0 };
    this.pool = new MeshPool(
      { tiles: this.atlas.tiles, seed: this.seed, genOpts: this.generatorOpts },
      (slot, msg) => { msg.slot = slot; this.inbox.push(msg); },
    );
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

  hasChunkAt(x, z) { return this.chunks.has(chunkKey(chunkCoord(x), chunkCoord(z))); }

  getLight(x, y, z) { return getLight(this, x, y, z); }

  // ===== Chunks =====

  // Caminho síncrono (spawn, edição em chunk ainda não carregado). O carregamento normal é feito nos workers.
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
      sectionMeshes: new Array(SECTIONS_PER_CHUNK).fill(null),
    };
    for (let i = 0; i < data.length; i++) if (data[i] !== 0) c.secCount[i >> 12]++;
    this.chunks.set(k, c);
    this._unsent.add(c);
    // Seções vazias nunca entram na fila
    for (let sy = 0; sy < SECTIONS_PER_CHUNK; sy++) {
      if (c.secCount[sy] > 0) { c.secState[sy] = DIRTY; this._enqueue(c, sy); }
    }
    this._wakeNeighbors(c);
    return c;
  }

  // Recalcula a tinta de bioma de todos os chunks (quando os mapas de cor chegam depois da geração)
  refreshTints() {
    for (const c of this.chunks.values()) {
      c.tint = this._computeTint(c.cx, c.cz);
      this._unsent.add(c);
      this.markAllSectionsDirty(c);
    }
  }

  // Vizinhos já malhados tinham a borda voltada para este chunk como "ar": refazer só se há faces expostas
  _wakeNeighbors(c) {
    for (const [dx, dz] of NEIGHBORS) {
      const nc = this.chunks.get(chunkKey(c.cx + dx, c.cz + dz));
      if (!nc) continue;
      for (let sy = 0; sy < SECTIONS_PER_CHUNK; sy++) {
        if (nc.secCount[sy] > 0 && wallNonEmpty(nc.data, sy, dx, dz)) this._markSectionDirty(nc, sy);
      }
    }
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
      if (!this._unsent.has(c)) {
        let list = this._blockUpdates.get(c);
        if (!list) { list = []; this._blockUpdates.set(c, list); }
        list.push(idx, state); // várias alterações do mesmo chunk no quadro viram UMA mensagem
      }
      this._markSectionDirty(c, sy);
      const ly = y % SECTION_SIZE;
      if (ly === 0 && sy > 0) this._markSectionDirty(c, sy - 1);
      if (ly === SECTION_SIZE - 1 && sy < SECTIONS_PER_CHUNK - 1) this._markSectionDirty(c, sy + 1);
      if (lx === 0) this._markNeighbor(cx - 1, cz, sy);
      if (lx === CHUNK_SIZE - 1) this._markNeighbor(cx + 1, cz, sy);
      if (lz === 0) this._markNeighbor(cx, cz - 1, sy);
      if (lz === CHUNK_SIZE - 1) this._markNeighbor(cx, cz + 1, sy);
    }
    c.changes.set(idx, state);
    if (this.onBlockChange) this.onBlockChange(x, y, z);
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

  // ===== Fila de seções sujas =====

  _markSectionDirty(c, sy) {
    c.secVer[sy]++; // versão da seção: resultado com versão antiga é aplicado e a seção é refeita
    if (c.secState[sy] === CLEAN) {
      c.secState[sy] = DIRTY;
      this._enqueue(c, sy);
    }
    // DIRTY: já está na fila · SENT: será refeita quando o resultado chegar (versão difere)
  }

  _distOf(c, sy) {
    const dx = c.cx - this._pcx, dz = c.cz - this._pcz;
    return dx * dx + dz * dz + Math.abs(sy - this._psy) * 0.25;
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

  // ===== Quadro =====

  update(scene, px, pz, radius, py = 64) {
    this.scene = scene;
    const ccx = chunkCoord(px), ccz = chunkCoord(pz);
    if (!this._hasPos || ccx !== this._pcx || ccz !== this._pcz || radius !== this._radius) {
      this._hasPos = true;
      this._pcx = ccx; this._pcz = ccz; this._radius = radius;
      this._psy = Math.floor(py / SECTION_SIZE);
      this._unloadFar();
      this._rebuildLoadList();
      this._resort();
    }
    this._drain();            // respostas dos workers, com orçamento de 2 ms
    this._dispatchGen();
    this._flushToPool();
    this._checkTimeouts();
    this._dispatchMesh();
    this.pool.flush();        // no máximo 1 mensagem por worker, vazio = 0 mensagens
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

  // ----- respostas dos workers -----

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
    if (!g || g.id !== msg.id) return null; // cancelada por tempo esgotado
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
    console.error('[MeshWorker] erro ao gerar malha', t.c.cx, t.c.cz, 'seção', t.sy, msg.error);
    this._failSection(t.c, t.sy, msg.error, MAX_ATTEMPTS);
  }

  _onMeshed(msg) {
    const t = this.inflight.get(msg.id);
    if (!t) return; // cancelada por tempo esgotado
    this.inflight.delete(msg.id);
    this.pool.release(t.slot);
    const c = t.c;
    this.stats.completed++;
    if (this.chunks.get(c.k) !== c) return; // chunk descarregado enquanto a tarefa corria
    const l = msg.light;
    if (l && l.ver > c.lightVer && l.ver <= c.ver) { c.lightData = l.data; c.lightVer = l.ver; }
    c.secTries[t.sy] = 0;
    this.uploadMap.set(c.k * 32 + t.sy, { c, sy: t.sy, opaque: msg.opaque, water: msg.water });
    if (c.secVer[t.sy] === t.ver) {
      c.secState[t.sy] = CLEAN;
    } else {
      c.secState[t.sy] = DIRTY; // mudou durante o meshing: mostra esta versão e refaz
      this._enqueue(c, t.sy);
    }
  }

  // ----- saída para os workers -----

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

  // Dados de bloco chegam aos workers uma vez (chunk novo) ou em lote (alterações do quadro)
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

  // Tarefa sem resposta: cancela e devolve à fila normal (nunca refaz a malha na main thread)
  _checkTimeouts() {
    if (this.inflight.size === 0 && this.genInflight.size === 0) return;
    const now = performance.now();
    let n = 0;
    for (const [id, t] of this.inflight) {
      if (now - t.sentAt <= TASK_TIMEOUT_MS) continue;
      this.inflight.delete(id);
      this.pool.release(t.slot);
      this.stats.timeouts++;
      console.error('[MeshWorker] tarefa sem resposta em 5 s', t.c.cx, t.c.cz, 'seção', t.sy);
      this._failSection(t.c, t.sy, 'timeout', 2);
      if (++n >= MAX_TIMEOUTS_PER_FRAME) return;
    }
    for (const [k, g] of this.genInflight) {
      if (now - g.sentAt <= GEN_TIMEOUT_MS) continue;
      this.genInflight.delete(k);
      this.pool.release(g.slot);
      this.stats.timeouts++;
      console.error('[MeshWorker] geração sem resposta', g.cx, g.cz);
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
      console.error('[World] seção desistida após falhas', c.cx, c.cz, 'seção', sy, reason);
    }
  }

  // ----- upload à GPU -----

  // No máximo UPLOAD_MAX malhas (ou 2 ms) por quadro, reaproveitando Mesh/BufferGeometry/buffers WebGL
  uploadMeshes() {
    if (this.uploadMap.size === 0 || !this.scene) return 0;
    const t0 = performance.now();
    let n = 0;
    for (const [key, u] of this.uploadMap) {
      this.uploadMap.delete(key);
      if (this.chunks.get(u.c.k) === u.c) {
        this._applySection(u.c, u.sy, u.opaque, u.water);
        this.stats.uploaded++;
        n++;
      }
      if (n >= UPLOAD_MAX || performance.now() - t0 > UPLOAD_BUDGET_MS) break;
    }
    return n;
  }

  _applySection(c, sy, opaque, water) {
    let m = c.sectionMeshes[sy];
    if (!opaque && !water) { if (m) this._disposeSection(c, sy); return; }
    if (!m) m = c.sectionMeshes[sy] = { opaque: null, water: null };
    m.opaque = fillSectionMesh(this.scene, m.opaque, opaque, this.opaqueMat, 0, c.cx, sy, c.cz);
    m.water = fillSectionMesh(this.scene, m.water, water, this.waterMat, 1, c.cx, sy, c.cz);
  }

  _disposeSection(c, sy) {
    const m = c.sectionMeshes[sy];
    if (!m) return;
    disposeMesh(this.scene, m.opaque);
    disposeMesh(this.scene, m.water);
    c.sectionMeshes[sy] = null;
  }

  _disposeChunkMeshes(c) {
    if (!this.scene) return;
    for (let sy = 0; sy < SECTIONS_PER_CHUNK; sy++) this._disposeSection(c, sy);
  }

  // ===== Estado / diagnóstico =====

  pendingMeshCount() { return this.pending.length + this.inflight.size + this.uploadMap.size; }
  loadBacklog() { return this.loadList.length + this.genInflight.size; }
  isIdle() { return this.pendingMeshCount() === 0 && this.loadBacklog() === 0 && this.inboxSize() === 0; }

  // Espera curta (carregamento inicial) até a área ao redor do jogador estar malhada
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