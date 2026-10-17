// Física autêntica de Blocos com Gravidade e Suporte (Minecraft 1.8.9: BlockFalling & BlockBush)
// - Areia (12), Cascalho (13) e Bigorna (145) caem quando o bloco de baixo é removido
// - Plantas, flores, grama alta, tochas e colheitas quebram e dropam se o bloco de suporte for quebrado
import { stateId, packState } from './chunk';
import { getBlock, isSolid, isFluid, isReplaceable } from './blocks';
import { FLOOR_BOUND_IDS } from './shapes';
import { WALL_META_DIR } from './blocksMore';

// Blocos afetados por gravidade
export const FALLING_BLOCK_IDS = new Set([12, 13, 145]);

// Blocos que requerem suporte no chão (bloco abaixo deve ser sólido)
export const GROUND_SUPPORTED_BLOCKS = new Set([
  6, 31, 37, 38, 39, 40, 55, 59, 70, 72, 78, 83, 104, 105, 115, 141, 142, 32,   // mudas, plantas, fio de redstone, placas, neve, cana, colheitas
  175,                                                                            // planta alta (a de cima depende da de baixo)
  64, 71, 193, 194, 195, 196, 197,                                                // portas (a metade de cima sai junto, ver abaixo)
  ...FLOOR_BOUND_IDS,                                                             // trilhos, placa em pé, bolo, vaso, tapete, repetidor... (shapes.js)
]);

// Onde está o bloco que segura este: devolve [dx, dy, dz] (do bloco até o suporte) ou null se não depende de nenhum.
// Tochas e alavancas/botões/placas/gancho presos na parede dependem do bloco do lado da meta; no chão, do de baixo.
const TORCHES = new Set([50, 75, 76]);
const SWITCHES = new Set([69, 77, 143]);
const WALL_ONLY = new Set([68, 131]);
export function supportOffset(id, meta) {
  const m = meta & 7;
  if (TORCHES.has(id)) return m >= 1 && m <= 4 ? wallOffset(m) : [0, -1, 0];
  if (SWITCHES.has(id)) return m >= 1 && m <= 4 ? wallOffset(m) : m === 5 ? [0, 1, 0] : [0, -1, 0];
  if (WALL_ONLY.has(id)) return wallOffset(Math.min(4, Math.max(1, m)));
  if (GROUND_SUPPORTED_BLOCKS.has(id)) return [0, -1, 0];
  return null;
}
function wallOffset(m) {
  const d = [[-1, 0], [0, -1], [1, 0], [0, 1]][WALL_META_DIR[m]];
  return [d[0], 0, d[1]];
}

export function canFallThrough(id) {
  return id === 0 || isFluid(id) || id === 51 || (isReplaceable(id) && !isSolid(id));
}

/**
 * Processa a quebra em cascata de blocos anexados (grama sobre terra, flores, tochas)
 * e o início de queda para areia/cascalho quando um bloco é destruído.
 */
export function handleBlockBreakPhysics(world, x, y, z, dropCallback = null) {
  // 1. Tudo que estava preso no bloco quebrado (planta em cima, tocha/alavanca/placa ao lado, alavanca no teto) cai e dropa
  const around = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  for (const [dx, dy, dz] of around) {
    const nx = x + dx, ny = y + dy, nz = z + dz;
    const ns = world.getBlock(nx, ny, nz);
    const nid = stateId(ns);
    if (nid === 0) continue;
    const off = supportOffset(nid, ns & 0xf);
    if (!off || nx + off[0] !== x || ny + off[1] !== y || nz + off[2] !== z) continue;
    const blockDef = getBlock(nid);
    const upperHalf = nid === 175 && (ns & 8);   // metade de cima da planta alta: sai sem largar nada (a de baixo larga)
    const dropItem = blockDef?.drop && !upperHalf ? { id: blockDef.drop, count: 1, meta: nid === 175 ? ns & 7 : 0 } : null;
    world.setBlock(nx, ny, nz, 0);
    if (nid === 175 && !upperHalf) world.setBlock(nx, ny + 1, nz, 0);
    if (blockDef.model === 'door') world.setBlock(nx, ny + ((ns & 8) ? -1 : 1), nz, 0); // porta sem chão: cai inteira, dropando 1 item
    if (dropItem && dropCallback) dropCallback(dropItem, { x: nx + 0.5, y: ny + 0.2, z: nz + 0.5 });
  }
  // 1b. Trepadeira ao lado: perde o lado que estava colado no bloco quebrado; sem nenhum lado (e sem bloco em cima) some, sem largar nada
  for (const [dx, dz, bit] of [[1, 0, 2], [-1, 0, 8], [0, 1, 4], [0, -1, 1]]) {   // o vizinho em (+x) tinha este bloco a oeste → bit 2...
    const vs = world.getBlock(x + dx, y, z + dz);
    if (stateId(vs) !== 106 || !((vs & 0xf) & bit)) continue;
    const rest = (vs & 0xf) & ~bit;
    const above = stateId(world.getBlock(x + dx, y + 1, z + dz));
    world.setBlock(x + dx, y, z + dz, rest === 0 && !(isSolid(above) || above === 106) ? 0 : packState(106, rest));
  }
  // 2. Areia/Cascalho acima: cai até encontrar chão sólido
  const aboveId = stateId(world.getBlock(x, y + 1, z));
  if (FALLING_BLOCK_IDS.has(aboveId)) triggerFallingColumn(world, x, y + 1, z, dropCallback);
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
