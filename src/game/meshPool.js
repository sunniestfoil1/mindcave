// Pool de workers (PRD 23/24): no máximo MAX_PER_WORKER tarefas em voo por worker e UM lote de mensagem
// por worker por quadro. Dados grandes (chunks) são enviados uma vez, por transferência; tarefas só levam números.
import { MeshMirror, handleMeshMessage } from './meshCore';

export const MAX_PER_WORKER = 4;
const MAX_WORKERS = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency)
  ? Math.max(2, Math.min(8, navigator.hardwareConcurrency - 1))
  : 4;

// Reserva: mesma lógica do worker, executada na main thread (1 lote por macrotask)
class LocalWorker {
  constructor() {
    this.mirror = new MeshMirror();
    this.onmessage = null;
    this.queue = [];
    this.scheduled = false;
  }
  postMessage(msg) {
    this.queue.push(msg);
    if (!this.scheduled) { this.scheduled = true; setTimeout(() => this._run(), 0); }
  }
  _run() {
    this.scheduled = false;
    const msg = this.queue.shift();
    if (msg) handleMeshMessage(this.mirror, msg, (m) => { if (this.onmessage) this.onmessage({ data: m }); });
    if (this.queue.length && !this.scheduled) { this.scheduled = true; setTimeout(() => this._run(), 0); }
  }
  terminate() { this.queue.length = 0; }
}

function spawnWorker(index, onMessage) {
  try {
    const w = new Worker(new URL('./workers/meshWorker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => onMessage(index, e.data);
    w.onerror = (e) => console.error('[MeshWorker] erro no worker', index, e.message || e);
    return w;
  } catch (e) {
    console.error('[MeshWorker] não foi possível criar o worker', e);
    return null;
  }
}

function newBatch() { return { type: 'batch', un: [], ch: [], bl: [], gn: [], ts: [], tr: [] }; }

export class MeshPool {
  constructor(initMsg, onMessage) {
    this.slots = [];
    this.msgs = 0;          // mensagens enviadas no total
    this.lastFlushMsgs = 0; // mensagens do último quadro
    const hc = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    const want = Math.max(1, Math.min(MAX_WORKERS, hc - 1));
    for (let i = 0; i < want; i++) {
      const w = spawnWorker(i, onMessage);
      if (!w) break;
      this.slots.push({ w, inflight: 0, batch: newBatch(), dirty: false });
    }
    this.local = this.slots.length === 0;
    if (this.local) {
      const lw = new LocalWorker();
      lw.onmessage = (e) => onMessage(0, e.data);
      this.slots.push({ w: lw, inflight: 0, batch: newBatch(), dirty: false });
    }
    for (const s of this.slots) s.w.postMessage({ type: 'init', ...initMsg });
  }

  // Reserva uma vaga no worker menos ocupado; -1 se todos estiverem no limite
  acquire() {
    let best = -1, bestLoad = MAX_PER_WORKER;
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].inflight < bestLoad) { best = i; bestLoad = this.slots[i].inflight; }
    }
    if (best >= 0) this.slots[best].inflight++;
    return best;
  }

  hasCapacity() {
    for (const s of this.slots) if (s.inflight < MAX_PER_WORKER) return true;
    return false;
  }

  release(i) {
    const s = this.slots[i];
    if (s && s.inflight > 0) s.inflight--;
  }

  // ---- fila de saída (enviada em flush(), no máximo 1 mensagem por worker) ----
  queueTask(slot, task) { const s = this.slots[slot]; s.batch.ts.push(task); s.dirty = true; }
  queueGen(slot, task) { const s = this.slots[slot]; s.batch.gn.push(task); s.dirty = true; }
  queueUnload(key) { for (const s of this.slots) { s.batch.un.push(key); s.dirty = true; } }
  queueBlocks(key, ver, list) { for (const s of this.slots) { s.batch.bl.push([key, ver, list]); s.dirty = true; } }

  // Cada worker recebe a sua própria cópia dos blocos e da tinta (transferidas, sem clonagem)
  queueChunk(c) {
    for (const s of this.slots) {
      const blocks = c.data.slice();
      const tint = c.tint.slice();
      s.batch.ch.push({ key: c.k, cx: c.cx, cz: c.cz, ver: c.ver, blocks, tint });
      s.batch.tr.push(blocks.buffer, tint.buffer);
      s.dirty = true;
    }
  }

  flush() {
    let n = 0;
    for (const s of this.slots) {
      if (!s.dirty) continue;
      const b = s.batch;
      const tr = b.tr;
      delete b.tr;
      s.w.postMessage(b, tr);
      s.batch = newBatch();
      s.dirty = false;
      n++;
    }
    this.lastFlushMsgs = n;
    this.msgs += n;
    return n;
  }

  dispose() { for (const s of this.slots) s.w.terminate(); this.slots.length = 0; }
}