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

// Detecta se uma skin no formato 64×64 foi projetada para modelo fino (Alex, 3px) ou clássico (Steve, 4px)
export function detectSlimSkin(canvas) {
  try {
    const ctx = canvas.getContext('2d');
    // No modelo clássico (4px), as colunas 54-55 (x: 54, 55, y: 20..31) contêm pixels opacos da face de trás do braço.
    // No modelo slim (3px), essas colunas ficam vazias/transparentes no layout 64×64.
    const checkCoords = [
      { x: 54, y: 20 },
      { x: 55, y: 20 },
      { x: 54, y: 28 },
      { x: 55, y: 28 },
    ];
    let opaqueCount = 0;
    for (const { x, y } of checkCoords) {
      const alpha = ctx.getImageData(x, y, 1, 1).data[3];
      if (alpha > 10) opaqueCount++;
    }
    return opaqueCount === 0;
  } catch {
    return false;
  }
}

// Normaliza qualquer skin para canvas 64×64 com padrão Minecraft Java 1.8+:
// - 64×32 legada (<= 1.7) ou proporção 2:1 (ex: 128×64) expande para 64×64, espelhando os membros
//   direitos (braço e perna) para os slots dos membros esquerdos.
// - 64×64 com membros esquerdos transparentes/vazios detecta a ausência e espelha automaticamente.
// - Membros de destino corretos no formato 64×64:
//   * Braço esquerdo: (32, 48) - espelho do braço direito (40, 16)
//   * Perna esquerda: (16, 48) - espelho da perna direita (0, 16)
//   * Manga esquerda: (48, 48) - espelho da manga direita (40, 32)
//   * Calça esquerda: (0, 48)  - espelho da calça direita (0, 32)
export function normalizeSkinImage(img) {
  if (!img || !img.width || !img.height) return null;

  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Espelha uma caixa cubóide de membro de um canvas de origem para o canvas de destino 64×64
  const mirrorLimb = (sourceCanvas, su, sv, du, dv, w = 4, h = 12, d = 4) => {
    const faces = [
      [su + d, sv, w, d, du + d, dv],                           // Topo (+Y)
      [su + d + w, sv, w, d, du + d + w, dv],                   // Base (-Y)
      [su, sv + d, d, h, du + d + w, dv + d],                   // Externa: direito -X -> esquerdo +X
      [su + d, sv + d, w, h, du + d, dv + d],                   // Frente (+Z)
      [su + d + w, sv + d, d, h, du, dv + d],                   // Interna: direito +X -> esquerdo -X
      [su + w + 2 * d, sv + d, w, h, du + w + 2 * d, dv + d],   // Costas (-Z)
    ];

    for (const [sx, sy, sw, sh, dx, dy] of faces) {
      ctx.save();
      ctx.translate(dx + sw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
      ctx.restore();
    }
  };

  const hasVisiblePixels = (c, x, y, w, h) => {
    try {
      const data = c.getContext('2d').getImageData(x, y, w, h).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 10) return true;
      }
    } catch { /* contexto protegido */ }
    return false;
  };

  // CASO 1: Formato legado 2:1 (64×32, 128×64, etc.)
  if (img.width === img.height * 2 || (img.width === 64 && img.height === 32)) {
    const tempCv = document.createElement('canvas');
    tempCv.width = 64; tempCv.height = 32;
    const tempCtx = tempCv.getContext('2d');
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(img, 0, 0, 64, 32);

    // Metade de cima idêntica: cabeça, chapéu, corpo, braço direito, perna direita
    ctx.drawImage(tempCv, 0, 0);

    // Espelha braço direito -> esquerdo e perna direita -> esquerda
    mirrorLimb(tempCv, 40, 16, 32, 48, 4, 12, 4);
    mirrorLimb(tempCv, 0, 16, 16, 48, 4, 12, 4);

    return cv;
  }

  // CASO 2: Formato quadrado (64×64, 128×128, etc.)
  if (img.width === img.height) {
    ctx.drawImage(img, 0, 0, 64, 64);

    // Cria snapshot estático para ler pixels de origem sem risco de sobreposição
    const snap = document.createElement('canvas');
    snap.width = 64; snap.height = 64;
    const sctx = snap.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(cv, 0, 0);

    const hasLeftArm = hasVisiblePixels(snap, 32, 48, 16, 16);
    const hasLeftLeg = hasVisiblePixels(snap, 16, 48, 16, 16);
    const hasRightArm = hasVisiblePixels(snap, 40, 16, 16, 16);
    const hasRightLeg = hasVisiblePixels(snap, 0, 16, 16, 16);

    // Se braço esquerdo não tem textura mas braço direito tem, espelha!
    if (!hasLeftArm && hasRightArm) {
      mirrorLimb(snap, 40, 16, 32, 48, 4, 12, 4);
    }
    // Se perna esquerda não tem textura mas perna direita tem, espelha!
    if (!hasLeftLeg && hasRightLeg) {
      mirrorLimb(snap, 0, 16, 16, 48, 4, 12, 4);
    }

    // Camadas externas (segunda camada)
    const hasRightSleeve = hasVisiblePixels(snap, 40, 32, 16, 16);
    const hasLeftSleeve = hasVisiblePixels(snap, 48, 48, 16, 16);
    if (!hasLeftSleeve && hasRightSleeve) {
      mirrorLimb(snap, 40, 32, 48, 48, 4, 12, 4);
    }

    const hasRightPants = hasVisiblePixels(snap, 0, 32, 16, 16);
    const hasLeftPants = hasVisiblePixels(snap, 0, 48, 16, 16);
    if (!hasLeftPants && hasRightPants) {
      mirrorLimb(snap, 0, 32, 0, 48, 4, 12, 4);
    }

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
    if (file.type && !file.type.includes('image/png') && !file.type.includes('png')) {
      return reject(new Error('A skin precisa ser um arquivo PNG.'));
    }
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
        const slim = detectSlimSkin(cv);
        resolve({ png: dataUrl, slim });
      };
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Canvas 64×64 da skin escolhida. Fica em cache (por escolha) e há leitura síncrona: o modelo/prévia só aparece quando a skin certa
// já existe, então não há mais o Steve piscando antes da skin personalizada. Steve e Alex vêm de arquivos locais (não esperam o pacote de 106 MB).
const _skinCanvases = new Map();   // chave → canvas pronto
const _skinPromises = new Map();   // chave → promessa em andamento
const skinKey = (c) => (c.kind === 'custom' ? `custom:${c.png.length}:${c.png.slice(-48)}` : c.kind);

export function getSkinCanvasSync(choice = getSkinChoice()) {
  return _skinCanvases.get(skinKey(choice)) || null;
}

function loadImageUrl(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function decodeSkin(choice) {
  if (choice.kind === 'custom') {
    const img = await loadImageUrl(choice.png);
    if (!img) return null;
    const cv = normalizeSkinImage(img);
    if (cv) return cv;
    const fallbackCv = document.createElement('canvas');
    fallbackCv.width = 64; fallbackCv.height = 64;
    fallbackCv.getContext('2d').drawImage(img, 0, 0);
    return fallbackCv;
  }
  const img = await loadImageUrl(`/assets/skins/${choice.kind}.png`);
  if (img) { const cv = normalizeSkinImage(img); if (cv) return cv; }
  const { getPackCanvas, MC } = await import('./pack');
  return getPackCanvas(MC + `textures/entity/${choice.kind}.png`);
}

export function getSkinCanvas(choice = getSkinChoice()) {
  const key = skinKey(choice);
  const ready = _skinCanvases.get(key);
  if (ready) return Promise.resolve(ready);
  if (_skinPromises.has(key)) return _skinPromises.get(key);
  const p = decodeSkin(choice).then((cv) => {
    if (cv) { if (_skinCanvases.size > 8) _skinCanvases.delete(_skinCanvases.keys().next().value); _skinCanvases.set(key, cv); }
    _skinPromises.delete(key);
    return cv;
  });
  _skinPromises.set(key, p);
  return p;
}

// Começa a decodificar a skin local sem esperar ninguém (chamado ao abrir o mundo, em paralelo com pacote e chunks)
export function preloadLocalSkin() { return getSkinCanvas().catch(() => null); }

export function isSlimSkin(choice = getSkinChoice()) {
  if (choice.kind === 'alex') return true;
  if (choice.kind === 'custom' && !!choice.slim) return true;
  return false;
}

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
