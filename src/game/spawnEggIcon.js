// Ícone do ovo de spawn: spawn_egg.png (casca) multiplicado pela cor primária + spawn_egg_overlay.png (pintas) multiplicado pela secundária,
// como o ItemMonsterPlacer.getColorFromItemStack do 1.8.9. Devolve um canvas; o resultado fica em cache por meta.
import { getPackCanvas, MC } from './pack';
import { SPAWN_EGGS } from './spawnEggData';

const cache = new Map();

function tinted(src, rgb) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
  const r = ((rgb >> 16) & 255) / 255, gr = ((rgb >> 8) & 255) / 255, b = (rgb & 255) / 255;
  for (let i = 0; i < d.length; i += 4) { d[i] *= r; d[i + 1] *= gr; d[i + 2] *= b; }
  g.putImageData(img, 0, 0);
  return cv;
}

export function composeEggCanvas(meta) {
  const egg = SPAWN_EGGS[meta] || { c1: 0xffffff, c2: 0xffffff };   // meta sem mob (ovo "cru"): o desenho sem tinta
  if (cache.has(meta)) return cache.get(meta);
  const p = Promise.all([getPackCanvas(MC + 'textures/items/spawn_egg.png'), getPackCanvas(MC + 'textures/items/spawn_egg_overlay.png')]).then(([base, spots]) => {
    if (!base) { cache.delete(meta); return null; }   // pacote ainda não carregou: tenta de novo na próxima
    const out = tinted(base, egg.c1);
    if (spots) out.getContext('2d').drawImage(tinted(spots, egg.c2), 0, 0);
    return out;
  });
  cache.set(meta, p);
  return p;
}
