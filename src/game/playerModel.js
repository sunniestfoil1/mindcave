// Modelo do jogador — porte do skinview3d (bs-community/skinview3d, MIT)
// Constrói o modelo a partir de BoxGeometry com UV mapping de skin 64×64.
// Referência: 07-animacoes-jogador-e-armaduras/skinview3d/src/model.ts
import * as THREE from 'three';
import { modelRotationYFromYaw } from './viewMath';
import { getItem } from './items';
import { getPackCanvas, onPackChanged, MC } from './pack';

// === UV mapping — porte exato de setUVs() do skinview3d ===
function setUVs(box, u, v, width, height, depth, textureWidth, textureHeight) {
  const toFaceVertices = (x1, y1, x2, y2) => [
    new THREE.Vector2(x1 / textureWidth, 1.0 - y2 / textureHeight),
    new THREE.Vector2(x2 / textureWidth, 1.0 - y2 / textureHeight),
    new THREE.Vector2(x2 / textureWidth, 1.0 - y1 / textureHeight),
    new THREE.Vector2(x1 / textureWidth, 1.0 - y1 / textureHeight),
  ];

  const top = toFaceVertices(u + depth, v, u + width + depth, v + depth);
  const bottom = toFaceVertices(u + width + depth, v, u + width * 2 + depth, v + depth);
  const left = toFaceVertices(u, v + depth, u + depth, v + depth + height);
  const front = toFaceVertices(u + depth, v + depth, u + width + depth, v + depth + height);
  const right = toFaceVertices(u + width + depth, v + depth, u + width + depth * 2, v + height + depth);
  const back = toFaceVertices(u + width + depth * 2, v + depth, u + width * 2 + depth * 2, v + height + depth);

  const uvAttr = box.attributes.uv;
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
  uvAttr.set(new Float32Array(newUVData));
  uvAttr.needsUpdate = true;
}

function setSkinUVs(box, u, v, width, height, depth) {
  setUVs(box, u, v, width, height, depth, 64, 64);
}

// === Skin padrão — steve.png oficial empacotado (carrega local, sem esperar o pacote) ===
let _defaultSkinTexture = null;
function getDefaultSkin() {
  if (!_defaultSkinTexture) {
    _defaultSkinTexture = new THREE.TextureLoader().load('/assets/skins/steve.png');
    _defaultSkinTexture.magFilter = THREE.NearestFilter;
    _defaultSkinTexture.minFilter = THREE.NearestFilter;
    _defaultSkinTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return _defaultSkinTexture;
}

// === BodyPart — porte de BodyPart do skinview3d ===
class BodyPart extends THREE.Group {
  constructor(innerLayer, outerLayer) {
    super();
    this.innerLayer = innerLayer;
    this.outerLayer = outerLayer;
    innerLayer.name = 'inner';
    outerLayer.name = 'outer';
  }
}

// === SkinObject — porte de SkinObject do skinview3d ===
class SkinObject extends THREE.Group {
  constructor() {
    super();
    this.modelListeners = [];
    this.slim = false;

    // Materiais — inner (camada sólida) e outer (camada de overlay: chapéu, jaqueta)
    this.layer1Material = new THREE.MeshLambertMaterial({ side: THREE.FrontSide });
    this.layer2Material = new THREE.MeshLambertMaterial({
      side: THREE.DoubleSide, transparent: true, alphaTest: 1e-5,
    });

    this.layer1MaterialBiased = this.layer1Material.clone();
    this.layer1MaterialBiased.polygonOffset = true;
    this.layer1MaterialBiased.polygonOffsetFactor = 1.0;
    this.layer1MaterialBiased.polygonOffsetUnits = 1.0;

    this.layer2MaterialBiased = this.layer2Material.clone();
    this.layer2MaterialBiased.polygonOffset = true;
    this.layer2MaterialBiased.polygonOffsetFactor = 1.0;
    this.layer2MaterialBiased.polygonOffsetUnits = 1.0;

    // Cabeça
    const headBox = new THREE.BoxGeometry(8, 8, 8);
    setSkinUVs(headBox, 0, 0, 8, 8, 8);
    const headMesh = new THREE.Mesh(headBox, this.layer1Material);

    const head2Box = new THREE.BoxGeometry(9, 9, 9);
    setSkinUVs(head2Box, 32, 0, 8, 8, 8);
    const head2Mesh = new THREE.Mesh(head2Box, this.layer2Material);

    this.head = new BodyPart(headMesh, head2Mesh);
    this.head.name = 'head';
    this.head.add(headMesh, head2Mesh);
    headMesh.position.y = 4;
    head2Mesh.position.y = 4;
    this.add(this.head);

    // Corpo
    const bodyBox = new THREE.BoxGeometry(8, 12, 4);
    setSkinUVs(bodyBox, 16, 16, 8, 12, 4);
    const bodyMesh = new THREE.Mesh(bodyBox, this.layer1Material);

    const body2Box = new THREE.BoxGeometry(8.5, 12.5, 4.5);
    setSkinUVs(body2Box, 16, 32, 8, 12, 4);
    const body2Mesh = new THREE.Mesh(body2Box, this.layer2Material);

    this.body = new BodyPart(bodyMesh, body2Mesh);
    this.body.name = 'body';
    this.body.add(bodyMesh, body2Mesh);
    this.body.position.y = -6;
    this.add(this.body);

    // Capa (1.8.9): quadro 10×16 px nas costas, pivô na borda de cima para balançar.
    // Textura = render do Crafthead (113×180, proporção 10:16) com transparência nas bordas.
    const capeGeo = new THREE.PlaneGeometry(10, 16);
    capeGeo.translate(0, -8, 0);
    this.capeMaterial = new THREE.MeshLambertMaterial({
      side: THREE.DoubleSide, transparent: true, alphaTest: 0.3,
    });
    this.capePivot = new THREE.Group();
    this.capePivot.position.set(0, 6, -2.3); // topo das costas do corpo (parte local do corpo)
    this.capePivot.rotation.x = (10.8 * Math.PI) / 180; // ângulo de repouso
    this.capePivot.visible = false; // some até a textura chegar
    this.capePivot.add(new THREE.Mesh(capeGeo, this.capeMaterial));
    this.body.add(this.capePivot);

    // Braço direito
    const rightArmBox = new THREE.BoxGeometry();
    const rightArmMesh = new THREE.Mesh(rightArmBox, this.layer1MaterialBiased);
    this.modelListeners.push(() => {
      rightArmMesh.scale.x = this.slim ? 3 : 4;
      rightArmMesh.scale.y = 12;
      rightArmMesh.scale.z = 4;
      setSkinUVs(rightArmBox, 40, 16, this.slim ? 3 : 4, 12, 4);
    });

    const rightArm2Box = new THREE.BoxGeometry();
    const rightArm2Mesh = new THREE.Mesh(rightArm2Box, this.layer2MaterialBiased);
    this.modelListeners.push(() => {
      rightArm2Mesh.scale.x = this.slim ? 3.5 : 4.5;
      rightArm2Mesh.scale.y = 12.5;
      rightArm2Mesh.scale.z = 4.5;
      setSkinUVs(rightArm2Box, 40, 32, this.slim ? 3 : 4, 12, 4);
    });

    const rightArmPivot = new THREE.Group();
    rightArmPivot.add(rightArmMesh, rightArm2Mesh);
    this.modelListeners.push(() => {
      rightArmPivot.position.x = this.slim ? -0.5 : -1;
    });
    rightArmPivot.position.y = -4;

    this.rightArm = new BodyPart(rightArmMesh, rightArm2Mesh);
    this.rightArm.name = 'rightArm';
    this.rightArm.add(rightArmPivot);
    this.rightArm.position.x = -5;
    this.rightArm.position.y = -2;
    this.add(this.rightArm);

    // Braço esquerdo
    const leftArmBox = new THREE.BoxGeometry();
    const leftArmMesh = new THREE.Mesh(leftArmBox, this.layer1MaterialBiased);
    this.modelListeners.push(() => {
      leftArmMesh.scale.x = this.slim ? 3 : 4;
      leftArmMesh.scale.y = 12;
      leftArmMesh.scale.z = 4;
      setSkinUVs(leftArmBox, 32, 48, this.slim ? 3 : 4, 12, 4);
    });

    const leftArm2Box = new THREE.BoxGeometry();
    const leftArm2Mesh = new THREE.Mesh(leftArm2Box, this.layer2MaterialBiased);
    this.modelListeners.push(() => {
      leftArm2Mesh.scale.x = this.slim ? 3.5 : 4.5;
      leftArm2Mesh.scale.y = 12.5;
      leftArm2Mesh.scale.z = 4.5;
      setSkinUVs(leftArm2Box, 48, 48, this.slim ? 3 : 4, 12, 4);
    });

    const leftArmPivot = new THREE.Group();
    leftArmPivot.add(leftArmMesh, leftArm2Mesh);
    this.modelListeners.push(() => {
      leftArmPivot.position.x = this.slim ? 0.5 : 1;
    });
    leftArmPivot.position.y = -4;

    this.leftArm = new BodyPart(leftArmMesh, leftArm2Mesh);
    this.leftArm.name = 'leftArm';
    this.leftArm.add(leftArmPivot);
    this.leftArm.position.x = 5;
    this.leftArm.position.y = -2;
    this.add(this.leftArm);

    // Perna direita
    const rightLegBox = new THREE.BoxGeometry(4, 12, 4);
    setSkinUVs(rightLegBox, 0, 16, 4, 12, 4);
    const rightLegMesh = new THREE.Mesh(rightLegBox, this.layer1MaterialBiased);

    const rightLeg2Box = new THREE.BoxGeometry(4.5, 12.5, 4.5);
    setSkinUVs(rightLeg2Box, 0, 32, 4, 12, 4);
    const rightLeg2Mesh = new THREE.Mesh(rightLeg2Box, this.layer2MaterialBiased);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.add(rightLegMesh, rightLeg2Mesh);
    rightLegPivot.position.y = -6;

    this.rightLeg = new BodyPart(rightLegMesh, rightLeg2Mesh);
    this.rightLeg.name = 'rightLeg';
    this.rightLeg.add(rightLegPivot);
    this.rightLeg.position.x = -1.9;
    this.rightLeg.position.y = -12;
    this.rightLeg.position.z = -0.1;
    this.add(this.rightLeg);

    // Perna esquerda
    const leftLegBox = new THREE.BoxGeometry(4, 12, 4);
    setSkinUVs(leftLegBox, 16, 48, 4, 12, 4);
    const leftLegMesh = new THREE.Mesh(leftLegBox, this.layer1MaterialBiased);

    const leftLeg2Box = new THREE.BoxGeometry(4.5, 12.5, 4.5);
    setSkinUVs(leftLeg2Box, 0, 48, 4, 12, 4);
    const leftLeg2Mesh = new THREE.Mesh(leftLeg2Box, this.layer2MaterialBiased);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.add(leftLegMesh, leftLeg2Mesh);
    leftLegPivot.position.y = -6;

    this.leftLeg = new BodyPart(leftLegMesh, leftLeg2Mesh);
    this.leftLeg.name = 'leftLeg';
    this.leftLeg.add(leftLegPivot);
    this.leftLeg.position.x = 1.9;
    this.leftLeg.position.y = -12;
    this.leftLeg.position.z = -0.1;
    this.add(this.leftLeg);

    // Aplicar modelo padrão (não-slim)
    this.modelType = 'default';
  }

  get map() { return this.layer1Material.map; }
  set map(newMap) {
    this.layer1Material.map = newMap;
    this.layer1Material.needsUpdate = true;
    this.layer1MaterialBiased.map = newMap;
    this.layer1MaterialBiased.needsUpdate = true;
    this.layer2Material.map = newMap;
    this.layer2Material.needsUpdate = true;
    this.layer2MaterialBiased.map = newMap;
    this.layer2MaterialBiased.needsUpdate = true;
  }

  get modelType() { return this.slim ? 'slim' : 'default'; }
  set modelType(value) {
    this.slim = value === 'slim';
    this.modelListeners.forEach(fn => fn());
  }

  resetJoints() {
    this.head.rotation.set(0, 0, 0);
    this.leftArm.rotation.set(0, 0, 0);
    this.rightArm.rotation.set(0, 0, 0);
    this.leftLeg.rotation.set(0, 0, 0);
    this.rightLeg.rotation.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.head.position.y = 0;
    this.body.position.y = -6;
    this.body.position.z = 0;
    this.rightArm.position.x = -5;
    this.rightArm.position.y = -2;
    this.rightArm.position.z = 0;
    this.leftArm.position.x = 5;
    this.leftArm.position.y = -2;
    this.leftArm.position.z = 0;
    this.rightLeg.position.x = -1.9;
    this.rightLeg.position.y = -12;
    this.rightLeg.position.z = -0.1;
    this.leftLeg.position.x = 1.9;
    this.leftLeg.position.y = -12;
    this.leftLeg.position.z = -0.1;
  }
}

// === PlayerObject — porte de PlayerObject do skinview3d ===
const CapeDefaultAngle = (10.8 * Math.PI) / 180;

class PlayerObject extends THREE.Group {
  constructor() {
    super();
    this.skin = new SkinObject();
    this.skin.name = 'skin';
    this.skin.position.y = 8;
    this.add(this.skin);

    // Aplicar skin padrão
    this.skin.map = getDefaultSkin();
  }

  setSkinTexture(texture) {
    this.skin.map = texture;
  }

  resetJoints() {
    this.skin.resetJoints();
  }
}

// === API pública ===
const PIXEL_TO_BLOCK = 1 / 16;

export function buildPlayerModel() {
  const wrapper = new THREE.Group();
  const player = new PlayerObject();
  player.scale.setScalar(PIXEL_TO_BLOCK);
  // No skinview3d: pés em y=-16 (pixels), topo da cabeça em y=16 (pixels)
  // Após escala 1/16: pés em y=-1, cabeça em y=1
  // Offset +1 para pés em y=0
  player.position.y = 1;
  wrapper.add(player);

  // Mapear body parts para userData (usado por applyThirdPersonPose)
  wrapper.userData = {
    skin: player.skin,
    head: player.skin.head,
    body: player.skin.body,
    armL: player.skin.leftArm,
    armR: player.skin.rightArm,
    legL: player.skin.leftLeg,
    legR: player.skin.rightLeg,
    isGlb: false,
    playerObject: player,
  };
  // Item na mão (terceira pessoa/F5): filho do braço direito para acompanhar todo o balanço
  const heldHolder = new THREE.Group();
  heldHolder.position.set(-1, -10, 0); // mão, em pixels do modelo
  wrapper.userData.armR.add(heldHolder);
  wrapper.userData.heldHolder = heldHolder;
  wrapper.userData.cape = player.skin.capePivot;
  wrapper.userData.capeMaterial = player.skin.capeMaterial;
  wrapper.visible = false;
  return wrapper;
}

// === Capa do modelo: aplica a textura (dataURL) e a visibilidade ===
export function setModelCape(model, src, visible) {
  const pivot = model?.userData?.cape;
  const mat = model?.userData?.capeMaterial;
  if (!pivot || !mat) return;
  const key = src || null;
  if (pivot._src !== key) {
    pivot._src = key;
    pivot._loaded = false;
    if (mat.map) { mat.map.dispose(); mat.map = null; mat.needsUpdate = true; }
    if (key) {
      const token = key;
      new THREE.TextureLoader().load(key, (tex) => {
        if (pivot._src !== token) { tex.dispose(); return; } // trocou antes de carregar
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        mat.map = tex;
        mat.needsUpdate = true;
        pivot._loaded = true;
        pivot.visible = pivot._wantVisible !== false;
      });
    }
  }
  pivot._wantVisible = visible !== false;
  pivot.visible = pivot._wantVisible && pivot._loaded && !!pivot._src;
}

// Aplica a capa salva (Crafthead) ao modelo; sem capa salva, oculta
export async function applyCapeToModel(model, visible = true) {
  try {
    const { getCapeChoice } = await import('./skinStore');
    const cape = getCapeChoice();
    setModelCape(model, cape ? cape.png : null, visible);
  } catch (e) {
    console.warn('[PlayerModel] Falha ao aplicar capa:', e.message);
  }
}

// === Item segurado no modelo (F5 e jogadores remotos) — em pixels, como o resto do modelo ===
const _heldGeo = {};
export function setModelHeldItem(model, itemId) {
  const holder = model?.userData?.heldHolder;
  if (!holder) return;
  const id = itemId || 0;
  if (holder._heldId === id) return;
  holder.clear();
  holder._heldId = id;
  if (!id) return;
  const def = getItem(id);
  if (!def) return;
  const isTool = !!(def.tool || def.weapon || def.weaponDamage);
  const isBlock = id < 256;
  if (!_heldGeo.tool) {
    _heldGeo.tool = new THREE.BoxGeometry(1, 8, 1);
    _heldGeo.block = new THREE.BoxGeometry(4.5, 4.5, 4.5);
    _heldGeo.item = new THREE.BoxGeometry(4, 4, 0.8);
  }
  const mat = new THREE.MeshBasicMaterial({ color: def.color || 0x888888 });
  const mesh = new THREE.Mesh(isTool ? _heldGeo.tool : isBlock ? _heldGeo.block : _heldGeo.item, mat);
  if (isTool) mesh.rotation.set(0.4, 0, 0.2);
  holder.add(mesh);
}


// === Armadura vestida (ModelBiped do 1.8.9 com expansão 1,0 / 0,5) ===
// Código de rede: 3 bits por peça (0 nada, 1 couro, 2 malha, 3 ferro, 4 diamante, 5 ouro), capacete nos bits 0-2, botas nos 9-11.
const ARMOR_MAT_CODE = { leather: 1, chain: 2, iron: 3, diamond: 4, gold: 5 };
const ARMOR_FILE = [null, 'leather', 'chainmail', 'iron', 'diamond', 'gold'];
const LEATHER_COLOR = 0xa06540;   // cor padrão do couro no 1.8.9 (sem tintura)

export function armorCodeFromSlots(slots) {
  let code = 0;
  for (let i = 0; i < 4; i++) {
    const it = slots && slots[i];
    const m = it && it.id ? getItem(it.id)?.armor?.material : null;
    code |= (ARMOR_MAT_CODE[m] || 0) << (i * 3);
  }
  return code;
}

// textura da camada (1 ou 2) do material: cache por arquivo, refeito quando o pacote de recursos muda
const _armorTex = new Map();
onPackChanged(() => {
  for (const e of _armorTex.values()) { e.tex?.dispose(); }
  _armorTex.clear();
  _armorEpoch++;
});
let _armorEpoch = 0;
function armorTexture(file, cb) {
  let e = _armorTex.get(file);
  if (!e) {
    e = { tex: null, waiting: [] };
    _armorTex.set(file, e);
    getPackCanvas(MC + 'textures/models/armor/' + file + '.png').then((cv) => {
      if (!cv) return;
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      e.tex = tex;
      for (const f of e.waiting.splice(0)) f(tex);
    });
  }
  if (e.tex) cb(e.tex); else e.waiting.push(cb);
}

// caixa expandida com UV do layout 64×32 dos arquivos de armadura
function armorBox(u, v, w, h, d, grow) {
  const g = new THREE.BoxGeometry(w + grow * 2, h + grow * 2, d + grow * 2);
  setUVs(g, u, v, w, h, d, 64, 32);
  return g;
}

// peça → lista de [parte do corpo, geometria, posição x/y/z relativa, espelhar]
function armorParts(piece) {
  if (piece === 0) return [{ part: 'head', geo: () => armorBox(0, 0, 8, 8, 8, 1), pos: [0, 4, 0], layer: 1 }];
  if (piece === 1) return [
    { part: 'body', geo: () => armorBox(16, 16, 8, 12, 4, 1), pos: [0, 0, 0], layer: 1 },
    { part: 'rightArm', geo: () => armorBox(40, 16, 4, 12, 4, 1), pos: [-1, -4, 0], layer: 1 },
    { part: 'leftArm', geo: () => armorBox(40, 16, 4, 12, 4, 1), pos: [1, -4, 0], layer: 1, mirror: true },
  ];
  if (piece === 2) return [
    { part: 'body', geo: () => armorBox(16, 16, 8, 12, 4, 0.5), pos: [0, 0, 0], layer: 2 },
    { part: 'rightLeg', geo: () => armorBox(0, 16, 4, 12, 4, 0.5), pos: [0, -6, 0], layer: 2 },
    { part: 'leftLeg', geo: () => armorBox(0, 16, 4, 12, 4, 0.5), pos: [0, -6, 0], layer: 2, mirror: true },
  ];
  return [
    { part: 'rightLeg', geo: () => armorBox(0, 16, 4, 12, 4, 1), pos: [0, -6, 0], layer: 1 },
    { part: 'leftLeg', geo: () => armorBox(0, 16, 4, 12, 4, 1), pos: [0, -6, 0], layer: 1, mirror: true },
  ];
}

// Veste/tira a armadura de um modelo (jogador local em 3ª pessoa ou remoto). Só reconstrói a peça que mudou.
export function setModelArmor(model, code) {
  const ud = model?.userData;
  if (!ud || !ud.skin) return;
  code = code | 0;
  if (!ud.armorState) ud.armorState = { code: 0, epoch: _armorEpoch, pieces: [null, null, null, null] };
  const st = ud.armorState;
  if (st.code === code && st.epoch === _armorEpoch) return;
  const parts = { head: ud.head, body: ud.body, rightArm: ud.armR, leftArm: ud.armL, rightLeg: ud.legR, leftLeg: ud.legL };
  for (let piece = 0; piece < 4; piece++) {
    const mat = (code >> (piece * 3)) & 7;
    const had = (st.code >> (piece * 3)) & 7;
    if (mat === had && st.epoch === _armorEpoch) continue;
    // remove a peça antiga
    const old = st.pieces[piece];
    if (old) for (const o of old) { o.parent?.remove(o.mesh); o.mesh.geometry.dispose(); o.mesh.material.dispose(); }
    st.pieces[piece] = null;
    if (!mat || !ARMOR_FILE[mat]) continue;
    const list = [];
    for (const def of armorParts(piece)) {
      const file = ARMOR_FILE[mat] + '_layer_' + def.layer;
      const material = new THREE.MeshLambertMaterial({ alphaTest: 0.1, side: THREE.FrontSide });
      if (mat === 1) { material.color.setHex(LEATHER_COLOR); material.userData.baseColor = LEATHER_COLOR; }
      const mesh = new THREE.Mesh(def.geo(), material);
      mesh.visible = false;                        // some até a textura chegar (evita caixa branca)
      mesh.position.set(def.pos[0], def.pos[1], def.pos[2]);
      if (def.mirror) mesh.scale.x = -1;
      armorTexture(file, (tex) => { material.map = tex; material.needsUpdate = true; mesh.visible = true; });
      parts[def.part].add(mesh);
      list.push({ mesh, parent: parts[def.part] });
      // couro: a camada de tintura (_overlay) não leva a cor
      if (mat === 1) {
        const m2 = new THREE.MeshLambertMaterial({ alphaTest: 0.1, side: THREE.FrontSide });
        const mesh2 = new THREE.Mesh(def.geo(), m2);
        mesh2.visible = false;
        mesh2.position.copy(mesh.position);
        mesh2.scale.set(def.mirror ? -1.001 : 1.001, 1.001, 1.001);   // um fio acima da camada de couro, sem brigar de profundidade
        armorTexture(file + '_overlay', (tex) => { m2.map = tex; m2.needsUpdate = true; mesh2.visible = true; });
        parts[def.part].add(mesh2);
        list.push({ mesh: mesh2, parent: parts[def.part] });
      }
    }
    st.pieces[piece] = list;
  }
  st.code = code; st.epoch = _armorEpoch;
}

// Posiciona o modelo no mundo a partir do estado do jogador (usado pelo motor e pelo laboratório)
export function placePlayerModel(model, pos, yaw) {
  model.position.set(pos.x, pos.y, pos.z);
  model.rotation.y = modelRotationYFromYaw(yaw);
}

// Carregar skin customizada de URL (ex: skin do usuário ou textura importada)
export async function loadPlayerSkin(model, skinUrl) {
  try {
    const loader = new THREE.TextureLoader();
    const texture = await loader.loadAsync(skinUrl);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    const player = model.userData.playerObject;
    if (player) player.setSkinTexture(texture);
  } catch (e) {
    console.warn('[PlayerModel] Falha ao carregar skin:', e.message);
  }
}

export async function loadPlayerGlb(model) {
  // Otimização: usa o modelo procedural skinview3d de alta fidelidade (0 download, 0 overhead GLB)
  if (model && model.userData) {
    model.userData.isGlb = false;
  }
  return true;
}

// === Mão em primeira pessoa — porte de getMyHand do minecraft-renderer ===
// Usa a textura do braço direito (UV 40,16) da skin 64×64
export function buildFirstPersonArm() {
  // BoxGeometry(0.25, 0.75, 0.25) com UV do braço direito e pivô no ombro (topo)
  const box = new THREE.BoxGeometry(0.25, 0.75, 0.25);
  setSkinUVs(box, 40, 16, 4, 12, 4);
  box.translate(0, -0.375, 0);

  const material = new THREE.MeshLambertMaterial();
  material.map = getDefaultSkin();
  material.needsUpdate = true;

  const mesh = new THREE.Mesh(box, material);
  mesh.userData.procedural = true;
  return mesh;
}

// GLB não usado para a mão FPS
export async function loadFirstPersonArmGlb(_oldArm, _fpsScene) { return _oldArm; }

// Aplica a skin padrão (steve.png) do pacote ao modelo do jogador e à mão em 1ª pessoa (MC24 §5.2)
const _skinTextures = new WeakMap(); // canvas → textura (um upload à GPU por skin, compartilhado entre modelos)
function textureForCanvas(cv) {
  let tex = _skinTextures.get(cv);
  if (!tex) {
    tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    _skinTextures.set(cv, tex);
  }
  return tex;
}

// Aplica a skin escolhida ao modelo do jogador e à mão em 1ª pessoa. Com a skin já em cache aplica de forma síncrona (antes de qualquer
// await), então o primeiro quadro já sai com a skin certa. Devolve true se aplicou.
export async function applyPackSkin(playerModel, fpsArm) {
  try {
    const { getSkinCanvas, getSkinCanvasSync, isSlimSkin } = await import('./skinStore');
    const cv = getSkinCanvasSync() || await getSkinCanvas();
    if (!cv) return false;
    const tex = textureForCanvas(cv);
    const player = playerModel?.userData?.playerObject;
    if (player) {
      player.setSkinTexture(tex);
      player.modelType = isSlimSkin() ? 'slim' : 'default';
    }
    if (fpsArm?.material) { fpsArm.material.map = tex; fpsArm.material.needsUpdate = true; }
    return true;
  } catch (e) {
    console.warn('[PlayerModel] Falha ao aplicar skin:', e.message);
    return false;
  }
}
