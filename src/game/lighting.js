// Sistema de iluminação — leitura de luz do céu/bloco + fatores de dia/noite (PRD 02 RF-020..025).
// O cálculo de luz por chunk (BFS) vive em lightCore.js e roda nos workers de meshing (PRD 23);
// a main thread só lê o resultado devolvido pelos workers em chunk.lightData.
import { WORLD_HEIGHT } from './constants';
import { chunkIndex, localCoord, chunkCoord, createLightData } from './chunk';

// Lê luz de qualquer posição absoluta (lê de chunks vizinhos se necessário)
export function getLight(world, x, y, z) {
  if (y < 0) return { sky: 0, block: 0 };
  if (y >= WORLD_HEIGHT) return { sky: 15, block: 0 };
  const c = world.chunks.get(world.key(chunkCoord(x), chunkCoord(z)));
  if (!c || !c.lightData) return { sky: 0, block: 0 };
  const l = c.lightData[chunkIndex(localCoord(x), y, localCoord(z))];
  return { sky: (l >> 4) & 15, block: l & 15 };
}

export function getSkyLightAbs(world, x, y, z) {
  if (y < 0) return 0;
  if (y >= WORLD_HEIGHT) return 15;
  const c = world.chunks.get(world.key(chunkCoord(x), chunkCoord(z)));
  if (!c || !c.lightData) return 0;
  return (c.lightData[chunkIndex(localCoord(x), y, localCoord(z))] >> 4) & 15;
}

export function getBlockLightAbs(world, x, y, z) {
  if (y < 0) return 0;
  if (y >= WORLD_HEIGHT) return 0;
  const c = world.chunks.get(world.key(chunkCoord(x), chunkCoord(z)));
  if (!c || !c.lightData) return 0;
  return c.lightData[chunkIndex(localCoord(x), y, localCoord(z))] & 15;
}

// Inicializa lightData do chunk se necessário
export function ensureLightData(chunk) {
  if (!chunk.lightData) chunk.lightData = createLightData();
  return chunk.lightData;
}

// === Brilho do céu por hora do dia ===

export function skyBrightnessFactor(time) {
  const t = time % 24000;
  if (t < 12000) return 1.0;                    // dia
  if (t < 13000) return 1.0 - (t - 12000) / 1000 * 0.92; // pôr do sol
  if (t < 23000) return 0.08;                   // noite
  return 0.08 + (t - 23000) / 1000 * 0.92;      // amanhecer
}

export function sunsetFactor(time) {
  const t = time % 24000;
  if (t >= 11500 && t < 13500) return Math.sin(((t - 11500) / 2000) * Math.PI);
  if (t >= 22500 && t < 24000) return Math.sin(((t - 22500) / 1500) * Math.PI);
  return 0;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Brilho do sol da 1.8 (World.getSunBrightness): 1.0 ao meio-dia … 0.2 à noite, 0.36 no horizonte
export function sunBrightness(time) {
  const s = Math.sin(((time % 24000) / 24000) * Math.PI * 2); // 1 = meio-dia
  return 0.2 + 0.8 * (1 - clamp01(0.8 - s * 2));
}

// Cor do céu (zênite): azul da planície 0x78A7FF escurecido pela hora (1.8: temp 0.8)
export function getSkyColor(time) {
  const s = Math.sin(((time % 24000) / 24000) * Math.PI * 2);
  const f = clamp01(s * 2 + 0.5);
  const ss = sunsetFactor(time);
  const r = 0.47 * f + ss * 0.25, g = 0.655 * f + ss * 0.06, b = 1.0 * f - ss * 0.1;
  return { r: clamp01(r), g: clamp01(g), b: clamp01(b) };
}

// Cor da névoa/horizonte: 0xC0D8FF de dia, escura à noite, alaranjada no nascer/pôr do sol
export function getFogColor(time) {
  const s = Math.sin(((time % 24000) / 24000) * Math.PI * 2);
  const f = clamp01(s * 0.94 + 0.06);
  const ss = sunsetFactor(time);
  const r = 0.753 * f + ss * 0.3, g = 0.847 * f + ss * 0.1, b = 1.0 * f - ss * 0.15;
  return { r: clamp01(r), g: clamp01(g), b: clamp01(b) };
}

// Posição do sol (x, y) normalizada. y>0 = acima do horizonte
export function getSunPosition(time) {
  const angle = (time % 24000) / 24000 * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}