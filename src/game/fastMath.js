// FastMath — Tabela de consulta trigonométrica de alta performance
// Referência: Minecraft 1.8.9 MathHelper (net.minecraft.util.MathHelper) & OptiFine / Sodium FastMath
// Substitui Math.sin e Math.cos por leituras ultra-rápidas em Float32Array de 65536 entradas indexado por máscara bitwise.

const TABLE_SIZE = 65536;
const MASK = 0xffff;
const RAD_TO_INDEX = TABLE_SIZE / (Math.PI * 2); // 10430.378350470453
const COS_OFFSET = TABLE_SIZE / 4; // 16384 (PI / 2)

const SIN_TABLE = new Float32Array(TABLE_SIZE);

for (let i = 0; i < TABLE_SIZE; i++) {
  SIN_TABLE[i] = Math.sin((i * Math.PI * 2) / TABLE_SIZE);
}

/**
 * Seno ultra-rápido com precisão equivalente ao Minecraft 1.8.9 (~10x mais rápido que Math.sin)
 * @param {number} rad Ângulo em radianos
 * @returns {number}
 */
export function fastSin(rad) {
  return SIN_TABLE[((rad * RAD_TO_INDEX) | 0) & MASK];
}

/**
 * Cosseno ultra-rápido com precisão equivalente ao Minecraft 1.8.9 (~10x mais rápido que Math.cos)
 * @param {number} rad Ângulo em radianos
 * @returns {number}
 */
export function fastCos(rad) {
  return SIN_TABLE[(((rad * RAD_TO_INDEX) | 0) + COS_OFFSET) & MASK];
}
