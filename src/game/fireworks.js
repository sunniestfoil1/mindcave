// Fogos de artifício (1.8.9: EntityFireworkRocket + EntityFireworkSparkFX/Starter). O foguete sobe acelerando (vy += 0,04 e vx/vz ×1,15 por tick) soltando
// o rastro de faíscas brancas; ao fim da vida (10 × voo + sorteio) explode no formato do item — bola pequena, bola grande, estrela, creeper ou explosão —
// com as cores (e a cor de esmaecer) da estrela, rastro nas faíscas e o som de explosão que muda com a distância.
import * as THREE from 'three';
import { playEvent } from './sounds';
import { getPackCanvas, MC } from './pack';
import { FIREWORK_PRESETS } from './fireworkData';

const STAR = [[0, 1], [0.3455, 0.309], [0.9511, 0.309], [0.3795918, -0.12546], [0.6122449, -0.809017], [0, -0.35705], [-0.6122449, -0.809017], [-0.3795918, -0.12546], [-0.9511, 0.309], [-0.3455, 0.309]];
const CREEPER = [[0, 0.2], [0.2, 0.2], [0.2, 0.6], [0.6, 0.6], [0.6, 0.2], [0.2, 0.2], [0.2, 0], [0.4, 0], [0.4, -0.6], [0.2, -0.6], [0.2, -0.4], [0, -0.4]];
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255].map((v) => v / 255);

let _iconTex = null;
function iconTexture() {
  if (_iconTex) return _iconTex;
  const tex = new THREE.Texture(document.createElement('canvas'));
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  getPackCanvas(MC + 'textures/items/fireworks.png').then((cv) => { if (cv) { tex.image = cv; tex.needsUpdate = true; } }).catch(() => {});
  _iconTex = tex;
  return tex;
}

export class FireworkManager {
  constructor(scene, particles) {
    this.scene = scene;
    this.particles = particles;
    this.rockets = [];
    this.world = null;
  }

  // Solta um foguete em (x, y, z) com o preset (meta do item). Devolve o foguete.
  launch(x, y, z, presetIndex = 0, playerPos = null) {
    const preset = FIREWORK_PRESETS[presetIndex] || FIREWORK_PRESETS[0];
    const mat = new THREE.SpriteMaterial({ map: iconTexture(), transparent: true, depthWrite: false, fog: false, alphaTest: 0.1 });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.5, 0.5, 1);
    sprite.position.set(x, y, z);
    this.scene.add(sprite);
    const r = { x, y, z, vx: gauss() * 0.001, vy: 0.05, vz: gauss() * 0.001, age: 0, life: 10 * preset.flight + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 7), preset, sprite, playerPos };
    this.rockets.push(r);
    playEvent('entity.firework_rocket.launch', { pos: { x, y, z }, volume: 3 });
    return r;
  }

  tick() {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.vx *= 1.15; r.vz *= 1.15; r.vy += 0.04;
      r.x += r.vx; r.y += r.vy; r.z += r.vz;
      r.age++;
      r.sprite.position.set(r.x, r.y, r.z);
      // rastro branco: uma faísca por tick, caindo devagar atrás do foguete (FIREWORKS_SPARK)
      this.particles.spawnSpark(r.x, r.y - 0.3, r.z, gauss() * 0.05, -r.vy * 0.5, gauss() * 0.05, [0.96, 0.96, 0.92], { life: 26 + Math.floor(Math.random() * 6), size: 0.1 });
      if (r.age > r.life) {
        this.explode(r);
        this.scene.remove(r.sprite); r.sprite.material.dispose();
        this.rockets.splice(i, 1);
      }
    }
  }

  explode(r) {
    const ex = r.preset.ex;
    if (!ex) return;
    const dist = r.playerPos ? Math.hypot(r.playerPos.x - r.x, r.playerPos.y - r.y, r.playerPos.z - r.z) : 0;
    const far = dist >= 16;
    const large = ex.type === 1 || ex.type === 4;
    playEvent(`entity.firework_rocket.${large ? 'large_blast' : 'blast'}${far ? '_far' : ''}`, { pos: { x: r.x, y: r.y, z: r.z }, volume: far ? 20 : 20 });
    if (ex.twinkle) setTimeout(() => playEvent(`entity.firework_rocket.twinkle${far ? '_far' : ''}`, { pos: { x: r.x, y: r.y, z: r.z }, volume: 20 }), 200);
    const P = (vx, vy, vz) => this._spark(r, ex, vx, vy, vz);
    if (ex.type === 0) this._ball(0.25, 2, P);
    else if (ex.type === 1) this._ball(0.5, 4, P);
    else if (ex.type === 2) this._shape(0.5, STAR, false, P);
    else if (ex.type === 3) this._shape(0.5, CREEPER, true, P);
    else this._burst(r, P);
  }

  _spark(r, ex, vx, vy, vz) {
    const c = rgb(pick(ex.colors));
    const fade = ex.fade && ex.fade.length ? rgb(pick(ex.fade)) : null;
    this.particles.spawnSpark(r.x, r.y, r.z, vx, vy, vz, c, { life: 48 + Math.floor(Math.random() * 12), size: 0.16, fade, trail: ex.trail, grav: 0.004, drag: 0.91, dragY: true, twinkle: ex.twinkle });
  }

  // EntityFireworkStarterFX.createBall
  _ball(speed, size, P) {
    for (let j = -size; j <= size; j++) for (let k = -size; k <= size; k++) for (let l = -size; l <= size; l++) {
      const d3 = k + (Math.random() - Math.random()) * 0.5, d4 = j + (Math.random() - Math.random()) * 0.5, d5 = l + (Math.random() - Math.random()) * 0.5;
      const d6 = Math.sqrt(d3 * d3 + d4 * d4 + d5 * d5) / speed + Math.random() * 0.5;
      P(d3 / d6, d4 / d6, d5 / d6);
      if (j !== -size && j !== size && k !== -size && k !== size) l += size * 2 - 1;
    }
  }

  // createShaped: o contorno da forma (estrela/creeper) girado em três ângulos, espelhado dos dois lados
  _shape(speed, shape, flat, P) {
    P(shape[0][0] * speed, shape[0][1] * speed, 0);
    const f = Math.random() * Math.PI, d2 = flat ? 0.034 : 0.34;
    for (let i = 0; i < 3; i++) {
      const d3 = f + i * Math.PI * d2;
      let d4 = shape[0][0], d5 = shape[0][1];
      for (let j = 1; j < shape.length; j++) {
        const d6 = shape[j][0], d7 = shape[j][1];
        for (let d8 = 0.25; d8 <= 1.0; d8 += 0.25) {
          let d9 = (d4 + (d6 - d4) * d8) * speed; const d10 = (d5 + (d7 - d5) * d8) * speed;
          const d11 = d9 * Math.sin(d3); d9 *= Math.cos(d3);
          for (let d12 = -1; d12 <= 1; d12 += 2) P(d9 * d12, d10, d11 * d12);
        }
        d4 = d6; d5 = d7;
      }
    }
  }

  _burst(r, P) {
    const d0 = gauss() * 0.05, d1 = gauss() * 0.05;
    for (let i = 0; i < 70; i++) P(r.vx * 0.5 + gauss() * 0.15 + d0, r.vy * 0.5 + Math.random() * 0.5, r.vz * 0.5 + gauss() * 0.15 + d1);
  }

  dispose() {
    for (const r of this.rockets) { this.scene.remove(r.sprite); r.sprite.material.dispose(); }
    this.rockets = [];
  }
}
