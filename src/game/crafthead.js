// Crafthead (crafthead.net): busca skin e capa pelo nickname.
// CORS aberto (Access-Control-Allow-Origin: *) confirmado; sem chave, sem conta.
// Endereços: /skin/{nick} → PNG 64×64 ou 64×32 (legada); /cape/{nick} → render 113×180 da capa
// ou PNG 1×1 transparente quando o jogador não tem capa.
import { normalizeSkinImage } from './skinStore';

const API = 'https://crafthead.net';
const NICK = /^[A-Za-z0-9_]{3,16}$/;

function validateNick(nick) {
  const n = (nick || '').trim();
  if (!NICK.test(n)) throw new Error('Nickname inválido: use 3 a 16 letras, números ou _.');
  return n;
}

async function fetchPngUrl(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Crafthead respondeu ${r.status}.`);
  const blob = await r.blob();
  if (!blob.type || !blob.type.includes('png')) throw new Error('Resposta do Crafthead não é PNG.');
  return URL.createObjectURL(blob);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida do Crafthead.')); };
    img.src = url;
  });
}

// Skin do nickname → dataURL 64×64 já normalizada (legada 64×32 é convertida)
export async function fetchCraftheadSkin(nick) {
  const n = validateNick(nick);
  const img = await loadImage(await fetchPngUrl(`${API}/skin/${encodeURIComponent(n)}`));
  const cv = normalizeSkinImage(img);
  if (!cv) throw new Error(`Skin de ${n} veio em formato desconhecido (${img.width}×${img.height}).`);
  const png = cv.toDataURL('image/png');
  if (png.length > 200 * 1024) throw new Error('Skin pesada demais para salvar (máximo 200 KB).');
  return { user: n, png };
}

// Capa do nickname → dataURL do render, ou null se o jogador não tem capa (PNG 1×1)
export async function fetchCraftheadCape(nick) {
  const n = validateNick(nick);
  const img = await loadImage(await fetchPngUrl(`${API}/cape/${encodeURIComponent(n)}`));
  if (img.width <= 1 && img.height <= 1) return null;
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const png = cv.toDataURL('image/png');
  if (png.length > 200 * 1024) throw new Error('Capa pesada demais para salvar (máximo 200 KB).');
  return { user: n, png };
}
