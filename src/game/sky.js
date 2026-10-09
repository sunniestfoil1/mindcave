// Céu, sol, lua, estrelas, nuvens e Suporte Completo a OptiFine / MCPatcher Custom Sky (CEU.zip)
// (PRD 02 RF-040..042 + MC24 §5.3)
import * as THREE from 'three';
import { mulberry32 } from './prng';
import { getSunPosition, getSkyColor, getFogColor } from './lighting';
import { getPackCanvas, MC } from './pack';

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

// Converte string de tempo HH:MM ou ticks em fração de dia [0, 1] (00:00 = 0, 12:00 = 0.5, 18:00 = 0.75)
function parseTimeStr(str) {
  if (!str) return 0;
  const clean = str.trim().replace(/\\:/g, ':');
  if (clean.includes(':')) {
    const [h, m] = clean.split(':').map(Number);
    return (((h || 0) * 60 + (m || 0)) / 1440) % 1.0;
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
    name: 'sky2',
    props: {
      startFadeIn: parseTimeStr('18:00'),
      endFadeIn: parseTimeStr('19:30'),
      startFadeOut: parseTimeStr('19:30'),
      endFadeOut: parseTimeStr('4:30'),
      blend: 'add',
      rotate: false,
      axis: [0.0, 1.0, 0.0],
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

function createSkyBoxGeometry(radius) {
  const segments = 24;
  const geo = new THREE.BoxGeometry(radius * 2, radius * 2, radius * 2, segments, segments, segments);
  const pos = geo.attributes.position;
  const uvs = geo.attributes.uv;

  // Normaliza todos os vértices da caixa para criar um domo esférico perfeitamente arredondado (sem cantos de cubo)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, y, z);
    if (len > 0) {
      pos.setXYZ(i, (x / len) * radius, (y / len) * radius, (z / len) * radius);
    }
  }
  pos.needsUpdate = true;

  // Mapeamento contínuo dos 6 grupos de faces para a grade 3×2 de 1536x1024 (OptiFine / MCPatcher format)
  // Grupo 0: +X (Leste / East)  -> Col 1, Row 1
  // Grupo 1: -X (Oeste / West)  -> Col 1, Row 0
  // Grupo 2: +Y (Topo / Up)     -> Col 0, Row 0
  // Grupo 3: -Y (Fundo / Down)  -> Col 0, Row 1
  // Grupo 4: +Z (Sul / South)   -> Col 2, Row 1
  // Grupo 5: -Z (Norte / North) -> Col 2, Row 0
  const faceMap = [
    { col: 1, row: 1 },
    { col: 1, row: 0 },
    { col: 0, row: 0 },
    { col: 0, row: 1 },
    { col: 2, row: 1 },
    { col: 2, row: 0 },
  ];

  const epsU = 0.5 / 1536;
  const epsV = 0.5 / 1024;

  for (let g = 0; g < geo.groups.length; g++) {
    const group = geo.groups[g];
    const { col, row } = faceMap[g];

    for (let i = group.start; i < group.start + group.count; i++) {
      const vIdx = geo.index.getX(i);
      const u = uvs.getX(vIdx);
      const v = uvs.getY(vIdx);

      const uMin = (col / 3.0) + epsU;
      const uMax = ((col + 1) / 3.0) - epsU;
      const vMin = (row === 0 ? 0.5 : 0.0) + epsV;
      const vMax = (row === 0 ? 1.0 : 0.5) - epsV;

      const finalU = uMin + u * (uMax - uMin);
      const finalV = vMin + v * (vMax - vMin);

      uvs.setXY(vIdx, finalU, finalV);
    }
  }

  uvs.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Camadas de Céu Personalizado (OptiFine / MCPatcher - CEU.zip)
export class Sky {
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

  createCustomSkyLayers() {
    this.customLayers = [];
    const texLoader = new THREE.TextureLoader();

    DEFAULT_SKY_LAYERS.forEach((layerDef, index) => {
      const p = layerDef.props;
      const radius = 460 - index * 2;
      const geo = createSkyBoxGeometry(radius);

      let blending = THREE.NormalBlending;
      if (p.blend === 'add') blending = THREE.AdditiveBlending;
      if (p.blend === 'multiply') blending = THREE.MultiplyBlending;

      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: true,
        blending: blending,
        fog: false,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = -950 + index;
      mesh.frustumCulled = false;
      this.scene.add(mesh);

      const axisVec = new THREE.Vector3(p.axis[0], p.axis[1], p.axis[2]).normalize();
      if (axisVec.lengthSq() < 0.001) axisVec.set(0, 1, 0);

      const layerObj = {
        name: layerDef.name,
        mesh,
        mat,
        geo,
        props: p,
        axis: axisVec,
      };

      const imgUrl = `/assets/sky/${p.source}`;
      texLoader.load(
        imgUrl,
        (tex) => {
          if (this.disposed) return;
          tex.magFilter = THREE.LinearFilter;
          tex.minFilter = THREE.LinearFilter;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          mat.map = tex;
          mat.needsUpdate = true;
        },
        undefined,
        () => {
          texLoader.load('/assets/sky/cloud2.png', (fallbackTex) => {
            if (this.disposed) return;
            fallbackTex.magFilter = THREE.LinearFilter;
            fallbackTex.minFilter = THREE.LinearFilter;
            fallbackTex.wrapS = THREE.ClampToEdgeWrapping;
            fallbackTex.wrapT = THREE.ClampToEdgeWrapping;
            mat.map = fallbackTex;
            mat.needsUpdate = true;
          });
        }
      );

      this.customLayers.push(layerObj);
    });
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
    this.sun.position.set(camX + sun.x * dist, camY + sun.y * dist, camZ);
    this.sun.lookAt(camera.position);
    this.moon.position.set(camX - sun.x * dist, camY - sun.y * dist, camZ);
    this.moon.lookAt(camera.position);

    const dayFactor = clamp01(sun.y * 2);
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

    const nightFactor = clamp01(-sun.y * 2 + 0.3);
    this.stars.material.opacity = nightFactor * 0.8;
    this.stars.position.copy(camera.position);

    // Atualiza camadas de Céu Personalizado (CEU.zip - OptiFine / MCPatcher)
    const tDay = ((((time % 24000) + 24000) % 24000) / 24000) % 1.0;
    if (this.customLayers) {
      this.customLayers.forEach((layer) => {
        const p = layer.props;
        const alpha = getSkyFadeAlpha(tDay, p.startFadeIn, p.endFadeIn, p.startFadeOut, p.endFadeOut);
        layer.mat.opacity = alpha;
        layer.mesh.visible = alpha > 0.001;
        layer.mesh.position.copy(camera.position);

        if (p.rotate) {
          const angle = tDay * Math.PI * 2;
          layer.mesh.quaternion.setFromAxisAngle(layer.axis, angle);
        }
      });
    }

    // Nuvens: deriva de 0,03 bloco por tick; cor escurece à noite
    this.cloudMat.uniforms.uOffset.value.set(time * 0.03, 0);
    const cb = clamp01(Math.sin(((time % 24000) / 24000) * Math.PI * 2) * 2 + 0.5) * 0.9 + 0.1;
    this.cloudMat.uniforms.uColor.value.setRGB(cb, cb, cb);
    this.clouds.position.x = camX;
    this.clouds.position.z = camZ;
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
        if (layer.mat.map) layer.mat.map.dispose();
        layer.mat.dispose();
      });
    }
  }
}