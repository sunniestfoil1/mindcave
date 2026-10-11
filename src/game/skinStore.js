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

// Lê um arquivo PNG e valida: precisa ser 64×64 (formato atual de skin) e ter até 200 KB
export function readSkinFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Nenhum arquivo escolhido.'));
    if (file.type !== 'image/png') return reject(new Error('A skin precisa ser um arquivo PNG.'));
    if (file.size > 200 * 1024) return reject(new Error('Arquivo grande demais (máximo 200 KB).'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (img.width !== 64 || img.height !== 64) return reject(new Error(`A skin precisa ter 64×64 px (esta tem ${img.width}×${img.height}).`));
        resolve(reader.result);
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
