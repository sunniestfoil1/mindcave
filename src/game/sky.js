// Céu, sol, lua, estrelas, nuvens e Suporte Completo a OptiFine / MCPatcher Custom Sky (CEU.zip)
// (PRD 02 RF-040..042 + MC24 §5.3)
import * as THREE from 'three';
import { mulberry32 } from './prng';
import { getSunPosition, getSkyColor, getFogColor } from './lighting';
import { getPackCanvas, MC } from './pack';
import { settingsStore } from './settingsStore';

const DOME_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const DOME_FRAG = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  gl_FragColor = vec4(mix(uHorizon, uZenith, pow(h, 0.55)), 1.0);
}`;

const CLOUD_VERT = `
varying vec2 vWorldXZ;
varying float vDist;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldXZ = wp.xz;
  vDist = length(wp.xz - cameraPosition.xz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const CLOUD_FRAG = `
uniform sampler2D map;
uniform float uCells;
uniform vec2 uOffset;
uniform vec3 uColor;
uniform float uAlpha;
uniform vec2 uFade;
varying vec2 vWorldXZ;
varying float vDist;
void main() {
  vec2 uv = (vWorldXZ + uOffset) / (12.0 * uCells);
  float a = texture2D(map, fract(uv)).a * uAlpha * (1.0 - smoothstep(uFade.x, uFade.y, vDist));
  if (a < 0.02) discard;
  gl_FragColor = vec4(uColor, a);
}`;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function nearestTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

// Converte "HH:MM" ou ticks em fração do dia [0, 1) no relógio do jogo: o tick 0 é 06:00 (nascer do sol), como no OptiFine.
// Antes isto tratava 00:00 como o início do dia e deixava as camadas 6 horas fora de fase em relação ao sol.
function parseTimeStr(str) {
  if (!str) return 0;
  const clean = str.trim().replace(/\:/g, ':');
  if (clean.includes(':')) {
    const [h, m] = clean.split(':').map(Number);
    const hours = (((h || 0) - 6) % 24 + 24) % 24 + (m || 0) / 60;
    return (hours / 24) % 1.0;
  }
  const ticks = parseFloat(clean);
  return ((((ticks % 24000) + 24000) % 24000) / 24000) % 1.0;
}

// Analisa arquivo .properties do OptiFine/MCPatcher Sky
export function parseSkyProperties(text) {
  const props = {};
  if (!text) return props;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    props[key] = val;
  }
  return {
    startFadeIn: parseTimeStr(props.startFadeIn || '0:00'),
    endFadeIn: parseTimeStr(props.endFadeIn || props.startFadeIn || '0:00'),
    startFadeOut: parseTimeStr(props.startFadeOut || props.endFadeIn || '12:00'),
    endFadeOut: parseTimeStr(props.endFadeOut || props.startFadeOut || '12:00'),
    blend: (props.blend || 'add').toLowerCase(),
    rotate: props.rotate === 'true',
    axis: props.axis ? props.axis.split(/\s+/).map(Number) : [0.0, -0.2, 0.0],
    source: props.source ? props.source.replace(/^\.\//, '') : 'cloud1.png',
  };
}

// Calcula opacidade [0, 1] da camada de céu com base no tempo atual t [0, 1] e ciclo dia/noite
function getSkyFadeAlpha(t, startIn, endIn, startOut, endOut) {
  const norm = (v) => (v - startIn + 1.0) % 1.0;
  const tN = norm(t);
  const endInN = norm(endIn);
  const startOutN = norm(startOut);
  const endOutN = norm(endOut);

  if (endInN > 0 && tN <= endInN) {
    return tN / endInN;
  }
  if (tN <= startOutN) {
    return 1.0;
  }
  if (tN <= endOutN) {
    const fadeLen = endOutN - startOutN;
    if (fadeLen <= 0) return 0.0;
    return 1.0 - (tN - startOutN) / fadeLen;
  }
  return 0.0;
}

// Configurações dos arquivos sky1..sky4 do CEU.zip (MCPatcher / OptiFine)
const DEFAULT_SKY_LAYERS = [
  {
    name: 'sky1',
    props: {
      startFadeIn: parseTimeStr('18:00'),
      endFadeIn: parseTimeStr('18:45'),
      startFadeOut: parseTimeStr('18:50'),
      endFadeOut: parseTimeStr('19:10'),
      blend: 'multiply',
      rotate: true,
      axis: [0.0, -0.2, 0.0],
      source: 'cloud2.png',
    }
  },
  {
    name: 'sky3',
    props: {
      startFadeIn: parseTimeStr('18:30'),
      endFadeIn: parseTimeStr('18:45'),
      startFadeOut: parseTimeStr('18:45'),
      endFadeOut: parseTimeStr('5:25'),
      blend: 'add',
      rotate: true,
      axis: [0.0, -0.2, 0.0],
      source: 'starfield03.png',
    }
  },
  {
    name: 'sky4',
    props: {
      startFadeIn: parseTimeStr('5:30'),
      endFadeIn: parseTimeStr('6:00'),
      startFadeOut: parseTimeStr('17:50'),
      endFadeOut: parseTimeStr('18:40'),
      blend: 'replace',
      rotate: true,
      axis: [0.0, -0.2, 0.0],
      source: 'cloud1.png',
    }
  }
];

// Skybox OptiFine/MCPatcher: imagem 3×2 de faces quadradas. Layout confirmado pela continuidade das bordas
// (12 bordas casadas com erro ~0 em cloud1.png e cloud2.png):
//   linha 0: baixo, cima, norte   ·   linha 1: leste, sul, oeste      (cada lateral em pé, esquerda→direita = giro N→L→S→O)
// Cada face é parametrizada por (s, t): s = esquerda→direita da imagem, t = cima→baixo.
const SKY_FACES = [
  { tile: 0, p: (R, s, t) => [R * (1 - 2 * s), -R, R * (1 - 2 * t)] },        // baixo
  { tile: 1, p: (R, s, t) => [R * (1 - 2 * s), R, R * (2 * t - 1)] },         // cima
  { tile: 2, p: (R, s, t) => [R * (2 * s - 1), R * (1 - 2 * t), -R] },        // norte (-Z)
  { tile: 3, p: (R, s, t) => [R, R * (1 - 2 * t), R * (2 * s - 1)] },         // leste (+X)
  { tile: 4, p: (R, s, t) => [R * (1 - 2 * s), R * (1 - 2 * t), R] },         // sul (+Z)
  { tile: 5, p: (R, s, t) => [-R, R * (1 - 2 * t), R * (1 - 2 * s)] },        // oeste (-X)
];

export function createSkyBoxGeometry(radius, segments = 8) {
  const pos = [], uv = [], idx = [];
  const epsU = 0.75 / 1536, epsV = 0.75 / 1024;
  for (const f of SKY_FACES) {
    const col = f.tile % 3, row = Math.floor(f.tile / 3);
    const u0 = col / 3 + epsU, u1 = (col + 1) / 3 - epsU;
    const vTop = 1 - row / 2 - epsV, vBot = 1 - (row + 1) / 2 + epsV; // a textura sobe invertida (flipY)
    const base = pos.length / 3;
    for (let j = 0; j <= segments; j++) {
      for (let i = 0; i <= segments; i++) {
        const s = i / segments, t = j / segments;
        pos.push(...f.p(radius, s, t));
        uv.push(u0 + (u1 - u0) * s, vTop + (vBot - vTop) * t);
      }
    }
    for (let j = 0; j < segments; j++) {
      for (let i = 0; i < segments; i++) {
        const a = base + j * (segments + 1) + i, b = a + 1, c = a + segments + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

// Camadas de Céu Personalizado (OptiFine / MCPatcher - CEU.zip)
export class Sky {
  // No Nether não há céu: esconde a cúpula, o sol, a lua, as estrelas e as nuvens (e volta a mostrar no mundo normal)
  setVisible(v) {
    this._hidden = !v;
    for (const o of [this.dome, this.sun, this.moon, this.stars, this.clouds]) if (o) o.visible = v;
    if (this.customLayers) {
      for (const layer of this.customLayers) {
        if (layer.mesh) layer.mesh.visible = v && (layer.mat?.uniforms?.uFade?.value > 0.005);
      }
    }
  }

  constructor(scene, seed) {
    this.scene = scene;
    this.seed = seed >>> 0;
    this.disposed = false;
    this.moonPhase = -1;
    this.moonTex = null;
    this.skyColor = new THREE.Color(0x78a7ff);
    this.fogColor = new THREE.Color(0xc0d8ff);

    // Cúpula base do céu (gradiente zênite -> horizonte)
    this.domeMat = new THREE.ShaderMaterial({
      uniforms: { uZenith: { value: new THREE.Color(0x78a7ff) }, uHorizon: { value: new THREE.Color(0xc0d8ff) } },
      vertexShader: DOME_VERT, fragmentShader: DOME_FRAG,
      side: THREE.BackSide, depthWrite: false, depthTest: true,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), this.domeMat);
    this.dome.renderOrder = -1000;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // Sol
    this.sun = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.9, fog: false, depthWrite: false, depthTest: true }),
    );
    this.sun.renderOrder = -850;
    scene.add(this.sun);

    // Lua
    this.moon = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshBasicMaterial({ color: 0xddddff, transparent: true, opacity: 0.8, fog: false, depthWrite: false, depthTest: true }),
    );
    this.moon.renderOrder = -850;
    scene.add(this.moon);

    this.createStars();
    this.createClouds();
    this.createCustomSkyLayers();
  }

  // Camadas do CEU.zip (OptiFine/MCPatcher). Lê sky1..4.properties de /assets/sky; camada cuja textura não existe é ignorada.
  createCustomSkyLayers() {
    this.customLayers = [];
    const texLoader = new THREE.TextureLoader();
    const loadProps = (i) => fetch(`/assets/sky/sky${i}.properties`).then((r) => (r.ok ? r.text() : null)).catch(() => null);
    Promise.all([1, 2, 3, 4].map(loadProps)).then((texts) => {
      if (this.disposed) return;
      let defs = texts.map((t, i) => (t ? { name: `sky${i + 1}`, props: parseSkyProperties(t) } : null)).filter(Boolean);
      if (defs.length === 0) defs = DEFAULT_SKY_LAYERS;
      defs.forEach((layerDef, index) => {
        const p = layerDef.props;
        texLoader.load(`/assets/sky/${p.source}`, (tex) => {
          if (this.disposed) { tex.dispose(); return; }
          tex.magFilter = THREE.LinearFilter;
          tex.minFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          this._addSkyLayer(layerDef, tex, index);
        }, undefined, () => { /* sem textura: sem camada (nada de substituir por outra imagem) */ });
      });
    });
  }

  _addSkyLayer(layerDef, tex, index) {
    const p = layerDef.props;
    const mode = p.blend === 'multiply' ? 2 : p.blend === 'add' ? 1 : 0; // 0 substituir, 1 somar, 2 multiplicar
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uFade: { value: 0 }, uMode: { value: mode } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform sampler2D map; uniform float uFade; uniform float uMode; varying vec2 vUv;
        void main() {
          vec4 t = texture2D(map, vUv);
          if (uMode > 1.5) gl_FragColor = vec4(mix(vec3(1.0), t.rgb, uFade), 1.0);   // multiplicar: some em direção ao branco
          else if (uMode > 0.5) gl_FragColor = vec4(t.rgb, t.a * uFade);               // somar (alfa da textura × fade)
          else gl_FragColor = vec4(t.rgb, uFade);                                       // substituir
        }`,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
      blending: mode === 2 ? THREE.MultiplyBlending : mode === 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const geo = createSkyBoxGeometry(450 - index * 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -950 + index;
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.scene.add(mesh);
    const axis = new THREE.Vector3(p.axis[0], p.axis[1], p.axis[2]);
    if (axis.lengthSq() < 1e-6) axis.set(0, 1, 0); else axis.normalize();
    this.customLayers.push({ name: layerDef.name, mesh, mat, geo, props: p, axis });
  }

  createStars() {
    const count = 1500;
    const positions = new Float32Array(count * 3);
    const rng = mulberry32(this.seed ^ 0x55aa55);
    for (let i = 0; i < count; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 0.9 + 0.1);
      const r = 400;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false, depthTest: true });
    this.stars = new THREE.Points(geo, mat);
    this.stars.renderOrder = -900;
    this.scene.add(this.stars);
  }

  createClouds() {
    const n = 64;
    const canvas = document.createElement('canvas');
    canvas.width = n; canvas.height = n;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (mulberry32(x * 73856 + y * 19349 + this.seed)() > 0.7) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1, 1); }
      }
    }
    this.cloudTex = nearestTexture(canvas);
    this.cloudTex.wrapS = THREE.RepeatWrapping;
    this.cloudTex.wrapT = THREE.RepeatWrapping;
    this.cloudMat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: this.cloudTex }, uCells: { value: n }, uOffset: { value: new THREE.Vector2() },
        uColor: { value: new THREE.Color(1, 1, 1) }, uAlpha: { value: 0.8 }, uFade: { value: new THREE.Vector2(380, 640) },
      },
      vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG,
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide,
    });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), this.cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 128;
    this.clouds.renderOrder = -800;
    this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);
  }

  async applyPack() {
    const [sunC, moonC, cloudC] = await Promise.all([
      getPackCanvas(MC + 'environment/sun.png'),
      getPackCanvas(MC + 'environment/moon_phases.png'),
      getPackCanvas(MC + 'environment/clouds.png'),
    ]);
    if (this.disposed) return;
    if (sunC) {
      const m = this.sun.material;
      m.map = nearestTexture(sunC); m.color.set(0xffffff); m.blending = THREE.AdditiveBlending; m.needsUpdate = true;
    }
    if (moonC) {
      const m = this.moon.material;
      this.moonTex = nearestTexture(moonC);
      this.moonTex.repeat.set(0.25, 0.5);
      m.map = this.moonTex; m.color.set(0xffffff); m.blending = THREE.AdditiveBlending; m.needsUpdate = true;
      this.moonPhase = -1;
    }
    if (cloudC) {
      this.cloudTex.dispose();
      this.cloudTex = nearestTexture(cloudC);
      this.cloudTex.wrapS = THREE.RepeatWrapping;
      this.cloudTex.wrapT = THREE.RepeatWrapping;
      this.cloudMat.uniforms.map.value = this.cloudTex;
      this.cloudMat.uniforms.uCells.value = cloudC.width;
    }
  }

  update(time, camera) {
    if (this._hidden) return;

    const skyEnabled = settingsStore.get('device.sky') !== false;
    const customSkyEnabled = settingsStore.get('device.customSky') !== false;
    const sunEnabled = settingsStore.get('device.sun') !== false;
    const starsEnabled = settingsStore.get('device.stars') !== false;

    // Se a opção Céu estiver desligada nas configurações
    if (!skyEnabled) {
      if (this.dome) this.dome.visible = false;
      if (this.sun) this.sun.visible = false;
      if (this.moon) this.moon.visible = false;
      if (this.stars) this.stars.visible = false;
      if (this.clouds) this.clouds.visible = false;
      if (this.customLayers) {
        for (const layer of this.customLayers) {
          if (layer.mesh) layer.mesh.visible = false;
        }
      }
      return;
    }

    const sun = getSunPosition(time);
    const sky = getSkyColor(time);
    const fog = getFogColor(time);
    this.skyColor.setRGB(sky.r, sky.g, sky.b);
    this.fogColor.setRGB(fog.r, fog.g, fog.b);
    this.domeMat.uniforms.uZenith.value.copy(this.skyColor);
    this.domeMat.uniforms.uHorizon.value.copy(this.fogColor);
    this.dome.position.copy(camera.position);

    const camX = camera.position.x, camY = camera.position.y, camZ = camera.position.z;
    const dist = 400;

    // Sol e Lua
    if (sunEnabled) {
      this.sun.position.set(camX + sun.x * dist, camY + sun.y * dist, camZ);
      this.sun.lookAt(camera.position);
      this.moon.position.set(camX - sun.x * dist, camY - sun.y * dist, camZ);
      this.moon.lookAt(camera.position);

      this.sun.visible = sun.y > -0.1;
      this.sun.material.opacity = Math.min(0.9, 0.9 * Math.max(0, sun.y + 0.15) / 0.15);
      this.moon.visible = sun.y < 0.1;
      this.moon.material.opacity = Math.min(0.8, 0.8 * Math.max(0, -sun.y + 0.15) / 0.15);

      // Fase da lua = dia do mundo mod 8
      if (this.moonTex) {
        const phase = Math.floor(time / 24000) % 8;
        if (phase !== this.moonPhase) {
          this.moonPhase = phase;
          this.moonTex.offset.set((phase % 4) * 0.25, 1 - (Math.floor(phase / 4) + 1) * 0.5);
        }
      }
    } else {
      this.sun.visible = false;
      this.moon.visible = false;
    }

    // Camadas de Céu Personalizado (OptiFine / MCPatcher - CEU.zip)
    const tDay = ((((time % 24000) + 24000) % 24000) / 24000) % 1.0;
    let starfield = 0, cover = 0;

    if (customSkyEnabled && this.customLayers && this.customLayers.length > 0) {
      this.customLayers.forEach((layer) => {
        const p = layer.props;
        const alpha = getSkyFadeAlpha(tDay, p.startFadeIn, p.endFadeIn, p.startFadeOut, p.endFadeOut);
        layer.mat.uniforms.uFade.value = alpha;
        const isVis = alpha > 0.005;
        layer.mesh.visible = isVis;
        layer.mesh.position.copy(camera.position);

        if (isVis) {
          if (/star/i.test(p.source)) starfield = Math.max(starfield, alpha);
          if (p.blend === 'replace') cover = Math.max(cover, alpha);
        }

        if (p.rotate) {
          const angle = tDay * Math.PI * 2;
          layer.mesh.quaternion.setFromAxisAngle(layer.axis, angle);
        }
      });
    } else if (this.customLayers) {
      // Céu personalizado desativado: desliga todas as camadas OptiFine
      for (const layer of this.customLayers) {
        if (layer.mesh) layer.mesh.visible = false;
      }
    }

    // Controle da Cúpula Base:
    // A cúpula base (gradiente zênite/horizonte) permanece sempre visível de fundo, sem piscar
    this.dome.visible = true;

    // Estrelas:
    // Se Céu Personalizado estiver desligado, renderiza as estrelas procedurais do céu padrão com brilho total.
    // Se Céu Personalizado estiver ligado, apaga as estrelas procedurais apenas se o starfield customizado estiver ativo.
    if (starsEnabled) {
      const nightFactor = clamp01(-sun.y * 2 + 0.3);
      const starsAlpha = customSkyEnabled
        ? nightFactor * 0.8 * (1.0 - starfield) * (1.0 - cover)
        : nightFactor * 0.8;

      if (starsAlpha > 0.01) {
        this.stars.visible = true;
        this.stars.material.opacity = starsAlpha;
        this.stars.position.copy(camera.position);
      } else {
        this.stars.visible = false;
      }
    } else {
      this.stars.visible = false;
    }

    // Nuvens: deriva de 0,03 bloco por tick; cor escurece à noite
    this.cloudMat.uniforms.uOffset.value.set(time * 0.03, 0);
    const cb = clamp01(Math.sin(((time % 24000) / 24000) * Math.PI * 2) * 2 + 0.5) * 0.9 + 0.1;
    this.cloudMat.uniforms.uColor.value.setRGB(cb, cb, cb);
    this.clouds.position.x = camX;
    this.clouds.position.z = camZ;
    this.clouds.visible = true;
    void dayFactor;
  }

  dispose() {
    this.disposed = true;
    this.scene.remove(this.dome, this.sun, this.moon, this.stars, this.clouds);
    this.dome.geometry.dispose(); this.domeMat.dispose();
    this.sun.geometry.dispose(); this.sun.material.dispose();
    this.moon.geometry.dispose(); this.moon.material.dispose();
    this.stars.geometry.dispose(); this.stars.material.dispose();
    this.clouds.geometry.dispose(); this.cloudMat.dispose();
    this.cloudTex.dispose();
    if (this.moonTex) this.moonTex.dispose();

    if (this.customLayers) {
      this.customLayers.forEach((layer) => {
        this.scene.remove(layer.mesh);
        layer.geo.dispose();
        if (layer.mat.uniforms.map.value) layer.mat.uniforms.map.value.dispose();
        layer.mat.dispose();
      });
    }
  }
}