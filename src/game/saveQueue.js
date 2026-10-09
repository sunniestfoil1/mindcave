// Fila de saves com retentativa (PRD 12 RF-012) + diário IndexedDB (RF-011)

const DB_NAME = 'mindcave_journal';
const STORE = 'block_journal';

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

// Diário: registra mudanças de blocos desde o último autosave (RF-011)
export async function journalBlock(worldId, x, y, z, state) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add({ worldId, x, y, z, state, ts: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* IndexedDB indisponível */ }
}

export async function readJournal(worldId) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result.filter(r => r.worldId === worldId));
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

export async function clearJournal(worldId) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        for (const r of req.result) {
          if (r.worldId === worldId) store.delete(r.id);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* noop */ }
}

// Fila de saves com retentativa exponencial (RF-012)
export class SaveQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.pendingCount = 0;
    this.onUpdate = null;
    this.lastError = null;
  }

  enqueue(task) {
    this.queue.push({ task, retries: 0 });
    this.pendingCount++;
    this._notify();
    this._process();
  }

  async _process() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const item = this.queue[0];
      try {
        await item.task();
        this.queue.shift();
        this.pendingCount--;
        this.lastError = null;
        this._notify();
      } catch (e) {
        item.retries++;
        if (item.retries >= 5) {
          // Desistir após 5 tentativas — não perder o dado na fila
          console.error('[SaveQueue] Desistindo após 5 retentativas:', e);
          this.queue.shift();
          this.pendingCount--;
          this.lastError = e.message;
          this._notify();
        } else {
          // Backoff exponencial: 1s, 2s, 4s, 8s, 16s
          const delay = Math.pow(2, item.retries - 1) * 1000;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    this.processing = false;
  }

  _notify() {
    if (this.onUpdate) this.onUpdate({ pending: this.pendingCount, error: this.lastError });
  }

  get pending() { return this.pendingCount; }
}