// Blocos do Aether (dimensão de ilhas no céu). Ids 210–215, sem colisão com os do 1.8.9 (o maior usado é o 201).
// O visual vem de ladrilhos montados em textures.js (composeAether): grama azul-esverdeada, pedra sagrada, nuvens e portal azul animado.
export const AETHER = { GRASS: 210, HOLYSTONE: 211, CLOUD_COLD: 212, CLOUD_BLUE: 213, CLOUD_GOLD: 214, PORTAL: 215 };
export const CLOUD_IDS = [AETHER.CLOUD_COLD, AETHER.CLOUD_BLUE, AETHER.CLOUD_GOLD];

export function registerAetherBlocks({ BLOCKS, B }) {
  BLOCKS[AETHER.GRASS] = B(AETHER.GRASS, 'aether_grass', 'Grama do Aether', { hardness: 0.6, faces: { top: 'aether_grass_top', bottom: 'dirt', side: 'aether_grass_side' }, drop: 3, soundCategory: 'grass' });
  BLOCKS[AETHER.HOLYSTONE] = B(AETHER.HOLYSTONE, 'holystone', 'Pedra Sagrada', { hardness: 0.5, faces: { all: 'holystone' }, drop: AETHER.HOLYSTONE });
  // nuvens: cubos macios; a azul quica quem cai nela e a dourada quica mais (a física está no motor, via `bounce`)
  BLOCKS[AETHER.CLOUD_COLD] = B(AETHER.CLOUD_COLD, 'cold_aercloud', 'Nuvem Fria', { hardness: 0.2, faces: { all: 'cloud_cold' }, drop: AETHER.CLOUD_COLD, soundCategory: 'wool' });
  BLOCKS[AETHER.CLOUD_BLUE] = B(AETHER.CLOUD_BLUE, 'blue_aercloud', 'Nuvem Azul', { hardness: 0.2, faces: { all: 'cloud_blue' }, drop: AETHER.CLOUD_BLUE, soundCategory: 'wool', bounce: 1.0 });
  BLOCKS[AETHER.CLOUD_GOLD] = B(AETHER.CLOUD_GOLD, 'golden_aercloud', 'Nuvem Dourada', { hardness: 0.2, faces: { all: 'cloud_golden' }, drop: AETHER.CLOUD_GOLD, soundCategory: 'wool', bounce: 1.6 });
  // portal do Aether: o mesmo plano fino do portal do Nether, com a textura azul; hardness -1 (some só quando a moldura quebra)
  BLOCKS[AETHER.PORTAL] = B(AETHER.PORTAL, 'aether_portal', 'Portal do Aether', {
    model: 'portal', hardness: -1, faces: { all: 'aether_portal' }, drop: null, solid: false, opaque: false, render: 'translucent',
    lightOpacity: 0, lightEmission: 11, replaceable: false, soundCategory: 'glass', hiddenInCreative: true,
  });
}
