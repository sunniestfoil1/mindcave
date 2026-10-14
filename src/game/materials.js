// Materiais com shader: lightmap do Minecraft 1.8 (céu × brilho do dia + luz de bloco quente), UV wrapping por tile
// (greedy meshing), tinta de bioma por vértice e névoa. Espaço de cor: tudo em valores sRGB "crus"
// (ColorManagement desligado) — sem conversão dupla que escurece ou lava as cores (MC24-RF-032).
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

// Curva de brilho da 1.8: (1-f)/(f*3+1), f = 1 - nível/15   ·   nível de luz chega em 0..1 (nível/15)
const LIGHTMAP = `
float lvl(float l) { float f = 1.0 - l; return (1.0 - f) / (f * 3.0 + 1.0); }
vec3 lightmap(vec2 L) {
  if (uFullbright > 0.5) return vec3(1.0);   // módulo Fullbright do Mind Client: luz máxima
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


// Amostragem do atlas com derivadas calculadas do UV CONTÍNUO (vUv), não do fract(vUv): no limite entre dois blocos o fract salta de 1 para 0,
// a GPU vê um gradiente enorme e escolhe o mipmap mais borrado — o que desenhava uma linha com a média do atlas (azul da água) ao redor
// da grama e dos blocos. O gradiente também é limitado a 16 texels (mip 4): acima disso o mipmap misturaria tiles vizinhos do atlas.
const SAMPLE = `
vec4 sampleAtlas(vec2 atlasUv) {
  vec2 gx = dFdx(vUv), gy = dFdy(vUv);
  float fp = max(length(gx), length(gy)) * 16.0;
  float k = fp > 16.0 ? 16.0 / fp : 1.0;
  return textureGrad(map, atlasUv, gx * uTileSize * k, gy * uTileSize * k);
}
`;

// Pixels com alfa entre 0.5 e 0.97 do atlas marcam "NÃO tingir" (ex.: terra na lateral da grama);
// alfa 1.0 recebe a tinta de bioma (vColor = só a tinta; o sombreamento por face vai no vAo).
const FRAG_OPAQUE = `
precision highp float;
${UNIFORMS}
${LIGHTMAP}
${SAMPLE}
void main() {
  vec2 atlasUv = vTileOrigin + fract(vUv) * uTileSize;
  vec4 tex = sampleAtlas(atlasUv);
  if (tex.a < 0.5) discard;
  tex.rgb /= tex.a; // atlas premultiplicado
  // A flag "não tingir" (alfa 0.5–0.97) vem do texel exato: o mipmap também gera alfa nessa faixa nas bordas dos recortes
  float flagA = textureLod(map, atlasUv, 0.0).a;
  vec3 tintc = flagA < 0.97 ? vec3(1.0) : vColor;
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
${SAMPLE}
void main() {
  vec2 atlasUv = vTileOrigin + fract(vUv) * uTileSize;
  vec4 tex = sampleAtlas(atlasUv);
  if (tex.a > 0.0) tex.rgb /= tex.a; // atlas premultiplicado
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
    uSkyColor: { value: new THREE.Color(1, 1, 1) },   // tinta da luz do céu (branca; escurece com chuva)
    uSunBright: { value: 1.0 },                       // brilho do dia (0.2 noite … 1.0 dia)
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