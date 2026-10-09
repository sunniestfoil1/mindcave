// Algoritmo de explosão — PRD 11 §2 (1.8.9)
import { stateId, stateMeta, packState } from './chunk';
import { getBlock, isWater, isSolid } from './blocks';

const TNT = 46, FIRE = 51;

// Explosão principal: destrói blocos por raios, gera drops, cadeia de TNT
export function explode(world, pos, power, options = {}) {
  const { fire = false, breakBlocks = true, dropItems = true } = options;

  // Verifica se está na água — não destrói blocos mas fere entidades
  const centerState = world.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
  const inWater = isWater(stateId(centerState));
  const actualBreak = breakBlocks && !inWater;

  const destroyed = new Set();
  const rays = 16;

  for (let ix = 0; ix < rays; ix++) {
    for (let iy = 0; iy < rays; iy++) {
      for (let iz = 0; iz < rays; iz++) {
        // Só a casca externa
        if (ix > 0 && ix < rays-1 && iy > 0 && iy < rays-1 && iz > 0 && iz < rays-1) continue;

        let dx = (ix / (rays-1)) * 2 - 1;
        let dy = (iy / (rays-1)) * 2 - 1;
        let dz = (iz / (rays-1)) * 2 - 1;
        const len = Math.hypot(dx, dy, dz);
        if (len < 0.001) continue;
        dx /= len; dy /= len; dz /= len;

        let intensity = power * (0.7 + Math.random() * 0.6);
        let cx = pos.x, cy = pos.y, cz = pos.z;

        for (let step = 0; step < power * 2 / 0.3 + 4 && intensity > 0; step++) {
          cx += dx * 0.3;
          cy += dy * 0.3;
          cz += dz * 0.3;

          const bx = Math.floor(cx), by = Math.floor(cy), bz = Math.floor(cz);
          const k = bx + ',' + by + ',' + bz;
          if (destroyed.has(k)) { intensity -= 0.225 * 0.3; continue; }

          const state = world.getBlock(bx, by, bz);
          const id = stateId(state);
          if (id === 0) { intensity -= 0.225 * 0.3; continue; }

          const block = getBlock(id);
          if (block.hardness < 0) { intensity = 0; break; } // bedrock

          const resistance = block.resistance || block.hardness || 1;
          intensity -= (resistance + 0.3) * 0.3;
          intensity -= 0.225 * 0.3;

          if (intensity > 0 && actualBreak) {
            destroyed.add(k);
          }
        }
      }
    }
  }

  // Aplicar destruição
  const result = { destroyed: [], chainTNT: [], droppedItems: [], pos, power, inWater };

  for (const k of destroyed) {
    const parts = k.split(',');
    const bx = +parts[0], by = +parts[1], bz = +parts[2];
    const state = world.getBlock(bx, by, bz);
    const id = stateId(state);
    if (id === 0) continue;

    // Cadeia de TNT
    if (id === TNT) {
      result.chainTNT.push({ x: bx + 0.5, y: by + 0.5, z: bz + 0.5, delay: 10 + Math.floor(Math.random() * 20) });
    }

    // Drops com chance 1/power
    if (dropItems && Math.random() < 1 / power) {
      const block = getBlock(id);
      if (block.drop) {
        result.droppedItems.push({ id: block.drop, x: bx + 0.5, y: by + 0.5, z: bz + 0.5 });
      }
    }

    world.setBlock(bx, by, bz, 0);
    result.destroyed.push({ x: bx, y: by, z: bz });
  }

  // Fogo opcional
  if (fire && !inWater) {
    for (const k of destroyed) {
      if (Math.random() < 0.25) {
        const parts = k.split(',');
        const bx = +parts[0], by = +parts[1], bz = +parts[2];
        if (stateId(world.getBlock(bx, by, bz)) === 0) {
          world.setBlock(bx, by, bz, packState(FIRE, 0));
        }
      }
    }
  }

  return result;
}

// Dano e knockback para entidades
export function getExplosionDamage(entityPos, explosionPos, power) {
  const dx = entityPos.x - explosionPos.x;
  const dy = (entityPos.y + 0.5) - explosionPos.y;
  const dz = entityPos.z - explosionPos.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > power * 2) return { damage: 0, knockback: { x: 0, y: 0, z: 0 } };

  const exposure = 1; // Simplificado — MC fazia raycast para obstrução
  const damage = (1 - dist / (power * 2)) * power * 4 * exposure;
  const kbMag = damage * 0.15;
  const len = dist || 1;
  const knockback = {
    x: (dx / len) * kbMag,
    y: 0.3 + kbMag * 0.3,
    z: (dz / len) * kbMag,
  };
  return { damage: Math.max(0, damage), knockback };
}