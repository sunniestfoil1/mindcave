// Chuva e neve instanciadas (PRD 23 RF-022): 1 draw call cada, cores neutras, nenhum objeto novo por quadro.
import * as THREE from 'three';
import { mulberry32 } from './prng';

const COUNT = 500;
const BOX_XZ = 32;
const BOX_Y = 24;

function makeLayer(scene, geo, color, opacity, rng) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.visible = false;
  const m = new THREE.Matrix4();
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (rng() - 0.5) * BOX_XZ;
    pos[i * 3 + 1] = (rng() - 0.5) * BOX_Y;
    pos[i * 3 + 2] = (rng() - 0.5) * BOX_XZ;
    mesh.setMatrixAt(i, m.identity());
  }
  mesh.userData.pos = pos;
  scene.add(mesh);
  return mesh;
}

export class Precipitation {
  constructor(scene, seed) {
    this.scene = scene;
    const rng = mulberry32((seed ^ 0x11aa) >>> 0);
    this.rain = makeLayer(scene, new THREE.BoxGeometry(0.02, 0.6, 0.02), 0xb4c4dc, 0.55, rng);
    this.snow = makeLayer(scene, new THREE.BoxGeometry(0.08, 0.08, 0.08), 0xffffff, 0.85, rng);
  }

  // mode: 0 = nada, 1 = chuva, 2 = neve
  update(px, py, pz, mode) {
    this.rain.visible = mode === 1;
    this.snow.visible = mode === 2;
    if (mode === 0) return;
    const mesh = mode === 1 ? this.rain : this.snow;
    const pos = mesh.userData.pos;
    const arr = mesh.instanceMatrix.array;
    const fall = mode === 1 ? 0.8 : 0.1;
    const half = BOX_Y / 2;
    for (let i = 0; i < COUNT; i++) {
      let y = pos[i * 3 + 1] - fall;
      if (y < -half) y += BOX_Y;
      pos[i * 3 + 1] = y;
      const o = i * 16;
      arr[o + 12] = pos[i * 3];
      arr[o + 13] = y;
      arr[o + 14] = pos[i * 3 + 2];
    }
    mesh.position.set(px, py, pz);
    mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    for (const m of [this.rain, this.snow]) {
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
      m.dispose();
    }
  }
}