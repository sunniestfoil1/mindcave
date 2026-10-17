// Sincronização de mobs no online (sem dependências, roda em Node e no navegador).
// O HOST é o dono da simulação: IA, física, vida, dano, drops. A cada 2 ticks ele manda a cada convidado a lista dos mobs a até 96 blocos dele
// (pacote 'mobs'); o convidado só desenha cópias ("fantasmas") suavizadas. Golpes, tesoura e ovos do convidado viajam para o host, que decide.
export const MF = { BABY: 1, DEAD: 2, SHEARED: 4, FIRE: 8, AGGRO: 16, SCREAM: 32, GROUND: 64 };
export const MOB_NET_RADIUS = 96;
export const MOB_NET_MAX = 64;
export const GHOST_MISSED_LIMIT = 6;   // pacotes seguidos sem o mob (a 10/s = 0,6 s) até a cópia sumir
export const MOB_HIT_MAX_DAMAGE = 40;
export const MOB_HIT_REACH = 10;       // blocos entre o convidado e o mob que ele diz ter acertado (alcance 3 + atraso + flecha de perto)

const r2 = (v) => Math.round(v * 100) / 100;

export function mobFlags(m) {
  let f = 0;
  if (m.isBaby) f |= MF.BABY;
  if (m.isDead) f |= MF.DEAD;
  if (m.sheared) f |= MF.SHEARED;
  if (m.fireTicks > 0) f |= MF.FIRE;
  if (m.target) f |= MF.AGGRO;
  if (m.screaming) f |= MF.SCREAM;
  if (m.onGround) f |= MF.GROUND;
  return f;
}

// [netId, tipo, x, y, z, yaw, cabeçaYaw, cabeçaPitch, vida, flags, inchaço, tempoDeMorte, tempoDeDano]
export function encodeMob(m) {
  return [m.netId, m.typeId, r2(m.pos.x), r2(m.pos.y), r2(m.pos.z), r2(m.yaw || 0), r2(m.headYaw || 0), r2(m.headPitch || 0),
    Math.round((m.health || 0) * 2) / 2, mobFlags(m), m.swelling ? r2(m.swelling) : 0, m.deathTime | 0, m.hurtTime | 0];
}

export function decodeMob(a) {
  return { netId: a[0], typeId: a[1], x: a[2], y: a[3], z: a[4], yaw: a[5], headYaw: a[6], headPitch: a[7], health: a[8], flags: a[9], swelling: a[10], deathTime: a[11], hurtTime: a[12] };
}

// Os mobs mais próximos de `near` ({x, z}) dentro do raio, até o máximo; assignId(mob) garante o netId
export function buildMobSnapshot(mobs, near, radius = MOB_NET_RADIUS, max = MOB_NET_MAX, assignId = null) {
  const r2sq = radius * radius;
  const list = [];
  for (const m of mobs) {
    if (m.ghost) continue;
    const dx = m.pos.x - near.x, dz = m.pos.z - near.z;
    const d = dx * dx + dz * dz;
    if (d <= r2sq) list.push([d, m]);
  }
  list.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [, m] of list.slice(0, max)) {
    if (!m.netId && assignId) assignId(m);
    if (m.netId) out.push(encodeMob(m));
  }
  return out;
}

// O host confere o golpe que o convidado diz ter dado: dano finito e razoável, mob existente e perto do jogador dele
export function validRemoteHit(msg, mob, playerPos) {
  if (!msg || !mob || mob.isDead) return false;
  const d = Number(msg.dmg);
  if (!Number.isFinite(d) || d <= 0 || d > MOB_HIT_MAX_DAMAGE) return false;
  if (!playerPos) return false;
  const dist = Math.hypot(playerPos.x - mob.pos.x, (playerPos.y ?? mob.pos.y) - mob.pos.y, playerPos.z - mob.pos.z);
  return dist <= MOB_HIT_REACH;
}

export const lerpAngleShort = (a, b, t) => {
  let d = (b - a) % (Math.PI * 2);
  if (d < -Math.PI) d += Math.PI * 2;
  if (d > Math.PI) d -= Math.PI * 2;
  return a + d * t;
};
