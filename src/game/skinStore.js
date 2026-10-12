// Skin do jogador local: Steve ou Alex (do pacote 1.8.9) ou um PNG 64×64 enviado pelo jogador.
// A escolha fica no navegador; o rosto (8×8 da cabeça + camada do chapéu) alimenta a lista do TAB.
const KEY = 'mc_skin';
const listeners = new Set();

export function getSkinChoice() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && (v.kind === 'steve' || v.kind === 'alex' || (v.kind === 'custom' && typeof v.png === 'string'))) return v;
  } catch { /* sem armazenamento: usa Steve */ }
  return { kind: 'steve' };
}

export function setSkinChoice(choice) {
  try { localStorage.setItem(KEY, JSON.stringify(choice)); } catch { /* cota cheia ou bloqueado */ }
  listeners.forEach(fn => fn(choice));
}

export function onSkinChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// === Capa (Crafthead): { user, png } salva no navegador; null = sem capa ===
const CAPE_KEY = 'mc_cape';
let _capeCache; // undefined = não lido ainda
export function getCapeChoice() {
  if (_capeCache !== undefined) return _capeCache;
  try {
    const v = JSON.parse(localStorage.getItem(CAPE_KEY) || 'null');
    _capeCache = (v && typeof v.png === 'string') ? v : null;
  } catch { _capeCache = null; }
  return _capeCache;
}
export function setCapeChoice(c) {
  _capeCache = c || null;
  try {
    if (c) localStorage.setItem(CAPE_KEY, JSON.stringify(c));
    else localStorage.removeItem(CAPE_KEY);
  } catch { /* cota cheia ou bloqueado */ }
  capeListeners.forEach(fn => fn(_capeCache));
}
const capeListeners = new Set();
export function onCapeChange(fn) { capeListeners.add(fn); return () => capeListeners.delete(fn); }

// Normaliza qualquer skin para canvas 64×64: quadrada reduz com vizinho mais próximo;
// 64×32 (legada 1.7) expande copiando os membros direitos espelhados para os locais esquerdos.
export function normalizeSkinImage(img) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (img.width === img.height) {
    ctx.drawImage(img, 0, 0, 64, 64);
    return cv;
  }
  if (img.width === 64 && img.height === 32) {
    ctx.drawImage(img, 0, 0); // metade de cima idêntica (cabeça, chapéu, corpo, membros direitos)
    // Membro esquerdo = espelho do direito, face a face: faces interna/externa trocam de slot
    // e cada face é flipada na horizontal (como o render da 1.7 fazia com a textura direita).
    const mirrorBox = (u, v, du) => {
      const w = 4, h = 12, d = 4;
      const faces = [
        [u + d, v, w, d, du + d, v],                 // topo
        [u + w + d, v, w, d, du + w + d, v],         // base
        [u, v + d, d, h, du + w + d, v + d],         // externa (−x) → slot externa do outro lado
        [u + d, v + d, w, h, du + d, v + d],         // frente
        [u + w + d, v + d, d, h, du, v + d],         // interna (+x) → slot interna
        [u + w + 2 * d, v + d, w, h, du + w + 2 * d, v + d], // costas
      ];
      for (const [sx, sy, sw, sh, dx, dy] of faces) {
        ctx.save();
        ctx.translate(dx + sw / 2, dy + sh / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
        ctx.restore();
      }
    };
    mirrorBox(40, 16, 32); // braço direito → esquerdo
    mirrorBox(0, 16, 16);  // perna direita → esquerda
    return cv;
  }
  return null; // formato não suportado
}

// Lê um arquivo PNG e normaliza para 64×64: skins salvas em outros tamanhos (128×128, 256×256…)
// são reduzidas com vizinho mais próximo (sem borrar os pixels) e reencodadas (menor arquivo).
// Entrada aceita até 5 MB; o resultado final precisa caber em 200 KB (limite do localStorage).
export function readSkinFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Nenhum arquivo escolhido.'));
    if (file.type !== 'image/png') return reject(new Error('A skin precisa ser um arquivo PNG.'));
    if (file.size > 5 * 1024 * 1024) return reject(new Error('Arquivo grande demais (máximo 5 MB).'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cv = normalizeSkinImage(img);
        if (!cv) return reject(new Error(`Skin inválida: aceita quadrada (ex.: 64×64) ou legada 64×32; esta tem ${img.width}×${img.height}.`));
        const dataUrl = cv.toDataURL('image/png');
        if (dataUrl.length > 200 * 1024) return reject(new Error('Mesmo convertida, a skin ficou grande demais (máximo 200 KB).'));
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Canvas 64×64 da skin escolhida (ou null se o pacote ainda não carregou)
export async function getSkinCanvas(choice = getSkinChoice()) {
  if (choice.kind === 'custom') {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = 64; cv.height = 64;
        cv.getContext('2d').drawImage(img, 0, 0);
        resolve(cv);
      };
      img.onerror = () => resolve(null);
      img.src = choice.png;
    });
  }
  const { getPackCanvas, MC } = await import('./pack');
  return getPackCanvas(MC + `textures/entity/${choice.kind}.png`);
}

export function isSlimSkin(choice = getSkinChoice()) { return choice.kind === 'alex'; }

// Rosto 8×8 com a camada do chapéu por cima, ampliado em `scale` px por pixel de skin, como data URL
export async function getSkinFaceUrl(scale = 4, choice = getSkinChoice()) {
  const src = await getSkinCanvas(choice);
  if (!src) return null;
  const cv = document.createElement('canvas');
  cv.width = 8 * scale; cv.height = 8 * scale;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 8, 8, 8, 8, 0, 0, cv.width, cv.height);
  ctx.drawImage(src, 40, 8, 8, 8, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/png');
}
