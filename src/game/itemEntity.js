// Gerenciador de Entidades de Itens Caídos 3D (Minecraft 1.8.9) — PRD 06 RF-062
// Blocos dropados são cubos texturizados (atlas do mundo, face top/bottom/side + tinta);
// itens comum usam o ícone real do pacote 1.8.9. Pilha visual: no máximo 4 mini-cubos.
// Física: só aterrissa descendo sobre a face superior; item nascido dentro de bloco fica
// parado — nunca é teleportado para cima (bug que fazia o item subir até a superfície).
import * as THREE from 'three';
import { getBlock, tileForFace, blockTint } from './blocks';
import { getItem } from './items';
import { addItem } from './inventory';
import { playPopSound, playXpOrbSound } from './sounds';
import { addXP } from './survival';
import { stateId } from './chunk';
import { MC, getPackUrl } from './pack';
import { itemIconFile, itemBlockTile } from './gui/iconNames';
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

function crossBlockMesh(block, meta, atlas) {
  const tileName = tileForFace(block, 'side', meta) || tileForFace(block, 'top', meta) || block.faces?.all || block.name;
  const tiles = atlas?.tiles;
  const tint = blockTint(block, 'side', meta) || (block.tint === 'grass' ? [0x91 / 255, 0xbd / 255, 0x59 / 255] : null);
  const rgb = (t) => (t ? new THREE.Color(t[0], t[1], t[2]) : new THREE.Color(0xffffff));

  if (tiles && atlas?.texture && tiles[tileName]) {
    const t = tiles[tileName];
    const geo = new THREE.PlaneGeometry(0.32, 0.32);
    applyTileToFace(geo, 0, t);
    const mat = new THREE.MeshBasicMaterial({
      map: atlas.texture,
      color: rgb(tint),
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
      fog: false,
    });
    return new THREE.Mesh(geo, mat);
  }

  // Fallback: busca arquivo individual do pacote ou usa cor real do bloco
  const geo = new THREE.PlaneGeometry(0.32, 0.32);
  const color = block.color || (tint ? new THREE.Color(tint[0], tint[1], tint[2]).getHex() : 0xffffff);
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, alphaTest: 0.1, fog: false });
  const mesh = new THREE.Mesh(geo, mat);

  getPackUrl(MC + 'textures/blocks/' + tileName + '.png').then((url) => {
    if (!url) return;
    new THREE.TextureLoader().load(url, (tex) => {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      mat.map = tex;
      mat.color.set(rgb(tint));
      mat.needsUpdate = true;
    });
  }).catch(() => {});

  return mesh;
}

// --- Itens comum: ícone do pacote 1.8.9 em plano; fallback de cor até carregar ---
function iconTexture(id) {
  const cached = iconTexCache.get(id);
  if (cached !== undefined) return cached;
  const def = getItem(id);
  if (!def) { iconTexCache.set(id, null); return null; }
  iconTexCache.set(id, null); // marcado como carregando (vira textura quando pronta)

  const iconName = itemIconFile(def.name);
  const blockTile = itemBlockTile(def.name);
  const path = blockTile
    ? MC + 'textures/blocks/' + blockTile + '.png'
    : MC + 'textures/items/' + iconName + '.png';

  getPackUrl(path).then((url) => {
    if (!url) return;
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
    });
  }).catch(() => {});

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
      const isCutout = block.model === 'cross' || block.model === 'torch' || block.model === 'crop' || !block.solid;
      if (isCutout) {
        mesh = crossBlockMesh(block, item.meta || 0, atlas);
      } else {
        mesh = blockMesh(block, item.meta || 0, atlas);
        if (!mesh) {
          mesh = new THREE.Mesh(BLOCK_GEO, new THREE.MeshLambertMaterial({ color: block.color || 0x7c9c3e, fog: false }));
        }
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

// --- Orbes de Experiência (Minecraft 1.8.9: textures/entity/experience_orb.png) ---
let xpOrbTex = null;
let xpOrbTexLoading = false;
const pendingXpOrbMeshes = new Set();

function getXpOrbTexture() {
  if (xpOrbTex) return xpOrbTex;
  if (!xpOrbTexLoading) {
    xpOrbTexLoading = true;
    getPackUrl(MC + 'textures/entity/experience_orb.png').then((url) => {
      const texUrl = url || '/assets/minecraft/textures/entity/experience_orb.png';
      new THREE.TextureLoader().load(texUrl, (tex) => {
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        xpOrbTex = tex;
        for (const m of pendingXpOrbMeshes) {
          if (m.material) {
            m.material.map = tex;
            m.material.color.setHex(0xffffff);
            m.material.needsUpdate = true;
          }
        }
        pendingXpOrbMeshes.clear();
      }, undefined, () => {});
    }).catch(() => {});
  }
  return xpOrbTex;
}

function getXpTextureIndex(xp) {
  if (xp < 3) return 0;
  if (xp < 7) return 1;
  if (xp < 17) return 2;
  if (xp < 37) return 3;
  if (xp < 73) return 4;
  if (xp < 149) return 5;
  if (xp < 307) return 6;
  if (xp < 617) return 7;
  if (xp < 1237) return 8;
  if (xp < 2477) return 9;
  return 10;
}

function createXpOrbMesh(xpValue) {
  const tex = getXpOrbTexture();
  const index = getXpTextureIndex(xpValue);
  const col = index % 4;
  const row = Math.floor(index / 4);

  // Grade 4x4 de sprites 16x16 em textura 64x64
  const u0 = (col * 16) / 64;
  const u1 = ((col + 1) * 16) / 64;
  const v0 = 1 - ((row + 1) * 16) / 64;
  const v1 = 1 - (row * 16) / 64;

  const geo = new THREE.PlaneGeometry(0.28, 0.28);
  const uv = geo.attributes.uv;
  uv.setXY(0, u0, v1);
  uv.setXY(1, u1, v1);
  uv.setXY(2, u0, v0);
  uv.setXY(3, u1, v0);
  uv.needsUpdate = true;

  const mat = new THREE.MeshBasicMaterial({
    map: tex || null,
    color: tex ? 0xffffff : 0x76fc47,
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
    fog: false,
  });

  const mesh = new THREE.Mesh(geo, mat);
  if (!tex) pendingXpOrbMeshes.add(mesh);
  return mesh;
}

export class ItemEntityManager {
  constructor(scene, world = null) {
    this.scene = scene;
    this.world = world;
    this.items = [];
    this.xpOrbs = [];
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

  spawnXpOrb(amount, pos, vel = null) {
    if (!amount || amount <= 0) return null;
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
        for (let up = 1; up <= 2; up++) {
          const b = getBlock(at(sx, sy + up, sz));
          if (!(b && b.solid)) { sy += up; break; }
        }
        spawnPos = { x: pos.x, y: sy + 0.1, z: pos.z };
      }
    }

    const mesh = createXpOrbMesh(amount);
    mesh.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    mesh.renderOrder = 1;
    this.scene.add(mesh);

    const vx = vel ? vel.x : (Math.random() - 0.5) * 0.2;
    const vy = vel ? vel.y : 0.25 + Math.random() * 0.15;
    const vz = vel ? vel.z : (Math.random() - 0.5) * 0.2;

    const orb = {
      amount,
      pos: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
      vel: { x: vx, y: vy, z: vz },
      mesh,
      age: 0,
      despawnAge: 6000,
      onGround: false,
    };
    this.xpOrbs.push(orb);
    return orb;
  }

  update(dt, player, inventory, world, time, frustum = null, camera = null) {
    if ((!this.items || !this.items.length) && (!this.xpOrbs || !this.xpOrbs.length)) return;
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

      // Atração e Coleta pelo Jogador (bloqueada se o jogador estiver morto ou em modo espectador)
      if (!player || player.isDead || player.gameMode === 'spectator') {
        continue;
      }

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
          this.onItemPickup?.(itemToCollect, e.pos);
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

    // === Atualização dos Orbes de Experiência (XP Orbs - Minecraft 1.8.9) ===
    if (this.xpOrbs && this.xpOrbs.length > 0) {
      for (let k = this.xpOrbs.length - 1; k >= 0; k--) {
        const orb = this.xpOrbs[k];
        orb.age += ticks;
        if (orb.age >= orb.despawnAge) {
          this.removeXpOrb(k);
          continue;
        }

        const canCollect = player && !player.isDead && player.gameMode !== 'spectator';
        let attracted = false;

        if (canCollect) {
          const dx = pPos.x - orb.pos.x;
          const dy = (pPos.y + 0.8) - orb.pos.y;
          const dz = pPos.z - orb.pos.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          // Raio oficial 1.8.9: Só começa a atrair a menos de 7.25 blocos de distância
          if (distSq < 52.56) {
            const dist = Math.sqrt(distSq);
            // Coleta imediata quando encosta (< 1.25 blocos)
            if (dist < 1.25) {
              addXP(player, orb.amount);
              playXpOrbSound(orb.pos);
              this.removeXpOrb(k);
              continue;
            }

            // Atração física proporcional à proximidade
            attracted = true;
            const factor = 1.0 - (dist / 8.0);
            if (factor > 0) {
              const speed = factor * factor * 14.0 * dt;
              orb.vel.x += (dx / dist) * speed;
              orb.vel.y += (dy / dist) * speed;
              orb.vel.z += (dz / dist) * speed;
            }
          }
        }

        // Gravidade e atrito com ar/solo quando não está em atração direta
        if (!attracted) {
          if (!orb.onGround) orb.vel.y -= GRAVITY * dt;
          orb.vel.x *= 0.96;
          orb.vel.z *= 0.96;
        }

        const nextX = orb.pos.x + orb.vel.x * dt;
        const nextY = orb.pos.y + orb.vel.y * dt;
        const nextZ = orb.pos.z + orb.vel.z * dt;

        const bx = Math.floor(nextX), by = Math.floor(nextY), bz = Math.floor(nextZ);
        if (world && solidAt(bx, by, bz)) {
          orb.vel.x = 0; orb.vel.y = 0; orb.vel.z = 0;
          orb.onGround = true;
        } else if (world && orb.vel.y <= 0 && solidAt(Math.floor(orb.pos.x), Math.floor(nextY), Math.floor(orb.pos.z))) {
          orb.pos.y = Math.floor(nextY) + 1;
          orb.vel.y = 0;
          orb.onGround = true;
        } else {
          orb.pos.x = nextX;
          orb.pos.y = nextY;
          orb.pos.z = nextZ;
          orb.onGround = false;
        }

        // Billboard para a câmera / jogador + animação senoidal suave
        if (orb.mesh) {
          if (frustum && !frustum.containsPoint(orb.pos)) {
            orb.mesh.visible = false;
          } else {
            orb.mesh.visible = true;
            const bob = fastSin(time * 0.2 + orb.pos.x + orb.pos.z) * 0.04 + 0.08;
            orb.mesh.position.set(orb.pos.x, orb.pos.y + bob, orb.pos.z);
            if (camera) {
              orb.mesh.quaternion.copy(camera.quaternion);
            } else if (player) {
              orb.mesh.lookAt(pPos.x, orb.pos.y + bob, pPos.z);
            }
          }
        }
      }
    }
  }

  removeXpOrb(index) {
    const orb = this.xpOrbs[index];
    if (orb && orb.mesh) {
      pendingXpOrbMeshes.delete(orb.mesh);
      this.scene.remove(orb.mesh);
    }
    this.xpOrbs.splice(index, 1);
  }

  removeItem(index) {
    const e = this.items[index];
    if (e && e.mesh) {
      for (const c of e.mesh.children || [e.mesh]) pendingIconMeshes.delete(c);
      this.scene.remove(e.mesh);
    }
    this.items.splice(index, 1);
  }

  serialize() {
    return (this.items || []).map(e => ({
      id: e.id,
      count: e.count,
      meta: e.meta || 0,
      pos: { x: e.pos.x, y: e.pos.y, z: e.pos.z },
      vel: { x: e.vel.x, y: e.vel.y, z: e.vel.z },
      age: e.age || 0,
      pickupDelay: e.pickupDelay || 0,
    }));
  }

  deserialize(data) {
    if (!Array.isArray(data)) return;
    for (let i = this.items.length - 1; i >= 0; i--) this.removeItem(i);
    for (const item of data) {
      if (!item || !item.id || !item.pos) continue;
      const entity = this.spawnItem(
        { id: item.id, count: item.count || 1, meta: item.meta || 0 },
        item.pos,
        item.vel || { x: 0, y: 0, z: 0 },
        item.pickupDelay || 0
      );
      if (entity && typeof item.age === 'number') entity.age = item.age;
    }
  }

  dispose() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.removeItem(i);
    }
    this.items = [];
    if (this.xpOrbs) {
      for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
        this.removeXpOrb(i);
      }
      this.xpOrbs = [];
    }
  }
}

