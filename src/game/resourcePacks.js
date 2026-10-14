// Pacotes de recursos extras, no estilo do ResourcePackRepository do 1.8.9: a lista escolhida vale por cima do pacote base.
// Cada pacote é um .zip no Supabase Storage. Depois de baixado fica na Cache API e só baixa de novo se o tamanho (ou o ETag) mudar:
// a conferência é um HEAD de poucos bytes. A escolha fica no localStorage na ordem do options.txt (último = maior prioridade).
import { SUPABASE_STORAGE_URL, setOverlays, readZipFile } from './pack';

const STORE_KEY = 'mc.resourcePacks.v1';
const CACHE_NAME = 'mc-resourcepacks-v1';

export const PACK_CATALOG = [
  { id: 'SunniFPSBOOST.zip', url: `${SUPABASE_STORAGE_URL}/resourcepacks/SunniFPSBOOST.zip`, size: 2261841 },
];
export const OPTIMIZED_PACK_ID = 'SunniFPSBOOST.zip';

const packById = (id) => PACK_CATALOG.find((p) => p.id === id) || null;

export function getSelectedPackIds() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY));
    if (Array.isArray(v)) return v.filter((id) => packById(id));
  } catch { /* sem localStorage ou valor corrompido */ }
  return [];
}

export function setSelectedPackIds(ids) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(ids.filter((id) => packById(id)))); } catch { /* sem localStorage */ }
}

// ---- cache (bytes do zip + tamanho e ETag da versão baixada) ----
async function readCache(pack) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(pack.url);
    if (!res) return null;
    const buf = await res.arrayBuffer();
    return { buf, size: Number(res.headers.get('x-pack-size')) || buf.byteLength, etag: res.headers.get('x-pack-etag') || '' };
  } catch { return null; }
}

async function writeCache(pack, buf, etag) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(pack.url, new Response(buf.slice(0), { headers: { 'content-type': 'application/zip', 'x-pack-size': String(buf.byteLength), 'x-pack-etag': etag || '' } }));
  } catch { /* sem Cache API: baixa de novo na próxima */ }
}

async function remoteInfo(pack) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 5000);
  try {
    const res = await fetch(pack.url, { method: 'HEAD', cache: 'no-store', signal: ctl.signal });
    if (!res.ok) return null;
    return { size: Number(res.headers.get('content-length')) || 0, etag: res.headers.get('etag') || '' };
  } catch { return null; } finally { clearTimeout(timer); }
}

const sameVersion = (cached, remote) => cached.size === remote.size && (!remote.etag || !cached.etag || cached.etag === remote.etag);

function isZip(buf) {
  return buf.byteLength > 22 && new DataView(buf).getUint32(0, true) === 0x04034b50;
}

async function download(pack, onProgress) {
  const res = await fetch(pack.url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`servidor respondeu ${res.status}`);
  const total = Number(res.headers.get('content-length')) || pack.size;
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.(Math.min(99, Math.round((loaded / total) * 100)));
  }
  const bytes = new Uint8Array(loaded);
  let off = 0;
  for (const c of chunks) { bytes.set(c, off); off += c.byteLength; }
  if (!isZip(bytes.buffer)) throw new Error('o arquivo baixado não é um zip');
  await writeCache(pack, bytes.buffer, res.headers.get('etag') || '');
  onProgress?.(100);
  return bytes.buffer;
}

// Zip do pacote: do cache quando a versão do servidor é a mesma (ou o servidor não responde), senão baixa de novo.
export async function ensurePackBuffer(pack, onProgress) {
  const cached = await readCache(pack);
  const remote = await remoteInfo(pack);
  if (cached && (!remote || sameVersion(cached, remote))) return cached.buf;
  try {
    return await download(pack, onProgress);
  } catch (e) {
    if (cached) return cached.buf;
    throw e;
  }
}

export async function getCachedPackBuffer(pack) {
  return (await readCache(pack))?.buf || null;
}

// pack.png e descrição do pack.mcmeta (como a lista do jogo mostra). O byte solto do § vira o caractere de substituição e sai.
export async function readPackInfo(buf) {
  let description = '';
  let iconUrl = null;
  try {
    const meta = await readZipFile(buf, 'pack.mcmeta');
    if (meta) description = String(JSON.parse(new TextDecoder().decode(meta))?.pack?.description || '').replace(/�/g, '');
    const png = await readZipFile(buf, 'pack.png');
    if (png) iconUrl = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
  } catch { /* pacote sem metadados: aparece só o nome */ }
  return { description, iconUrl };
}

// Boot: liga os pacotes escolhidos que já estão no cache (sem rede, para o jogo abrir na hora). O que faltar ou estiver
// desatualizado é baixado em segundo plano e vale na próxima abertura.
export async function bootResourcePacks() {
  const ids = getSelectedPackIds();
  if (ids.length === 0) return;
  const list = [];
  const stale = [];
  for (const id of [...ids].reverse()) {
    const pack = packById(id);
    const cached = await readCache(pack);
    if (cached) list.push({ id, buf: cached.buf }); else console.warn(`[Pacotes] ${id} não está no cache deste navegador; baixando para a próxima abertura`);
    stale.push(pack);
  }
  if (list.length) await setOverlays(list);
  setTimeout(() => { for (const pack of stale) ensurePackBuffer(pack).catch((e) => console.warn(`[Pacotes] ${pack.id}: ${e.message}`)); }, 3000);
}
