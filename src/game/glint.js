// Brilho de encantamento (RenderItem.renderEffect da 1.8.9): textura misc/enchanted_item_glint.png em duas camadas que correm em direções
// opostas, cor (0,5; 0,25; 0,8), mistura SRC_COLOR+ONE, e só sobre os pixels opacos do item.
import * as THREE from 'three';
import { MC, getPackUrl } from './pack';

// Itens que brilham sempre, mesmo sem encantamento (livro encantado, maçã dourada encantada, garrafa de XP)
export function hasGlint(item) {
  if (!item) return false;
  if (item.enchants && Object.keys(item.enchants).length > 0) return true;
  return item.id === 403 || item.id === 384 || (item.id === 322 && (item.meta || 0) === 1);
}

let glintTex = null, glintLoading = false;
const pending = new Set();
export function getGlintTexture() {
  if (glintTex) return glintTex;
  if (!glintLoading) {
    glintLoading = true;
    getPackUrl(MC + 'textures/misc/enchanted_item_glint.png').then((url) => {
      if (!url) return;
      new THREE.TextureLoader().load(url, (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.magFilter = t.minFilter = THREE.NearestFilter;
        glintTex = t;
        for (const m of pending) m.uniforms.uGlint.value = t;
        pending.clear();
      });
    }).catch(() => {});
  }
  return glintTex;
}

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const FRAG = `
uniform sampler2D uGlint; uniform sampler2D uMask; uniform float uHasMask; uniform float uHasGlint; uniform float uTime;
varying vec2 vUv;
vec2 rot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c*p.x - s*p.y, s*p.x + c*p.y); }
void main(){
  if (uHasGlint < 0.5) discard;
  if (uHasMask > 0.5 && texture2D(uMask, vUv).a < 0.1) discard;
  vec3 tint = vec3(0.5, 0.25, 0.8);
  vec2 a = rot(vUv * 8.0, -0.8727) + vec2(mod(uTime, 3.0) / 3.0 / 8.0 * 8.0, 0.0);
  vec2 b = rot(vUv * 8.0, 0.1745) - vec2(mod(uTime, 4.873) / 4.873 / 8.0 * 8.0, 0.0);
  vec3 c1 = texture2D(uGlint, a).rgb * tint, c2 = texture2D(uGlint, b).rgb * tint;
  gl_FragColor = vec4(c1 * c1 + c2 * c2, 1.0);
}`;

export function makeGlintMaterial(hasMask) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uGlint: { value: getGlintTexture() }, uMask: { value: null }, uHasMask: { value: hasMask ? 1 : 0 }, uHasGlint: { value: 0 }, uTime: { value: 0 } },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  if (!glintTex) pending.add(m);
  return m;
}

// Cria, para cada mesh do item, um irmão com o shader do brilho; devolve { group, update(ms) }
export function buildGlintOverlay(root) {
  const group = new THREE.Group();
  const links = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const sprite = !!(o.material && !Array.isArray(o.material) && o.material.map && o.geometry.type === 'PlaneGeometry');
    const mat = makeGlintMaterial(sprite);
    const g = new THREE.Mesh(o.geometry, mat);
    g.position.copy(o.position); g.quaternion.copy(o.quaternion); g.scale.copy(o.scale).multiplyScalar(sprite ? 1 : 1.012);
    g.frustumCulled = false;
    group.add(g);
    links.push({ g, src: o, sprite });
  });
  return {
    group,
    update(ms) {
      const t = ms / 1000 * 20 / 20; // segundos
      for (const l of links) {
        const u = l.g.material.uniforms;
        u.uTime.value = t;
        u.uHasGlint.value = glintTex ? 1 : 0;
        if (l.sprite) { u.uMask.value = l.src.material.map || null; u.uHasMask.value = l.src.material.map ? 1 : 0; }
      }
    },
  };
}
