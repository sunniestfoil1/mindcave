// Item 2D "extrudado" (ItemRenderer.renderItemIn2D / ItemModelGenerator): face da frente e de trás com a imagem inteira e, em cada
// borda de pixel opaco, uma lateral com a cor daquele pixel (1 pixel de espessura). É isso que dá profundidade ao item na mão e no chão.
// Coordenadas centradas: x e y de −size/2 a +size/2, z de −espessura/2 a +espessura/2; frente em +z (imagem sem espelhar).
import * as THREE from 'three';

const geometryCache = new Map();

// canvas: imagem do item (quadrada; tira de animação usa só o 1º quadro). size: lado do item em unidades do mundo.
export function buildExtrudedGeometry(canvas, size) {
  const w = canvas.width;
  const h = Math.min(canvas.height, w);
  const alpha = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const opaque = (i, j) => i >= 0 && j >= 0 && i < w && j < h && alpha[(j * w + i) * 4 + 3] > 16;

  const pos = [], nor = [], uv = [], idx = [];
  const quad = (a, b, c, d, n, ua, ub, uc, ud) => {
    const base = pos.length / 3;
    for (const p of [a, b, c, d]) pos.push(p[0], p[1], p[2]);
    for (let k = 0; k < 4; k++) nor.push(n[0], n[1], n[2]);
    for (const t of [ua, ub, uc, ud]) uv.push(t[0], t[1]);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  const half = size / 2;
  const depth = size / 16;           // 1 pixel de um item 16×16
  const hz = depth / 2;
  // frente (+z) e verso (−z): mesmo pixel no mesmo lugar nas duas faces (o verso, visto por trás, é a imagem espelhada, como um carimbo)
  quad([-half, -half, hz], [half, -half, hz], [half, half, hz], [-half, half, hz], [0, 0, 1], [0, 0], [1, 0], [1, 1], [0, 1]);
  quad([half, -half, -hz], [-half, -half, -hz], [-half, half, -hz], [half, half, -hz], [0, 0, -1], [1, 0], [0, 0], [0, 1], [1, 1]);

  const px = size / w, py = size / h;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (!opaque(i, j)) continue;
      const x0 = -half + i * px, x1 = x0 + px;
      const y1 = half - j * py, y0 = y1 - py;
      const u = (i + 0.5) / w, v = 1 - (j + 0.5) / h;   // centro do pixel: a lateral inteira tem a cor dele
      const c = [u, v];
      if (!opaque(i - 1, j)) quad([x0, y0, -hz], [x0, y0, hz], [x0, y1, hz], [x0, y1, -hz], [-1, 0, 0], c, c, c, c);
      if (!opaque(i + 1, j)) quad([x1, y0, hz], [x1, y0, -hz], [x1, y1, -hz], [x1, y1, hz], [1, 0, 0], c, c, c, c);
      if (!opaque(i, j - 1)) quad([x0, y1, hz], [x1, y1, hz], [x1, y1, -hz], [x0, y1, -hz], [0, 1, 0], c, c, c, c);
      if (!opaque(i, j + 1)) quad([x0, y0, -hz], [x1, y0, -hz], [x1, y0, hz], [x0, y0, hz], [0, -1, 0], c, c, c, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  geo.userData.extrudedSprite = true;
  return geo;
}

// Uma geometria por imagem e tamanho (itens iguais compartilham)
export function extrudedGeometryFor(key, canvas, size) {
  const k = key + '|' + size;
  let g = geometryCache.get(k);
  if (!g) { g = buildExtrudedGeometry(canvas, size); geometryCache.set(k, g); }
  return g;
}

export function clearExtrudedCache() {
  for (const g of geometryCache.values()) g.dispose();
  geometryCache.clear();
}
