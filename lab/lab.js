// Laboratório: valida modelo, mão em 1ª pessoa e grama com o MESMO código do jogo, sem carregar mapa.
import * as THREE from 'three';
import { buildPlayerModel, applyPackSkin, placePlayerModel } from '/src/game/playerModel.js';
import { buildHandRig, poseHand } from '/src/game/firstPersonHand.js';
import { createAnimationState, tickAnimation, applyThirdPersonPose, startSwing } from '/src/game/animation.js';
import { lookDirFromAngles } from '/src/game/viewMath.js';
import { loadPack } from '/src/game/pack.js';

const $ = (id) => document.getElementById(id);
// ?view=f5|hand|grass mostra só um painel, em tamanho grande
const only = new URLSearchParams(location.search).get('view');
if (only) {
  const views = { f5: 'cv-f5', hand: 'cv-hand', grass: 'cv-grass' };
  document.querySelectorAll('.view').forEach((v) => { if (v.querySelector('canvas').id !== views[only]) v.style.display = 'none'; else v.style.minHeight = '70vh'; });
  document.querySelector('.views').style.gridTemplateColumns = '1fr';
}
const out = $('out');
const DEG = Math.PI / 180;

// ===== Estado simulado do jogador =====
const player = {
  pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 },
  yaw: 0, pitch: 0, sprinting: false, sneaking: false, selectedSlot: 0, hurtTime: 0, isDead: false,
};
const anim = createAnimationState();
const ui = { gDist: 4, gAng: 30, gPitch: 40, yawDeg: 0, pitchDeg: 0, speed: 0, perspective: 1, walkAuto: true, heldItem: false, bob: true };

// ===== Painel =====
const panel = $('panel');
function addSlider(label, key, min, max, step, onChange) {
  const row = document.createElement('label');
  const v = document.createElement('span');
  row.innerHTML = `<span>${label}</span>`;
  const inp = document.createElement('input');
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = ui[key];
  const upd = () => { ui[key] = parseFloat(inp.value); v.textContent = ui[key]; onChange && onChange(); };
  inp.addEventListener('input', upd);
  row.append(inp, v); v.textContent = ui[key]; panel.append(row);
}
function addCheck(label, key, onChange) {
  const row = document.createElement('label'); row.className = 'chk';
  const c = document.createElement('input'); c.type = 'checkbox'; c.checked = ui[key];
  c.addEventListener('change', () => { ui[key] = c.checked; onChange && onChange(); });
  row.append(c, document.createTextNode(label)); panel.append(row);
}
function addBtn(label, fn, alt) {
  const b = document.createElement('button'); b.textContent = label; if (alt) b.className = 'alt';
  b.addEventListener('click', fn); panel.append(b);
}
function h3(t) { const e = document.createElement('h3'); e.textContent = t; panel.append(e); }

h3('Jogador');
addSlider('yaw (°)', 'yawDeg', -180, 180, 1);
addSlider('pitch (°)', 'pitchDeg', -89, 89, 1);
addSlider('velocidade', 'speed', 0, 6, 0.1);
addCheck('correndo', 'sprint', () => { player.sprinting = ui.sprint; });
addCheck('agachado', 'sneak', () => { player.sneaking = ui.sneak; });
addBtn('golpe (swing)', () => startSwing(anim));
addBtn('hurtTime = 10', () => { player.hurtTime = 10; }, true);
h3('Câmera F5');
addSlider('modo (1 trás, 2 frente)', 'perspective', 1, 2, 1);
h3('Mão 1ª pessoa');
addCheck('segurando item', 'heldItem');
h3('Grama');
addSlider('distância', 'gDist', 1.5, 40, 0.5);
addSlider('ângulo (°)', 'gAng', -180, 180, 1);
addSlider('inclinação (°)', 'gPitch', 5, 89, 1);
h3('Verificações');
addBtn('rodar verificações', () => runChecks(), true);

// ===== Renderers =====
function mkRenderer(id) {
  const canvas = $(id);
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  return r;
}
const rF5 = mkRenderer('cv-f5'), rHand = mkRenderer('cv-hand'), rGrass = mkRenderer('cv-grass');
function fit(r, cam) {
  const c = r.domElement, w = c.parentElement.clientWidth, h = c.parentElement.clientHeight;
  if (c.width !== w || c.height !== h) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
}

// ===== Cena F5 =====
const sceneF5 = new THREE.Scene();
sceneF5.background = new THREE.Color(0x7aa6d8);
sceneF5.add(new THREE.AmbientLight(0xffffff, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(2, 5, 3); sceneF5.add(sun);
const grid = new THREE.GridHelper(8, 16, 0x223, 0x445); sceneF5.add(grid);
const camF5 = new THREE.PerspectiveCamera(70, 1, 0.05, 100);
const model = buildPlayerModel(); model.visible = true; sceneF5.add(model);
const lookArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1.4, 0x00e5ff, 0.25, 0.15);
sceneF5.add(lookArrow);
// Eixos: X vermelho, Z azul
sceneF5.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-3, 0.01, -3), 1, 0xff4444, 0.15, 0.1));
sceneF5.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-3, 0.01, -3), 1, 0x4466ff, 0.15, 0.1));

// ===== Cena da mão =====
const sceneHand = new THREE.Scene();
sceneHand.background = new THREE.Color(0x8fb4e8);
sceneHand.add(new THREE.AmbientLight(0xffffff, 1.0));
const camHand = new THREE.PerspectiveCamera(70, 1, 0.05, 10);
const handRig = buildHandRig();
const fpsArm = handRig.arm; sceneHand.add(fpsArm, handRig.itemRoot);
const fpsItemGroup = handRig.itemGroup;
const itemMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), new THREE.MeshBasicMaterial({ color: 0xc0a060 }));
itemMesh.rotation.set(0.4, 0, 0.2);
fpsItemGroup.add(itemMesh);

// ===== Cena da grama (preenchida por grass.js) =====
const sceneGrass = new THREE.Scene();
sceneGrass.background = new THREE.Color(0x7aa6d8);
const camGrass = new THREE.PerspectiveCamera(50, 1, 0.05, 100);
camGrass.position.set(1.6, 1.4, 2.4); camGrass.lookAt(0.5, 0.4, 0.5);
const grassApi = { ready: false, update() {} };
import('/lab/grass.js').then((m) => m.setup(sceneGrass, camGrass, rGrass, grassApi)).catch((e) => log(`<span class="bad">grama: ${e.message}</span>`));

// ===== Loop 20 TPS + render =====
let last = performance.now(), acc = 0;
function tick() {
  player.yaw = ui.yawDeg * DEG; player.pitch = ui.pitchDeg * DEG;
  const spd = ui.speed;
  player.vel.x = spd; player.vel.z = 0;
  if (player.hurtTime > 0) player.hurtTime--;
  tickAnimation(anim, player, performance.now() / 1000);
}
function frame(now) {
  acc += now - last; last = now;
  let n = 0;
  while (acc >= 50 && n++ < 5) { tick(); acc -= 50; }

  // F5
  placePlayerModel(model, player.pos, player.yaw);
  applyThirdPersonPose(model, anim, player, now / 1000);
  const eye = { x: 0, y: 1.62, z: 0 };
  const dir = lookDirFromAngles(player.yaw, player.pitch);
  lookArrow.position.set(eye.x, eye.y, eye.z);
  lookArrow.setDirection(new THREE.Vector3(dir.x, dir.y, dir.z).normalize());
  const mult = ui.perspective === 1 ? -1 : 1;
  camF5.position.set(eye.x + dir.x * 4 * mult, eye.y + dir.y * 4 * mult, eye.z + dir.z * 4 * mult);
  camF5.lookAt(eye.x, eye.y, eye.z);
  fit(rF5, camF5); rF5.render(sceneF5, camF5);

  // Mão
  poseHand(handRig, anim, player, null, ui.heldItem, now / 1000 / 20);
  fit(rHand, camHand); rHand.render(sceneHand, camHand);

  // Grama
  grassApi.update(now);
  fit(rGrass, camGrass); rGrass.render(sceneGrass, camGrass);

  requestAnimationFrame(frame);
}

// ===== Verificações automáticas =====
function log(html) { out.innerHTML += html + '\n'; }
function runChecks() {
  out.innerHTML = '';
  const res = {};
  // 1) O modelo encara a direção em que o jogador olha?
  const rows = [];
  let allOk = true;
  const saved = { yaw: player.yaw, pitch: player.pitch };
  for (const deg of [0, 45, 90, 135, 180, -90, -135]) {
    placePlayerModel(model, player.pos, deg * DEG);
    model.updateMatrixWorld(true);
    const o = new THREE.Vector3(0, 0, 0).applyMatrix4(model.matrixWorld);
    const f = new THREE.Vector3(0, 0, 1).applyMatrix4(model.matrixWorld).sub(o).normalize(); // "frente" do modelo
    const d = lookDirFromAngles(deg * DEG, 0);
    const dot = f.x * d.x + f.z * d.z;
    const ok = dot > 0.999; allOk = allOk && ok;
    rows.push(`  yaw ${String(deg).padStart(4)}°  frente do modelo (${f.x.toFixed(2)}, ${f.z.toFixed(2)})  olhar (${d.x.toFixed(2)}, ${d.z.toFixed(2)})  ${ok ? '<span class="ok">OK</span>' : '<span class="bad">VIRADO</span>'}`);
  }
  player.yaw = saved.yaw;
  log(`F5: modelo encara a direção do olhar? ${allOk ? '<span class="ok">SIM</span>' : '<span class="bad">NÃO</span>'}`);
  rows.forEach(log);
  res.facing = allOk;
  // 2) Mão em 1ª pessoa (braço vazio): ombro fora da tela, mão visível no canto inferior direito, braço apontando para frente e para cima
  ui.heldItem = false; anim.equipProgress = 1; anim.targetEquip = 1; anim.isSwinging = false; anim.speed = 0;
  poseHand(handRig, anim, player, null, false, 0);
  fpsArm.updateMatrixWorld(true); camHand.updateMatrixWorld(true);
  const shoulder = new THREE.Vector3(-6 / 16, 0, 0).applyMatrix4(fpsArm.matrixWorld);
  const tip = new THREE.Vector3(-6 / 16, 12 / 16, 0).applyMatrix4(fpsArm.matrixWorld);
  const axis = tip.clone().sub(shoulder).normalize();
  const tipNdc = tip.clone().project(camHand);
  const handOk = axis.z < -0.5 && axis.y > 0.2 && tipNdc.x > 0 && tipNdc.x < 1 && tipNdc.y > -1 && tipNdc.y < 0.2;
  log(`Mão: eixo ombro→mão (${axis.x.toFixed(2)}, ${axis.y.toFixed(2)}, ${axis.z.toFixed(2)})  ponta na tela (x ${tipNdc.x.toFixed(2)}, y ${tipNdc.y.toFixed(2)})  ${handOk ? '<span class="ok">aponta para frente/cima, ponta visível à direita</span>' : '<span class="bad">pose errada</span>'}`);
  res.hand = handOk;
  window.__labResult = res;
  return res;
}
window.__lab = { runChecks, player, anim, ui, model, fpsArm, camHand, THREE };

(async () => {
  log('carregando pack de texturas…');
  try { const ok = await loadPack(); await applyPackSkin(model, fpsArm); log(ok ? 'pack ok' : 'pack indisponível (skin padrão)'); } catch (e) { log('pack: ' + e.message); }
  runChecks();
  requestAnimationFrame(frame);
})();
