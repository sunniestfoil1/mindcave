// Fast Math LUT (LookUp Table) - Técnica Sodium / CM Client (paridade Minecraft 1.8.9 MathHelper)
// Substitui Math.sin, Math.cos e Math.hypot por tabelas pré-calculadas em Float32Array para performance ultra-rápida.

const SIN_TABLE = new Float32Array(65536);
for (let i = 0; i < 65536; ++i) {
  SIN_TABLE[i] = Math.sin((i * Math.PI * 2) / 65536);
}

export function fastSin(rad) {
  return SIN_TABLE[(rad * 10430.378) & 65535];
}

export function fastCos(rad) {
  return SIN_TABLE[(rad * 10430.378 + 16384) & 65535];
}

export function fastHypot2(dx, dz) {
  return Math.sqrt(dx * dx + dz * dz);
}

export function fastHypot3(dx, dy, dz) {
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
