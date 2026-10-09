// Formato de chunk + helpers de indexação e estado de bloco (PRD 01 RF-010, PRD 02 luz)
import { CHUNK_SIZE, WORLD_HEIGHT } from './constants';

export function packState(id, meta = 0) { return ((id & 0xfff) << 4) | (meta & 0xf); }
export function stateId(s) { return (s >> 4) & 0xfff; }
export function stateMeta(s) { return s & 0xf; }

export function chunkIndex(lx, y, lz) { return lx + CHUNK_SIZE * (lz + CHUNK_SIZE * y); }
export function localCoord(x) { return ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE; }
export function chunkCoord(x) { return Math.floor(x / CHUNK_SIZE); }
// Chave numérica única de um chunk (usada pelo mundo e pelos workers — não decodificar com operadores de bit)
export function chunkKey(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }

export function createChunkData() {
  return new Uint16Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
}

// Dados de luz empacotados: (skyLight << 4) | blockLight — 1 byte por bloco
export function createLightData() {
  return new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
}

export function getSkyLight(lightData, idx) { return (lightData[idx] >> 4) & 15; }
export function getBlockLight(lightData, idx) { return lightData[idx] & 15; }
export function setSkyLight(lightData, idx, val) {
  lightData[idx] = (lightData[idx] & 0x0f) | ((val & 15) << 4);
}
export function setBlockLight(lightData, idx, val) {
  lightData[idx] = (lightData[idx] & 0xf0) | (val & 15);
}