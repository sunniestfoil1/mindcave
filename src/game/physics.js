// Física AABB 1.8.9 (MC24-RF-020..022): colisão eixo a eixo (Y, X, Z) contra as caixas dos blocos,
// degrau de 0,6, proteção de borda ao agachar — no estilo prismarine-physics.
// ATENÇÃO: world.getBlock devolve o ESTADO (id << 4 | meta); a colisão sempre usa o id do estado.
import { PLAYER } from './constants';
import { BLOCKS } from './blocks';

const EPS = 1e-7;

// Altura da caixa de colisão do bloco (0 = atravessável). Plantas, tochas, fluidos etc. são atravessáveis.
function collisionHeight(state) {
  if (state === 0) return 0;
  const bId = (state >> 4) & 0xfff;
  const b = BLOCKS[bId];
  if (!b || !b.solid) return 0;
  return b.collH === undefined ? 1 : b.collH;
}

// Atrito de blocos vanilla 1.8.9 (Slipperiness - Prismarine Physics)
export function getBlockSlipperiness(state) {
  if (state === 0) return 0.6;
  const id = (state >> 4) & 0xfff;
  if (id === 79 || id === 174) return 0.98; // Gelo / Gelo Compactado
  if (id === 165) return 0.8; // Bloco de Slime
  return 0.6; // Valor padrão de terra, pedra, grama
}

// Caixas planas: [minX, minY, minZ, maxX, maxY, maxZ] * n
const BOX = new Float64Array(6 * 600);
let nBox = 0;

function collect(world, minX, minY, minZ, maxX, maxY, maxZ) {
  nBox = 0;
  const x0 = Math.floor(minX), x1 = Math.floor(maxX);
  const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(255, Math.floor(maxY));
  const z0 = Math.floor(minZ), z1 = Math.floor(maxZ);
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      for (let y = y0; y <= y1; y++) {
        const h = collisionHeight(world.getBlock(x, y, z));
        if (h === 0 || nBox >= 600) continue;
        const o = nBox * 6;
        BOX[o] = x; BOX[o + 1] = y; BOX[o + 2] = z; BOX[o + 3] = x + 1; BOX[o + 4] = y + h; BOX[o + 5] = z + 1;
        nBox++;
      }
    }
  }
}

// bb = [minX, minY, minZ, maxX, maxY, maxZ]
function clipY(bb, dy) {
  for (let i = 0; i < nBox; i++) {
    const o = i * 6;
    if (bb[3] <= BOX[o] + EPS || bb[0] >= BOX[o + 3] - EPS || bb[5] <= BOX[o + 2] + EPS || bb[2] >= BOX[o + 5] - EPS) continue;
    if (dy > 0 && bb[4] <= BOX[o + 1] + EPS) dy = Math.min(dy, BOX[o + 1] - bb[4]);
    else if (dy < 0 && bb[1] >= BOX[o + 4] - EPS) dy = Math.max(dy, BOX[o + 4] - bb[1]);
  }
  return dy;
}

function clipX(bb, dx) {
  for (let i = 0; i < nBox; i++) {
    const o = i * 6;
    if (bb[4] <= BOX[o + 1] + EPS || bb[1] >= BOX[o + 4] - EPS || bb[5] <= BOX[o + 2] + EPS || bb[2] >= BOX[o + 5] - EPS) continue;
    if (dx > 0 && bb[3] <= BOX[o] + EPS) dx = Math.min(dx, BOX[o] - bb[3]);
    else if (dx < 0 && bb[0] >= BOX[o + 3] - EPS) dx = Math.max(dx, BOX[o + 3] - bb[0]);
  }
  return dx;
}

function clipZ(bb, dz) {
  for (let i = 0; i < nBox; i++) {
    const o = i * 6;
    if (bb[4] <= BOX[o + 1] + EPS || bb[1] >= BOX[o + 4] - EPS || bb[3] <= BOX[o] + EPS || bb[0] >= BOX[o + 3] - EPS) continue;
    if (dz > 0 && bb[5] <= BOX[o + 2] + EPS) dz = Math.min(dz, BOX[o + 2] - bb[5]);
    else if (dz < 0 && bb[2] >= BOX[o + 5] - EPS) dz = Math.max(dz, BOX[o + 5] - bb[2]);
  }
  return dz;
}

function intersectsAny(minX, minY, minZ, maxX, maxY, maxZ) {
  for (let i = 0; i < nBox; i++) {
    const o = i * 6;
    if (maxX > BOX[o] + EPS && minX < BOX[o + 3] - EPS && maxY > BOX[o + 1] + EPS && minY < BOX[o + 4] - EPS
      && maxZ > BOX[o + 2] + EPS && minZ < BOX[o + 5] - EPS) return true;
  }
  return false;
}

// A caixa (pés em px,py,pz) intersecta algum bloco sólido?
export function collidesAt(world, px, py, pz, w = PLAYER.width, h = PLAYER.height) {
  const hw = w / 2;
  collect(world, px - hw, py, pz - hw, px + hw, py + h, pz + hw);
  return intersectsAny(px - hw, py, pz - hw, px + hw, py + h, pz + hw);
}

// Move a entidade (pos, vel em blocos/tick) em dt ticks. Retorna { onGround, collidedX, collidedZ }.
export function moveEntity(pos, vel, world, dt, opts = {}) {
  const w = opts.width || PLAYER.width;
  const h = opts.height || PLAYER.height;
  const hw = w / 2;
  let dx = vel.x * dt, dy = vel.y * dt, dz = vel.z * dt;
  const oldDx = dx, oldDy = dy, oldDz = dz;

  const bb = [pos.x - hw, pos.y, pos.z - hw, pos.x + hw, pos.y + h, pos.z + hw];
  const step = PLAYER.stepHeight;
  collect(world,
    bb[0] + Math.min(0, dx) - 0.05, bb[1] + Math.min(0, dy) - 1.05, bb[2] + Math.min(0, dz) - 0.05,
    bb[3] + Math.max(0, dx) + 0.05, bb[4] + Math.max(0, dy) + step + 0.05, bb[5] + Math.max(0, dz) + 0.05);

  // Agachado no chão: não cai da borda (reduz o passo até haver apoio)
  if (opts.sneaking && opts.onGround && !opts.flying) {
    const s = 0.05;
    const supported = (ox, oz) => intersectsAny(bb[0] + ox, bb[1] - 1, bb[2] + oz, bb[3] + ox, bb[4] - 1, bb[5] + oz);
    while (dx !== 0 && !supported(dx, 0)) { if (Math.abs(dx) < s) dx = 0; else dx -= Math.sign(dx) * s; }
    while (dz !== 0 && !supported(0, dz)) { if (Math.abs(dz) < s) dz = 0; else dz -= Math.sign(dz) * s; }
    while (dx !== 0 && dz !== 0 && !supported(dx, dz)) {
      if (Math.abs(dx) < s) dx = 0; else dx -= Math.sign(dx) * s;
      if (Math.abs(dz) < s) dz = 0; else dz -= Math.sign(dz) * s;
    }
  }
  const reqDx = dx, reqDz = dz;
  const start = bb.slice();

  dy = clipY(bb, dy); bb[1] += dy; bb[4] += dy;
  dx = clipX(bb, dx); bb[0] += dx; bb[3] += dx;
  dz = clipZ(bb, dz); bb[2] += dz; bb[5] += dz;

  const landed = oldDy < 0 && dy !== oldDy;
  const hitH = dx !== reqDx || dz !== reqDz;

  // Degrau: sobe até 0,6 se bateu de lado estando no chão
  if (step > 0 && (opts.onGround || landed) && hitH && !opts.flying) {
    const s2 = start.slice();
    const sdy = clipY(s2, step); s2[1] += sdy; s2[4] += sdy;
    const sdx = clipX(s2, reqDx); s2[0] += sdx; s2[3] += sdx;
    const sdz = clipZ(s2, reqDz); s2[2] += sdz; s2[5] += sdz;
    const back = clipY(s2, -sdy); s2[1] += back; s2[4] += back;
    if (sdx * sdx + sdz * sdz > dx * dx + dz * dz + 1e-9 && !intersectsAny(s2[0], s2[1], s2[2], s2[3], s2[4], s2[5])) {
      bb[0] = s2[0]; bb[1] = s2[1]; bb[2] = s2[2]; bb[3] = s2[3]; bb[4] = s2[4]; bb[5] = s2[5];
      dx = sdx; dz = sdz;
      dy = s2[1] - start[1];
    }
  }

  pos.x = (bb[0] + bb[3]) / 2;
  pos.y = bb[1];
  pos.z = (bb[2] + bb[5]) / 2;

  const colX = Math.abs(dx - reqDx) > 1e-9, colZ = Math.abs(dz - reqDz) > 1e-9;
  if (colX) vel.x = 0;
  if (colZ) vel.z = 0;
  if (landed || Math.abs(dy - oldDy) > 1e-9) vel.y = 0;

  return { onGround: landed, collidedX: colX, collidedZ: colZ };
}

// Existe o chunk sob esta posição? Antes dele existir o jogador fica parado (RF-021).
export function chunkLoadedAt(world, x, z) { return world.hasChunkAt(x, z); }

// RF-021: se a caixa intersecta bloco sólido, leva o jogador à posição livre mais próxima ACIMA.
// Retorna true se moveu.
export function unstickPlayer(world, pos, w = PLAYER.width, h = PLAYER.height) {
  if (!collidesAt(world, pos.x, pos.y, pos.z, w, h)) return false;
  const y0 = Math.floor(pos.y);
  for (let y = y0 + 1; y < 255; y++) {
    if (!collidesAt(world, pos.x, y, pos.z, w, h)) { pos.y = y; return true; }
  }
  return false;
}

function normalCube(world, x, y, z) {
  const s = world.getBlock(x, y, z);
  if (s === 0) return false;
  const b = BLOCKS[(s >> 4) & 0xfff];
  return !!(b && b.solid && b.opaque);
}
function openSpace(world, x, y, z) { return !normalCube(world, x, y, z) && !normalCube(world, x, y + 1, z); }

// RF-022: empurrão da 1.8 (0,1 bloco por tick) para o lado livre mais próximo quando parte do corpo está num bloco.
export function pushOutOfBlocks(world, pos) {
  let pushed = false;
  const hw = PLAYER.width * 0.35;
  for (let k = 0; k < 4; k++) {
    const px = pos.x + (k & 1 ? hw : -hw), pz = pos.z + (k & 2 ? hw : -hw);
    const bx = Math.floor(px), by = Math.floor(pos.y + 0.5), bz = Math.floor(pz);
    if (!normalCube(world, bx, by, bz) && !normalCube(world, bx, by + 1, bz)) continue;
    const fx = px - bx, fz = pz - bz;
    let best = 9999, dir = -1;
    if (openSpace(world, bx - 1, by, bz) && fx < best) { best = fx; dir = 0; }
    if (openSpace(world, bx + 1, by, bz) && 1 - fx < best) { best = 1 - fx; dir = 1; }
    if (openSpace(world, bx, by, bz - 1) && fz < best) { best = fz; dir = 2; }
    if (openSpace(world, bx, by, bz + 1) && 1 - fz < best) { best = 1 - fz; dir = 3; }
    if (openSpace(world, bx, by + 1, bz) && 0.5 < best) { dir = 4; }
    if (dir === 0) pos.x -= 0.1; else if (dir === 1) pos.x += 0.1;
    else if (dir === 2) pos.z -= 0.1; else if (dir === 3) pos.z += 0.1;
    else if (dir === 4) pos.y += 0.1;
    if (dir >= 0) pushed = true;
  }
  return pushed;
}