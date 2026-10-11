// Modelos de Mobs do Minecraft Java 1.8.9 — Mapeamento UV e Animações MCP
// Referências: net.minecraft.client.model (ModelBiped, ModelZombie, ModelSkeleton, ModelCreeper, ModelSpider, ModelQuadruped)
import * as THREE from 'three';
import { getPackCanvas, MC } from './pack';

// === UV Mapping MCP — Mapeia texturas desmontadas nas faces do BoxGeometry ===
function setBoxUVs(geo, u, v, w, h, d, texW = 64, texH = 32) {
  const toFace = (x1, y1, x2, y2) => [
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

  const uvRight = [right[3], right[2], right[0], right[1]];
  const uvLeft = [left[3], left[2], left[0], left[1]];
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

function makeBox(w, h, d, u, v, texW = 64, texH = 32, material = null) {
  const geo = new THREE.BoxGeometry(w / 16, h / 16, d / 16);
  setBoxUVs(geo, u, v, w, h, d, texW, texH);
  return new THREE.Mesh(geo, material);
}

function makeLimb(w, h, d, u, v, texW = 64, texH = 32, material = null) {
  const group = new THREE.Group();
  const mesh = makeBox(w, h, d, u, v, texW, texH, material);
  mesh.position.y = -(h / 16) / 2;
  group.add(mesh);
  return group;
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

// === CONSTRUTORES DE MODELOS MCP ===

// 1. ModelBiped / ModelZombie / ModelSkeleton (net.minecraft.client.model.ModelBiped)
function buildBipedModel(mobType, opts = {}) {
  const g = new THREE.Group();
  const texH = mobType === 'zombie' ? 64 : 32;
  const mat = getMobMaterial(mobType, 64, texH);

  // Cabeça: 8x8x8 px, pivô no pescoço (y = 1.5)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.5, 0);
  const headMesh = makeBox(8, 8, 8, 0, 0, 64, texH, mat);
  headMesh.position.y = 0.25; // 4/16 acima do pescoço
  headGroup.add(headMesh);
  g.add(headGroup);

  // Tronco: 8x12x4 px, centro em y = 1.125
  const body = makeBox(8, 12, 4, 16, 16, 64, texH, mat);
  body.position.set(0, 1.125, 0);
  g.add(body);

  // Braços: 4x12x4 px, pivôs nos ombros (y = 1.45)
  const armL = makeLimb(4, 12, 4, texH === 64 ? 32 : 40, texH === 64 ? 48 : 16, 64, texH, mat);
  armL.position.set(-0.375, 1.45, 0);
  g.add(armL);

  const armR = makeLimb(4, 12, 4, 40, 16, 64, texH, mat);
  armR.position.set(0.375, 1.45, 0);
  g.add(armR);

  // Pernas: 4x12x4 px, pivôs nos quadris (y = 0.75)
  const legL = makeLimb(4, 12, 4, texH === 64 ? 16 : 0, texH === 64 ? 48 : 16, 64, texH, mat);
  legL.position.set(-0.125, 0.75, 0);
  g.add(legL);

  const legR = makeLimb(4, 12, 4, 0, 16, 64, texH, mat);
  legR.position.set(0.125, 0.75, 0);
  g.add(legR);

  g.userData = { head: headGroup, body, armL, armR, legL, legR, type: 'biped', mobType, ...opts };
  return g;
}

// 2. ModelCreeper (net.minecraft.client.model.ModelCreeper)
function buildCreeperModel() {
  const g = new THREE.Group();
  const mat = getMobMaterial('creeper', 64, 32);

  // Cabeça: 8x8x8 px, pivô em y = 1.125
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.125, 0);
  const headMesh = makeBox(8, 8, 8, 0, 0, 64, 32, mat);
  headMesh.position.y = 0.25;
  headGroup.add(headMesh);
  g.add(headGroup);

  // Tronco: 8x12x4 px, centro em y = 0.75
  const body = makeBox(8, 12, 4, 16, 16, 64, 32, mat);
  body.position.set(0, 0.75, 0);
  g.add(body);

  // 4 Pernas do Creeper: 4x6x4 px, pivôs em y = 0.375
  const leg1 = makeLimb(4, 6, 4, 0, 16, 64, 32, mat); // Traseira esquerda
  leg1.position.set(-0.125, 0.375, -0.25);
  g.add(leg1);

  const leg2 = makeLimb(4, 6, 4, 0, 16, 64, 32, mat); // Traseira direita
  leg2.position.set(0.125, 0.375, -0.25);
  g.add(leg2);

  const leg3 = makeLimb(4, 6, 4, 0, 16, 64, 32, mat); // Frontal esquerda
  leg3.position.set(-0.125, 0.375, 0.25);
  g.add(leg3);

  const leg4 = makeLimb(4, 6, 4, 0, 16, 64, 32, mat); // Frontal direita
  leg4.position.set(0.125, 0.375, 0.25);
  g.add(leg4);

  g.userData = { head: headGroup, body, leg1, leg2, leg3, leg4, type: 'creeper' };
  return g;
}

// 3. ModelQuadruped (Cow, Pig, Sheep - net.minecraft.client.model.ModelQuadruped)
function buildQuadrupedModel(mobType) {
  const g = new THREE.Group();
  const mat = getMobMaterial(mobType, 64, 32);

  const isPig = mobType === 'pig';
  const legH = isPig ? 6 : 12;
  const legY = (legH / 16);

  // Cabeça: 8x8x8 px, pivô em y = legY + 0.35, z = 0.5
  const headGroup = new THREE.Group();
  headGroup.position.set(0, legY + 0.35, 0.45);
  const headMesh = makeBox(8, 8, 8, 0, 0, 64, 32, mat);
  headMesh.position.y = 0.25;
  headGroup.add(headMesh);

  if (isPig) {
    // Focinho do porco: 4x3x1 px
    const snout = makeBox(4, 3, 1, 16, 16, 64, 32, mat);
    snout.position.set(0, 0.18, 0.28);
    headGroup.add(snout);
  }

  g.add(headGroup);

  // Corpo horizontal: 10x16x8 px
  const body = makeBox(10, 8, 16, 28, 8, 64, 32, mat);
  body.position.set(0, legY + 0.25, 0);
  g.add(body);

  // 4 Pernas: 4xH×4 px
  const leg1 = makeLimb(4, legH, 4, 0, 16, 64, 32, mat); // Traseira esquerda
  leg1.position.set(-0.25, legY, -0.4);
  g.add(leg1);

  const leg2 = makeLimb(4, legH, 4, 0, 16, 64, 32, mat); // Traseira direita
  leg2.position.set(0.25, legY, -0.4);
  g.add(leg2);

  const leg3 = makeLimb(4, legH, 4, 0, 16, 64, 32, mat); // Frontal esquerda
  leg3.position.set(-0.25, legY, 0.35);
  g.add(leg3);

  const leg4 = makeLimb(4, legH, 4, 0, 16, 64, 32, mat); // Frontal direita
  leg4.position.set(0.25, legY, 0.35);
  g.add(leg4);

  g.userData = { head: headGroup, body, leg1, leg2, leg3, leg4, type: 'quadruped', mobType };
  return g;
}

// 4. ModelSpider (net.minecraft.client.model.ModelSpider)
function buildSpiderModel() {
  const g = new THREE.Group();
  const mat = getMobMaterial('spider', 64, 32);

  // Cabeça: 8x8x8 px, UV (32, 4)
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.5, 0.3);
  const headMesh = makeBox(8, 8, 8, 32, 4, 64, 32, mat);
  headGroup.add(headMesh);
  g.add(headGroup);

  // Tórax: 6x6x6 px, UV (0, 0)
  const thorax = makeBox(6, 6, 6, 0, 0, 64, 32, mat);
  thorax.position.set(0, 0.5, 0);
  g.add(thorax);

  // Abdômen: 10x8x12 px, UV (0, 12)
  const abdomen = makeBox(10, 8, 12, 0, 12, 64, 32, mat);
  abdomen.position.set(0, 0.55, -0.55);
  g.add(abdomen);

  // 8 Pernas: 16x2x2 px, UV (18, 0)
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const idx = i % 4;
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.25, 0.5, 0.2 - idx * 0.15);

    const legMesh = makeBox(12, 2, 2, 18, 0, 64, 32, mat);
    legMesh.position.x = side * (6 / 16);
    legGroup.add(legMesh);

    // Ângulos de descanso das pernas da aranha
    legGroup.rotation.z = side * 0.35;
    g.add(legGroup);
    legs.push(legGroup);
  }

  g.userData = { head: headGroup, thorax, abdomen, legs, type: 'spider' };
  return g;
}

// 5. ModelEnderman
function buildEndermanModel() {
  const g = new THREE.Group();
  const mat = getMobMaterial('enderman', 64, 32);

  // Cabeça alta em y = 2.4
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.4, 0);
  const headMesh = makeBox(8, 8, 8, 0, 0, 64, 32, mat);
  headMesh.position.y = 0.25;
  headGroup.add(headMesh);
  g.add(headGroup);

  // Tronco magro: 8x12x4
  const body = makeBox(8, 12, 4, 16, 16, 64, 32, mat);
  body.position.set(0, 1.8, 0);
  g.add(body);

  // Braços finos e longos: 2x30x2
  const armL = makeLimb(2, 30, 2, 56, 0, 64, 32, mat);
  armL.position.set(-0.35, 2.3, 0);
  g.add(armL);

  const armR = makeLimb(2, 30, 2, 56, 0, 64, 32, mat);
  armR.position.set(0.35, 2.3, 0);
  g.add(armR);

  // Pernas longas: 2x30x2
  const legL = makeLimb(2, 30, 2, 56, 0, 64, 32, mat);
  legL.position.set(-0.12, 1.35, 0);
  g.add(legL);

  const legR = makeLimb(2, 30, 2, 56, 0, 64, 32, mat);
  legR.position.set(0.12, 1.35, 0);
  g.add(legR);

  g.userData = { head: headGroup, body, armL, armR, legL, legR, type: 'enderman' };
  return g;
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
  wolf: () => buildQuadrupedModel('wolf'),
  chicken: () => buildQuadrupedModel('pig'), // Utiliza bípede/quadrúpede compacto até pack carregar
  witch: () => buildBipedModel('zombie', { isWitch: true }),
  slime: () => {
    const g = new THREE.Group();
    const mat = getMobMaterial('slime', 64, 32);
    const body = makeBox(8, 8, 8, 0, 16, 64, 32, mat);
    body.position.y = 0.25;
    g.add(body);
    g.userData = { body, type: 'slime' };
    return g;
  },
};

export function buildMobModel(mobType) {
  const builder = BUILDERS[mobType];
  const g = builder ? builder() : buildBipedModel('zombie');
  g.visible = false;
  return g;
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

  // Variáveis canônicas do MCP 1.8.9:
  const limbSwing = mob._limbSwing || 0;
  const limbSwingAmount = mob._limbSwingAmount || 0;
  const ageInTicks = (mob.ticksAlive || 0) + (time % 1);
  const netHeadYaw = mob.headYaw || 0;
  const headPitch = mob.headPitch || 0;

  // 1. BIPED (Zombie, Skeleton, Player)
  if (u.type === 'biped') {
    if (u.head) {
      u.head.rotation.y = netHeadYaw;
      u.head.rotation.x = headPitch;
    }

    // Pernas balançam com Math.cos(limbSwing * 0.6662) * 1.4 * limbSwingAmount
    const cosLeg = Math.cos(limbSwing * 0.6662);
    const cosLegPI = Math.cos(limbSwing * 0.6662 + Math.PI);
    u.legR.rotation.x = cosLeg * 1.4 * limbSwingAmount;
    u.legL.rotation.x = cosLegPI * 1.4 * limbSwingAmount;
    u.legR.rotation.y = 0;
    u.legL.rotation.y = 0;

    if (u.isZombie) {
      // ModelZombie.java: Braços esticados para frente (-Math.PI / 2) com sutil oscilação respiratória
      u.armR.rotation.x = -Math.PI / 2 + Math.sin(ageInTicks * 0.067) * 0.05;
      u.armL.rotation.x = -Math.PI / 2 - Math.sin(ageInTicks * 0.067) * 0.05;
      u.armR.rotation.z = Math.cos(ageInTicks * 0.09) * 0.05 + 0.05;
      u.armL.rotation.z = -(Math.cos(ageInTicks * 0.09) * 0.05 + 0.05);
      u.armR.rotation.y = -0.1;
      u.armL.rotation.y = 0.1;
    } else if (u.isSkeleton) {
      // ModelSkeleton.java: Braços apontados para mira de flechas
      u.armR.rotation.x = -Math.PI / 2 + headPitch;
      u.armL.rotation.x = -Math.PI / 2 + headPitch;
      u.armR.rotation.y = -0.4 + netHeadYaw;
      u.armL.rotation.y = 0.4 + netHeadYaw;
      u.armR.rotation.z = 0;
      u.armL.rotation.z = 0;
    } else {
      // Bípede padrão
      u.armR.rotation.x = cosLegPI * 2.0 * limbSwingAmount * 0.5;
      u.armL.rotation.x = cosLeg * 2.0 * limbSwingAmount * 0.5;
      u.armR.rotation.z = 0;
      u.armL.rotation.z = 0;
    }
  }

  // 2. CREEPER (ModelCreeper.java)
  else if (u.type === 'creeper') {
    if (u.head) {
      u.head.rotation.y = netHeadYaw;
      u.head.rotation.x = headPitch;
    }
    const cosLeg = Math.cos(limbSwing * 0.6662) * 1.4 * limbSwingAmount;
    const cosLegPI = Math.cos(limbSwing * 0.6662 + Math.PI) * 1.4 * limbSwingAmount;
    u.leg1.rotation.x = cosLeg;
    u.leg2.rotation.x = cosLegPI;
    u.leg3.rotation.x = cosLegPI;
    u.leg4.rotation.x = cosLeg;

    // Efeito de inchaço do Creeper
    if (mob.swelling > 0) {
      const s = 1.0 + (mob.swelling / 30.0) * 0.3;
      model.scale.set(s, s, s);
    } else {
      model.scale.set(1, 1, 1);
    }
  }

  // 3. QUADRUPED (Cow, Pig, Sheep - ModelQuadruped.java)
  else if (u.type === 'quadruped') {
    if (u.head) {
      u.head.rotation.y = netHeadYaw;
      u.head.rotation.x = headPitch;
    }
    const cosLeg = Math.cos(limbSwing * 0.6662) * 1.4 * limbSwingAmount;
    const cosLegPI = Math.cos(limbSwing * 0.6662 + Math.PI) * 1.4 * limbSwingAmount;
    u.leg1.rotation.x = cosLeg;
    u.leg2.rotation.x = cosLegPI;
    u.leg3.rotation.x = cosLegPI;
    u.leg4.rotation.x = cosLeg;
  }

  // 4. SPIDER (ModelSpider.java)
  else if (u.type === 'spider') {
    if (u.head) {
      u.head.rotation.y = netHeadYaw;
      u.head.rotation.x = headPitch;
    }
    if (u.legs) {
      const f3 = -(Math.cos(limbSwing * 0.6662 * 2.0) * 0.4) * limbSwingAmount;
      const f4 = -(Math.cos(limbSwing * 0.6662 * 2.0 + Math.PI) * 0.4) * limbSwingAmount;
      const f7 = Math.abs(Math.sin(limbSwing * 0.6662) * 0.4) * limbSwingAmount;
      const f8 = Math.abs(Math.sin(limbSwing * 0.6662 + Math.PI) * 0.4) * limbSwingAmount;

      u.legs[0].rotation.y = f3; u.legs[4].rotation.y = -f3;
      u.legs[1].rotation.y = f4; u.legs[5].rotation.y = -f4;
      u.legs[0].rotation.z = -0.35 + f7; u.legs[4].rotation.z = 0.35 - f7;
      u.legs[1].rotation.z = -0.35 + f8; u.legs[5].rotation.z = 0.35 - f8;
    }
  }

  // 5. ENDERMAN
  else if (u.type === 'enderman') {
    if (u.head) {
      u.head.rotation.y = netHeadYaw;
      u.head.rotation.x = headPitch;
    }
    const cosLeg = Math.cos(limbSwing * 0.6662) * 1.0 * limbSwingAmount;
    const cosLegPI = Math.cos(limbSwing * 0.6662 + Math.PI) * 1.0 * limbSwingAmount;
    u.legL.rotation.x = cosLegPI;
    u.legR.rotation.x = cosLeg;
    u.armL.rotation.x = -cosLegPI * 0.5;
    u.armR.rotation.x = -cosLeg * 0.5;
  }
}