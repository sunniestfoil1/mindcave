// Busca skin e capa pelo nickname com múltiplos provedores e fallback automático:
// 1. Crafthead (crafthead.net)
// 2. MC-Heads (mc-heads.net)
// 3. Minotar (minotar.net)
// Todos com CORS aberto confirmado. Suporta também carregar diretamente de uma URL de imagem.
import { normalizeSkinImage, detectSlimSkin } from './skinStore.js';

const SKIN_PROVIDERS = [
  (nick) => `https://crafthead.net/skin/${encodeURIComponent(nick)}`,
  (nick) => `https://mc-heads.net/skin/${encodeURIComponent(nick)}`,
  (nick) => `https://minotar.net/skin/${encodeURIComponent(nick)}`,
];

const CAPE_PROVIDERS = [
  (nick) => `https://crafthead.net/cape/${encodeURIComponent(nick)}`,
  (nick) => `https://crafatar.com/capes/${encodeURIComponent(nick)}`,
];

const NICK = /^[A-Za-z0-9_]{3,16}$/;

function validateNick(nick) {
  const n = (nick || '').trim();
  if (!NICK.test(n)) throw new Error('Nickname inválido: use 3 a 16 letras, números ou _.');
  return n;
}

async function fetchPngBlobWithFallback(urls) {
  let lastErr = null;
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const r = await fetch(url, { signal: timer.signal });
      clearTimeout(timer);
      if (!r.ok) continue;
      const blob = await r.blob();
      if (blob.type && !blob.type.includes('png') && !blob.type.includes('image')) continue;
      if (blob.size < 50) continue; // evita payloads vazios
      return URL.createObjectURL(blob);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Não foi possível obter a imagem dos servidores de skin.');
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try { if (url.startsWith('blob:')) URL.revokeObjectURL(url); } catch { /* noop */ }
      resolve(img);
    };
    img.onerror = () => {
      try { if (url.startsWith('blob:')) URL.revokeObjectURL(url); } catch { /* noop */ }
      reject(new Error('Imagem inválida ao carregar.'));
    };
    img.src = url;
  });
}

// Skin do nickname → { user, png, slim } dataURL 64×64 já normalizada
export async function fetchCraftheadSkin(nick) {
  const n = validateNick(nick);
  const urls = SKIN_PROVIDERS.map(fn => fn(n));
  const objUrl = await fetchPngBlobWithFallback(urls);
  const img = await loadImage(objUrl);
  const cv = normalizeSkinImage(img);
  if (!cv) throw new Error(`Skin de ${n} veio em formato desconhecido (${img.width}×${img.height}).`);
  const png = cv.toDataURL('image/png');
  if (png.length > 200 * 1024) throw new Error('Skin pesada demais para salvar (máximo 200 KB).');
  const slim = detectSlimSkin(cv);
  return { user: n, png, slim };
}

// Suporte para carregar skin diretamente de uma URL de imagem (ex: link do imgur, namemc, novaskin)
export async function fetchSkinFromUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    throw new Error('A URL precisa começar com http:// ou https://');
  }
  let objUrl;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(trimmed, { signal: timer.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`Servidor respondeu com código ${r.status}.`);
    const blob = await r.blob();
    objUrl = URL.createObjectURL(blob);
  } catch {
    // Se fetch falhar (ex: restrição de CORS em fetch mas permitido em <img> tag)
    objUrl = trimmed;
  }

  const img = await loadImage(objUrl);
  const cv = normalizeSkinImage(img);
  if (!cv) throw new Error(`Skin da URL veio em formato desconhecido (${img.width}×${img.height}). Use 64×64 ou 64×32.`);
  const png = cv.toDataURL('image/png');
  if (png.length > 200 * 1024) throw new Error('Skin pesada demais para salvar (máximo 200 KB).');
  const slim = detectSlimSkin(cv);
  return { user: 'url', png, slim };
}

// Capa do nickname → dataURL do render, ou null se o jogador não tem capa (PNG 1×1)
export async function fetchCraftheadCape(nick) {
  const n = validateNick(nick);
  try {
    const urls = CAPE_PROVIDERS.map(fn => fn(n));
    const objUrl = await fetchPngBlobWithFallback(urls);
    const img = await loadImage(objUrl);
    if (img.width <= 1 && img.height <= 1) return null;
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const png = cv.toDataURL('image/png');
    if (png.length > 200 * 1024) return null;
    return { user: n, png };
  } catch {
    return null;
  }
}
