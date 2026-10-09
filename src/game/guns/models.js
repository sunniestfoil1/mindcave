// Modelos procedurais de armas (voxels) — PRD 09 RF-040..042
import * as THREE from 'three';

function box(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
}

const COLORS = {
  iron: 0x3a3a3a, ironLight: 0x5a5a5a, ironDark: 0x222222,
  wood: 0x6b4226, woodDark: 0x4a2e18,
  gold: 0xd4a830, black: 0x111111, glass: 0x88aacc,
};

// === Pistola ===
function buildPistol() {
  const g = new THREE.Group();
  const slide = box(0.06, 0.06, 0.22, COLORS.ironDark); slide.position.set(0, 0, 0.02); g.add(slide);
  const barrel = box(0.04, 0.04, 0.08, COLORS.iron); barrel.position.set(0, 0.01, -0.12); g.add(barrel);
  const grip = box(0.05, 0.14, 0.06, COLORS.iron); grip.position.set(0, -0.09, 0.08); grip.rotation.x = 0.15; g.add(grip);
  const trigger = box(0.02, 0.03, 0.02, COLORS.ironLight); trigger.position.set(0, -0.03, 0.06); g.add(trigger);
  g.userData = { type: 'pistol', barrel, slide, grip };
  return g;
}

// === Escopeta ===
function buildShotgun() {
  const g = new THREE.Group();
  const barrel1 = box(0.04, 0.04, 0.4, COLORS.ironDark); barrel1.position.set(-0.03, 0.02, -0.1); g.add(barrel1);
  const barrel2 = box(0.04, 0.04, 0.4, COLORS.ironDark); barrel2.position.set(0.03, 0.02, -0.1); g.add(barrel2);
  const pump = box(0.1, 0.05, 0.1, COLORS.wood); pump.position.set(0, -0.03, -0.05); g.add(pump);
  const body = box(0.06, 0.06, 0.2, COLORS.iron); body.position.set(0, 0, 0.08); g.add(body);
  const stock = box(0.05, 0.1, 0.16, COLORS.wood); stock.position.set(0, -0.04, 0.2); stock.rotation.x = -0.1; g.add(stock);
  g.userData = { type: 'shotgun', barrel1, barrel2, pump, body, stock };
  return g;
}

// === Rifle de ferrolho ===
function buildBoltRifle() {
  const g = new THREE.Group();
  const barrel = box(0.035, 0.035, 0.5, COLORS.ironDark); barrel.position.set(0, 0.02, -0.15); g.add(barrel);
  const body = box(0.05, 0.07, 0.25, COLORS.iron); body.position.set(0, 0, 0.08); g.add(body);
  const bolt = box(0.03, 0.05, 0.05, COLORS.ironLight); bolt.position.set(0, 0.05, 0.12); g.add(bolt);
  const scope = box(0.03, 0.04, 0.12, COLORS.black); scope.position.set(0, 0.08, 0.05); g.add(scope);
  const scopeLens = box(0.025, 0.025, 0.01, COLORS.glass); scopeLens.position.set(0, 0.08, -0.01); g.add(scopeLens);
  const stock = box(0.05, 0.1, 0.2, COLORS.wood); stock.position.set(0, -0.03, 0.22); stock.rotation.x = -0.05; g.add(stock);
  const grip = box(0.05, 0.08, 0.05, COLORS.wood); grip.position.set(0, -0.07, 0.12); grip.rotation.x = 0.2; g.add(grip);
  g.userData = { type: 'bolt_rifle', barrel, body, bolt, scope, stock, grip };
  return g;
}

// === Carabina ===
function buildCarbine() {
  const g = new THREE.Group();
  const barrel = box(0.03, 0.03, 0.35, COLORS.ironDark); barrel.position.set(0, 0.02, -0.12); g.add(barrel);
  const body = box(0.05, 0.06, 0.2, COLORS.iron); body.position.set(0, 0, 0.08); g.add(body);
  const mag = box(0.04, 0.1, 0.05, COLORS.ironDark); mag.position.set(0, -0.08, 0.06); g.add(mag);
  const stock = box(0.04, 0.08, 0.15, COLORS.iron); stock.position.set(0, -0.02, 0.2); g.add(stock);
  const grip = box(0.04, 0.08, 0.04, COLORS.ironDark); grip.position.set(0, -0.07, 0.1); grip.rotation.x = 0.2; g.add(grip);
  const handguard = box(0.045, 0.04, 0.12, COLORS.ironLight); handguard.position.set(0, 0, -0.05); g.add(handguard);
  g.userData = { type: 'carbine', barrel, body, mag, stock, grip, handguard };
  return g;
}

// === Granada ===
function buildGrenade() {
  const g = new THREE.Group();
  const body = box(0.08, 0.1, 0.08, 0x4a5a3a); body.position.y = 0; g.add(body);
  const top = box(0.04, 0.03, 0.04, COLORS.ironDark); top.position.y = 0.07; g.add(top);
  const pin = box(0.01, 0.01, 0.05, COLORS.ironLight); pin.position.set(0, 0.09, 0.03); g.add(pin);
  g.userData = { type: 'grenade', body, top, pin };
  return g;
}

const BUILDERS = {
  pistol: buildPistol,
  shotgun: buildShotgun,
  bolt_rifle: buildBoltRifle,
  carbine: buildCarbine,
  grenade: buildGrenade,
};

export function buildGunModel(gunKey) {
  const builder = BUILDERS[gunKey];
  if (!builder) return new THREE.Group();
  return builder();
}

// Aplicar acessórios ao modelo (visual)
export function applyAccessoriesToModel(model, accessories) {
  if (!model || !accessories) return;
  // Silenciador
  if (accessories.silencer) {
    const sil = box(0.035, 0.035, 0.12, COLORS.ironDark);
    sil.position.set(0, 0.01, -0.2);
    model.add(sil);
  }
  // Mira telescópica
  if (accessories.scope) {
    const scope = box(0.025, 0.035, 0.1, COLORS.black);
    scope.position.set(0, 0.08, 0.05);
    model.add(scope);
  }
  // Lanterna
  if (accessories.tactical_light) {
    const light = box(0.03, 0.03, 0.04, COLORS.glass);
    light.position.set(0, 0, -0.15);
    model.add(light);
  }
}

// === Animação de arma em 1ª pessoa (RF-041) ===
// Retorna { x, y, z, rotX, rotY, rotZ } para a mão/modelo
export function getGunTransform(state, player, ads, anim, time) {
  const walking = Math.hypot(player.vel?.x || 0, player.vel?.z || 0) > 0.5;
  const sprinting = player.sprinting;
  const t = time;

  let x = 0.3, y = -0.25, z = -0.5;
  let rotX = 0, rotY = 0.1, rotZ = 0;

  // Bobbing ao andar
  if (walking && !ads) {
    const bp = t * 0.15;
    y += Math.sin(bp * 2) * 0.01;
    x += Math.sin(bp) * 0.005;
  }

  // Sprint: arma abaixada
  if (sprinting) {
    y -= 0.1;
    z += 0.05;
    rotX -= 0.3;
  }

  // ADS: alinha ao centro
  if (ads) {
    x = 0; y = -0.02; z = -0.3;
    rotY = 0; rotX = 0;
  }

  // Recuo (coice)
  if (state.recoilTime > 0) {
    const recoilProgress = state.recoilTime / state.maxRecoilTime;
    const kick = recoilProgress * 0.04;
    z += kick;
    rotX -= recoilProgress * (state.recoilV || 2) * 0.015;
  }

  // Swing (golpe de coronhada)
  if (anim.swingProgress > 0) {
    rotX -= anim.swingProgress * 0.8;
    y -= anim.swingProgress * 0.05;
  }

  return { x, y, z, rotX, rotY, rotZ };
}