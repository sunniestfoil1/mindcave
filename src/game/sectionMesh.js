// Geometria das seções na GPU: cria/reutiliza BufferGeometry e Mesh via Pool estilo Sodium/FerriteCore
// Elimina spikes de Garbage Collection e evita re-adicionar/remover objetos do grafo Three.js desnecessariamente
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
const MAX_POOL_SIZE = 500;

export function acquireGeometry() {
  return GEOMETRY_POOL.pop() || new THREE.BufferGeometry();
}

export function releaseGeometry(geom) {
  if (!geom) return;
  geom.dispose();
  if (GEOMETRY_POOL.length < MAX_POOL_SIZE) {
    // Limpa atributos e índice antigos para reutilizar a instância sem novas alocações
    for (const key in geom.attributes) {
      geom.deleteAttribute(key);
    }
    geom.setIndex(null);
    GEOMETRY_POOL.push(geom);
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

  // Bounding Sphere e Box3 precisos estilo Sodium (16x16x16: centro em 8, raio = sqrt(8^2+8^2+8^2) ≈ 13.8564)
  const minX = cx * 16, minY = sy * 16, minZ = cz * 16;
  geom.boundingBox = new THREE.Box3(
    new THREE.Vector3(minX, minY, minZ),
    new THREE.Vector3(minX + 16, minY + 16, minZ + 16)
  );
  geom.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(minX + 8, minY + 8, minZ + 8),
    13.86
  );
  return geom;
}

export function disposeMesh(scene, mesh) {
  if (!mesh) return;
  scene.remove(mesh);
  if (mesh.geometry) releaseGeometry(mesh.geometry);
}

// Aplica a geometria vinda do worker. Reutiliza o Mesh existente na cena para evitar churn de grafo Three.js
export function fillSectionMesh(scene, mesh, g, mat, order, cx, sy, cz) {
  if (!g) {
    if (mesh) disposeMesh(scene, mesh);
    return null;
  }

  const geom = buildGeometry(g, cx, sy, cz);

  // Se o mesh já existe no grafo da cena, apenas substitui a geometria na GPU
  if (mesh) {
    if (mesh.geometry) releaseGeometry(mesh.geometry);
    mesh.geometry = geom;
    mesh.visible = true;
    return mesh;
  }

  const m = new THREE.Mesh(geom, mat);
  m.renderOrder = order;
  m.frustumCulled = true;
  m.matrixAutoUpdate = false;        // posições já estão em coordenadas de mundo
  m.matrixWorldAutoUpdate = false;
  scene.add(m);
  return m;
}