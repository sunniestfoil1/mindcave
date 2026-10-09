// Contêineres: baús, baú duplo, baú do Ender — PRD 06 RF-050
import { stack } from './inventory';

// Tipos de contêiner
export const ContainerType = {
  CHEST: 'chest',
  DOUBLE_CHEST: 'double_chest',
  ENDER_CHEST: 'ender_chest',
  FURNACE: 'furnace',
};

// Cria um contêiner
export function createContainer(type, size = 27) {
  return {
    type,
    slots: new Array(size).fill(null),
  };
}

// Mapa de contêineres por posição (transitório — persistência via chunk delta depois)
const _containers = new Map();

function posKey(x, y, z) { return `${x},${y},${z}`; }

export function getContainer(world, x, y, z) {
  const key = posKey(x, y, z);
  if (_containers.has(key)) return _containers.get(key);
  return null;
}

export function getOrCreateContainer(world, x, y, z, type = 'chest', size = 27) {
  const key = posKey(x, y, z);
  if (!_containers.has(key)) {
    _containers.set(key, createContainer(type, size));
  }
  return _containers.get(key);
}

export function removeContainer(x, y, z) {
  _containers.delete(posKey(x, y, z));
}

// Detecta baú duplo (dois baús lado a lado)
export function detectDoubleChest(world, x, y, z) {
  // Verifica leste/oeste
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const neighbor = world.getBlock(x + dx, y, z + dz);
    if ((neighbor >> 4) === 54) { // baú
      const c1 = getOrCreateContainer(world, x, y, z, 'chest', 27);
      const c2 = getOrCreateContainer(world, x + dx, y, z + dz, 'chest', 27);
      return { slots: [...c1.slots, ...c2.slots], isDouble: true, c1, c2 };
    }
  }
  return null;
}

// Baú do Ender: inventário por jogador
const _enderChests = new Map();

export function getEnderChest(userId) {
  if (!_enderChests.has(userId)) {
    _enderChests.set(userId, createContainer('ender_chest', 27));
  }
  return _enderChests.get(userId);
}

// Limpa contêineres ao descarregar
export function clearContainers() {
  _containers.clear();
}