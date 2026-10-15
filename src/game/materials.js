// Materiais com shader otimizado (Sodium / CM Client):
//  · uTileSize positivo + clamp de meio-texel (0.5/16..15.5/16) para eliminar 100% da "geada"/bleeding;
//  · Compatível tanto com tiles novos (v0 no topo) quanto com tiles antigos em cache de workers.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

const VERT = `
attribute vec2 light;
attribute float ao;
attribute vec2 tileOrigin;
varying vec2 vUv;
varying vec3 vColor;
varying vec2 vLight;
varying float vAo;
varying float vViewDist;
varying vec2 vTileOrigin;
void main() {
  vUv = uv;
  vColor = color;
  vLight = light;
  vAo = ao;
  vTileOrigin = tileOrigin;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewDist = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const LIGHTMAP = `
float lvl(float l) { float f = 1.0 - l; return (1.0 - f) / (f * 3.0 + 1.0); }
vec3 lightmap(vec2 L) {
  if (uFullbright > 0.5) return vec3(1.0);
  float s = lvl(L.y) * uSunBright * 0.95 + 0.05;
  float b = lvl(L.x) * 1.5;
  vec3 bc = vec3(b, b * ((b * 0.6 + 0.4) * 0.6 + 0.4), b * (b * b * 0.6 + 0.4));
  vec3 c = vec3(s) * uSkyColor + bc;
  c = clamp(c * 0.96 + 0.03, 0.0, 1.0);
  vec3 g = 1.0 - c;
  g = 1.0 - g * g * g * g;
  c = mix(c, g, uBrightness);
  return clamp(c * 0.96 + 0.03, 0.0, 1.0);
}
`;

const UNIFORMS = `
uniform sampler2D map;
uniform vec2 uTileSize;
uniform vec3 uSkyColor;
uniform float uSunBright;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uBrightness;
uniform float uFullbright;
varying vec2 vUv;
varying vec3 vColor;
varying vec2 vLight;
varying float vAo;
varying float vViewDist;
varying vec2 vTileOrigin;
`;

// Converte o UV repetido do Greedy Meshing (0..N) para a coordenada interna do tile (0..1),
// invertendo o Y (y=0 base do bloco -> v=1 base do tile no canvas) e travando a meio-texel (0.5/16 a 15.5/16)
// para NUNCA tocar no tile vizinho do Atlas (elimina 100% da geada branca).
const SNAP_UV = `
vec2 snapAtlasUv(vec2 uvCoord) {
  vec2 f = fract(uvCoord);
  f.y = 1.0 - f.y;
  vec2 safe = clamp(f, 0.03125, 0.96875);
  return vTileOrigin + safe * abs(uTileSize);
}
`;

const FRAG_OPAQUE = `
precision highp float;
${UNIFORMS}
${LIGHTMAP}
${SNAP_UV}
void main() {
  vec2 atlasUv = snapAtlasUv(vUv);
  vec4 tex = texture2D(map, atlasUv);
  if (tex.a < 0.5) discard;
  vec3 tintc = tex.a < 0.97 ? vec3(1.0) : vColor;
  vec3 col = tex.rgb * tintc * lightmap(vLight) * vAo;
  float fog = smoothstep(uFogNear, uFogFar, vViewDist);
  col = mix(col, uFogColor, fog);
  gl_FragColor = vec4(col, 1.0);
}
`;

const FRAG_WATER = `
precision highp float;
uniform float uWaterOpacity;
${UNIFORMS}
${LIGHTMAP}
${SNAP_UV}
void main() {
  vec2 atlasUv = snapAtlasUv(vUv);
  vec4 tex = texture2D(map, atlasUv);
  vec3 col = tex.rgb * vColor * lightmap(vLight) * vAo;
  float fog = smoothstep(uFogNear, uFogFar, vViewDist);
  col = mix(col, uFogColor, fog);
  float a = tex.a < 0.99 ? tex.a : uWaterOpacity;
  gl_FragColor = vec4(col, a);
}
`;

export function createSharedUniforms() {
  return {
    map: { value: null },
    uTileSize: { value: new THREE.Vector2(1, 1) },
    uSkyColor: { value: new THREE.Color(1, 1, 1) },
    uSunBright: { value: 1.0 },
    uFogColor: { value: new THREE.Color(0.75, 0.85, 1.0) },
    uFogNear: { value: 50 },
    uFogFar: { value: 100 },
    uWaterOpacity: { value: 0.72 },
    uBrightness: { value: 0.0 },
    uFullbright: { value: 0.0 },
  };
}

export function makeOpaqueMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG_OPAQUE,
    vertexColors: true,
    side: THREE.FrontSide,
  });
}

export function makeWaterMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG_WATER,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}