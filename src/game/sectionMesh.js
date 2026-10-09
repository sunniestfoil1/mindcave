// Geometria das seções na GPU: cria/reutiliza BufferGeometry via Geometry Pool para eliminar GC spikes
import * as THREE from 'three';

const ATTRS = [
  ['positions', 'position', 3, false],
  ['colors', 'color', 3, true],
  ['uvs', 'uv', 2, false],
  ['lights', 'light', 2, true],
  ['aos', 'ao', 1, true],
  ['tileOrigins', 'tileOrigin', 2, false],
];

const GEOMETRY_POOL = [];
const MAX_POOL_SIZE = 2000;

export function acquireGeometry() {
  return GEOMETRY_POOL.pop() || new THREE.BufferGeometry();
}

export function releaseGeometry(geom) {
  if (!geom) return;
  if (GEOMETRY_POOL.length < MAX_POOL_SIZE) {
    // Limpar atributos e índice antes de devolver ao pool
    geom.dispose();
    GEOMETRY_POOL.push(new THREE.BufferGeometry());
  } else {
    geom.dispose();
  }
}

function buildGeometry(g, cx, sy, cz) {
  const nv = g.positions.length / 3;
  const ni = g.indices.length;
  const geom = acquireGeometry();
  for (const [key, name, size, norm] of ATTRS) {
    const src = g[key];
    const attr = new THREE.BufferAttribute(src, size, norm);
    attr.count = nv;
    geom.setAttribute(name, attr);
  }
  const ia = new THREE.BufferAttribute(g.indices, 1);
  ia.count = ni;
  geom.setIndex(ia);
  geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx * 16 + 8, sy * 16 + 8, cz * 16 + 8), 14);
  return geom;
}

export function disposeMesh(scene, mesh) {
  if (!mesh) return;
  scene.remove(mesh);
  if (mesh.geometry) releaseGeometry(mesh.geometry);
}

// Aplica a geometria vinda do worker. Devolve a malha ou null se a seção ficou vazia.
export function fillSectionMesh(scene, mesh, g, mat, order, cx, sy, cz) {
  if (mesh) {
    disposeMesh(scene, mesh);
  }
  if (!g) return null;
  const m = new THREE.Mesh(buildGeometry(g, cx, sy, cz), mat);
  m.renderOrder = order;
  m.frustumCulled = true;
  m.matrixAutoUpdate = false;        // posições já estão em coordenadas de mundo
  m.matrixWorldAutoUpdate = false;
  scene.add(m);
  return m;
}