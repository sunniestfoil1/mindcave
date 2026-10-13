// Painel da grama: malha REAL do jogo (mesher + atlas + shader), um pedaço de terreno sem mundo.
import * as THREE from 'three';
import { loadRealTextures, makeAtlas } from '/src/game/textures.js';
import { createSharedUniforms, makeOpaqueMaterial } from '/src/game/materials.js';
import { MeshMirror } from '/src/game/meshCore.js';
import { fillSectionMesh } from '/src/game/sectionMesh.js';
import { chunkKey, createChunkData, chunkIndex, packState } from '/src/game/chunk.js';
import { generateChunk } from '/src/game/worldgen.js';

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
  // ?shape=1 mostra lajes e escadas (todos os tipos, de baixo/de cima, duplas, invertidas e cantos) com a malha real
  const qs = new URLSearchParams(location.search);
  const shapeMode = !!qs.get('shape');
  if (shapeMode) {
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) blocks[chunkIndex(x, 61, z)] = 0;
    for (let x = 6; x < 9; x++) for (let z = 6; z < 9; z++) { blocks[chunkIndex(x, 61, z)] = 0; blocks[chunkIndex(x, 60, z)] = packState(GRASS, 0); }
    const put = (x, z, id, meta = 0, y = 61) => { blocks[chunkIndex(x, y, z)] = packState(id, meta); };
    for (let v = 0; v < 8; v++) { put(1 + v, 2, 44, v); put(1 + v, 4, 44, 8 | v); put(1 + v, 6, 43, v); } // lajes: baixo, cima, dupla
    for (let v = 0; v < 6; v++) put(1 + v, 8, 126, v);
    put(9, 8, 182, 0);
    for (let m = 0; m < 4; m++) put(1 + m, 11, 53, m);            // escada de carvalho nas 4 direções
    for (let m = 0; m < 4; m++) put(6 + m, 11, 67, 4 | m);        // pedregulho, invertidas
    put(11, 9, 156, 3); put(11, 8, 156, 1);                       // quartzo: canto externo (frente sobe p/ oeste)
    put(13, 12, 109, 3); put(13, 13, 109, 1);                     // tijolo de pedra: canto interno
    put(11, 12, 134, 0); put(12, 12, 134, 0); put(13, 14, 180, 2); put(1, 13, 128, 2); put(2, 13, 114, 2); put(3, 13, 108, 2);
    // camas nas 4 direções (pé + cabeceira com o bit 8)
    put(12, 1, 26, 0); put(12, 2, 26, 8); put(14, 1, 26, 2); put(14, 0, 26, 10); put(11, 4, 26, 3); put(12, 4, 26, 11); put(15, 6, 26, 1); put(14, 6, 26, 9);
    // cercas (com cantos e ligadas a bloco), portões fechado/aberto, portas fechada/aberta/dobradiça direita
    put(1, 0, 85); put(2, 0, 85); put(3, 0, 85); put(3, 1, 85); put(4, 0, 107, 1); put(5, 0, 85); put(5, 1, 1);
    put(6, 0, 107, 1 | 4); put(8, 0, 113); put(9, 0, 113);
    put(7, 1, 64, 1); put(7, 1, 64, 8, 62); put(10, 1, 64, 1 | 4); put(10, 1, 64, 8, 62); put(12, 1, 71, 2); put(12, 1, 71, 8 | 1, 62);
    put(5, 14, 53, 0); put(6, 14, 53, 0, 61); put(6, 14, 53, 0, 62); // degraus empilhados
  }
  const tint = new Uint8Array(256 * 9);
  for (let i = 0; i < 256; i++) { tint.set([124, 189, 107, 72, 181, 24, 63, 118, 228], i * 9); } // grama, folhagem, água (planície)
  // ?real=cx,cz troca o terreno de brinquedo por chunks gerados pelo próprio jogo (árvores, relevo)
  const real = new URLSearchParams(location.search).get('real');
  const mirror = new MeshMirror();
  mirror.init({ tiles: atlas.tiles, seed: 1, genOpts: null });
  let target = new THREE.Vector3(8, 60.6, 8);
  if (real) {
    const [rcx, rcz] = real.split(',').map(Number);
    let topY = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const d = generateChunk(29270812, rcx + dx, rcz + dz, { generatorId: 'open_world' });
      mirror.setChunk(chunkKey(rcx + dx, rcz + dz), rcx + dx, rcz + dz, d, tint, 1);
    }
    for (let sy = 0; sy < 16; sy++) {
      const g = mirror.mesh(chunkKey(rcx, rcz), rcx, rcz, sy, false);
      if (g.opaque) { fillSectionMesh(scene, null, g.opaque, mat, 0, rcx, sy, rcz); topY = Math.max(topY, sy * 16 + 16); }
    }
    const cd = generateChunk(29270812, rcx, rcz, { generatorId: 'open_world' });
    let sy0 = 0;
    for (let y = 255; y > 0; y--) if (cd[chunkIndex(8, y, 8)] !== 0) { sy0 = y; break; }
    target = new THREE.Vector3(rcx * 16 + 8, sy0 + 2, rcz * 16 + 8);
    api.mat = mat; api.uniforms = uniforms; api.atlas = atlas; api.ready = true;
  } else {
    mirror.setChunk(chunkKey(0, 0), 0, 0, blocks, tint, 1);
    const geo = mirror.mesh(chunkKey(0, 0), 0, 0, 3, false);
    const mesh = fillSectionMesh(scene, null, geo.opaque, mat, 0, 0, 3, 0);
    if (!mesh) throw new Error('malha da grama vazia');
    api.mesh = mesh; api.mat = mat; api.uniforms = uniforms; api.atlas = atlas;
    api.ready = true;
  }

  api.update = () => {
    const ui = window.__lab ? window.__lab.ui : { gDist: 4, gAng: 30, gPitch: 40 };
    const a = (ui.gAng ?? 30) * Math.PI / 180, p = (ui.gPitch ?? 40) * Math.PI / 180, d = ui.gDist ?? 4;
    if (shapeMode) {
      const q = new URLSearchParams(location.search);
      const sa = Number(q.get('a') ?? 20) * Math.PI / 180, sp = Number(q.get('p') ?? 50) * Math.PI / 180, sd = Number(q.get('d') ?? 16);
      const t = new THREE.Vector3(Number(q.get('x') ?? 8), 61, Number(q.get('z') ?? 8));
      camera.position.set(t.x + Math.sin(sa) * Math.cos(sp) * sd, t.y + Math.sin(sp) * sd, t.z + Math.cos(sa) * Math.cos(sp) * sd);
      camera.lookAt(t);
      return;
    }
    camera.position.set(target.x + Math.sin(a) * Math.cos(p) * d, target.y + Math.sin(p) * d, target.z + Math.cos(a) * Math.cos(p) * d);
    camera.lookAt(target);
  };
}
