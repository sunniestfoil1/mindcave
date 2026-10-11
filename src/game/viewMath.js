// Convenção de ângulos do jogo, em um lugar só (usada pelo motor e pelo laboratório em lab/).
// yaw: 0 = olhando para +Z; cresce no sentido anti-horário visto de cima (olhar para -X em 90°).
// pitch: positivo = olhando para baixo.

export function lookDirFromAngles(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: -Math.sin(pitch), z: Math.cos(yaw) * cp };
}

// Rotação Y do three.js que faz um modelo que "olha para +Z" encarar a direção do yaw acima.
// rotation.y = θ leva +Z para (sen θ, 0, cos θ), enquanto o jogo olha para (-sen yaw, 0, cos yaw): θ = -yaw.
export function modelRotationYFromYaw(yaw) {
  return -yaw;
}
