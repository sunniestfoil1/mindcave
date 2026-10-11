// Painel da grama: malha REAL do jogo (mesher + atlas + shader), um pedaço de terreno sem mundo.
import * as THREE from 'three';
import { loadRealTextures, makeAtlas } from '/src/game/textures.js';
import { createSharedUniforms, makeOpaqueMaterial } from '/src/game/materials.js';
import { MeshMirror } from '/src/game/meshCore.js';
import { fillSectionMesh } from '/src/game/sectionMesh.js';
import { chunkKey, createChunkData, chunkIndex, packState } from '/src/game/chunk.js';

export async function setup(scene, camera, renderer, api) {
  const atlas = makeAtlas();
  const uniforms = createSharedUniforms();
  uniforms.map.value = atlas.texture;
  const first = Object.values(atlas.tiles)[0];
  uniforms.uTileSize.value.set(first.u1 - first.u0, first.v1 - first.v0);
  uniforms.uFogNear.value = 1000; uniforms.uFogFar.value = 2000; // sem névoa no laboratório
  uniforms.uSkyColor.value.setRGB(1, 1, 1);
  uniforms.uSunBright.value = 1.0;
  const mat = makeOpaqueMaterial(uniforms);
  await loadRealTextures();

  // Terreno: 16×16 de grama sobre terra, com um degrau 3×3 para ver as laterais
  const blocks = createChunkData();
  const GRASS = 2, DIRT = 3, STONE = 1;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    for (let y = 0; y <= 58; y++) blocks[chunkIndex(x, y, z)] = packState(STONE, 0);
    for (let y = 59; y <= 59; y++) blocks[chunkIndex(x, y, z)] = packState(DIRT, 0);
    blocks[chunkIndex(x, 60, z)] = packState(GRASS, 0);
  }
  for (let x = 6; x < 9; x++) for (let z = 6; z < 9; z++) {
    blocks[chunkIndex(x, 61, z)] = packState(GRASS, 0);
    blocks[chunkIndex(x, 60, z)] = packState(DIRT, 0);
  }
  // plantas recortadas sobre a grama (grama alta, dente-de-leão, papoula) e folhas, para ver o contorno das bordas
  const plants = [[2, 2, 31], [3, 4, 31], [4, 2, 31], [2, 5, 37], [11, 3, 38], [12, 5, 31], [13, 3, 31], [10, 11, 31], [11, 11, 31], [12, 12, 31], [3, 12, 37], [4, 11, 31]];
  for (const [x, z, id] of plants) blocks[chunkIndex(x, 61, z)] = packState(id, 1);
  for (let y = 61; y <= 62; y++) for (let x = 1; x <= 2; x++) for (let z = 8; z <= 9; z++) blocks[chunkIndex(x, y, z)] = packState(18, 0);
  const tint = new Uint8Array(256 * 9);
  for (let i = 0; i < 256; i++) { tint.set([124, 189, 107, 72, 181, 24, 63, 118, 228], i * 9); } // grama, folhagem, água (planície)
  const mirror = new MeshMirror();
  mirror.init({ tiles: atlas.tiles, seed: 1, genOpts: null });
  mirror.setChunk(chunkKey(0, 0), 0, 0, blocks, tint, 1);
  const geo = mirror.mesh(chunkKey(0, 0), 0, 0, 3, false);
  const mesh = fillSectionMesh(scene, null, geo.opaque, mat, 0, 0, 3, 0);
  if (!mesh) throw new Error('malha da grama vazia');
  api.mesh = mesh; api.mat = mat; api.uniforms = uniforms; api.atlas = atlas;
  api.ready = true;

  const target = new THREE.Vector3(8, 60.6, 8);
  api.update = () => {
    const ui = window.__lab ? window.__lab.ui : { gDist: 4, gAng: 30, gPitch: 40 };
    const a = (ui.gAng ?? 30) * Math.PI / 180, p = (ui.gPitch ?? 40) * Math.PI / 180, d = ui.gDist ?? 4;
    camera.position.set(target.x + Math.sin(a) * Math.cos(p) * d, target.y + Math.sin(p) * d, target.z + Math.cos(a) * Math.cos(p) * d);
    camera.lookAt(target);
  };
}
