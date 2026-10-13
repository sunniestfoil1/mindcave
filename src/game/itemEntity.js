// Gerenciador de Entidades de Itens Caídos 3D (Minecraft 1.8.9) — PRD 06 RF-062
// Blocos dropados são cubos texturizados (atlas do mundo, face top/bottom/side + tinta);
// itens comum usam o ícone real do pacote 1.8.9. Pilha visual: no máximo 4 mini-cubos.
// Física: só aterrissa descendo sobre a face superior; item nascido dentro de bloco fica
// parado — nunca é teleportado para cima (bug que fazia o item subir até a superfície).
import * as THREE from 'three';
import { getBlock, tileForFace, blockTint } from './blocks';
import { getItem } from './items';
import { addItem } from './inventory';
import { playPopSound } from './sounds';
import { stateId } from './chunk';
import { MC, getPackUrl } from './pack';
import { itemIconFile } from './gui/iconNames';
import { fastSin } from './fastMath';

const GRAVITY = 18.0;

const BLOCK_GEO = new THREE.BoxGeometry(0.25, 0.25, 0.25);
const PLANE_GEO = new THREE.PlaneGeometry(0.3, 0.3);

// --- Blocos: geometria por combinação de tiles + material por face (tinta de lã/grama) ---
const geoCache = new Map();
const matCache = new Map();
const iconTexCache = new Map();

function applyTileToFace(geo, faceIdx, t) {
  const uv = geo.attributes.uv;
  const base = faceIdx * 4;
  for (let i = 0; i < 4; i++) {
    const u = uv.getX(base + i), v = uv.getY(base + i);
    uv.setXY(base + i, t.u0 + u * (t.u1 - t.u0), t.v0 + v * (t.v1 - t.v0));
  }
}

// BoxGeometry faces: +x, -x, +y, -y, +z, -z
function blockGeoFor(tiles, sideName, topName, bottomName) {
  const key = sideName + '|' + topName + '|' + bottomName;
  let geo = geoCache.get(key);
  if (geo) return geo;
  geo = BLOCK_GEO.clone();
  applyTileToFace(geo, 0, tiles[sideName] || tiles.error);
  applyTileToFace(geo, 1, tiles[sideName] || tiles.error);
  applyTileToFace(geo, 2, tiles[topName] || tiles.error);
  applyTileToFace(geo, 3, tiles[bottomName] || tiles.error);
  applyTileToFace(geo, 4, tiles[sideName] || tiles.error);
  applyTileToFace(geo, 5, tiles[sideName] || tiles.error);
  geoCache.set(key, geo);
  return geo;
}

function faceMat(map, tint) {
  const key = map.uuid + '|' + tint;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ map, color: tint, fog: false });
    matCache.set(key, m);
  }
  return m;
}

function blockMesh(block, meta, atlas) {
  const tiles = atlas?.tiles;
  if (!atlas?.texture || !tiles) return null;
  const sideName = tileForFace(block, 'side', meta);
  const topName = tileForFace(block, 'top', meta);
  const bottomName = tileForFace(block, 'bottom', meta);
  const geo = blockGeoFor(tiles, sideName, topName, bottomName);
  const sideT = blockTint(block, 'side', meta);
  const topT = blockTint(block, 'top', meta);
  const botT = blockTint(block, 'bottom', meta);
  const rgb = (t) => (t ? new THREE.Color(t[0], t[1], t[2]) : 0xffffff);
  // Índices das faces da BoxGeometry na mesma ordem
  const mats = [
    faceMat(atlas.texture, rgb(sideT)), faceMat(atlas.texture, rgb(sideT)),
    faceMat(atlas.texture, rgb(topT)), faceMat(atlas.texture, rgb(botT)),
    faceMat(atlas.texture, rgb(sideT)), faceMat(atlas.texture, rgb(sideT)),
  ];
  return new THREE.Mesh(geo, mats);
}

// --- Itens comum: ícone do pacote 1.8.9 em plano; fallback de cor até carregar ---
function iconTexture(id) {
  const cached = iconTexCache.get(id);
  if (cached !== undefined) return cached;
  const def = getItem(id);
  if (!def) { iconTexCache.set(id, null); return null; }
  const url = getPackUrl(MC + 'textures/items/' + itemIconFile(def.name) + '.png');
  if (!url) { iconTexCache.set(id, null); return null; }
  iconTexCache.set(id, null); // marcado como carregando (vira textura quando pronta)
  new THREE.TextureLoader().load(url, (tex) => {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    iconTexCache.set(id, tex);
    // Atualiza os planos já criados com este item
    for (const e of pendingIconMeshes) {
      if (e.itemId !== id || !e.material) continue;
      e.material.map = tex;
      e.material.color.set(0xffffff);
      e.material.transparent = true;
      e.material.needsUpdate = true;
      pendingIconMeshes.delete(e);
    }
  }, undefined, () => { iconTexCache.set(id, null); });
  return null;
}
const pendingIconMeshes = new Set();

function planeMatFor(id, def) {
  const tex = iconTexCache.get(id);
  if (tex) return new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, fog: false });
  const color = def?.color || 0xffffff;
  return new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: false });
}

/** Mesh de item dropado (e usado pela mão em 1ª pessoa): cubo texturizado p/ bloco, plano c/ ícone p/ item. */
export function createItemMesh(item, count = 1, atlas = null) {
  const group = new THREE.Group();
  const block = getBlock(item.id);
  const itemDef = getItem(item.id);

  // Efeito visual de agrupamento 1.8.9: no máximo 4 réplicas em pilha
  let subMeshCount = 1;
  if (count > 32) subMeshCount = 4;
  else if (count > 16) subMeshCount = 3;
  else if (count > 4) subMeshCount = 2;

  const isBlock = block && block.id > 0 && block.id < 256;

  for (let i = 0; i < subMeshCount; i++) {
    let mesh;
    if (isBlock) {
      mesh = blockMesh(block, item.meta || 0, atlas);
      if (!mesh) {
        mesh = new THREE.Mesh(BLOCK_GEO, new THREE.MeshLambertMaterial({ color: block.color || 0x888888, fog: false }));
      }
    } else {
      iconTexture(item.id);
      mesh = new THREE.Mesh(PLANE_GEO, planeMatFor(item.id, itemDef));
      mesh.itemId = item.id;
      pendingIconMeshes.add(mesh);
    }

    // Deslocamento sutil para o efeito de pilha
    if (i > 0) {
      mesh.position.set((i * 0.04) - 0.06, i * 0.05, (i * 0.03) - 0.04);
      mesh.rotation.y = i * 0.4;
    }
    group.add(mesh);
  }

  return group;
}

export class ItemEntityManager {
  constructor(scene, world = null) {
    this.scene = scene;
    this.world = world;
    this.items = [];
    // Pré-aquecimento: um item minúsculo e fora da vista força a compilação dos dois shaders já no carregamento
    const warmBlock = new THREE.Mesh(BLOCK_GEO, new THREE.MeshLambertMaterial({ color: 0x888888, fog: false }));
    const warmPlane = new THREE.Mesh(PLANE_GEO, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false }));
    for (const w of [warmBlock, warmPlane]) {
      w.position.set(0, -1000, 0);
      w.scale.setScalar(0.001);
      w.frustumCulled = false;
      scene.add(w);
    }
  }

  _atlas() { return this.world?.atlas || null; }

  rebuildMesh(e) {
    if (e.mesh) {
      this.scene.remove(e.mesh);
    }
    e.mesh = createItemMesh({ id: e.id, meta: e.meta }, e.count, this._atlas());
    e.mesh.position.set(e.pos.x, e.pos.y, e.pos.z);
    this.scene.add(e.mesh);
  }

  spawnItem(itemData, pos, vel = { x: 0, y: 0.2, z: 0 }, pickupDelay = 15) {
    if (!itemData || !itemData.id) return null;
    const count = itemData.count || 1;
    const meta = itemData.meta || 0;

    // Se nasceu dentro de um bloco (drop de mob que morreu na parede), sobe no
    // máximo 2 células até achar ar — nunca mais que isso.
    let spawnPos = pos;
    const w = this.world;
    if (w) {
      const at = (x, y, z) => {
        if (y < 0 || y >= 256) return 0;
        if (typeof w.getBlockId === 'function') return w.getBlockId(x, y, z);
        if (typeof w.getBlock === 'function') return stateId(w.getBlock(x, y, z));
        return 0;
      };
      const sx = Math.floor(pos.x), sz = Math.floor(pos.z);
      let sy = Math.floor(pos.y);
      const b0 = getBlock(at(sx, sy, sz));
      if (b0 && b0.solid) {
        let freed = false;
        for (let up = 1; up <= 2; up++) {
          const b = getBlock(at(sx, sy + up, sz));
          if (!(b && b.solid)) { sy += up; freed = true; break; }
        }
        if (freed) spawnPos = { x: pos.x, y: sy + 0.1, z: pos.z };
      }
    }

    const mesh = createItemMesh(itemData, count, this._atlas());
    mesh.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    mesh.renderOrder = 0;
    this.scene.add(mesh);

    const entity = {
      id: itemData.id,
      count,
      meta,
      pos: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
      vel: { x: vel.x, y: vel.y, z: vel.z },
      mesh,
      pickupDelay,
      age: 0,
      despawnAge: 6000, // 5 minutos (6000 ticks)
      onGround: false,
    };

    this.items.push(entity);
    return entity;
  }

  update(dt, player, inventory, world, time, frustum = null) {
    if (!this.items.length) return;
    this.world = world;

    // Agrupamento de itens próximos do mesmo tipo (Item Stacking / Grouping)
    for (let i = 0; i < this.items.length; i++) {
      const e1 = this.items[i];
      if (!e1 || e1.count >= 64) continue;
      for (let j = this.items.length - 1; j > i; j--) {
        const e2 = this.items[j];
        if (!e2 || e2.id !== e1.id || e2.meta !== e1.meta || e2.count >= 64) continue;
        const dx = e1.pos.x - e2.pos.x;
        const dy = e1.pos.y - e2.pos.y;
        const dz = e1.pos.z - e2.pos.z;
        if (dx * dx + dy * dy + dz * dz < 1.44) { // < 1.2 blocos de distância
          const total = e1.count + e2.count;
          if (total <= 64) {
            e1.count = total;
            this.removeItem(j);
            this.rebuildMesh(e1);
          } else {
            e2.count = total - 64;
            e1.count = 64;
            this.rebuildMesh(e1);
            this.rebuildMesh(e2);
          }
        }
      }
    }

    const pPos = player.pos;
    // idade e atraso de coleta contam em ticks (20/s) mesmo que o render rode a 144 fps ou a 10 fps
    this._tickAcc = (this._tickAcc || 0) + dt;
    const ticks = Math.floor(this._tickAcc / 0.05);
    this._tickAcc -= ticks * 0.05;

    const cellId = (x, y, z) => {
      if (!world || y < 0 || y >= 256) return 0;
      if (typeof world.getBlockId === 'function') return world.getBlockId(x, y, z);
      if (typeof world.getBlock === 'function') return stateId(world.getBlock(x, y, z));
      return 0;
    };
    const solidAt = (x, y, z) => { const b = getBlock(cellId(x, y, z)); return !!(b && b.solid); };

    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      e.age += ticks;

      // Despawn após 5 minutos
      if (e.age >= e.despawnAge) {
        this.removeItem(i);
        continue;
      }

      if (e.pickupDelay > 0) e.pickupDelay = Math.max(0, e.pickupDelay - ticks);

      // Física — nunca empurra o item para cima
      const bx0 = Math.floor(e.pos.x), by0 = Math.floor(e.pos.y), bz0 = Math.floor(e.pos.z);
      if (world && solidAt(bx0, by0, bz0)) {
        // Dentro de um bloco: congela (nem cai, nem sobe, nem atravessa)
        e.vel.x = 0; e.vel.y = 0; e.vel.z = 0;
        e.onGround = false;
      } else if (e.onGround && world && solidAt(bx0, Math.floor(e.pos.y - 0.01), bz0)) {
        // Repouso no chão
        e.vel.x = 0; e.vel.y = 0; e.vel.z = 0;
      } else {
        if (!e.onGround) e.vel.y -= GRAVITY * dt;
        const nextX = e.pos.x + e.vel.x * dt;
        const nextY = e.pos.y + e.vel.y * dt;
        const nextZ = e.pos.z + e.vel.z * dt;

        // Horizontal: para na parede (sem escalar)
        if (world && (e.vel.x !== 0 || e.vel.z !== 0)) {
          const midY = Math.floor(e.pos.y + 0.25);
          if (solidAt(Math.floor(nextX), midY, Math.floor(nextZ))) {
            e.vel.x = 0; e.vel.z = 0;
          } else {
            e.pos.x = nextX; e.pos.z = nextZ;
          }
        } else {
          e.pos.x = nextX; e.pos.z = nextZ;
        }

        // Vertical: aterrissa só se estava acima da face superior e a cruza descendo
        if (world && e.vel.y <= 0) {
          const gY = Math.floor(nextY);
          const top = gY + 1;
          if (gY >= 0 && gY < 256 && e.pos.y >= top && nextY < top
            && solidAt(Math.floor(e.pos.x), gY, Math.floor(e.pos.z))) {
            e.pos.y = top;
            e.vel.y = 0;
            e.vel.x *= 0.8;
            e.vel.z *= 0.8;
            e.onGround = true;
          } else {
            e.pos.y = nextY;
            e.onGround = false;
          }
        } else {
          e.pos.y = nextY;
          if (e.vel.y > 0) e.onGround = false;
        }
      }

      // Animação 3D: Rotação contínua + Flutuação (bobbing) com Culling (Sodium / Lithium)
      if (e.mesh) {
        if (frustum && !frustum.containsPoint(e.pos)) {
          e.mesh.visible = false;
        } else {
          e.mesh.visible = true;
          const bob = fastSin(time * 0.1 + e.pos.x) * 0.05 + 0.15;
          e.mesh.position.set(e.pos.x, e.pos.y + bob, e.pos.z);
          e.mesh.rotation.y += 2.5 * dt; // Rotação 3D em torno do eixo Y
        }
      }

      // Atração e Coleta pelo Jogador
      const dx = pPos.x - e.pos.x;
      const dy = (pPos.y + 0.8) - e.pos.y;
      const dz = pPos.z - e.pos.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (e.pickupDelay <= 0 && distSq < 3.24) { // Raio de 1.8 blocos
        const dist = Math.sqrt(distSq);
        if (dist < 0.5) {
          // Coletado! Com inventário cheio o item fica no chão (como na 1.8.9)
          const itemToCollect = { id: e.id, count: e.count, meta: e.meta };
          const leftover = inventory ? addItem(inventory, itemToCollect) : itemToCollect;
          if (leftover) continue;
          playPopSound(e.pos);
          this.removeItem(i);
        } else {
          // Atração magnética em direção ao jogador
          const speed = 8.0 * dt;
          e.pos.x += (dx / dist) * speed;
          e.pos.y += (dy / dist) * speed;
          e.pos.z += (dz / dist) * speed;
        }
      }
    }
  }

  removeItem(index) {
    const e = this.items[index];
    if (e && e.mesh) {
      for (const c of e.mesh.children || [e.mesh]) pendingIconMeshes.delete(c);
      this.scene.remove(e.mesh);
    }
    this.items.splice(index, 1);
  }

  dispose() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.removeItem(i);
    }
    this.items = [];
  }
}
