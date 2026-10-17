// Flecha: a mesma geometria do RenderArrow do 1.8.9 (placa de ponta 5×5 + dois planos cruzados de 16×4, escala 0,05625) com a textura do
// pacote (textures/entity/arrow.png, 32×32). As cores de reserva (enquanto o pacote não carregou) vêm da textura do modelo de referência
// minecraft_arrow.glb, embutida abaixo: a malha do GLB era só isto (12 vértices), então ela é montada aqui em código, sem carregar GLB.
import * as THREE from 'three';
import { getPackCanvas, MC } from './pack';

const FALLBACK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAAHlBMVEX///8AAAD////i4uLBwcGenp68mGK0kFqfhE1zXjnEzP2AAAAAAnRSTlMAAHaTzTgAAABbSURBVHjaY2AYBfQHjIIKDxgYGBgY3kMFmBg+oKpgUgxUQNMi8AFNiwC6FjRbmB5+YmBgYGBxgAmwlPI/+MjPwLcPbqiwwDsGBgZm2fMwLfJ8DAwMDH8fwFQAAIqYDxhWmt3WAAAAAElFTkSuQmCC';

const PX = 0.05625;
let _mat = null, _geo = null;

function arrowMaterial() {
  if (_mat) return _mat;
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 32;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  _mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
  const img = new Image();
  img.onload = () => { if (!_packLoaded) { ctx.clearRect(0, 0, 32, 32); ctx.drawImage(img, 0, 0, 32, 32); tex.needsUpdate = true; } };
  img.src = FALLBACK_PNG;
  let _packLoaded = false;
  getPackCanvas(MC + 'textures/entity/arrow.png').then((src) => {
    if (!src) return;
    _packLoaded = true;
    cv.width = src.width; cv.height = src.height;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0);
    tex.needsUpdate = true;
  }).catch(() => {});
  return _mat;
}

// Vértices em px do modelo (x = para frente), girados 45° em volta do eixo x; convertidos para o eixo z do jogo (a flecha aponta para +z)
function arrowGeometry() {
  if (_geo) return _geo;
  const pos = [], uv = [], idx = [];
  const quad = (pts, uvs) => {   // 4 pontos [x, y, z] em px do modelo
    const base = pos.length / 3;
    for (let i = 0; i < 4; i++) {
      let [x, y, z] = pts[i];
      const c = Math.cos(Math.PI / 4), s = Math.sin(Math.PI / 4);   // giro global de 45° em x
      const yy = y * c - z * s, zz = y * s + z * c;
      x -= 4;                                                        // translate(-4, 0, 0)
      pos.push(zz * PX, yy * PX, x * PX);                           // eixo da flecha (x do modelo) → z
      uv.push(uvs[i][0], 1 - uvs[i][1]);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  // placa da ponta (as duas faces) em x = −7: uv (0, 5/32)–(5/32, 10/32)
  const f6 = 0, f7 = 5 / 32, f8 = 5 / 32, f9 = 10 / 32;
  quad([[-7, -2, -2], [-7, -2, 2], [-7, 2, 2], [-7, 2, -2]], [[f6, f8], [f7, f8], [f7, f9], [f6, f9]]);
  quad([[-7, 2, -2], [-7, 2, 2], [-7, -2, 2], [-7, -2, -2]], [[f6, f8], [f7, f8], [f7, f9], [f6, f9]]);
  // haste: a mesma placa 16×4 girada 0°, 90°, 180° e 270° em x (dois planos cruzados, cada um visto dos dois lados), uv (0,0)–(0,5)/32
  for (let j = 0; j < 4; j++) {
    const a = j * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
    const P = (x, y) => [x, y * c, y * s];
    quad([P(-8, -2), P(8, -2), P(8, 2), P(-8, 2)], [[0, 0], [0.5, 0], [0.5, 5 / 32], [0, 5 / 32]]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  _geo = g;
  return g;
}

// Grupo com a flecha apontando para +z (o jogo orienta com lookAt na direção do movimento)
export function buildArrowMesh() {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(arrowGeometry(), arrowMaterial());
  mesh.frustumCulled = false;
  group.add(mesh);
  return group;
}
