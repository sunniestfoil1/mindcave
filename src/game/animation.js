// Controlador de animações 1.8.9 — PRD 07 RF-040..062
// Camadas: locomoção (corpo), ação (braços/tronco), aditivos (respiração, cabeça, dano)
// Procedural por padrão; GLB no PRD 10. As variáveis são replicadas para multiplayer.
import * as THREE from 'three';

// === Estado de animação do jogador ===
export function createAnimationState() {
  return {
    // Locomoção
    walkPhase: 0,
    speed: 0,
    // Ação
    swingProgress: 0,       // 0..1, dura 6 ticks
    swingDirection: 1,
    isSwinging: false,
    equipProgress: 0,       // 0..1, item subindo ao equipar
    prevSlot: -1,
    targetEquip: 1,
    // Estados de uso
    blocking: false,
    bowDrawing: false,
    bowCharge: 0,
    eating: false,
    usingItem: false,
    // Aditivos
    hurtFlash: 0,
    deathProgress: 0,
    // Inércia da mão em 1ª pessoa
    handRotX: 0, handRotY: 0,
    prevYaw: 0, prevPitch: 0,
  };
}

// === Atualiza o estado de animação a cada tick ===
export function tickAnimation(anim, player, time) {
  // Locomoção
  const spd = Math.hypot(player.vel.x, player.vel.z);
  anim.speed = spd;
  const phaseSpeed = player.sprinting ? 0.45 : 0.3;
  if (spd > 0.05) {
    anim.walkPhase += phaseSpeed * Math.min(1, spd / 5);
  } else {
    anim.walkPhase += 0.02; // respiração
  }

  // Swing (balanço de ataque/mineração) — 6 ticks de duração (RF-051)
  if (anim.isSwinging) {
    anim.swingProgress += 1 / 6;
    if (anim.swingProgress >= 1) {
      anim.swingProgress = 0;
      anim.isSwinging = false;
    }
  }

  // Equipar — item sobe progressivamente (RF-051)
  if (anim.equipProgress < anim.targetEquip) {
    anim.equipProgress = Math.min(anim.targetEquip, anim.equipProgress + 0.1);
  } else if (anim.equipProgress > anim.targetEquip) {
    anim.equipProgress = Math.max(anim.targetEquip, anim.equipProgress - 0.1);
  }

  // Detectar troca de item
  const curSlot = player.selectedSlot;
  if (anim.prevSlot !== curSlot && anim.prevSlot !== -1) {
    anim.targetEquip = 0;
    setTimeout(() => { anim.targetEquip = 1; }, 1); // sobe de novo no próximo frame
  }
  anim.prevSlot = curSlot;

  // Estados de uso
  anim.blocking = !!player.blocking;
  anim.bowDrawing = !!player.bowDrawing;
  anim.bowCharge = player.bowCharge || 0;
  anim.eating = !!player.eating;
  anim.usingItem = !!player.usingItem;

  // Flash de dano
  if (player.hurtTime > 0) anim.hurtFlash = player.hurtTime / 10;
  else anim.hurtFlash = 0;

  // Morte
  if (player.isDead) {
    anim.deathProgress = Math.min(1, anim.deathProgress + 0.05);
  } else {
    anim.deathProgress = 0;
  }

  // Inércia da mão em 1ª pessoa
  const yawDiff = player.yaw - anim.prevYaw;
  const pitchDiff = player.pitch - anim.prevPitch;
  anim.handRotY = anim.handRotY * 0.5 + yawDiff * 0.3;
  anim.handRotX = anim.handRotX * 0.5 + pitchDiff * 0.3;
  anim.prevYaw = player.yaw;
  anim.prevPitch = player.pitch;
}

// Inicia um balanço (pode reiniciar a cada clique — RF-051, RF-041)
export function startSwing(anim) {
  anim.isSwinging = true;
  anim.swingProgress = 0;
}

// === Aplica poses ao modelo 3D em terceira pessoa ===
// Porte da matemática de animação do skinview3d (MIT):
// - WalkingAnimation: sin(t*8)*0.5 para pernas/braços, cos(t)*0.03 + PI*0.02 para Z
// - RunningAnimation: cos(t*15+PI/2)*1.3 pernas, cos(t)*1.5 braços
// - IdleAnimation: cos(t*2)*0.03 + PI*0.02 para braço Z
// - CrouchAnimation: body.rotation.x = 0.4538 * |sin(pr*PI/2)|, body.position ajustado
export function applyThirdPersonPose(model, anim, player, time) {
  if (!model || !model.userData) return;
  const u = model.userData;
  const spd = anim.speed;
  const t = anim.walkPhase;

  // Morte: tomba para o lado (RF-060)
  if (player.isDead) {
    const dp = anim.deathProgress;
    model.rotation.z = dp * Math.PI / 2;
    model.rotation.x = 0;
    u.armL.rotation.set(0, 0, 0);
    u.armR.rotation.set(0, 0, 0);
    u.legL.rotation.set(0, 0, 0);
    u.legR.rotation.set(0, 0, 0);
    if (u.body) u.body.rotation.x = 0;
    return;
  }
  model.rotation.z = 0;

  const walking = spd > 0.05;
  const sprinting = player.sprinting && walking;
  const sneaking = player.sneaking;

  // === Locomoção (skinview3d) ===
  const basicArmRotationZ = Math.PI * 0.02;

  if (sprinting) {
    // Correr — cos com amplitude maior (skinview3d RunningAnimation)
    const rt = t * 1.5 + Math.PI * 0.5;
    u.legL.rotation.x = Math.cos(rt + Math.PI) * 1.3;
    u.legR.rotation.x = Math.cos(rt) * 1.3;
    u.armL.rotation.x = Math.cos(rt) * 1.5;
    u.armR.rotation.x = Math.cos(rt + Math.PI) * 1.5;
    const runArmZ = Math.PI * 0.1;
    u.armL.rotation.z = Math.cos(rt) * 0.1 + runArmZ;
    u.armR.rotation.z = Math.cos(rt + Math.PI) * 0.1 - runArmZ;
    // Inclinação leve ao correr
    model.rotation.z = Math.cos(rt + Math.PI) * 0.01;
  } else if (walking) {
    // Andar — sin com amplitude 0.5 (skinview3d WalkingAnimation)
    const amp = Math.min(1, spd / 5);
    u.legL.rotation.x = Math.sin(t) * 0.5 * amp;
    u.legR.rotation.x = Math.sin(t + Math.PI) * 0.5 * amp;
    u.armR.rotation.x = Math.sin(t) * 0.5 * amp;
    u.armL.rotation.x = Math.sin(t + Math.PI) * 0.5 * amp;
    u.armL.rotation.z = Math.cos(t) * 0.03 + basicArmRotationZ;
    u.armR.rotation.z = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ;
    model.rotation.z = 0;
  } else {
    // Parado — respiração (skinview3d IdleAnimation)
    u.legL.rotation.x = 0;
    u.legR.rotation.x = 0;
    u.armL.rotation.x = 0;
    u.armR.rotation.x = 0;
    u.armL.rotation.z = Math.cos(t) * 0.03 + basicArmRotationZ;
    u.armR.rotation.z = Math.cos(t + Math.PI) * 0.03 - basicArmRotationZ;
    model.rotation.z = 0;
  }

  // === Agachar (skinview3d CrouchAnimation) ===
  if (sneaking && u.body) {
    u.body.rotation.x = 0.4538 * Math.abs(Math.sin((t * 0.5 * Math.PI) / 2));
  } else if (u.body) {
    u.body.rotation.x = 0;
  }

  // === Estados de ação (sobrepõe a locomoção do braço direito) ===
  if (anim.blocking) {
    u.armR.rotation.x = -Math.PI / 3;
    u.armR.rotation.z = -Math.PI / 6;
  } else if (anim.bowDrawing) {
    u.armR.rotation.x = -Math.PI / 2 + anim.bowCharge * 0.3;
    u.armL.rotation.x = -Math.PI / 2 - anim.bowCharge * 0.3;
    u.armR.rotation.z = 0; u.armL.rotation.z = 0;
  } else if (anim.eating) {
    const bob = Math.sin(time * 1.5) * 0.1;
    u.armR.rotation.x = -Math.PI / 2 + bob;
  } else if (anim.isSwinging) {
    const sp = anim.swingProgress;
    const swingAngle = Math.sin(sp * Math.PI) * 1.5;
    u.armR.rotation.x = -swingAngle;
    u.armR.rotation.z = 0;
  }

  // === Cabeça: segue pitch + head bobbing ao andar (skinview3d) ===
  if (u.head) {
    u.head.rotation.y = walking ? Math.sin(t / 4) * 0.2 : 0;
    u.head.rotation.x = player.pitch + (walking ? Math.sin(t / 5) * 0.1 : 0);
  }
}

import { fastSin, fastCos } from './fastMath';

const _tfCached = { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 };

// === Calcula transformação da mão em 1ª pessoa (Minecraft 1.8.9 ItemRenderer) ===
export function getFirstPersonTransform(anim, player, itemDef, time) {
  const DEG = Math.PI / 180;

  // 1. Vetores Base de Translação (ItemRenderer 1.8.9)
  let x = 0.56, y = -0.52, z = -0.60;

  // 2. Ângulos de Rotação Base (Yaw = +45.0°, Pitch = 0.0°, Roll = 0.0°)
  let rotX = 0, rotY = 45.0 * DEG, rotZ = 0;
  let scale = 1;

  // 4. Progresso de Equipar/Desequipar (Equip Progress e: 0..1)
  const ep = anim.equipProgress;
  y -= (1.0 - ep) * 0.6;

  // Bobbing da caminhada (ItemRenderer transformFirstPersonItem 1.8.9)
  const spd = anim.speed;
  if (spd > 0.05) {
    const fSpd = Math.min(1, spd / 5);
    const p = anim.walkPhase;
    x += -fastSin(p) * 0.05 * fSpd;
    y += Math.abs(fastCos(p * 2)) * 0.05 * fSpd;
    rotZ += fastSin(p) * (5.0 * DEG) * fSpd;
    rotX += fastCos(p * 2) * (5.0 * DEG) * fSpd;
    rotY += fastSin(p) * (10.0 * DEG) * fSpd;
  }

  // Inércia da câmera ao girar a visão
  rotY += anim.handRotY * 0.2;
  rotX += anim.handRotX * 0.2;

  // 3. Fórmulas de Onda do Golpe (Swing Math - ItemRenderer 1.8.9)
  if (anim.isSwinging) {
    const s = anim.swingProgress;
    const sqrtS = Math.sqrt(s);
    const f4 = fastSin(s * Math.PI);
    const f5 = fastSin(sqrtS * Math.PI);

    // Modificação Dinâmica da Posição (Translação do Golpe)
    x += -f5 * 0.4;
    y += fastSin(sqrtS * Math.PI * 2.0) * 0.2;
    z += -f4 * 0.2;

    // Modificação Dinâmica dos Ângulos (Rotação do Golpe)
    rotY += -f4 * 20.0 * DEG;
    rotZ += -f5 * 20.0 * DEG;
    rotX += -f5 * 80.0 * DEG;
  }

  // Bloquear com espada (Pose de defesa 1.8.9)
  if (anim.blocking) {
    rotX += -20.0 * DEG;
    rotY += -15.0 * DEG;
    rotZ += -30.0 * DEG;
    x -= 0.1;
    y += 0.05;
  }

  // Puxar arco
  if (anim.bowDrawing) {
    x = 0.35; y = -0.4; z = -0.7;
    rotX = -0.1;
    rotY = 0.2;
    if (anim.bowCharge > 0.9) {
      const shake = (Math.random() - 0.5) * 0.02;
      x += shake; y += shake;
    }
  }

  // Comer / Beber
  if (anim.eating) {
    rotX = -Math.PI / 2.2;
    y += 0.3 + Math.sin(time * 1.5) * 0.05;
  }

  // Ajustes de inclinação para ferramentas/espadas
  if (itemDef && (itemDef.tool || itemDef.weaponDamage)) {
    rotZ += 0.2;
  }

  _tfCached.x = x; _tfCached.y = y; _tfCached.z = z;
  _tfCached.rotX = rotX; _tfCached.rotY = rotY; _tfCached.rotZ = rotZ; _tfCached.scale = scale;
  return _tfCached;
}

// === Retorna o estado de animação para replicação em multiplayer (RF-042) ===
export function getAnimStateForSync(anim) {
  return {
    s: anim.isSwinging ? anim.swingProgress : 0,
    e: anim.equipProgress,
    b: anim.blocking ? 1 : 0,
    bd: anim.bowDrawing ? 1 : 0,
    bc: anim.bowCharge,
    ea: anim.eating ? 1 : 0,
    d: anim.deathProgress,
  };
}