// Modelos de Mobs do Minecraft Java 1.8.9 — Mapeamento UV e Animações MCP
// Referências: net.minecraft.client.model (ModelBiped, ModelZombie, ModelSkeleton, ModelCreeper, ModelSpider, ModelQuadruped)
import * as THREE from 'three';
import { getPackCanvas, MC } from './pack';

// === UV Mapping MCP — Mapeia texturas desmontadas nas faces do BoxGeometry ===
function setBoxUVs(geo, u, v, w, h, d, texW = 64, texH = 32, mirror = false) {
  // mirror (membros esquerdos do MCP): troca as faces laterais e inverte o U de cada face
  const toFace = (x1, y1, x2, y2) => mirror ? toFaceRaw(x2, y1, x1, y2) : toFaceRaw(x1, y1, x2, y2);
  const toFaceRaw = (x1, y1, x2, y2) => [
    new THREE.Vector2(x1 / texW, 1.0 - y2 / texH),
    new THREE.Vector2(x2 / texW, 1.0 - y2 / texH),
    new THREE.Vector2(x2 / texW, 1.0 - y1 / texH),
    new THREE.Vector2(x1 / texW, 1.0 - y1 / texH),
  ];

  const top = toFace(u + d, v, u + w + d, v + d);
  const bottom = toFace(u + w + d, v, u + w * 2 + d, v + d);
  const left = toFace(u, v + d, u + d, v + d + h);
  const front = toFace(u + d, v + d, u + w + d, v + d + h);
  const right = toFace(u + w + d, v + d, u + w + d * 2, v + h + d);
  const back = toFace(u + w + d * 2, v + d, u + w * 2 + d * 2, v + h + d);

  const R = mirror ? left : right, L = mirror ? right : left;
  const uvRight = [R[3], R[2], R[0], R[1]];
  const uvLeft = [L[3], L[2], L[0], L[1]];
  const uvTop = [top[3], top[2], top[0], top[1]];
  const uvBottom = [bottom[0], bottom[1], bottom[3], bottom[2]];
  const uvFront = [front[3], front[2], front[0], front[1]];
  const uvBack = [back[3], back[2], back[0], back[1]];

  const newUVData = [];
  for (const uvArray of [uvRight, uvLeft, uvTop, uvBottom, uvFront, uvBack]) {
    for (const uv of uvArray) {
      newUVData.push(uv.x, uv.y);
    }
  }
  const uvAttr = geo.attributes.uv;
  uvAttr.set(new Float32Array(newUVData));
  uvAttr.needsUpdate = true;
}

// === Sistema de Cache e Carregamento de Texturas Oficiais do Pack 1.8.9 ===
const _texMap = new Map();
const _matMap = new Map();

const MOB_PACK_PATHS = {
  zombie: 'textures/entity/zombie/zombie.png',
  skeleton: 'textures/entity/skeleton/skeleton.png',
  creeper: 'textures/entity/creeper/creeper.png',
  spider: 'textures/entity/spider/spider.png',
  cow: 'textures/entity/cow/cow.png',
  pig: 'textures/entity/pig/pig.png',
  sheep: 'textures/entity/sheep/sheep.png',
  sheep_fur: 'textures/entity/sheep/sheep_fur.png',
  chicken: 'textures/entity/chicken.png',
  enderman: 'textures/entity/enderman/enderman.png',
  witch: 'textures/entity/witch.png',
  wolf: 'textures/entity/wolf/wolf.png',
  slime: 'textures/entity/slime/slime.png',
};

// Fallback procedural de textura desmontada caso o pacote ainda não tenha concluído o download
function createProceduralMobTexture(mobType, texW, texH) {
  const cv = document.createElement('canvas');
  cv.width = texW;
  cv.height = texH;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, texW, texH);

  if (mobType === 'zombie') {
    // Cabeça verde zumbi
    ctx.fillStyle = '#497334'; ctx.fillRect(0, 0, 32, 16);
    ctx.fillStyle = '#304d22'; ctx.fillRect(8, 8, 8, 8); // Face com olhos
    ctx.fillStyle = '#111111'; ctx.fillRect(9, 12, 2, 2); ctx.fillRect(13, 12, 2, 2); // Olhos
    // Tronco azul ciano
    ctx.fillStyle = '#2c728e'; ctx.fillRect(16, 16, 24, 16);
    // Braço direito e esquerdo verde
    ctx.fillStyle = '#497334'; ctx.fillRect(40, 16, 16, 16);
    // Calças azuis
    ctx.fillStyle = '#3a3a78'; ctx.fillRect(0, 16, 16, 16);
  } else if (mobType === 'skeleton') {
    // Ossos cinzas
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(0, 0, texW, texH);
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(9, 10, 2, 2); ctx.fillRect(13, 10, 2, 2); // Olhos caveira
    ctx.fillRect(10, 13, 4, 1); // Boca caveira
  } else if (mobType === 'creeper') {
    // Verde camuflado
    ctx.fillStyle = '#439d37'; ctx.fillRect(0, 0, texW, texH);
    ctx.fillStyle = '#5ab34e';
    for (let x = 0; x < texW; x += 4) {
      for (let y = 0; y < texH; y += 4) {
        if ((x + y) % 8 === 0) ctx.fillRect(x, y, 4, 4);
      }
    }
    // Rosto do Creeper
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(9, 10, 2, 2); ctx.fillRect(13, 10, 2, 2); // Olhos
    ctx.fillRect(11, 12, 2, 2); ctx.fillRect(10, 14, 4, 2); // Focinho
  } else if (mobType === 'cow') {
    // Marrom com manchas brancas
    ctx.fillStyle = '#4c392c'; ctx.fillRect(0, 0, texW, texH);
    ctx.fillStyle = '#e5e5e5'; ctx.fillRect(20, 8, 8, 8); ctx.fillRect(4, 20, 6, 6);
  } else if (mobType === 'pig') {
    // Rosa
    ctx.fillStyle = '#f09a96'; ctx.fillRect(0, 0, texW, texH);
    ctx.fillStyle = '#d67975'; ctx.fillRect(16, 16, 4, 3); // Focinho
  } else if (mobType === 'spider') {
    // Preto/marrom escuro com olhos vermelhos
    ctx.fillStyle = '#211915'; ctx.fillRect(0, 0, texW, texH);
    ctx.fillStyle = '#d41818'; ctx.fillRect(34, 8, 1, 1); ctx.fillRect(36, 8, 1, 1);
  } else if (mobType === 'enderman') {
    // Preto profundo com olhos roxos luminosos
    ctx.fillStyle = '#101010'; ctx.fillRect(0, 0, texW, texH);
    ctx.fillStyle = '#cc00ff'; ctx.fillRect(9, 11, 3, 1); ctx.fillRect(13, 11, 3, 1);
  } else {
    ctx.fillStyle = '#888888'; ctx.fillRect(0, 0, texW, texH);
  }

  const texture = new THREE.CanvasTexture(cv);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return { texture, canvas: cv };
}

// === INSTRUÇÃO PARA ANÁLISE DINÂMICA DE IMAGEM (TEXTURAS MINECRAFT) ===
// 1. Grade Base Proporcional: U = image.width / 8
// 2. Identificação das Regiões do Corpo (Cabeça: 0 a 4U, Tronco: 2U a 5U, Membros: 5U a 8U e 0 a 2U inferior)
// 3. Dissecação do Cubo: Linha de Cima (Topo e Base deslocados a 1U), Linha de Baixo (Direita, Frente, Esquerda, Traseira)
// 4. Adaptação com Escaneamento de Alpha e Auto-Espelhamento para membros esquerdos se transparente ou se textura clássica compactada (64x32).
function processMobTextureDynamic(sourceCanvas) {
  const W = sourceCanvas.width;
  const H = sourceCanvas.height;
  // Textura 64x32: os UVs dos builders usam altura 32. Aumentar o canvas desloca o V e a malha amostra a metade vazia.
  if (H <= W / 2) return sourceCanvas;
  const U = W / 8; // Unidade base dinâmica

  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = W;
  targetCanvas.height = Math.max(H, W); // Garante proporção completa 64x64
  const ctx = targetCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // 1. Copia a textura original
  ctx.drawImage(sourceCanvas, 0, 0);

  // 2. Escaneamento do canal Alpha na área dos membros esquerdos
  let needsMirroring = false;
  if (H <= W / 2) {
    // Imagem clássica 64x32: os membros esquerdos não existem fisicamente na textura
    needsMirroring = true;
  } else {
    try {
      const imgData = ctx.getImageData(Math.floor(2 * U), Math.floor(6 * U), Math.floor(4 * U), Math.floor(2 * U));
      let nonZeroAlpha = 0;
      for (let i = 3; i < imgData.data.length; i += 4) {
        if (imgData.data[i] > 10) nonZeroAlpha++;
      }
      if (nonZeroAlpha < 16) needsMirroring = true;
    } catch {}
  }

  // 3. Regra de Adaptação de Evidência: gera braço e perna esquerdos espelhando horizontalmente
  if (needsMirroring) {
    const limbW = Math.floor(2 * U);
    const limbH = Math.floor(2 * U);

    // Perna esquerda espelhada em (2U, 6U) a partir da perna direita (0, 2U)
    ctx.save();
    ctx.translate(Math.floor(2 * U) + limbW, Math.floor(6 * U));
    ctx.scale(-1, 1);
    ctx.drawImage(sourceCanvas, 0, Math.floor(2 * U), limbW, limbH, 0, 0, limbW, limbH);
    ctx.restore();

    // Braço esquerdo espelhado em (4U, 6U) a partir do braço direito (5U, 2U)
    ctx.save();
    ctx.translate(Math.floor(4 * U) + limbW, Math.floor(6 * U));
    ctx.scale(-1, 1);
    ctx.drawImage(sourceCanvas, Math.floor(5 * U), Math.floor(2 * U), limbW, limbH, 0, 0, limbW, limbH);
    ctx.restore();
  }

  return targetCanvas;
}

function getMobMaterial(mobType, texW = 64, texH = 64) {
  const key = `${mobType}_${texW}_${texH}`;
  let mat = _matMap.get(key);
  if (mat) return mat;

  const { texture, canvas } = createProceduralMobTexture(mobType, texW, texH);
  mat = new THREE.MeshLambertMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.1,
  });
  _matMap.set(key, mat);

  // Carregar a textura oficial descompactada do resource pack em assets/minecraft/textures/entity/
  const path = MOB_PACK_PATHS[mobType];
  if (path) {
    getPackCanvas(MC + path).then(packCanvas => {
      if (packCanvas) {
        const processed = processMobTextureDynamic(packCanvas);
        canvas.width = processed.width;
        canvas.height = processed.height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(processed, 0, 0);
        texture.needsUpdate = true;
      }
    }).catch(() => {});
  }

  return mat;
}

// === CONSTRUTORES DE MODELOS (caixas do MCP 1.8.9) ===
// Cada parte vem das classes net.minecraft.client.model.*: pivô e caixa no quadro "cru" do Minecraft (Y para baixo, frente = -Z,
// origem 24 px acima dos pés). Convertemos para o quadro do jogo (Y para cima, frente = +Z) com uma rotação de 180° em X:
// posição (x, y, z) → (x, -y, -z); rotações em X ficam iguais, em Y e Z trocam de sinal.
const FEET_RAW = 24;

// Caixa do MC dentro de um pivô. box = [x, y, z, w, h, d] relativo ao pivô; uv = [u, v]; mirror espelha a textura (membros esquerdos)
function mcPart(mat, texW, texH, { uv, box, pivot, rot = [0, 0, 0], mirror = false, inflate = 0 }) {
  const [x, y, z, w, h, d] = box;
  const group = new THREE.Group();
  group.position.set(pivot[0] / 16, -pivot[1] / 16, -pivot[2] / 16);
  group.rotation.set(rot[0], -rot[1], -rot[2]);
  group.userData.restRot = [rot[0], -rot[1], -rot[2]];
  const geo = new THREE.BoxGeometry((w + 2 * inflate) / 16, (h + 2 * inflate) / 16, (d + 2 * inflate) / 16);
  setBoxUVs(geo, uv[0], uv[1], w, h, d, texW, texH, mirror);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x + w / 2) / 16, -(y + h / 2) / 16, -(z + d / 2) / 16);
  group.add(mesh);
  return group;
}

// Monta o modelo: raiz com os pés em y = 0 (o "24 px" cru vira 1.5 bloco acima da origem do mundo)
function rigRoot() {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.y = FEET_RAW / 16;
  root.add(inner);
  return { root, inner };
}

const texSize = (mobType) => (mobType === 'zombie' ? [64, 64] : [64, 32]);

// 1. ModelBiped / ModelZombie / ModelSkeleton
function buildBipedModel(mobType, opts = {}) {
  const [tw, th] = texSize(mobType);
  const mat = getMobMaterial(mobType, tw, th);
  const { root, inner } = rigRoot();
  const thin = !!opts.isSkeleton; // esqueleto: braços e pernas 2×12×2
  const head = mcPart(mat, tw, th, { uv: [0, 0], box: [-4, -8, -4, 8, 8, 8], pivot: [0, 0, 0] });
  const body = mcPart(mat, tw, th, { uv: [16, 16], box: [-4, 0, -2, 8, 12, 4], pivot: [0, 0, 0] });
  const armR = mcPart(mat, tw, th, { uv: [40, 16], box: thin ? [-1, -2, -1, 2, 12, 2] : [-3, -2, -2, 4, 12, 4], pivot: [-5, 2, 0] });
  const armL = mcPart(mat, tw, th, { uv: [40, 16], box: thin ? [-1, -2, -1, 2, 12, 2] : [-1, -2, -2, 4, 12, 4], pivot: [5, 2, 0], mirror: true });
  const legR = mcPart(mat, tw, th, { uv: [0, 16], box: thin ? [-1, 0, -1, 2, 12, 2] : [-2, 0, -2, 4, 12, 4], pivot: [-2, 12, 0] });
  const legL = mcPart(mat, tw, th, { uv: [0, 16], box: thin ? [-1, 0, -1, 2, 12, 2] : [-2, 0, -2, 4, 12, 4], pivot: [2, 12, 0], mirror: true });
  inner.add(head, body, armR, armL, legR, legL);
  root.userData = { head, body, armL, armR, legL, legR, type: 'biped', mobType, ...opts };
  return root;
}

// 2. ModelCreeper
function buildCreeperModel() {
  const mat = getMobMaterial('creeper', 64, 32);
  const { root, inner } = rigRoot();
  const head = mcPart(mat, 64, 32, { uv: [0, 0], box: [-4, -8, -4, 8, 8, 8], pivot: [0, 6, 0] });
  const body = mcPart(mat, 64, 32, { uv: [16, 16], box: [-4, 0, -2, 8, 12, 4], pivot: [0, 6, 0] });
  const legBox = [-2, 0, -2, 4, 6, 4];
  const leg1 = mcPart(mat, 64, 32, { uv: [0, 16], box: legBox, pivot: [-2, 18, 4] });
  const leg2 = mcPart(mat, 64, 32, { uv: [0, 16], box: legBox, pivot: [2, 18, 4] });
  const leg3 = mcPart(mat, 64, 32, { uv: [0, 16], box: legBox, pivot: [-2, 18, -4] });
  const leg4 = mcPart(mat, 64, 32, { uv: [0, 16], box: legBox, pivot: [2, 18, -4] });
  inner.add(head, body, leg1, leg2, leg3, leg4);
  root.userData = { head, body, leg1, leg2, leg3, leg4, type: 'creeper' };
  return root;
}

// 3. ModelQuadruped: porco, vaca, ovelha (cada um com as medidas do seu modelo)
function buildQuadrupedModel(mobType) {
  const mat = getMobMaterial(mobType, 64, 32);
  const { root, inner } = rigRoot();
  const H = Math.PI / 2;
  const parts = [];
  let head, body, legs;
  if (mobType === 'pig') {
    head = mcPart(mat, 64, 32, { uv: [0, 0], box: [-4, -4, -8, 8, 8, 8], pivot: [0, 12, -6] });
    head.add(mcPart(mat, 64, 32, { uv: [16, 16], box: [-2, 0, -9, 4, 3, 1], pivot: [0, 0, 0] }));
    body = mcPart(mat, 64, 32, { uv: [28, 8], box: [-5, -10, -7, 10, 16, 8], pivot: [0, 11, 2], rot: [H, 0, 0] });
    const lb = [-2, 0, -2, 4, 6, 4];
    legs = [[-3, 18, 7], [3, 18, 7], [-3, 18, -5], [3, 18, -5]].map((p) => mcPart(mat, 64, 32, { uv: [0, 16], box: lb, pivot: p }));
  } else if (mobType === 'cow') {
    head = mcPart(mat, 64, 32, { uv: [0, 0], box: [-4, -4, -6, 8, 8, 6], pivot: [0, 4, -8] });
    head.add(mcPart(mat, 64, 32, { uv: [22, 0], box: [-5, -5, -4, 1, 3, 1], pivot: [0, 0, 0] }));
    head.add(mcPart(mat, 64, 32, { uv: [22, 0], box: [4, -5, -4, 1, 3, 1], pivot: [0, 0, 0] }));
    body = mcPart(mat, 64, 32, { uv: [18, 4], box: [-6, -10, -7, 12, 18, 10], pivot: [0, 5, 2], rot: [H, 0, 0] });
    parts.push(mcPart(mat, 64, 32, { uv: [52, 0], box: [-2, 2, -8, 4, 6, 1], pivot: [0, 5, 2], rot: [H, 0, 0] }));
    const lb = [-2, 0, -2, 4, 12, 4];
    legs = [[-4, 12, 7], [4, 12, 7], [-4, 12, -6], [4, 12, -6]].map((p) => mcPart(mat, 64, 32, { uv: [0, 16], box: lb, pivot: p }));
  } else { // ovelha
    head = mcPart(mat, 64, 32, { uv: [0, 0], box: [-3, -4, -6, 6, 6, 8], pivot: [0, 6, -8] });
    body = mcPart(mat, 64, 32, { uv: [28, 8], box: [-4, -10, -7, 8, 16, 6], pivot: [0, 5, 2], rot: [H, 0, 0] });
    const lb = [-2, 0, -2, 4, 12, 4];
    legs = [[-3, 12, 7], [3, 12, 7], [-3, 12, -5], [3, 12, -5]].map((p) => mcPart(mat, 64, 32, { uv: [0, 16], box: lb, pivot: p }));
    // lã (sheep_fur.png): mesmas caixas infladas
    const fur = getMobMaterial('sheep_fur', 64, 32);
    head.add(mcPart(fur, 64, 32, { uv: [0, 0], box: [-3, -4, -4, 6, 6, 6], pivot: [0, 0, 0], inflate: 0.6 }));
    body.add(mcPart(fur, 64, 32, { uv: [28, 8], box: [-4, -10, -7, 8, 16, 6], pivot: [0, 0, 0], inflate: 1.75 }));
    legs.forEach((l) => l.add(mcPart(fur, 64, 32, { uv: [0, 16], box: [-2, 0, -2, 4, 6, 4], pivot: [0, 0, 0], inflate: 0.5 })));
  }
  inner.add(head, body, ...parts, ...legs);
  root.userData = { head, body, leg1: legs[0], leg2: legs[1], leg3: legs[2], leg4: legs[3], type: 'quadruped', mobType };
  return root;
}

// 4. ModelChicken
function buildChickenModel() {
  const mat = getMobMaterial('chicken', 64, 32);
  const { root, inner } = rigRoot();
  const head = mcPart(mat, 64, 32, { uv: [0, 0], box: [-2, -6, -2, 4, 6, 3], pivot: [0, 15, -4] });
  head.add(mcPart(mat, 64, 32, { uv: [14, 0], box: [-2, -4, -4, 4, 2, 2], pivot: [0, 0, 0] }));
  head.add(mcPart(mat, 64, 32, { uv: [14, 4], box: [-1, -2, -3, 2, 2, 2], pivot: [0, 0, 0] }));
  const body = mcPart(mat, 64, 32, { uv: [0, 9], box: [-3, -4, -3, 6, 8, 6], pivot: [0, 16, 0], rot: [Math.PI / 2, 0, 0] });
  const legR = mcPart(mat, 64, 32, { uv: [26, 0], box: [-1, 0, -3, 3, 5, 3], pivot: [-2, 19, 1] });
  const legL = mcPart(mat, 64, 32, { uv: [26, 0], box: [-1, 0, -3, 3, 5, 3], pivot: [1, 19, 1] });
  const wingR = mcPart(mat, 64, 32, { uv: [24, 13], box: [0, 0, -3, 1, 4, 6], pivot: [-4, 13, 0] });
  const wingL = mcPart(mat, 64, 32, { uv: [24, 13], box: [-1, 0, -3, 1, 4, 6], pivot: [4, 13, 0] });
  inner.add(head, body, legR, legL, wingR, wingL);
  root.userData = { head, body, legR, legL, wingR, wingL, type: 'chicken' };
  return root;
}

// 5. ModelWolf
function buildWolfModel() {
  const mat = getMobMaterial('wolf', 64, 32);
  const { root, inner } = rigRoot();
  const H = Math.PI / 2;
  const head = mcPart(mat, 64, 32, { uv: [0, 0], box: [-3, -3, -2, 6, 6, 4], pivot: [-1, 13.5, -7] });
  head.add(mcPart(mat, 64, 32, { uv: [16, 14], box: [-3, -5, 0, 2, 2, 1], pivot: [0, 0, 0] }));
  head.add(mcPart(mat, 64, 32, { uv: [16, 14], box: [1, -5, 0, 2, 2, 1], pivot: [0, 0, 0] }));
  head.add(mcPart(mat, 64, 32, { uv: [0, 10], box: [-1.5, 0, -5, 3, 3, 4], pivot: [0, 0, 0] }));
  const body = mcPart(mat, 64, 32, { uv: [18, 14], box: [-4, -2, -3, 6, 9, 6], pivot: [0, 14, 2], rot: [H, 0, 0] });
  const mane = mcPart(mat, 64, 32, { uv: [21, 0], box: [-4, -3, -3, 8, 6, 7], pivot: [-1, 14, -3], rot: [H, 0, 0] });
  const lb = [-1, 0, -1, 2, 8, 2];
  const legs = [[-2.5, 16, 7], [0.5, 16, 7], [-2.5, 16, -4], [0.5, 16, -4]].map((p) => mcPart(mat, 64, 32, { uv: [0, 18], box: lb, pivot: p }));
  const tail = mcPart(mat, 64, 32, { uv: [9, 18], box: [-1, 0, -1, 2, 8, 2], pivot: [-1, 12, 8], rot: [Math.PI / 5, 0, 0] });
  inner.add(head, body, mane, tail, ...legs);
  root.userData = { head, body, tail, leg1: legs[0], leg2: legs[1], leg3: legs[2], leg4: legs[3], type: 'quadruped', mobType: 'wolf' };
  return root;
}

// 6. ModelSpider: pernas com os ângulos de repouso do MCP (π/4 em Z; π/4, π/8 em Y)
function buildSpiderModel() {
  const mat = getMobMaterial('spider', 64, 32);
  const { root, inner } = rigRoot();
  const head = mcPart(mat, 64, 32, { uv: [32, 4], box: [-4, -4, -8, 8, 8, 8], pivot: [0, 15, -3] });
  const neck = mcPart(mat, 64, 32, { uv: [0, 0], box: [-3, -3, -3, 6, 6, 6], pivot: [0, 15, 0] });
  const body = mcPart(mat, 64, 32, { uv: [0, 12], box: [-5, -4, -6, 10, 8, 12], pivot: [0, 15, 9] });
  const f = Math.PI / 4, f1 = Math.PI / 8;
  const spec = [ // pivô, lado (-1 direita, +1 esquerda), rotZ, rotY de repouso (MCP)
    { p: [-4, 15, 2], s: -1, z: -f, y: f }, { p: [4, 15, 2], s: 1, z: f, y: -f },
    { p: [-4, 15, 1], s: -1, z: -f * 0.74, y: f1 }, { p: [4, 15, 1], s: 1, z: f * 0.74, y: -f1 },
    { p: [-4, 15, 0], s: -1, z: -f * 0.74, y: -f1 }, { p: [4, 15, 0], s: 1, z: f * 0.74, y: f1 },
    { p: [-4, 15, -1], s: -1, z: -f, y: -f }, { p: [4, 15, -1], s: 1, z: f, y: f },
  ];
  const legs = spec.map((l) => mcPart(mat, 64, 32, {
    uv: [18, 0], box: l.s < 0 ? [-15, -1, -1, 16, 2, 2] : [-1, -1, -1, 16, 2, 2], pivot: l.p, rot: [0, l.y, l.z],
  }));
  inner.add(head, neck, body, ...legs);
  root.userData = { head, body, legs, type: 'spider' };
  return root;
}

// 7. ModelEnderman (altura total até o chão 46 px ≈ 2,9 blocos; as pernas entram 4 px no chão, como no original)
function buildEndermanModel() {
  const mat = getMobMaterial('enderman', 64, 32);
  const { root, inner } = rigRoot();
  const f = -14;
  const head = mcPart(mat, 64, 32, { uv: [0, 0], box: [-4, -8, -4, 8, 8, 8], pivot: [0, f, 0] });
  const body = mcPart(mat, 64, 32, { uv: [32, 16], box: [-4, 0, -2, 8, 12, 4], pivot: [0, f, 0] });
  const armR = mcPart(mat, 64, 32, { uv: [56, 0], box: [-1, -2, -1, 2, 30, 2], pivot: [-3, 2 + f, 0] });
  const armL = mcPart(mat, 64, 32, { uv: [56, 0], box: [-1, -2, -1, 2, 30, 2], pivot: [5, 2 + f, 0], mirror: true });
  const legR = mcPart(mat, 64, 32, { uv: [56, 0], box: [-1, 0, -1, 2, 30, 2], pivot: [-2, 12 + f, 0] });
  const legL = mcPart(mat, 64, 32, { uv: [56, 0], box: [-1, 0, -1, 2, 30, 2], pivot: [2, 12 + f, 0], mirror: true });
  inner.add(head, body, armR, armL, legR, legL);
  root.userData = { head, body, armL, armR, legL, legR, type: 'enderman' };
  return root;
}

// 8. Slime: núcleo 6×6×6 e casca 8×8×8 (UV do slime.png)
function buildSlimeModel() {
  const mat = getMobMaterial('slime', 64, 32);
  const { root, inner } = rigRoot();
  const outer = mcPart(mat, 64, 32, { uv: [0, 0], box: [-4, 16, -4, 8, 8, 8], pivot: [0, 0, 0] });
  const core = mcPart(mat, 64, 32, { uv: [0, 16], box: [-3, 17, -3, 6, 6, 6], pivot: [0, 0, 0] });
  inner.add(core, outer);
  root.userData = { body: outer, type: 'slime' };
  return root;
}

// === FACTORY PRINCIPAL ===
const BUILDERS = {
  zombie: () => buildBipedModel('zombie', { isZombie: true }),
  skeleton: () => buildBipedModel('skeleton', { isSkeleton: true }),
  creeper: buildCreeperModel,
  spider: buildSpiderModel,
  cow: () => buildQuadrupedModel('cow'),
  pig: () => buildQuadrupedModel('pig'),
  sheep: () => buildQuadrupedModel('sheep'),
  enderman: buildEndermanModel,
  wolf: buildWolfModel,
  chicken: buildChickenModel,
  witch: () => buildBipedModel('zombie', { isWitch: true }),
  slime: buildSlimeModel,
};

export function buildMobModel(mobType) {
  const builder = BUILDERS[mobType];
  const g = builder ? builder() : buildBipedModel('zombie', { isZombie: true });
  g.visible = false;
  return g;
}

// Aplica ângulos no quadro "cru" do MCP ao quadro do jogo (Y e Z trocam de sinal)
function raw(part, x, y, z) {
  if (part) part.rotation.set(x, -y, -z);
}

// === ANIMAÇÕES CLÁSSICAS MCP 1.8.9 (setRotationAngles) ===
export function animateMobModel(model, mob, time) {
  if (!model || !model.userData) return;
  const u = model.userData;

  if (mob.isDead) {
    model.rotation.z = Math.PI / 2;
    return;
  }
  model.rotation.z = 0;

  // Variáveis canônicas do MCP 1.8.9
  const ls = mob._limbSwing || 0;
  const amt = mob._limbSwingAmount || 0;
  const age = (mob.ticksAlive || 0) + (time % 1);
  const headYaw = mob.headYaw || 0;      // convenção do jogo; raw() converte
  const headPitch = mob.headPitch || 0;
  const c1 = Math.cos(ls * 0.6662), c2 = Math.cos(ls * 0.6662 + Math.PI);
  const clamp = (v, m) => Math.max(-m, Math.min(m, v));
  const attacking = !!mob.target;

  const look = () => { if (u.head) raw(u.head, headPitch, headYaw, 0); };

  if (u.type === 'biped') {
    look();
    raw(u.legR, c1 * 1.4 * amt, 0, 0);
    raw(u.legL, c2 * 1.4 * amt, 0, 0);
    if (u.isZombie) {
      // ModelZombie: braços à frente (80°; 120° ao atacar) com a oscilação de respiração
      const lift = -Math.PI / (attacking ? 1.5 : 2.25);
      raw(u.armR, lift + Math.sin(age * 0.067) * 0.05, -0.1, Math.cos(age * 0.09) * 0.05 + 0.05);
      raw(u.armL, lift - Math.sin(age * 0.067) * 0.05, 0.1, -(Math.cos(age * 0.09) * 0.05 + 0.05));
    } else if (u.isSkeleton && attacking) {
      // ModelSkeleton mirando o arco
      raw(u.armR, -Math.PI / 2 + headPitch, -0.1 + headYaw, 0);
      raw(u.armL, -Math.PI / 2 + headPitch, 0.1 + headYaw + 0.4, 0);
    } else {
      raw(u.armR, c2 * 2.0 * amt * 0.5, 0, Math.cos(age * 0.09) * 0.05 + 0.05);
      raw(u.armL, c1 * 2.0 * amt * 0.5, 0, -(Math.cos(age * 0.09) * 0.05 + 0.05));
    }
  } else if (u.type === 'creeper') {
    look();
    raw(u.leg1, c1 * 1.4 * amt, 0, 0);
    raw(u.leg2, c2 * 1.4 * amt, 0, 0);
    raw(u.leg3, c2 * 1.4 * amt, 0, 0);
    raw(u.leg4, c1 * 1.4 * amt, 0, 0);
    // Inchaço (RenderCreeper.preRenderCallback): f⁴ estica XZ em até 40%, Y em 10%, com o tremor sen(f·100)
    const sw = Math.max(0, Math.min(1, mob.swelling || 0));
    const shake = 1 + Math.sin(sw * 100) * sw * 0.01;
    const f4 = Math.pow(sw, 4);
    model.scale.set((1 + f4 * 0.4) * shake, (1 + f4 * 0.1) / shake, (1 + f4 * 0.4) * shake);
  } else if (u.type === 'quadruped') {
    look();
    raw(u.leg1, c1 * 1.4 * amt, 0, 0);
    raw(u.leg2, c2 * 1.4 * amt, 0, 0);
    raw(u.leg3, c2 * 1.4 * amt, 0, 0);
    raw(u.leg4, c1 * 1.4 * amt, 0, 0);
    if (u.tail) raw(u.tail, Math.PI / 5, c1 * 1.4 * amt * 0.5, 0);
  } else if (u.type === 'chicken') {
    look();
    raw(u.legR, c1 * 1.4 * amt, 0, 0);
    raw(u.legL, c2 * 1.4 * amt, 0, 0);
    const flap = mob.onGround === false ? age * 1.4 : 0; // bate as asas no ar
    raw(u.wingR, 0, 0, Math.abs(Math.sin(flap)) * 0.9);
    raw(u.wingL, 0, 0, -Math.abs(Math.sin(flap)) * 0.9);
  } else if (u.type === 'spider') {
    look();
    // ModelSpider: repouso (π/4 em Z; π/4 e π/8 em Y) somado ao balanço das pernas
    const f = Math.PI / 4, f1 = Math.PI / 8;
    const restY = [f, -f, f1, -f1, -f1, f1, -f, f];
    const restZ = [-f, f, -f * 0.74, f * 0.74, -f * 0.74, f * 0.74, -f, f];
    const sw = (ph) => -(Math.cos(ls * 0.6662 * 2 + ph) * 0.4) * amt;
    const lift = (ph) => Math.abs(Math.sin(ls * 0.6662 + ph) * 0.4) * amt;
    const dy = [sw(0), -sw(0), sw(Math.PI), -sw(Math.PI), sw(Math.PI / 2), -sw(Math.PI / 2), sw(Math.PI * 1.5), -sw(Math.PI * 1.5)];
    const dz = [lift(0), -lift(0), lift(Math.PI), -lift(Math.PI), lift(Math.PI / 2), -lift(Math.PI / 2), lift(Math.PI * 1.5), -lift(Math.PI * 1.5)];
    u.legs.forEach((leg, i) => raw(leg, 0, restY[i] + dy[i], restZ[i] + dz[i]));
  } else if (u.type === 'enderman') {
    look();
    // ModelEnderman: balanço do bípede × 0,5, limitado a ±0,4
    raw(u.legR, clamp(c1 * 1.4 * amt * 0.5, 0.4), 0, 0);
    raw(u.legL, clamp(c2 * 1.4 * amt * 0.5, 0.4), 0, 0);
    raw(u.armR, clamp(c2 * 2.0 * amt * 0.5 * 0.5, 0.4), 0, 0);
    raw(u.armL, clamp(c1 * 2.0 * amt * 0.5 * 0.5, 0.4), 0, 0);
  } else if (u.type === 'slime') {
    // Achata e estica ao pular: usa a velocidade vertical
    const vy = mob.vel ? mob.vel.y : 0;
    const s = 1 - Math.max(-0.2, Math.min(0.3, vy)) * 0.5;
    model.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
  }
}
