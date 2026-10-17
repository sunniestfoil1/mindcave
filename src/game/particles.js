// Sistema de partículas — estilo 1.8.9 (blocos quebrados, respingos, fumaça, /particle).
// Cada partícula é um quadrado que olha para a câmera. Na quebra de bloco ele mostra um recorte de 4×4 pixels da textura do próprio bloco
// (como o EntityDiggingFX do original); as demais são cor lisa.
//
// Desempenho: estado em arrays tipados (sem objeto por partícula), um único desenho instanciado e nenhuma conta de matriz na CPU. A cada quadro só
// as partículas vivas são copiadas para o buffer da GPU, e só esse trecho sobe. Capacidade de 8192: 300 blocos quebrados no mesmo segundo
// (~3600 partículas) cabem sem descartar nenhuma.
import * as THREE from 'three';
import { clientStore } from './client/clientStore';
import { getBlock, tileForFace, blockTint, isFluid } from './blocks';
import { stateId } from './chunk';

const CAP = 8192;
const GRAVITY = 0.04;       // blocos/tick²
const STRIDE = 12;          // floats por instância: [x y z tamanho] [u v textura luzBloco] [r g b luzCéu]
const PATCH = 4;            // recorte de 4×4 px da textura do bloco
const TEX_BRIGHTNESS = 0.6; // EntityDiggingFX: particleRed = Green = Blue = 0.6

// A partícula de alguns blocos usa a textura de outro (no 1.8.9 a grama solta pedaços de terra)
const PARTICLE_TILE = { 2: 'dirt', 110: 'dirt', 60: 'dirt', 78: 'snow' };

const VERT = `
attribute vec4 aPos;    // xyz + tamanho
attribute vec4 aUv;     // u, v do recorte (canto superior esquerdo), 1 = textura / 0 = cor lisa, luz de bloco
attribute vec4 aTint;   // rgb + luz do céu
uniform vec2 uPatch;
varying vec2 vUv;
varying vec4 vTint;
varying vec2 vMode;     // textura?, luz de bloco
void main() {
  vec4 mv = viewMatrix * vec4(aPos.xyz, 1.0);
  mv.xy += position.xy * aPos.w;
  gl_Position = projectionMatrix * mv;
  vUv = vec2(aUv.x + (position.x + 0.5) * uPatch.x, aUv.y + (0.5 - position.y) * uPatch.y);
  vTint = aTint;
  vMode = aUv.zw;
}
`;
const FRAG = `
precision highp float;
uniform sampler2D map;
uniform float uSunBright;
uniform float uFullbright;
varying vec2 vUv;
varying vec4 vTint;
varying vec2 vMode;
float lvl(float l) { float f = 1.0 - l; return (1.0 - f) / (f * 3.0 + 1.0); }
void main() {
  vec3 col = vTint.rgb;
  if (vMode.x > 0.5) {
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.5) discard;
    col *= tex.rgb;
  }
  float s = lvl(vTint.a) * uSunBright * 0.95 + 0.05;
  float b = lvl(vMode.y) * 1.5;
  float light = uFullbright > 0.5 ? 1.0 : clamp(max(s, b) * 0.96 + 0.03, 0.0, 1.0);
  gl_FragColor = vec4(col * light, 1.0);
}
`;

export class ParticleManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    // estado de simulação (por partícula)
    this.px = new Float32Array(CAP); this.py = new Float32Array(CAP); this.pz = new Float32Array(CAP);
    this.vx = new Float32Array(CAP); this.vy = new Float32Array(CAP); this.vz = new Float32Array(CAP);
    this.life = new Uint8Array(CAP); this.maxLife = new Uint8Array(CAP);
    this.alive = new Uint8Array(CAP); this.ground = new Uint8Array(CAP);
    this.size = new Float32Array(CAP);
    // faíscas de fogos: gravidade e arrasto próprios, cor de esmaecer, rastro (as partículas comuns usam os padrões)
    this.grav = new Float32Array(CAP); this.drag = new Float32Array(CAP); this.dragY = new Uint8Array(CAP);
    this.fadeAt = new Uint8Array(CAP); this.fadeCol = new Float32Array(CAP * 3); this.trail = new Uint8Array(CAP);
    this.look = new Float32Array(CAP * 8);      // parte fixa da instância: u v textura luzBloco r g b luzCéu (+1 de folga)
    this.cursor = 0;
    this.count = 0;

    this.buffer = new THREE.InstancedInterleavedBuffer(new Float32Array(CAP * STRIDE), STRIDE, 1);
    this.buffer.setUsage(THREE.DynamicDrawUsage);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.setAttribute('aPos', new THREE.InterleavedBufferAttribute(this.buffer, 4, 0));
    geo.setAttribute('aUv', new THREE.InterleavedBufferAttribute(this.buffer, 4, 4));
    geo.setAttribute('aTint', new THREE.InterleavedBufferAttribute(this.buffer, 4, 8));
    geo.instanceCount = 0;
    this.geometry = geo;

    const atlas = world?.atlas;
    this.patch = new THREE.Vector2(PATCH / 256, PATCH / (atlas?.canvas?.height || 256));
    const u = world?.uniforms || {};
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        map: u.map || { value: atlas?.texture || null },
        uSunBright: u.uSunBright || { value: 1 },
        uFullbright: u.uFullbright || { value: 0 },
        uPatch: { value: this.patch },
      },
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this._tiles = new Map();   // id:meta → { x0, y0, tint } do recorte; null = sem textura no atlas
  }

  liveCount() { let n = 0; for (let i = 0; i < CAP; i++) n += this.alive[i]; return n; }

  _slot() {
    const i = this.cursor;
    this.cursor = (i + 1) % CAP;   // cheio: sobrescreve a mais antiga, como o limite de partículas do original
    return i;
  }

  _init(i, x, y, z, vx, vy, vz, size, maxLife) {
    this.alive[i] = 1; this.ground[i] = 0; this.life[i] = 0; this.maxLife[i] = maxLife;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.size[i] = size;
    this.grav[i] = GRAVITY; this.drag[i] = 0.96; this.dragY[i] = 0; this.fadeAt[i] = 0; this.trail[i] = 0;
  }

  _look(i, u, v, tex, block, r, g, b, sky) {
    const k = i * 8;
    const L = this.look;
    L[k] = u; L[k + 1] = v; L[k + 2] = tex; L[k + 3] = block; L[k + 4] = r; L[k + 5] = g; L[k + 6] = b; L[k + 7] = sky;
  }

  // luz (0..1) de uma posição: a maior entre a célula e as vizinhas abertas (o bloco quebrado em si já é opaco para a luz)
  _light(x, y, z) {
    const w = this.world;
    if (!w?.getLight) return [1, 0];
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    let sky = 0, blk = 0;
    for (const [dx, dy, dz] of [[0, 0, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      const l = w.getLight(bx + dx, by + dy, bz + dz);
      if (l.sky > sky) sky = l.sky;
      if (l.block > blk) blk = l.block;
    }
    return [sky / 15, blk / 15];
  }

  // pixel de origem do tile do bloco no atlas e tinta do bloco (folhas etc.); cacheado por bloco
  _tileFor(id, meta) {
    const key = id * 16 + meta;
    if (this._tiles.has(key)) return this._tiles.get(key);
    let res = null;
    const atlas = this.world?.atlas;
    const block = getBlock(id);
    const name = PARTICLE_TILE[id] || tileForFace(block, 'side', meta);
    const t = atlas?.tiles?.[name];
    if (t && atlas.canvas) {
      const tint = PARTICLE_TILE[id] ? null : blockTint(block, 'side', meta);
      // u0/v1 são o canto superior esquerdo do tile (com ou sem a folga de meio texel do atlas): floor + epsilon dá o pixel inteiro
      res = { x0: Math.floor(t.u0 * 256 + 1e-3), y0: Math.floor(t.v1 * atlas.canvas.height + 1e-3), tint };
    }
    this._tiles.set(key, res);
    return res;
  }

  // Blocos quebrados — recortes 4×4 da textura do bloco, com luz do local
  spawnBlockBreak(x, y, z, blockId, meta = 0) {
    const n = Math.round((10 + Math.floor(Math.random() * 6)) * clientStore.particleScale()); // módulo Particles do Mind Client
    if (n <= 0) return;
    const tile = this._tileFor(blockId, meta & 15);
    const [sky, blk] = this._light(x, y, z);
    let cr = 0.5, cg = 0.5, cb = 0.5;
    if (!tile) {   // bloco fora do atlas: cor do registro
      const c = getBlock(blockId)?.color ?? 0x7f7f7f;
      cr = ((c >> 16) & 255) / 255; cg = ((c >> 8) & 255) / 255; cb = (c & 255) / 255;
    }
    const H = this.world?.atlas?.canvas?.height || 256;
    for (let k = 0; k < n; k++) {
      const i = this._slot();
      this._init(i, x + 0.15 + Math.random() * 0.7, y + 0.15 + Math.random() * 0.7, z + 0.15 + Math.random() * 0.7,
        (Math.random() - 0.5) * 0.28, 0.14 + Math.random() * 0.22, (Math.random() - 0.5) * 0.28,
        0.1 + Math.random() * 0.06, 24 + Math.floor(Math.random() * 16));
      if (tile) {
        const t = tile.tint, f = TEX_BRIGHTNESS;
        this._look(i, (tile.x0 + Math.floor(Math.random() * 13)) / 256, (tile.y0 + Math.floor(Math.random() * 13)) / H, 1, blk,
          f * (t ? t[0] : 1), f * (t ? t[1] : 1), f * (t ? t[2] : 1), sky);
      } else {
        const v = 1 + (Math.random() - 0.5) * 0.12;
        this._look(i, 0, 0, 0, blk, cr * v, cg * v, cb * v, sky);
      }
    }
  }

  _solid(i, r, g, b, sky, blk) { this._look(i, 0, 0, 0, blk, r, g, b, sky); }

  // Respingos de água — partículas azul-claro ao entrar na água
  spawnSplash(x, y, z, intensity = 1) {
    const n = Math.floor((8 + Math.floor(Math.random() * 8)) * intensity * clientStore.particleScale());
    const [sky, blk] = this._light(x, y + 1, z);
    for (let k = 0; k < n; k++) {
      const i = this._slot();
      const angle = Math.random() * Math.PI * 2, speed = 0.08 + Math.random() * 0.2;
      this._init(i, x + (Math.random() - 0.5) * 0.5, y + 0.5 + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.5,
        Math.cos(angle) * speed, 0.15 + Math.random() * 0.25, Math.sin(angle) * speed, 0.1, 12 + Math.floor(Math.random() * 10));
      this._solid(i, (100 + Math.random() * 40) / 255, (150 + Math.random() * 40) / 255, (220 + Math.random() * 35) / 255, sky, blk);
    }
  }

  // Efeito clássico de morte (nuvem branca de fumaça / poof da 1.8.9)
  spawnDeathPoof(x, y, z) {
    const n = Math.round(16 * clientStore.particleScale());
    const [sky, blk] = this._light(x, y + 0.5, z);
    for (let k = 0; k < n; k++) {
      const i = this._slot();
      const angle = Math.random() * Math.PI * 2, speed = 0.04 + Math.random() * 0.08;
      this._init(i, x + (Math.random() - 0.5) * 0.6, y + 0.2 + Math.random() * 0.6, z + (Math.random() - 0.5) * 0.6,
        Math.cos(angle) * speed, 0.06 + Math.random() * 0.1, Math.sin(angle) * speed, 0.1, 18 + Math.floor(Math.random() * 12));
      const s = (220 + Math.random() * 35) / 255;
      this._solid(i, s, s, s, sky, blk);
    }
  }

  // Faísca de fogos de artifício (EntityFireworkSparkFX): brilha sozinha, cai quase nada (grav 0,004), freia (drag 0,91 nos três eixos),
  // muda para a cor de esmaecer na metade da vida e, com rastro, solta faíscas curtas atrás de si na primeira metade
  spawnSpark(x, y, z, vx, vy, vz, c, o = {}) {
    const i = this._slot();
    const life = Math.min(250, o.life ?? 30);
    this._init(i, x, y, z, vx, vy, vz, o.size ?? 0.12, life);
    if (o.grav !== undefined) this.grav[i] = o.grav;
    if (o.drag !== undefined) this.drag[i] = o.drag;
    this.dragY[i] = o.dragY ? 1 : 0;
    this.trail[i] = o.trail ? 1 : 0;
    if (o.fade) { this.fadeAt[i] = Math.max(1, Math.floor(life * 0.5)); this.fadeCol[i * 3] = o.fade[0]; this.fadeCol[i * 3 + 1] = o.fade[1]; this.fadeCol[i * 3 + 2] = o.fade[2]; }
    this._solid(i, c[0], c[1], c[2], 1, 1);
    return i;
  }

  // Partículas por nome (comando /particle) — cores representativas da 1.8.9; brilham sozinhas
  spawnNamed(name, x, y, z, count = 10) {
    const COLORS = {
      flame: [255, 140, 40], smoke: [120, 120, 120], largesmoke: [90, 90, 90],
      crit: [255, 220, 100], magic_crit: [190, 90, 220],
      heart: [255, 40, 80], happyvillager: [90, 220, 90], angryvillager: [200, 40, 40],
      note: [230, 90, 230], portal: [150, 70, 220], ender: [220, 80, 220],
      dragonbreath: [190, 90, 255], fireworkspark: [255, 220, 130],
      reddust: [255, 40, 40], driplava: [255, 110, 20], dripwater: [90, 140, 255],
      snowball: [245, 250, 255], snowshovel: [230, 245, 255], itemslime: [130, 210, 90],
      waterbubble: [170, 220, 255], watersplash: [120, 170, 230], suspended: [210, 210, 210],
      depthsuspend: [170, 190, 220], townaura: [160, 200, 90], hugeexplosion: [200, 160, 80],
      explosion: [180, 150, 90], cloud: [230, 230, 240], instantspell: [200, 160, 255],
      spell: [180, 140, 255], witchspell: [120, 200, 90],
    };
    const RISE = new Set(['flame', 'smoke', 'largesmoke', 'portal', 'ender', 'driplava', 'dripwater', 'townaura', 'suspended', 'depthsuspend', 'note', 'happyvillager', 'angryvillager', 'spell', 'instantspell', 'witchspell', 'dragonbreath', 'cloud']);
    const key = String(name || '').toLowerCase();
    const color = COLORS[key] || [200, 200, 200];
    const n = Math.max(1, Math.min(50, count | 0));
    const rise = RISE.has(key);
    for (let k = 0; k < n; k++) {
      const i = this._slot();
      this._init(i, x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.04, rise ? 0.02 + Math.random() * 0.03 : (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04,
        0.1, 12 + Math.floor(Math.random() * 14));
      const v = 1 + (Math.random() - 0.5) * 0.15;
      this._solid(i, Math.min(1, color[0] / 255 * v), Math.min(1, color[1] / 255 * v), Math.min(1, color[2] / 255 * v), 1, 1);
    }
    return true;
  }

  tick(world) {
    const { px, py, pz, vx, vy, vz, life, maxLife, alive, ground } = this;
    for (let i = 0; i < CAP; i++) {
      if (!alive[i]) continue;
      if (ground[i] && vx[i] * vx[i] + vz[i] * vz[i] < 1e-6) {   // parada no chão: só envelhece
        if (++life[i] >= maxLife[i]) alive[i] = 0;
        continue;
      }
      if (!ground[i]) vy[i] -= this.grav[i];
      px[i] += vx[i]; py[i] += vy[i]; pz[i] += vz[i];
      vx[i] *= this.drag[i]; vz[i] *= this.drag[i];
      if (this.dragY[i]) vy[i] *= this.drag[i];
      if (this.fadeAt[i] && life[i] === this.fadeAt[i]) { const k = i * 8; this.look[k + 4] = this.fadeCol[i * 3]; this.look[k + 5] = this.fadeCol[i * 3 + 1]; this.look[k + 6] = this.fadeCol[i * 3 + 2]; }
      if (this.trail[i] && life[i] < maxLife[i] / 2 && ((life[i] + maxLife[i]) & 1) === 0) {   // rastro: faísca curta com a cor de agora, quase parada
        const k = i * 8;
        this.spawnSpark(px[i], py[i], pz[i], 0, 0, 0, [this.look[k + 4], this.look[k + 5], this.look[k + 6]], { life: 12, size: 0.1, grav: 0.002, drag: 0.9, dragY: true });
      }
      // colisão com o chão
      if (world && vy[i] <= 0 && py[i] > 0 && py[i] < 256) {
        const by = Math.floor(py[i] - 0.06);
        const bid = stateId(world.getBlock(Math.floor(px[i]), by, Math.floor(pz[i])));
        if (bid !== 0 && !isFluid(bid)) {
          py[i] = by + 1; vy[i] = 0; vx[i] *= 0.5; vz[i] *= 0.5; ground[i] = 1;
        } else ground[i] = 0;
      }
      if (++life[i] >= maxLife[i]) alive[i] = 0;
    }
  }

  // Copia só as partículas vivas para o buffer da GPU (e sobe só esse trecho)
  renderUpdate() {
    const { px, py, pz, life, maxLife, alive, size, look } = this;
    const out = this.buffer.array;
    let n = 0;
    for (let i = 0; i < CAP; i++) {
      if (!alive[i]) continue;
      const o = n * STRIDE, k = i * 8;
      const r = life[i] / maxLife[i];
      out[o] = px[i]; out[o + 1] = py[i]; out[o + 2] = pz[i];
      out[o + 3] = size[i] * (r > 0.75 ? Math.max(0.01, 1 - (r - 0.75) * 4) : 1);   // encolhe no fim da vida
      out[o + 4] = look[k]; out[o + 5] = look[k + 1]; out[o + 6] = look[k + 2]; out[o + 7] = look[k + 3];
      out[o + 8] = look[k + 4]; out[o + 9] = look[k + 5]; out[o + 10] = look[k + 6]; out[o + 11] = look[k + 7];
      n++;
    }
    this.count = n;
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    if (n > 0) {
      this.buffer.clearUpdateRanges?.();
      this.buffer.addUpdateRange?.(0, n * STRIDE);
      this.buffer.needsUpdate = true;
    }
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
