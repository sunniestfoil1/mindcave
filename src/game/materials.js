// Materiais com shader otimizado (Sodium / CM Client):
//  · Elimina 100% da "geada branca" nas folhas/grama (isola a flag alpha=230 de grass_side em 0.88..0.93);
//  · Clamp de meio-texel (0.03125..0.96875) compatível com a orientação original (v0 na base);
//  · 1 única leitura texture2D por pixel (sem textureGrad / dFdx / dFdy / textureLod).
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

const FRAG_OPAQUE = `
precision highp float;
${UNIFORMS}
${LIGHTMAP}
void main() {
  vec2 localUv = clamp(fract(vUv), 0.03125, 0.96875);
  vec2 atlasUv = vTileOrigin + localUv * uTileSize;
  vec4 tex = texture2D(map, atlasUv);
  if (tex.a < 0.5) discard;
  // Apenas a terra na lateral da grama (alpha = 230/255 ≈ 0.902) fica sem tinta (vec3(1.0)).
  // Folhas e topo da grama recebem sempre vColor (verde), eliminando 100% da "geada branca".
  vec3 tintc = (tex.a > 0.88 && tex.a < 0.93) ? vec3(1.0) : vColor;
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
void main() {
  vec2 localUv = clamp(fract(vUv), 0.03125, 0.96875);
  vec2 atlasUv = vTileOrigin + localUv * uTileSize;
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