// Pathfinding A* em grade de blocos — PRD 08 RF-003
import { isSolid, isWater, isLava } from './blocks';
import { stateId } from './chunk';

const MAX_NODES = 300;

// Verifica se um nó é caminhável para um mob de dada largura/altura
function isWalkable(world, x, y, z, mob) {
  const feet = stateId(world.getBlock(x, y, z));
  const head = stateId(world.getBlock(x, y + 1, z));
  const ground = stateId(world.getBlock(x, y - 1, z));

  // Espaço livre (2 blocos para bípedes, 1 para aranhas)
  const needHeight = mob.height > 1 ? 2 : 1;
  if (isSolid(feet) || isSolid(head)) return false;
  if (needHeight === 2 && isSolid(stateId(world.getBlock(x, y + 2, z)))) return false;

  // Chão sólido
  if (!isSolid(ground)) {
    // Pode andar na água (nadar)
    if (!isWater(feet) && !isWater(ground)) return false;
  }

  // Evita perigos
  if (isLava(feet) || isLava(ground)) return false;
  if (feet === 51 || ground === 51) return false; // fire
  if (feet === 141 || ground === 141) return false; // cactus

  return true;
}

// Nó do A*
function Node(x, y, z, parent, g, h) {
  return { x, y, z, parent, g, h, f: g + h, key: x + ',' + y + ',' + z };
}

function heuristic(x1, y1, z1, x2, y2, z2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2) + Math.abs(z1 - z2);
}

// Encontra caminho de (sx,sy,sz) para (tx,ty,tz)
export function findPath(world, start, target, mob) {
  const sx = Math.floor(start.x), sy = Math.floor(start.y), sz = Math.floor(start.z);
  const tx = Math.floor(target.x), ty = Math.floor(target.y), tz = Math.floor(target.z);

  // Se alvo muito longe, não tenta
  if (Math.abs(sx - tx) + Math.abs(sz - tz) > (mob.followRange || 40)) return null;

  const open = [Node(sx, sy, sz, null, 0, heuristic(sx, sy, sz, tx, ty, tz))];
  const closed = new Set();
  let nodesExplored = 0;

  while (open.length > 0 && nodesExplored < MAX_NODES) {
    // Pega nó com menor f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    nodesExplored++;

    // Chegou no alvo (com tolerância ±1 em Y)
    if (current.x === tx && current.z === tz && Math.abs(current.y - ty) <= 2) {
      const path = [];
      let n = current;
      while (n) { path.unshift({ x: n.x + 0.5, y: n.y, z: n.z + 0.5 }); n = n.parent; }
      return path;
    }

    closed.add(current.key);

    // Vizinhos: 4 direções + subir/descer
    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
    ];

    for (const [dx, dz] of dirs) {
      const nx = current.x + dx, nz = current.z + dz;

      // Mesmo nível
      if (isWalkable(world, nx, current.y, nz, mob) && !closed.has(nx + ',' + current.y + ',' + nz)) {
        const n = Node(nx, current.y, nz, current, current.g + 1, heuristic(nx, current.y, nz, tx, ty, tz));
        const existing = open.find(o => o.key === n.key);
        if (!existing || n.g < existing.g) {
          if (existing) { existing.g = n.g; existing.f = n.f; existing.parent = current; }
          else open.push(n);
        }
        continue;
      }

      // Subir 1
      if (isWalkable(world, nx, current.y + 1, nz, mob) && isSolid(stateId(world.getBlock(current.x, current.y - 1, current.z)))) {
        const ny = current.y + 1;
        if (!closed.has(nx + ',' + ny + ',' + nz)) {
          const n = Node(nx, ny, nz, current, current.g + 1.2, heuristic(nx, ny, nz, tx, ty, tz));
          const existing = open.find(o => o.key === n.key);
          if (!existing || n.g < existing.g) {
            if (existing) { existing.g = n.g; existing.f = n.f; existing.parent = current; }
            else open.push(n);
          }
        }
      }

      // Descer até 3
      for (let dy = 1; dy <= 3; dy++) {
        const ny = current.y - dy;
        if (isWalkable(world, nx, ny, nz, mob)) {
          if (!closed.has(nx + ',' + ny + ',' + nz)) {
            const n = Node(nx, ny, nz, current, current.g + 1, heuristic(nx, ny, nz, tx, ty, tz));
            const existing = open.find(o => o.key === n.key);
            if (!existing || n.g < existing.g) {
              if (existing) { existing.g = n.g; existing.f = n.f; existing.parent = current; }
              else open.push(n);
            }
          }
          break; // primeiro nível descendo que é caminhável
        }
      }
    }
  }

  return null; // sem caminho
}

// Verifica se há linha de visão entre dois pontos (para alvo)
export function hasLineOfSight(world, from, to) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.1) return true;
  const steps = Math.ceil(len / 0.5);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = from.x + dx * t, y = from.y + dy * t, z = from.z + dz * t;
    if (isSolid(stateId(world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))))) return false;
  }
  return true;
}