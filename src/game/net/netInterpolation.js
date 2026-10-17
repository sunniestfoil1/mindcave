// Entity Interpolation (Snapshot Buffer com LERP temporal)
// Padrão de sincronização suave de rede — Minecraft 1.8.9 / Eaglercraft / Source Engine

export const INTERPOLATION_DELAY_MS = 60; // 60ms (~1.2 ticks a 20 TPS), absorve jitter de rede perfeitamente sem atraso perceptível

export function lerpAngle(a, b, t) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

export function recordPlayerSnapshot(p, msg) {
  const now = performance.now();
  p.name = msg.n || p.name;
  p.isDead = !!msg.dead;
  p.sleeping = !!msg.sleeping;
  p.held = msg.h || 0;
  p.voice = msg.v | 0;
  p.armor = msg.a | 0;
  p.gameMode = ['survival', 'creative', 'adventure', 'spectator'][msg.g | 0] || 'survival';

  if (!p.buffer) {
    p.buffer = [];
  }

  // Teleporte (> 8 blocos): limpa o buffer e move instantaneamente sem LERP
  if (p.x !== undefined) {
    const dx = msg.x - p.x;
    const dy = msg.y - p.y;
    const dz = msg.z - p.z;
    if (dx * dx + dy * dy + dz * dz > 64) {
      p.buffer.length = 0;
      p.x = msg.x;
      p.y = msg.y;
      p.z = msg.z;
      p.yaw = msg.yaw;
      p.pitch = msg.pitch || 0;
    }
  } else {
    p.x = msg.x;
    p.y = msg.y;
    p.z = msg.z;
    p.yaw = msg.yaw;
    p.pitch = msg.pitch || 0;
  }

  p.buffer.push({
    x: msg.x,
    y: msg.y,
    z: msg.z,
    yaw: msg.yaw,
    pitch: msg.pitch || 0,
    time: now,
  });

  // Mantém no máximo 10 snapshots recentes (histórico de ~500ms a 20 TPS)
  if (p.buffer.length > 10) {
    p.buffer.shift();
  }
}

export function interpolateRemotePlayer(rp, now = performance.now()) {
  const buf = rp.buffer;
  if (!buf || buf.length === 0) {
    return;
  }

  // Apenas 1 snapshot registrado: posiciona nele diretamente
  if (buf.length === 1) {
    const s = buf[0];
    rp.x = s.x;
    rp.y = s.y;
    rp.z = s.z;
    rp.yaw = s.yaw;
    rp.pitch = s.pitch;
    return;
  }

  const renderTime = now - INTERPOLATION_DELAY_MS;

  // Descarta snapshots velhos no passado que não serão mais consultados
  while (buf.length > 2 && buf[1].time < renderTime) {
    buf.shift();
  }

  // Caso 1: renderTime antes do snapshot mais antigo disponível
  if (renderTime <= buf[0].time) {
    const s = buf[0];
    rp.x = s.x;
    rp.y = s.y;
    rp.z = s.z;
    rp.yaw = s.yaw;
    rp.pitch = s.pitch;
    return;
  }

  // Caso 2: renderTime além do snapshot mais recente (jitter de rede / pacote atrasou)
  const lastIdx = buf.length - 1;
  if (renderTime >= buf[lastIdx].time) {
    const sLast = buf[lastIdx];
    const sPrev = buf[lastIdx - 1];
    const dt = Math.max(1, sLast.time - sPrev.time);
    const overTime = Math.min(100, renderTime - sLast.time); // extrapolação máxima limitada a 100ms
    const factor = overTime / dt;

    // Extrapolação amortecida baseada na velocidade do último trecho
    rp.x = sLast.x + (sLast.x - sPrev.x) * factor * 0.75;
    rp.y = sLast.y + (sLast.y - sPrev.y) * factor * 0.75;
    rp.z = sLast.z + (sLast.z - sPrev.z) * factor * 0.75;
    rp.yaw = sLast.yaw;
    rp.pitch = sLast.pitch;
    return;
  }

  // Caso 3: Interpolação LERP entre dois snapshots conhecidos
  let s0 = buf[0];
  let s1 = buf[1];
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i].time <= renderTime && renderTime <= buf[i + 1].time) {
      s0 = buf[i];
      s1 = buf[i + 1];
      break;
    }
  }

  const duration = s1.time - s0.time;
  const t = duration > 0 ? Math.max(0, Math.min(1, (renderTime - s0.time) / duration)) : 1;

  rp.x = s0.x + (s1.x - s0.x) * t;
  rp.y = s0.y + (s1.y - s0.y) * t;
  rp.z = s0.z + (s1.z - s0.z) * t;
  rp.yaw = lerpAngle(s0.yaw, s1.yaw, t);
  rp.pitch = s0.pitch + (s1.pitch - s0.pitch) * t;
}
