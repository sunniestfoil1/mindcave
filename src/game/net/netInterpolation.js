// Entity Interpolation (Snapshot Buffer com LERP temporal)
// Padrão de sincronização suave de rede — Minecraft 1.8.9 / Eaglercraft / Source Engine.
// Três cuidados que faltavam e causavam o "jogador voa 20 blocos para a frente e volta" no PvP:
//  1) cada pacote leva a hora do REMETENTE (ts); o instante do snapshot é ts + deslocamento de relógio estimado, não a hora em que o pacote
//     chegou (pacotes que chegam juntos, em rajada, tinham 1 ms de diferença e a velocidade estimada ia para o céu);
//  2) a extrapolação (pacote atrasado) usa um intervalo mínimo e tem teto de distância;
//  3) só extrapola quando o último snapshot é recente (jogador parado não "escorrega").

export const INTERPOLATION_DELAY_MS = 100; // 2 pacotes de 50 ms: absorve jitter de rede sem atraso perceptível
const MIN_DT_MS = 30;          // intervalo mínimo ao estimar velocidade (o normal é 50 ms)
const MAX_EXTRAPOLATE_MS = 100;
const MAX_EXTRAPOLATE_BLOCKS = 1.2;
const FRESH_MS = 160;          // snapshot mais velho que isto = jogador parado ou sem sinal: não extrapola

// Bits de pose enviados em `st` no pacote de posição
export const POSE = { SNEAK: 1, SPRINT: 2, BLOCK: 4, BOW: 8, EAT: 16, FLY: 32, SLEEP: 64 };

export function lerpAngle(a, b, t) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * t;
}

export function recordPlayerSnapshot(p, msg, now = performance.now()) {
  p.name = msg.n || p.name;
  p.isDead = !!msg.dead;
  p.sleeping = !!msg.sleeping;
  p.held = msg.h || 0;
  p.heldMeta = msg.hm | 0;
  p.voice = msg.v | 0;
  p.armor = msg.a | 0;
  p.gameMode = ['survival', 'creative', 'adventure', 'spectator'][msg.g | 0] || 'survival';
  // pose: agachar, correr, bloquear, arco, comer — chegam junto com a posição, na hora
  const st = msg.st | 0;
  p.pose = st;
  p.sneaking = !!(st & POSE.SNEAK);
  p.sprinting = !!(st & POSE.SPRINT);
  p.blocking = !!(st & POSE.BLOCK);
  p.bowDrawing = !!(st & POSE.BOW);
  p.eating = !!(st & POSE.EAT);
  p.flying = !!(st & POSE.FLY);
  p.bowCharge = (msg.bc | 0) / 100;
  p.dig = Array.isArray(msg.dg) && msg.dg.length === 4 && msg.dg.every(Number.isFinite) ? { x: msg.dg[0], y: msg.dg[1], z: msg.dg[2], stage: msg.dg[3] } : null;   // bloco que ele está quebrando
  if (msg.sw !== undefined) p.swingCount = msg.sw | 0;   // contador de golpes: cada incremento = um balanço de braço (não se perde se o pacote seguinte já chegou)

  if (!p.buffer) p.buffer = [];

  // Hora do snapshot = hora do remetente + deslocamento mínimo observado (o pacote mais rápido define o "atraso zero"; sobe devagar para
  // acompanhar a deriva dos relógios). Sem ts (cliente antigo): hora de chegada.
  let time = now;
  if (typeof msg.ts === 'number') {
    const off = now - msg.ts;
    p.clockOff = p.clockOff === undefined ? off : Math.min(off, p.clockOff + 0.3);
    time = msg.ts + p.clockOff;
  }
  if (p.buffer.length && time <= p.buffer[p.buffer.length - 1].time) time = p.buffer[p.buffer.length - 1].time + 0.01;   // sempre crescente

  // Teleporte (> 8 blocos): limpa o buffer e move instantaneamente sem LERP
  if (p.x !== undefined) {
    const dx = msg.x - p.x, dy = msg.y - p.y, dz = msg.z - p.z;
    if (dx * dx + dy * dy + dz * dz > 64) {
      p.buffer.length = 0;
      p.x = msg.x; p.y = msg.y; p.z = msg.z;
      p.yaw = msg.yaw; p.pitch = msg.pitch || 0;
    }
  } else {
    p.x = msg.x; p.y = msg.y; p.z = msg.z;
    p.yaw = msg.yaw; p.pitch = msg.pitch || 0;
  }

  p.buffer.push({ x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw, pitch: msg.pitch || 0, time, arrived: now });

  // Mantém no máximo 12 snapshots recentes
  if (p.buffer.length > 12) p.buffer.shift();
}

function put(rp, s) {
  rp.x = s.x; rp.y = s.y; rp.z = s.z;
  rp.yaw = s.yaw; rp.pitch = s.pitch;
}

export function interpolateRemotePlayer(rp, now = performance.now()) {
  const buf = rp.buffer;
  if (!buf || buf.length === 0) return;
  // Apenas 1 snapshot registrado: posiciona nele diretamente
  if (buf.length === 1) { put(rp, buf[0]); return; }

  // os instantes dos snapshots já estão na linha do tempo local (hora do remetente + deslocamento), então `now` é a referência
  const renderTime = now - INTERPOLATION_DELAY_MS;

  // Descarta snapshots velhos no passado que não serão mais consultados
  while (buf.length > 2 && buf[1].time < renderTime) buf.shift();

  // Caso 1: renderTime antes do snapshot mais antigo disponível
  if (renderTime <= buf[0].time) { put(rp, buf[0]); return; }

  const last = buf.length - 1;
  const sLast = buf[last];

  // Caso 2: renderTime além do snapshot mais recente (pacote atrasou)
  if (renderTime >= sLast.time) {
    const sPrev = buf[last - 1];
    const sinceArrival = now - sLast.arrived;
    if (sinceArrival > FRESH_MS) { put(rp, sLast); return; }   // parado ou sem sinal: fica onde o último pacote disse
    const dt = Math.max(MIN_DT_MS, sLast.time - sPrev.time);
    const over = Math.min(MAX_EXTRAPOLATE_MS, renderTime - sLast.time);
    let ex = (sLast.x - sPrev.x) / dt * over * 0.75, ey = (sLast.y - sPrev.y) / dt * over * 0.75, ez = (sLast.z - sPrev.z) / dt * over * 0.75;
    const len = Math.hypot(ex, ey, ez);
    if (len > MAX_EXTRAPOLATE_BLOCKS) { const k = MAX_EXTRAPOLATE_BLOCKS / len; ex *= k; ey *= k; ez *= k; }
    rp.x = sLast.x + ex; rp.y = sLast.y + ey; rp.z = sLast.z + ez;
    rp.yaw = sLast.yaw; rp.pitch = sLast.pitch;
    return;
  }

  // Caso 3: Interpolação LERP entre dois snapshots conhecidos
  let s0 = buf[0], s1 = buf[1];
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i].time <= renderTime && renderTime <= buf[i + 1].time) { s0 = buf[i]; s1 = buf[i + 1]; break; }
  }
  const duration = s1.time - s0.time;
  const t = duration > 0 ? Math.max(0, Math.min(1, (renderTime - s0.time) / duration)) : 1;
  rp.x = s0.x + (s1.x - s0.x) * t;
  rp.y = s0.y + (s1.y - s0.y) * t;
  rp.z = s0.z + (s1.z - s0.z) * t;
  rp.yaw = lerpAngle(s0.yaw, s1.yaw, t);
  rp.pitch = s0.pitch + (s1.pitch - s0.pitch) * t;
}
