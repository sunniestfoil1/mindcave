// Física autêntica de Blocos com Gravidade e Suporte (Minecraft 1.8.9: BlockFalling & BlockBush)
// - Areia (12), Cascalho (13) e Bigorna (145) caem quando o bloco de baixo é removido
// - Plantas, flores, grama alta, tochas e colheitas quebram e dropam se o bloco de suporte for quebrado
import { stateId, packState } from './chunk';
import { getBlock, isSolid, isFluid, isReplaceable } from './blocks';

// Blocos afetados por gravidade
export const FALLING_BLOCK_IDS = new Set([12, 13, 145]);

// Blocos que requerem suporte no chão (bloco abaixo deve ser sólido)
export const GROUND_SUPPORTED_BLOCKS = new Set([
  6,   // Muda de árvore (sapling)
  31,  // Grama alta (tallgrass)
  37,  // Dente-de-leão (flower)
  38,  // Papoula (rose)
  39,  // Cogumelo marrom
  40,  // Cogumelo vermelho
  50,  // Tocha no chão
  55,  // Redstone no chão
  59,  // Trigo
  70,  // Placa de pressão de pedra
  72,  // Placa de pressão de madeira
  75,  // Tocha de redstone apagada
  76,  // Tocha de redstone
  78,  // Camada de neve
  83,  // Cana-de-açúcar
  104, // Caule de abóbora
  105, // Caule de melancia
  115, // Verruga do nether
  141, // Cenouras
  142, // Batatas
  32, // Arbusto morto
  64, 71, // Portas (a metade de cima sai junto, ver abaixo)
]);

export function canFallThrough(id) {
  return id === 0 || isFluid(id) || id === 51 || (isReplaceable(id) && !isSolid(id));
}

/**
 * Processa a quebra em cascata de blocos anexados (grama sobre terra, flores, tochas)
 * e o início de queda para areia/cascalho quando um bloco é destruído.
 */
export function handleBlockBreakPhysics(world, x, y, z, dropCallback = null) {
  // 1. Bloco de cima: se for planta/flor/tocha apoiada, quebra e dropa
  const aboveState = world.getBlock(x, y + 1, z);
  const aboveId = stateId(aboveState);

  if (GROUND_SUPPORTED_BLOCKS.has(aboveId)) {
    const blockDef = getBlock(aboveId);
    const dropItem = blockDef?.drop ? { id: blockDef.drop, count: 1, meta: 0 } : null;
    world.setBlock(x, y + 1, z, 0);
    if (aboveId === 64 || aboveId === 71) world.setBlock(x, y + 2, z, 0); // porta sem chão: cai inteira, dropando 1 item
    if (dropItem && dropCallback) {
      dropCallback(dropItem, { x: x + 0.5, y: y + 1.2, z: z + 0.5 });
    }
  } else if (FALLING_BLOCK_IDS.has(aboveId)) {
    // 2. Areia/Cascalho acima: cai até encontrar chão sólido
    triggerFallingColumn(world, x, y + 1, z, dropCallback);
  }

  // 3. Tochas nas paredes vizinhas fixadas neste bloco
  const neighbors = [
    [1, 0, 0, 2],  // vizinho no +X, tocha aponta p/ -X (meta 2)
    [-1, 0, 0, 1], // vizinho no -X, tocha aponta p/ +X (meta 1)
    [0, 0, 1, 4],  // vizinho no +Z, tocha aponta p/ -Z (meta 4)
    [0, 0, -1, 3], // vizinho no -Z, tocha aponta p/ +Z (meta 3)
  ];
  for (const [dx, dy, dz, wallMeta] of neighbors) {
    const nx = x + dx, ny = y + dy, nz = z + dz;
    const ns = world.getBlock(nx, ny, nz);
    const nid = stateId(ns);
    if (nid === 50 || nid === 75 || nid === 76 || nid === 69 || nid === 77) {
      const meta = ns & 0xf;
      if (meta === wallMeta) {
        const bDef = getBlock(nid);
        const dropItem = bDef?.drop ? { id: bDef.drop, count: 1, meta: 0 } : null;
        world.setBlock(nx, ny, nz, 0);
        if (dropItem && dropCallback) {
          dropCallback(dropItem, { x: nx + 0.5, y: ny + 0.5, z: nz + 0.5 });
        }
      }
    }
  }
}

/**
 * Derruba uma coluna de areia/cascalho para baixo
 */
export function triggerFallingColumn(world, startX, startY, startZ, dropCallback = null) {
  let curY = startY;
  const blocksToFall = [];

  // Coleta a coluna contínua de areia/cascalho subindo
  while (curY < 256) {
    const s = world.getBlock(startX, curY, startZ);
    const id = stateId(s);
    if (!FALLING_BLOCK_IDS.has(id)) break;
    blocksToFall.push({ id, state: s, origY: curY });
    world.setBlock(startX, curY, startZ, 0);
    curY++;
  }

  if (blocksToFall.length === 0) return;

  // Encontra o piso onde a areia vai pousar
  let landY = startY - 1;
  while (landY > 0) {
    const belowState = world.getBlock(startX, landY, startZ);
    const belowId = stateId(belowState);
    if (!canFallThrough(belowId)) break;
    landY--;
  }
  landY++; // Posição do primeiro bloco acima do solo sólido

  // Deposita os blocos na nova posição mais baixa
  for (let i = 0; i < blocksToFall.length; i++) {
    const b = blocksToFall[i];
    const targetY = landY + i;
    if (targetY < 256) {
      world.setBlock(startX, targetY, startZ, b.state);
    } else if (dropCallback) {
      // Fora do mundo: vira drop
      dropCallback({ id: b.id, count: 1, meta: 0 }, { x: startX + 0.5, y: 255, z: startZ + 0.5 });
    }
  }
}

/**
 * Varre blocos com gravidade soltos perto do jogador (MCP 1.8.9: BlockFalling tick)
 */
export function tickNearbyFallingBlocks(world, px, py, pz, radius = 12) {
  const minX = Math.floor(px - radius), maxX = Math.floor(px + radius);
  const minZ = Math.floor(pz - radius), maxZ = Math.floor(pz + radius);
  const minY = Math.max(1, Math.floor(py - 8)), maxY = Math.min(250, Math.floor(py + 8));

  // Amostra aleatória para alta performance sem lag
  for (let i = 0; i < 8; i++) {
    const x = minX + Math.floor(Math.random() * (maxX - minX + 1));
    const z = minZ + Math.floor(Math.random() * (maxZ - minZ + 1));
    const y = minY + Math.floor(Math.random() * (maxY - minY + 1));

    const s = world.getBlock(x, y, z);
    const id = stateId(s);
    if (FALLING_BLOCK_IDS.has(id)) {
      const below = stateId(world.getBlock(x, y - 1, z));
      if (canFallThrough(below)) {
        triggerFallingColumn(world, x, y, z);
      }
    }
  }
}
