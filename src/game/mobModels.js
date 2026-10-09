// Modelos procedurais de mobs (cubos) — PRD 08 RF-040/041
import * as THREE from 'three';

const _geoCache = new Map();
const _matCache = new Map();

function getSharedBoxGeometry(w, h, d) {
  const key = `${w}_${h}_${d}`;
  let geo = _geoCache.get(key);
  if (!geo) {
    geo = new THREE.BoxGeometry(w, h, d);
    _geoCache.set(key, geo);
  }
  return geo;
}

function getSharedBasicMaterial(color) {
  let mat = _matCache.get(color);
  if (!mat) {
    mat = new THREE.MeshBasicMaterial({ color });
    _matCache.set(color, mat);
  }
  return mat;
}

function box(w, h, d, color) {
  return new THREE.Mesh(getSharedBoxGeometry(w, h, d), getSharedBasicMaterial(color));
}
function limb(w, h, d, color) {
  const g = new THREE.Group();
  const m = box(w, h, d, color);
  m.position.y = -h / 2;
  g.add(m);
  return g;
}

// === Bípede (zumbi, esqueleto) ===
function buildBiped(skin, shirt, pants, opts = {}) {
  const g = new THREE.Group();
  const head = box(0.5, 0.5, 0.5, skin); head.position.y = 1.5; g.add(head);
  const body = box(0.5, 0.75, 0.25, shirt); body.position.y = 0.87; g.add(body);
  const legL = limb(0.25, 0.75, 0.25, pants); legL.position.set(-0.13, 0.5, 0); g.add(legL);
  const legR = limb(0.25, 0.75, 0.25, pants); legR.position.set(0.13, 0.5, 0); g.add(legR);
  const armL = limb(0.25, 0.75, 0.25, skin); armL.position.set(-0.38, 1.25, 0); g.add(armL);
  const armR = limb(0.25, 0.75, 0.25, skin); armR.position.set(0.38, 1.25, 0); g.add(armR);
  if (opts.armsForward) { armL.rotation.x = -Math.PI / 2; armR.rotation.x = -Math.PI / 2; }
  if (opts.armsBow) { armL.rotation.x = -Math.PI / 2 + 0.3; armR.rotation.x = -Math.PI / 2 - 0.3; }
  g.userData = { head, body, armL, armR, legL, legR, type: 'biped' };
  return g;
}

// === Quadrúpede (porco, vaca, ovelha, lobo) ===
function buildQuadruped(bodyColor, headColor, w, h, len) {
  const g = new THREE.Group();
  const body = box(w, h, len, bodyColor); body.position.y = 0.7; g.add(body);
  const head = box(0.4, 0.4, 0.4, headColor); head.position.set(0, 0.7, len / 2 + 0.15); g.add(head);
  const fl = limb(0.18, 0.5, 0.18, bodyColor); fl.position.set(-w/2+0.1, 0.45, len/2-0.2); g.add(fl);
  const fr = limb(0.18, 0.5, 0.18, bodyColor); fr.position.set(w/2-0.1, 0.45, len/2-0.2); g.add(fr);
  const bl = limb(0.18, 0.5, 0.18, bodyColor); bl.position.set(-w/2+0.1, 0.45, -len/2+0.2); g.add(bl);
  const br = limb(0.18, 0.5, 0.18, bodyColor); br.position.set(w/2-0.1, 0.45, -len/2+0.2); g.add(br);
  g.userData = { head, body, fl, fr, bl, br, type: 'quadruped' };
  return g;
}

// === Creeper ===
function buildCreeper() {
  const g = new THREE.Group();
  const c = 0x4ac040;
  const body = box(0.6, 1.2, 0.4, c); body.position.y = 1.0; g.add(body);
  const head = box(0.5, 0.5, 0.5, c); head.position.y = 1.85; g.add(head);
  const fl = limb(0.25, 0.4, 0.25, c); fl.position.set(-0.15, 0.2, 0.15); g.add(fl);
  const fr = limb(0.25, 0.4, 0.25, c); fr.position.set(0.15, 0.2, 0.15); g.add(fr);
  const bl = limb(0.25, 0.4, 0.25, c); bl.position.set(-0.15, 0.2, -0.15); g.add(bl);
  const br = limb(0.25, 0.4, 0.25, c); br.position.set(0.15, 0.2, -0.15); g.add(br);
  g.userData = { head, body, fl, fr, bl, br, type: 'creeper' };
  return g;
}

// === Aranha ===
function buildSpider() {
  const g = new THREE.Group();
  const c = 0x2a2a2a;
  const body = box(1.0, 0.5, 0.6, c); body.position.y = 0.55; g.add(body);
  const head = box(0.5, 0.5, 0.5, c); head.position.set(0, 0.55, 0.55); g.add(head);
  const legs = [];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const idx = i % 4;
    const leg = limb(0.12, 0.5, 0.12, c);
    leg.position.set(side * 0.5, 0.45, 0.3 - idx * 0.2);
    leg.rotation.z = side * 0.5;
    g.add(leg); legs.push(leg);
  }
  g.userData = { head, body, legs, type: 'spider' };
  return g;
}

// === Slime ===
function buildSlime(color) {
  const g = new THREE.Group();
  const outer = box(0.5, 0.5, 0.5, color || 0x60c060);
  outer.material.transparent = true; outer.material.opacity = 0.7;
  outer.position.y = 0.25; g.add(outer);
  const inner = box(0.2, 0.2, 0.2, 0x40a040); inner.position.y = 0.25; g.add(inner);
  g.userData = { body: outer, inner, type: 'slime' };
  return g;
}

// === Galinha ===
function buildChicken() {
  const g = new THREE.Group();
  const c = 0xf0f0f0;
  const body = box(0.3, 0.3, 0.4, c); body.position.y = 0.45; g.add(body);
  const head = box(0.2, 0.2, 0.2, c); head.position.set(0, 0.65, 0.15); g.add(head);
  const wingL = limb(0.05, 0.25, 0.3, c); wingL.position.set(-0.18, 0.45, 0); g.add(wingL);
  const wingR = limb(0.05, 0.25, 0.3, c); wingR.position.set(0.18, 0.45, 0); g.add(wingR);
  const legL = limb(0.04, 0.2, 0.04, 0xf0a020); legL.position.set(-0.08, 0.1, 0); g.add(legL);
  const legR = limb(0.04, 0.2, 0.04, 0xf0a020); legR.position.set(0.08, 0.1, 0); g.add(legR);
  g.userData = { head, body, wingL, wingR, legL, legR, type: 'chicken' };
  return g;
}

// === Morcego ===
function buildBat() {
  const g = new THREE.Group();
  const c = 0x4a3a3a;
  const body = box(0.3, 0.3, 0.3, c); body.position.y = 0.15; g.add(body);
  const head = box(0.2, 0.2, 0.2, c); head.position.set(0, 0.3, 0.05); g.add(head);
  const wingL = limb(0.05, 0.05, 0.4, c); wingL.position.set(-0.2, 0.2, 0); g.add(wingL);
  const wingR = limb(0.05, 0.05, 0.4, c); wingR.position.set(0.2, 0.2, 0); g.add(wingR);
  g.userData = { head, body, wingL, wingR, type: 'bat' };
  return g;
}

// === Enderman ===
function buildEnderman() {
  const g = new THREE.Group();
  const c = 0x1a1a2a;
  const head = box(0.5, 0.5, 0.5, c); head.position.y = 2.5; g.add(head);
  // Olhos roxos
  const eyeL = box(0.1, 0.1, 0.02, 0xcc00ff); eyeL.position.set(-0.12, 2.55, 0.26); g.add(eyeL);
  const eyeR = box(0.1, 0.1, 0.02, 0xcc00ff); eyeR.position.set(0.12, 2.55, 0.26); g.add(eyeR);
  const body = box(0.6, 1.5, 0.3, c); body.position.y = 1.4; g.add(body);
  const armL = limb(0.2, 1.2, 0.2, c); armL.position.set(-0.45, 2.1, 0); g.add(armL);
  const armR = limb(0.2, 1.2, 0.2, c); armR.position.set(0.45, 2.1, 0); g.add(armR);
  const legL = limb(0.25, 1.0, 0.25, c); legL.position.set(-0.15, 0.9, 0); g.add(legL);
  const legR = limb(0.25, 1.0, 0.25, c); legR.position.set(0.15, 0.9, 0); g.add(legR);
  g.userData = { head, body, armL, armR, legL, legR, eyeL, eyeR, type: 'enderman' };
  return g;
}

// === Bruxa ===
function buildWitch() {
  const g = new THREE.Group();
  buildBiped(0xd0a080, 0x4a2a4a, 0x2a1a2a);
  const biped = buildBiped(0xd0a080, 0x4a2a4a, 0x2a1a2a);
  for (const child of biped.children) g.add(child);
  g.userData = biped.userData;
  // Chapéu
  const hat = box(0.4, 0.4, 0.4, 0x1a1a2a); hat.position.y = 1.9; g.add(hat);
  g.userData.hat = hat;
  return g;
}

// === Factory ===
const BUILDERS = {
  zombie: () => buildBiped(0x4a7a3a, 0x3a6a9a, 0x2a2a3a, { armsForward: true }),
  skeleton: () => buildBiped(0xe0e0e0, 0xc0c0c0, 0xc0c0c0, { armsBow: true }),
  creeper: buildCreeper,
  spider: buildSpider,
  slime: () => buildSlime(0x60c060),
  enderman: buildEnderman,
  witch: buildWitch,
  pig: () => buildQuadruped(0xf0a0a0, 0xf0a0a0, 0.5, 0.5, 0.9),
  cow: () => buildQuadruped(0x4a3a2a, 0x4a3a2a, 0.6, 0.7, 1.0),
  sheep: () => buildQuadruped(0xeeeeee, 0xeeeeee, 0.6, 0.6, 0.9),
  chicken: buildChicken,
  wolf: () => buildQuadruped(0xaaaaaa, 0xaaaaaa, 0.4, 0.5, 0.8),
  bat: buildBat,
};

export function buildMobModel(mobType) {
  const builder = BUILDERS[mobType];
  if (!builder) return buildQuadruped(0x888888, 0x888888, 0.6, 0.6, 0.8);
  const g = builder();
  g.visible = false;
  return g;
}

// === Animação procedural (RF-041) ===
export function animateMobModel(model, mob, time) {
  if (!model || !model.userData) return;
  const u = model.userData;
  const spd = Math.hypot(mob.vel.x, mob.vel.z);
  const t = time * 0.15;
  const amp = Math.min(1, spd / 0.3);
  const sw = Math.sin(t) * amp;

  if (mob.isDead) {
    model.rotation.z = Math.PI / 2;
    return;
  }
  model.rotation.z = 0;

  if (u.type === 'biped') {
    u.legL.rotation.x = -sw * 0.8;
    u.legR.rotation.x = sw * 0.8;
    if (mob.type.armsForward || (u.armL.rotation.x < -1 && u.armL.rotation.x > -3)) {
      u.armL.rotation.x = -Math.PI / 2 + sw * 0.3;
      u.armR.rotation.x = -Math.PI / 2 - sw * 0.3;
    } else {
      u.armL.rotation.x = -sw * 0.8;
      u.armR.rotation.x = sw * 0.8;
    }
    if (u.head) { u.head.rotation.y = mob.headYaw || 0; u.head.rotation.x = mob.headPitch || 0; }
  } else if (u.type === 'quadruped') {
    u.fl.rotation.x = -sw * 0.8;
    u.br.rotation.x = -sw * 0.8;
    u.fr.rotation.x = sw * 0.8;
    u.bl.rotation.x = sw * 0.8;
    if (u.head) u.head.rotation.x = mob.headPitch || 0;
  } else if (u.type === 'creeper') {
    u.fl.rotation.x = -sw * 0.5;
    u.fr.rotation.x = sw * 0.5;
    u.bl.rotation.x = sw * 0.5;
    u.br.rotation.x = -sw * 0.5;
    // Inflar
    if (mob.swelling > 0) {
      const s = 1 + Math.sin(time * 0.5) * 0.1 * mob.swelling;
      model.scale.set(s, s, s);
    } else {
      model.scale.set(1, 1, 1);
    }
  } else if (u.type === 'spider') {
    if (u.legs) {
      for (let i = 0; i < u.legs.length; i++) {
        const phase = i % 2 === 0 ? t : -t;
        u.legs[i].rotation.y = Math.sin(phase) * 0.3;
      }
    }
  } else if (u.type === 'slime') {
    const sq = 1 + Math.sin(t * 2) * 0.15 * amp;
    model.scale.set(sq, 2 - sq, sq);
  } else if (u.type === 'chicken') {
    u.legL.rotation.x = -sw * 0.8;
    u.legR.rotation.x = sw * 0.8;
    const wingFlap = mob.vel.y < -0.1 ? Math.sin(time * 1.0) : Math.sin(t) * 0.2;
    u.wingL.rotation.z = wingFlap * 0.5;
    u.wingR.rotation.z = -wingFlap * 0.5;
    if (u.head) u.head.rotation.x = mob.headPitch || 0;
  } else if (u.type === 'bat') {
    const flap = Math.sin(time * 0.8);
    u.wingL.rotation.z = flap * 0.8;
    u.wingR.rotation.z = -flap * 0.8;
  } else if (u.type === 'enderman') {
    u.legL.rotation.x = -sw * 0.5;
    u.legR.rotation.x = sw * 0.5;
    u.armL.rotation.x = -sw * 0.4;
    u.armR.rotation.x = sw * 0.4;
    if (u.head) { u.head.rotation.y = mob.headYaw || 0; u.head.rotation.x = mob.headPitch || 0; }
  }
}