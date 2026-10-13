// Mão em 1ª pessoa — pose do braço como no ItemRenderer da 1.8.9, com o item na frente.
// Decisão de jogo: o braço fica visível atrás do item segurado (pedido do jogador).
import * as THREE from 'three';
import { buildFirstPersonArm } from './playerModel';
import { getFirstPersonTransform } from './animation';
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

export function poseHand(rig, anim, player, heldDef, hasItem, time, partialTick = 0) {
  if (hasItem) {
    // Braço visível atrás do item ("mão segurando o bloco", pedido do jogador)
    rig.arm.visible = true;
    rig.arm.matrix.copy(armMatrix(anim, partialTick));
    const tf = getFirstPersonTransform(anim, player, heldDef, time, partialTick);
    rig.itemRoot.position.set(tf.x, tf.y, tf.z);
    rig.itemRoot.rotation.set(tf.rotX, tf.rotY, tf.rotZ);
    rig.itemRoot.visible = true;
  } else {
    rig.itemRoot.visible = false;
    rig.arm.visible = true;
    rig.arm.matrix.copy(armMatrix(anim, partialTick));
  }
}
