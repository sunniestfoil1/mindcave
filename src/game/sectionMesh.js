// Geometria das seções na GPU: junta todas as seções 16³ visíveis de uma coluna de chunk
// em UM ÚNICO THREE.Mesh opaco e UM de água por chunk (reduz Draw Calls de ~2.500 para ~150).
import * as THREE from 'three';

const ATTRS = [
  ['positions', 'position', 3, false, Float32Array],
  ['colors', 'color', 3, true, Uint8Array],
  ['uvs', 'uv', 2, false, Float32Array],
  ['lights', 'light', 2, true, Uint8Array],
  ['aos', 'ao', 1, true, Uint8Array],
  ['tileOrigins', 'tileOrigin', 2, false, Float32Array],
];

const GEOMETRY_POOL = [];
const MAX_POOL_SIZE = 768;

export function acquireGeometry() {
  return GEOMETRY_POOL.pop() || new THREE.BufferGeometry();
}

export function releaseGeometry(geom) {
  if (!geom) return;
  geom.dispose();
  if (GEOMETRY_POOL.length < MAX_POOL_SIZE) {
    for (const key in geom.attributes) {
      geom.deleteAttribute(key);
    }
    geom.setIndex(null);
    GEOMETRY_POOL.push(geom);
  }
}

export function disposeMesh(scene, mesh) {
  if (!mesh) return;
  scene.remove(mesh);
  if (mesh.geometry) releaseGeometry(mesh.geometry);
}

function buildMergedColumnGeometry(secList, cx, cz, minSectionY = 0) {
  let totalVerts = 0;
  let totalIndices = 0;
  let minSy = 16, maxSy = -1;

  for (let sy = minSectionY; sy < 16; sy++) {
    const g = secList[sy];
    if (!g || !g.positions || g.positions.length === 0) continue;
    totalVerts += g.positions.length / 3;
    totalIndices += g.indices.length;
    if (sy < minSy) minSy = sy;
    if (sy > maxSy) maxSy = sy;
  }

  if (totalVerts === 0) return null;

  const geom = acquireGeometry();

  for (let a = 0; a < ATTRS.length; a++) {
    const [key, name, itemSize, norm, ArrayType] = ATTRS[a];
    const merged = new ArrayType(totalVerts * itemSize);
    let offset = 0;
    for (let sy = minSy; sy <= maxSy; sy++) {
      const g = secList[sy];
      if (!g || !g[key]) continue;
      merged.set(g[key], offset);
      offset += g[key].length;
    }
    const attr = new THREE.BufferAttribute(merged, itemSize, norm);
    attr.count = totalVerts;
    geom.setAttribute(name, attr);
  }

  const IndexArray = totalVerts < 65536 ? Uint16Array : Uint32Array;
  const mergedIdx = new IndexArray(totalIndices);
  let idxOffset = 0;
  let vertOffset = 0;
  for (let sy = minSy; sy <= maxSy; sy++) {
    const g = secList[sy];
    if (!g || !g.indices) continue;
    const srcIdx = g.indices;
    const len = srcIdx.length;
    for (let i = 0; i < len; i++) {
      mergedIdx[idxOffset + i] = srcIdx[i] + vertOffset;
    }
    idxOffset += len;
    vertOffset += g.positions.length / 3;
  }

  const ia = new THREE.BufferAttribute(mergedIdx, 1);
  ia.count = totalIndices;
  geom.setIndex(ia);

  const minX = cx * 16, minY = minSy * 16, minZ = cz * 16;
  const maxY = (maxSy + 1) * 16;
  const centerY = (minY + maxY) * 0.5;
  const halfH = (maxY - minY) * 0.5;
  const radius = Math.sqrt(8 * 8 + 8 * 8 + halfH * halfH);

  if (!geom.boundingBox) {
    geom.boundingBox = new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(minX + 16, maxY, minZ + 16)
    );
  } else {
    geom.boundingBox.min.set(minX, minY, minZ);
    geom.boundingBox.max.set(minX + 16, maxY, minZ + 16);
  }

  if (!geom.boundingSphere) {
    geom.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(minX + 8, centerY, minZ + 8),
      radius
    );
  } else {
    geom.boundingSphere.center.set(minX + 8, centerY, minZ + 8);
    geom.boundingSphere.radius = radius;
  }

  return geom;
}

export function rebuildChunkColumnMesh(scene, existingMesh, secDataArray, mat, order, cx, cz, minSectionY = 0) {
  const geom = buildMergedColumnGeometry(secDataArray, cx, cz, minSectionY);
  if (!geom) {
    if (existingMesh) disposeMesh(scene, existingMesh);
    return null;
  }

  if (existingMesh) {
    if (existingMesh.geometry) releaseGeometry(existingMesh.geometry);
    existingMesh.geometry = geom;
    existingMesh.visible = true;
    return existingMesh;
  }

  const m = new THREE.Mesh(geom, mat);
  m.renderOrder = order;
  m.frustumCulled = true;
  m.castShadow = false;
  m.receiveShadow = false;
  m.matrixAutoUpdate = false;
  m.matrixWorldAutoUpdate = false;
  scene.add(m);
  return m;
}

export function fillSectionMesh(scene, mesh, g, mat, order, cx, sy, cz) {
  const arr = new Array(16).fill(null);
  if (g) arr[sy] = g;
  return rebuildChunkColumnMesh(scene, mesh, arr, mat, order, cx, cz, 0);
}