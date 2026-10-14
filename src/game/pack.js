// Pacote de recursos "minecraft-assets-1.8.9.zip": hospedado em nuvem de alta velocidade no Supabase Storage
// com fallback para Old_Default_1.8.9.zip e armazenamento persistente na Cache API (mc-assets-v2)
export const SUPABASE_STORAGE_URL = 'https://ddwdgwaliywymcatdekg.supabase.co/storage/v1/object/public/game-assets';
export const PACK_URL = `${SUPABASE_STORAGE_URL}/minecraft-assets-1.8.9.zip`;
export const FALLBACK_PACK_URL = `${SUPABASE_STORAGE_URL}/Old_Default_1.8.9.zip`;
export const LOCAL_FALLBACK_URL = '/assets/Old_Default_1.8.9.zip';
export const MC = 'assets/minecraft/';

let _entries = null;
let _buf = null;
let _promise = null;
let _ready = false;
const _listeners = new Set();
const _canvasCache = new Map();
const _urlCache = new Map();
const _jsonCache = new Map();

// Pacotes de recursos extras (resourcepacks) por cima do pacote base, do mais prioritário ao menos: { id, buf, entries, prefix }.
// Entram antes do pacote base ficar pronto (ver resourcePacks.js), então nenhum cache abaixo guarda textura "velha".
let _overlays = [];
const _overlayUrls = new Map();

// Verifica se os primeiros 4 bytes do buffer são o cabeçalho 'PK\x03\x04' (0x04034b50)
function isValidZipBuffer(buf) {
  if (!buf || buf.byteLength < 22) return false;
  const dv = new DataView(buf);
  return dv.getUint32(0, true) === 0x04034b50;
}

async function fetchBufferWithProgress(url, onProgress) {
  try {
    const cache = await caches.open('mc-assets-v2');
    const hit = await cache.match(url);
    if (hit) {
      const cachedBuf = await hit.arrayBuffer();
      if (isValidZipBuffer(cachedBuf)) {
        onProgress?.({ percent: 100, loaded: 1, total: 1, status: 'Pacote carregado do cache local!' });
        return cachedBuf;
      }
    }
  } catch { /* sem Cache API */ }

  try {
    onProgress?.({ percent: 0, loaded: 0, total: 100, status: 'Conectando ao Supabase Storage...' });
    const res = await fetch(url);
    if (!res.ok || res.headers.get('content-type')?.includes('text/html')) {
      throw new Error(`Servidor retornou status ${res.status}`);
    }

    const contentLength = res.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 6657308;
    let loadedBytes = 0;

    const reader = res.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loadedBytes += value.byteLength;

      const percent = Math.min(99, Math.round((loadedBytes / totalBytes) * 100));
      const loadedMB = (loadedBytes / 1024 / 1024).toFixed(1);
      const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
      onProgress?.({
        percent,
        loaded: loadedBytes,
        total: totalBytes,
        status: `Baixando texturas 1.8.9: ${loadedMB} MB / ${totalMB} MB (${percent}%)`
      });
    }

    const buf = new Uint8Array(loadedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const arrayBuf = buf.buffer;
    if (!isValidZipBuffer(arrayBuf)) {
      throw new Error('Buffer baixado não é um ZIP válido');
    }

    // Salvar no Cache API
    try {
      const cache = await caches.open('mc-assets-v2');
      await cache.put(url, new Response(arrayBuf.slice(0)));
    } catch {}

    onProgress?.({ percent: 100, loaded: totalBytes, total: totalBytes, status: 'Extraindo texturas e modelos...' });
    return arrayBuf;
  } catch (e) {
    console.warn(`[Pack] Falha ao baixar ${url}: ${e.message}. Tentando próximo fallback...`);
    if (url === PACK_URL) {
      return fetchBufferWithProgress(FALLBACK_PACK_URL, onProgress);
    }
    if (url === FALLBACK_PACK_URL) {
      return fetchBufferWithProgress(LOCAL_FALLBACK_URL, onProgress);
    }
    return null;
  }
}

export function parseZipEntries(buf) {
  if (!isValidZipBuffer(buf)) {
    console.warn('[Pack] Buffer zip inválido ou corrompido');
    return {};
  }
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return {};

  const cdOffset = dv.getUint32(eocd + 16, true);
  const cdEntries = dv.getUint16(eocd + 10, true);
  const entries = {};
  const dec = new TextDecoder();
  let off = cdOffset;

  for (let i = 0; i < cdEntries; i++) {
    if (off + 46 > buf.byteLength || dv.getUint32(off, true) !== 0x02014b50) break;
    const compMethod = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = dec.decode(new Uint8Array(buf, off + 46, nameLen)).replace(/\\/g, '/');
    const localNameLen = dv.getUint16(localOff + 26, true);
    const localExtraLen = dv.getUint16(localOff + 28, true);
    entries[name] = { compMethod, compSize, dataOff: localOff + 30 + localNameLen + localExtraLen, buf };
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflate(entry) {
  const compressed = new Uint8Array(entry.buf || _buf, entry.dataOff, entry.compSize);
  if (entry.compMethod === 0) return compressed;
  if (entry.compMethod === 8) {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error('Compressão não suportada: ' + entry.compMethod);
}

function overlayEntry(path) {
  for (const ov of _overlays) {
    const e = ov.entries[ov.prefix + path];
    if (e) return e;
  }
  return null;
}

function resolveEntry(path) {
  const ov = overlayEntry(path);
  if (ov) return ov;
  if (!_entries) return null;
  if (_entries[path]) return _entries[path];
  if (_entries['minecraft-assets-1.8.9/' + path]) return _entries['minecraft-assets-1.8.9/' + path];
  const clean = path.startsWith('/') ? path.slice(1) : path;
  for (const k in _entries) {
    if (k.endsWith(clean)) return _entries[k];
  }
  return null;
}

export function loadPack(onProgress) {
  if (_promise) return _promise;
  _promise = (async () => {
    try {
      _buf = await fetchBufferWithProgress(PACK_URL, onProgress);
      if (!_buf || !isValidZipBuffer(_buf)) {
        _ready = false;
        return false;
      }
      _entries = parseZipEntries(_buf);
      _ready = true;
      for (const cb of _listeners) { try { cb(); } catch (e) { console.error(e); } }
      _listeners.clear();
      return true;
    } catch (e) {
      console.warn('[Pack] Erro na inicialização do pacote:', e);
      _promise = null;
      _ready = false;
      return false;
    }
  })();
  return _promise;
}

export function ensurePack(onProgress, timeoutMs = 25000) {
  return Promise.race([loadPack(onProgress), new Promise(r => setTimeout(() => r(false), timeoutMs))]);
}

export function isPackReady() { return _ready; }
export function onPackReady(cb) {
  if (_ready) { cb(); return () => {}; }
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}
export function hasPackFile(path) { return !!resolveEntry(path); }
export function listPackFiles(prefix) {
  return _entries ? Object.keys(_entries).filter(n => n.includes(prefix)) : [];
}
export function packFileCount() { return _entries ? Object.keys(_entries).length : 0; }

export async function getPackBytes(path) {
  if (!_ready && !overlayEntry(path)) return null;
  const entry = resolveEntry(path);
  if (!entry) return null;
  return inflate(entry);
}

export function getPackCanvas(path) {
  if (!_ready && !overlayEntry(path)) {
    return new Promise((resolve) => {
      onPackReady(() => resolve(getPackCanvas(path)));
    });
  }
  const entry = resolveEntry(path);
  if (!entry) return Promise.resolve(null);
  if (_canvasCache.has(path)) return _canvasCache.get(path);
  const p = (async () => {
    const bytes = await inflate(entry);
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const cv = document.createElement('canvas');
    cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close?.();
    return cv;
  })().catch(() => null);
  _canvasCache.set(path, p);
  return p;
}

export function getPackUrl(path) {
  if (!_ready && !overlayEntry(path)) {
    return new Promise((resolve) => {
      onPackReady(() => resolve(getPackUrl(path)));
    });
  }
  const entry = resolveEntry(path);
  if (!entry) return Promise.resolve(null);
  if (_urlCache.has(path)) return _urlCache.get(path);
  const p = (async () => {
    const bytes = await inflate(entry);
    return URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  })().catch(() => null);
  _urlCache.set(path, p);
  return p;
}

export function getPackJson(path) {
  if (!_ready && !overlayEntry(path)) return Promise.resolve(null);
  const entry = resolveEntry(path);
  if (!entry) return Promise.resolve(null);
  if (_jsonCache.has(path)) return _jsonCache.get(path);
  const p = (async () => {
    const bytes = await inflate(entry);
    return JSON.parse(new TextDecoder().decode(bytes));
  })().catch(() => null);
  _jsonCache.set(path, p);
  return p;
}
// Liga os pacotes extras (do mais prioritário ao menos). Chamado no boot, antes de qualquer textura ser pedida.
// As folhas de GUI que o jogo mostra sem esperar o pacote base (widgets, icons) já saem daqui como URL pronta.
const SYNC_GUI_TEXTURES = ['textures/gui/widgets.png', 'textures/gui/icons.png', 'textures/font/ascii.png'];
export async function setOverlays(list) {
  _overlays = list.map(({ id, buf }) => {
    const entries = parseZipEntries(buf);
    // pacotes zipados com uma pasta por fora (Pack/assets/minecraft/...)
    let prefix = '';
    if (!entries[MC + 'textures/blocks/stone.png'] && !Object.keys(entries).some((k) => k.startsWith('assets/'))) {
      const hit = Object.keys(entries).find((k) => k.includes('/' + MC));
      if (hit) prefix = hit.slice(0, hit.indexOf('/' + MC) + 1);
    }
    return { id, buf, entries, prefix };
  });
  _canvasCache.clear(); _urlCache.clear(); _jsonCache.clear();
  for (const u of _overlayUrls.values()) URL.revokeObjectURL(u);
  _overlayUrls.clear();
  await Promise.all(SYNC_GUI_TEXTURES.map(async (path) => {
    const entry = overlayEntry(MC + path);
    if (!entry) return;
    const bytes = await inflate(entry);
    _overlayUrls.set(path, URL.createObjectURL(new Blob([bytes], { type: 'image/png' })));
  }));
}
export function getOverlayUrlSync(path) { return _overlayUrls.get(path) || null; }
// Lê um arquivo qualquer de um zip solto (pack.png e pack.mcmeta da tela de pacotes)
export async function readZipFile(buf, name) {
  const e = parseZipEntries(buf)[name];
  return e ? inflate(e) : null;
}
