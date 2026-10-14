// Mão em 1ª pessoa — pose do braço como no ItemRenderer da 1.8.9, com o item na frente.
// Com item na mão o braço não é desenhado (igual ao jogo original); só de mão vazia aparece o braço.
import * as THREE from 'three';
import { buildFirstPersonArm } from './playerModel';
import { fastSin, fastCos } from './fastMath';

const DEG = Math.PI / 180;
const M = new THREE.Matrix4();
const TMP = new THREE.Matrix4();

function T(x, y, z) { return TMP.makeTranslation(x, y, z); }

// Braço direito do ModelPlayer (caixa 4×12×4 px, ponto de rotação (-5, 2, 0) com Y para baixo),
// convertido para o quadro "cru" do modelo: Y e Z invertidos em relação ao quadro do skinview (Y para cima).
// A cadeia do ItemRenderer foi escrita para esse quadro cru.
function bakeRawArmGeometry(geo) {
  // geo: BoxGeometry(0.25, 0.75, 0.25) centrada na origem (UV do braço direito já aplicado)
  const toRaw = new THREE.Matrix4().makeRotationX(Math.PI); // (x, y, z) -> (x, -y, -z): rotação, não espelhamento
  // centro da caixa no quadro skinview: (-6, -6, 0) px
  geo.translate(-6 / 16, -6 / 16, 0);
  geo.applyMatrix4(toRaw);
  // ModelBiped.setRotationAngles soma cos(0)·0,05 + 0,05 = 0,1 rad em Z ao braço direito (ageInTicks = 0 na mão em 1ª pessoa), girando em torno do
  // ponto de rotação (-5, 2, 0) px. Medido no print oficial: com 0,1 rad os vértices do braço batem em 2–3 px; sem ele a mão ficava ~25 px fora.
  geo.translate(5 / 16, -2 / 16, 0);
  geo.rotateZ(0.1);
  geo.translate(-5 / 16, 2 / 16, 0);
  return geo;
}

export function buildHandRig() {
  const arm = buildFirstPersonArm();
  // buildFirstPersonArm desloca a caixa para pendurar do ombro; refaz centrada para a cadeia da 1.8.9
  const g = new THREE.BoxGeometry(0.25, 0.75, 0.25);
  const uv = arm.geometry.attributes.uv;
  g.attributes.uv.set(uv.array);
  bakeRawArmGeometry(g);
  arm.geometry.dispose();
  arm.geometry = g;
  arm.matrixAutoUpdate = false;
  arm.frustumCulled = false;
  arm.material.side = THREE.DoubleSide; // a 1.8.9 desenha o braço sem culling

  const itemRoot = new THREE.Group();
  const itemGroup = new THREE.Group();
  // Sem deslocamento extra: o transform da 1.8.9 (transformFirstPersonItem) já é em espaço
  // da câmera; qualquer offset aqui empurrava o item para fora da tela (y ≈ -1.17).
  itemRoot.add(itemGroup);
  return { arm, itemRoot, itemGroup };
}

// Matriz do braço vazio (espaço da câmera de 1ª pessoa) com micro-interpolação sub-tick
export function armMatrix(anim, partialTick = 0) {
  const pt = Math.min(1, Math.max(0, partialTick));
  const s = anim.isSwinging
    ? Math.min(1, Math.max(0, (anim.prevSwingProgress ?? anim.swingProgress) + (anim.swingProgress - (anim.prevSwingProgress ?? anim.swingProgress)) * pt))
    : 0;
  const sq = Math.sqrt(s);
  M.identity();
  // translação do golpe
  M.multiply(T(-0.3 * fastSin(sq * Math.PI), 0.4 * fastSin(sq * Math.PI * 2), -0.4 * fastSin(s * Math.PI)));
  // posição base + equipar/desequipar interpolado
  const ep = Math.min(1, Math.max(0, (anim.prevEquipProgress ?? anim.equipProgress) + (anim.equipProgress - (anim.prevEquipProgress ?? anim.equipProgress)) * pt));
  M.multiply(T(0.64, -0.6 + (ep - 1) * 0.6, -0.72));
  M.multiply(TMP.makeRotationY(45 * DEG));
  // balanço do golpe
  const f6 = fastSin(s * s * Math.PI);
  const f7 = fastSin(sq * Math.PI);
  M.multiply(TMP.makeRotationY(f7 * 70 * DEG));
  M.multiply(TMP.makeRotationZ(-f6 * 20 * DEG));
  // inércia ao girar a visão (mesma do item)
  M.multiply(TMP.makeRotationY(anim.handRotY * 0.2));
  M.multiply(TMP.makeRotationX(anim.handRotX * 0.2));
  // caminhada
  if (anim.speed > 0.05) {
    const k = Math.min(1, anim.speed / 5);
    const p = (anim.prevWalkPhase ?? anim.walkPhase) + (anim.walkPhase - (anim.prevWalkPhase ?? anim.walkPhase)) * pt;
    M.multiply(T(-fastSin(p) * 0.05 * k, Math.abs(fastCos(p * 2)) * 0.05 * k, 0));
    M.multiply(TMP.makeRotationZ(fastSin(p) * 5 * DEG * k));
  }
  // do ombro para o braço (ModelPlayer cru)
  M.multiply(T(-1, 3.6, 3.5));
  M.multiply(TMP.makeRotationZ(120 * DEG));
  M.multiply(TMP.makeRotationX(200 * DEG));
  M.multiply(TMP.makeRotationY(-135 * DEG));
  M.multiply(T(5.6, 0, 0));
  return M;
}

// Item segurado: cadeia do ItemRenderer.renderItemInFirstPerson. Ordem GL: golpe → posição base → equipar → giro de 45° → balanço do
// golpe → escala 0,4 → transform do modelo. Item plano usa o transform do jogo original (1.7, ver abaixo); bloco segue o da 1.8.9
// (sem transform próprio, escala 0,5 do RenderItem). O mesh do item é normalizado para 1×1(×1) centrado.
export function itemMatrix(out, anim, heldDef, style, partialTick, time) {
  const pt = Math.min(1, Math.max(0, partialTick));
  const lerp = (a, b) => (a ?? b) + (b - (a ?? b)) * pt;
  const s = anim.isSwinging ? Math.min(1, Math.max(0, lerp(anim.prevSwingProgress, anim.swingProgress))) : 0;
  const ep = Math.min(1, Math.max(0, lerp(anim.prevEquipProgress, anim.equipProgress)));
  const sq = Math.sqrt(s);
  const f = fastSin(s * s * Math.PI), f1 = fastSin(sq * Math.PI);
  const m = out.identity();
  m.multiply(T(-0.4 * f1, 0.2 * fastSin(sq * Math.PI * 2), -0.2 * fastSin(s * Math.PI)));
  m.multiply(T(0.56, -0.52, -0.72));
  m.multiply(T(0, (ep - 1) * 0.6, 0));
  // caminhada e inércia da mão (não existem no ItemRenderer; vêm do bob da câmera, aqui aplicados na mão)
  if (anim.speed > 0.05) {
    const k = Math.min(1, anim.speed / 5);
    const p = lerp(anim.prevWalkPhase, anim.walkPhase);
    m.multiply(T(-fastSin(p) * 0.05 * k, Math.abs(fastCos(p * 2)) * 0.05 * k, 0));
    m.multiply(TMP.makeRotationZ(fastSin(p) * 5 * DEG * k));
  }
  m.multiply(TMP.makeRotationY(anim.handRotY * 0.2));
  m.multiply(TMP.makeRotationX(anim.handRotX * 0.2));
  m.multiply(TMP.makeRotationY(45 * DEG));
  if (anim.blocking) {
    // ItemRenderer.func_178103_d (bloquear com espada)
    m.multiply(T(-0.5, 0.2, 0));
    m.multiply(TMP.makeRotationY(30 * DEG));
    m.multiply(TMP.makeRotationX(-80 * DEG));
    m.multiply(TMP.makeRotationY(60 * DEG));
  } else {
    m.multiply(TMP.makeRotationY(f * -20 * DEG));
    m.multiply(TMP.makeRotationZ(f1 * -20 * DEG));
    m.multiply(TMP.makeRotationX(f1 * -80 * DEG));
  }
  if (anim.eating) { m.multiply(T(0, 0.05 + Math.abs(Math.sin(time * 6)) * 0.03, -0.1)); m.multiply(TMP.makeRotationX(-30 * DEG)); }
  if (anim.bowDrawing) m.multiply(T(0, 0, 0.04 * (anim.bowCharge || 0)));
  m.multiply(TMP.makeScale(0.4, 0.4, 0.4));
  if (style === 'sprite') {
    // Item 2D na mão como no jogo original (animações 1.7: ItemRenderer.renderItem, caminho de item plano), medido nos prints do original
    // (espada, cenoura e sementes, IoU ≈ 0,85–0,9 com estas constantes): translação (0, −0,3, 0), escala 1,5, giro Y 50°, giro Z 335°
    // e o sprite de 1×1 com a origem num canto, deslocado (−0,9375, −0,0625, 0). A frente do sprite sai espelhada em x.
    // O mesh daqui é centrado, tem a frente em +z e vem espelhado pelo engine (escala x negativa): centro (0,5, 0,5, −1/32) no espaço do sprite.
    const rod = heldDef && heldDef.name === 'fishing_rod';
    if (rod) m.multiply(TMP.makeRotationY(180 * DEG));
    m.multiply(T(0, -0.3, 0));
    m.multiply(TMP.makeScale(1.5, 1.5, 1.5));
    m.multiply(TMP.makeRotationY(50 * DEG));
    m.multiply(TMP.makeRotationZ(335 * DEG));
    m.multiply(T(-0.9375 + 0.5, -0.0625 + 0.5, -1 / 32));
    return m;
  }
  m.multiply(TMP.makeScale(0.5, 0.5, 0.5));
  return m;
}

export function poseHand(rig, anim, player, heldDef, hasItem, time, partialTick = 0, style = 'sprite') {
  // ItemRenderer.renderItemInFirstPerson: com item na mão só o item é desenhado; o braço (renderPlayerArm) só aparece de mão vazia
  rig.arm.visible = !hasItem;
  rig.arm.matrix.copy(armMatrix(anim, partialTick));
  if (hasItem) {
    rig.itemRoot.matrixAutoUpdate = false;
    itemMatrix(rig.itemRoot.matrix, anim, heldDef, style, partialTick, time);
    rig.itemRoot.matrixWorldNeedsUpdate = true;
    rig.itemRoot.visible = true;
  } else {
    rig.itemRoot.visible = false;
  }
}
