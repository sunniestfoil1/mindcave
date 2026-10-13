// Operações de região (/fill e /clone) numa única implementação: o host as executa pelo comando e os convidados as repetem a
// partir da mensagem de rede (FILL / CLONE), em vez de uma mensagem por bloco (até 32768 blocos).
import { stateId } from '../chunk';

export const MAX_REGION = 32768; // limite do 1.8.9

export function regionVolume(x1, y1, z1, x2, y2, z2) {
  return (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1) * (Math.abs(z2 - z1) + 1);
}

const isInt = (v) => Number.isInteger(v) && Math.abs(v) < 30000000;

// Valida os números de uma mensagem vinda da rede (nunca confiar: volume e limites)
export function validRegion(m, keys) {
  if (!m || !keys.every(k => isInt(m[k]))) return false;
  return regionVolume(m.x1, m.y1, m.z1, m.x2, m.y2, m.z2) <= MAX_REGION;
}

// Preenche a caixa com `state`. mode: 'replace' (padrão) | 'keep' (só onde há ar). Devolve quantos blocos mudaram.
export function fillRegion(world, m, onChange) {
  const x0 = Math.min(m.x1, m.x2), x1 = Math.max(m.x1, m.x2);
  const y0 = Math.min(m.y1, m.y2), y1 = Math.max(m.y1, m.y2);
  const z0 = Math.min(m.z1, m.z2), z1 = Math.max(m.z1, m.z2);
  let placed = 0;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    if (m.mode === 'keep' && stateId(world.getBlock(x, y, z)) !== 0) continue;
    world.setBlock(x, y, z, m.blockState);
    onChange?.(x, y, z, m.blockState);
    placed++;
  }
  return placed;
}

// Copia a caixa de origem para o destino (dx, dy, dz = canto mínimo de destino). Lê tudo antes de escrever (origem e destino podem se sobrepor).
export function cloneRegion(world, m, onChange) {
  const x0 = Math.min(m.x1, m.x2), x1 = Math.max(m.x1, m.x2);
  const y0 = Math.min(m.y1, m.y2), y1 = Math.max(m.y1, m.y2);
  const z0 = Math.min(m.z1, m.z2), z1 = Math.max(m.z1, m.z2);
  const blocks = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) blocks.push(world.getBlock(x, y, z));
  let i = 0;
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const state = blocks[i++];
    const tx = m.dx + (x - x0), ty = m.dy + (y - y0), tz = m.dz + (z - z0);
    world.setBlock(tx, ty, tz, state);
    onChange?.(tx, ty, tz, state);
  }
  return blocks.length;
}
