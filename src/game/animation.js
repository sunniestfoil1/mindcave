// Controlador de animações 1.8.9 — PRD 07 RF-040..062
// Camadas: locomoção (corpo), ação (braços/tronco), aditivos (respiração, cabeça, dano)
// Procedural por padrão; GLB no PRD 10. As variáveis são replicadas para multiplayer.
import * as THREE from 'three';
import { fastSin, fastCos } from './fastMath';

// === Estado de animação do jogador ===
export function createAnimationState() {
  return {
    // Locomoção
    walkPhase: 0,
    prevWalkPhase: 0,
    speed: 0,
    // Andar do 1.8.9 (EntityLivingBase.limbSwing): anda com a DISTÂNCIA percorrida, não com o relógio
    limbSwing: 0, limbSwingAmount: 0, prevLimbSwingAmount: 0, hasLimb: false, age: 0, _px: undefined, _pz: undefined,
    // Ação
    swingProgress: 0,       // 0..1, dura 6 ticks
    prevSwingProgress: 0,
    swingDirection: 1,
    isSwinging: false,
    equipProgress: 0,       // 0..1, item subindo ao equipar
    prevEquipProgress: 0,
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
  anim.prevWalkPhase = anim.walkPhase;
  anim.prevSwingProgress = anim.swingProgress;
  anim.prevEquipProgress = anim.equipProgress;

  // Passos do 1.8.9: f = distância andada no tick × 4 (no máximo 1); a amplitude anda 40% do caminho até f e a fase soma a amplitude
  anim.age++;
  if (player.pos) {
    if (anim._px !== undefined) {
      const f = Math.min(1, Math.hypot(player.pos.x - anim._px, player.pos.z - anim._pz) * 4);
      anim.prevLimbSwingAmount = anim.limbSwingAmount;
      anim.limbSwingAmount += (f - anim.limbSwingAmount) * 0.4;
      anim.limbSwing += anim.limbSwingAmount;
      anim.hasLimb = true;
    }
    anim._px = player.pos.x; anim._pz = player.pos.z;
  }
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
      anim.prevSwingProgress = 0;
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
export function applyThirdPersonPose(model, anim, player, time, partialTick = 0) {
  if (!model || !model.userData) return;
  const u = model.userData;
  const spd = anim.speed;
  const pt = Math.min(1, Math.max(0, partialTick));
  const t = (anim.prevWalkPhase ?? anim.walkPhase) + (anim.walkPhase - (anim.prevWalkPhase ?? anim.walkPhase)) * pt;

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

  const limb = !!anim.hasLimb;
  const lsa = limb ? anim.prevLimbSwingAmount + (anim.limbSwingAmount - anim.prevLimbSwingAmount) * pt : 0;
  const ls = limb ? anim.limbSwing - anim.limbSwingAmount * (1 - pt) : 0;
  const walking = limb ? lsa > 0.02 : spd > 0.05;
  const sprinting = player.sprinting && walking;
  const sneaking = player.sneaking;

  // === Locomoção ===
  const basicArmRotationZ = Math.PI * 0.02;
  if (limb) {
    // ModelBiped.setRotationAngles (1.8.9): pernas ±1,4 × amplitude e braços ±1,0 × amplitude, em oposição; parado, os braços balançam de leve
    const c = fastCos(ls * 0.6662), c2 = fastCos(ls * 0.6662 + Math.PI);
    u.legR.rotation.x = c * 1.4 * lsa;
    u.legL.rotation.x = c2 * 1.4 * lsa;
    u.armR.rotation.x = c2 * lsa + fastSin(anim.age * 0.067) * 0.05;
    u.armL.rotation.x = c * lsa - fastSin(anim.age * 0.067) * 0.05;
    const sway = fastCos(anim.age * 0.09) * 0.05 + 0.05;
    u.armL.rotation.z = sway;
    u.armR.rotation.z = -sway;
    model.rotation.z = 0;
  } else if (sprinting) {
    // (sem posição: prévia do inventário e jogadores sem histórico) corrida do skinview3d
    const rt = t * 1.5 + Math.PI * 0.5;
    u.legL.rotation.x = fastCos(rt + Math.PI) * 1.3;
    u.legR.rotation.x = fastCos(rt) * 1.3;
    u.armL.rotation.x = fastCos(rt) * 1.5;
    u.armR.rotation.x = fastCos(rt + Math.PI) * 1.5;
    const runArmZ = Math.PI * 0.1;
    u.armL.rotation.z = fastCos(rt) * 0.1 + runArmZ;
    u.armR.rotation.z = fastCos(rt + Math.PI) * 0.1 - runArmZ;
    model.rotation.z = fastCos(rt + Math.PI) * 0.01;
  } else if (walking) {
    const amp = Math.min(1, spd / 5);
    u.legL.rotation.x = fastSin(t) * 0.5 * amp;
    u.legR.rotation.x = fastSin(t + Math.PI) * 0.5 * amp;
    u.armR.rotation.x = fastSin(t) * 0.5 * amp;
    u.armL.rotation.x = fastSin(t + Math.PI) * 0.5 * amp;
    u.armL.rotation.z = fastCos(t) * 0.03 + basicArmRotationZ;
    u.armR.rotation.z = fastCos(t + Math.PI) * 0.03 - basicArmRotationZ;
    model.rotation.z = 0;
  } else {
    u.legL.rotation.x = 0;
    u.legR.rotation.x = 0;
    u.armL.rotation.x = 0;
    u.armR.rotation.x = 0;
    u.armL.rotation.z = fastCos(t) * 0.03 + basicArmRotationZ;
    u.armR.rotation.z = fastCos(t + Math.PI) * 0.03 - basicArmRotationZ;
    model.rotation.z = 0;
  }

  // === Agachar (ModelBiped.isSneak do 1.8.9): o tronco, a cabeça e os braços inclinam 0,5 rad para frente em volta do quadril, os braços
  // pendem mais 0,4 rad e o corpo desce; na hora, sem animação (o 1.8.9 também não anima o agachar). Posições-base são guardadas ao entrar
  // no agachar e devolvidas ao sair (a pose normal não mexe em posição).
  if (u.body) {
    const parts = { head: u.head, body: u.body, armL: u.armL, armR: u.armR };
    if (sneaking) {
      if (!u._sneakBase) {
        u._sneakBase = {};
        for (const k in parts) u._sneakBase[k] = parts[k].position.clone();
      }
      const th = 0.5, c = Math.cos(th), sn = Math.sin(th), hipY = -12;
      for (const k in parts) {
        const b0 = u._sneakBase[k];
        const ry = b0.y - hipY, rz = b0.z;
        parts[k].position.set(b0.x, hipY + ry * c - rz * sn - 1, rz * c + ry * sn);   // gira em volta do quadril; -1 px: o corpo desce um pouco
        parts[k].rotation.x += th;
      }
      u.armL.rotation.x += 0.4; u.armR.rotation.x += 0.4;
    } else if (u._sneakBase) {
      for (const k in parts) parts[k].position.copy(u._sneakBase[k]);
      u._sneakBase = null;
    }
  }

  // === Segurando item: o braço direito sobe ~18° para a frente (ModelBiped.heldItemRight: armR.x = armR.x*0.5 - π/10) ===
  if (u.heldHolder && u.heldHolder.children.length) u.armR.rotation.x = u.armR.rotation.x * 0.5 - Math.PI / 10;

  // === Estados de ação (sobrepõe a locomoção do braço direito) ===
  if (anim.blocking) {
    u.armR.rotation.x = -Math.PI / 3;
    u.armR.rotation.z = -Math.PI / 6;
  } else if (anim.bowDrawing) {
    u.armR.rotation.x = -Math.PI / 2 + anim.bowCharge * 0.3;
    u.armL.rotation.x = -Math.PI / 2 - anim.bowCharge * 0.3;
    u.armR.rotation.z = 0; u.armL.rotation.z = 0;
  } else if (anim.eating) {
    const bob = fastSin(time * 1.5) * 0.1;
    u.armR.rotation.x = -Math.PI / 2 + bob;
  } else if (anim.isSwinging) {
    const sp = Math.min(1, Math.max(0, (anim.prevSwingProgress ?? anim.swingProgress) + (anim.swingProgress - (anim.prevSwingProgress ?? anim.swingProgress)) * pt));
    const swingAngle = fastSin(sp * Math.PI) * 1.5;
    u.armR.rotation.x = -swingAngle;
    u.armR.rotation.z = 0;
  }

  // === Capa: repouso a 10,8° e levanta com a velocidade horizontal e com a queda ===
  if (u.cape && u.cape.visible) {
    const vel = player.vel || { x: 0, y: 0, z: 0 };
    const spd = Math.hypot(vel.x, vel.z);
    const base = (10.8 * Math.PI) / 180;
    const flare = Math.min(1, spd / 7) * 0.55 + Math.min(1, Math.max(0, -vel.y) / 8) * 1.1;
    const target = base + flare;
    u.cape.rotation.x += (target - u.cape.rotation.x) * 0.15;
  }

  // === Cabeça: segue pitch + head bobbing ao andar (skinview3d) ===
  if (u.head) {
    u.head.rotation.y = limb ? 0 : (walking ? fastSin(t / 4) * 0.2 : 0);   // o 1.8.9 não balança a cabeça ao andar
    u.head.rotation.x = player.pitch + (limb ? 0 : (walking ? fastSin(t / 5) * 0.1 : 0)) + (sneaking ? 0.5 : 0);   // agachado a cabeça acompanha a inclinação do tronco
  }
}

const _tfCached = { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, scale: 1 };

// === Calcula transformação da mão em 1ª pessoa (Minecraft 1.8.9 ItemRenderer) ===
export function getFirstPersonTransform(anim, player, itemDef, time, partialTick = 0) {
  const DEG = Math.PI / 180;
  const pt = Math.min(1, Math.max(0, partialTick));

  // 1. Vetores Base de Translação (ItemRenderer 1.8.9)
  let x = 0.56, y = -0.52, z = -0.60;

  // 2. Ângulos de Rotação Base (Yaw = +45.0°, Pitch = 0.0°, Roll = 0.0°)
  let rotX = 0, rotY = 45.0 * DEG, rotZ = 0;
  let scale = 1;

  // 4. Progresso de Equipar/Desequipar (Equip Progress e: 0..1)
  const ep = Math.min(1, Math.max(0, (anim.prevEquipProgress ?? anim.equipProgress) + (anim.equipProgress - (anim.prevEquipProgress ?? anim.equipProgress)) * pt));
  y -= (1.0 - ep) * 0.6;

  // Bobbing da caminhada (ItemRenderer transformFirstPersonItem 1.8.9)
  const spd = anim.speed;
  if (spd > 0.05) {
    const fSpd = Math.min(1, spd / 5);
    const p = (anim.prevWalkPhase ?? anim.walkPhase) + (anim.walkPhase - (anim.prevWalkPhase ?? anim.walkPhase)) * pt;
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
    const s = Math.min(1, Math.max(0, (anim.prevSwingProgress ?? anim.swingProgress) + (anim.swingProgress - (anim.prevSwingProgress ?? anim.swingProgress)) * pt));
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