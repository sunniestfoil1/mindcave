// Gerenciador de Entidades de Itens Caídos 3D (Minecraft 1.8.9) — PRD 06 RF-062
import * as THREE from 'three';
import { getBlock } from './blocks';
import { getItem } from './items';
import { addItem } from './inventory';
import { playPopSound } from './sounds';
import { stateId } from './chunk';

const GRAVITY = 18.0;

// Recursos compartilhados: criar geometria/material por drop gerava alocação de GPU e compilação de shader no primeiro drop.
const BLOCK_GEO = new THREE.BoxGeometry(0.25, 0.25, 0.25);
const PLANE_GEO = new THREE.PlaneGeometry(0.3, 0.3);
const blockMats = new Map();
const planeMats = new Map();
function blockMat(color) {
  let m = blockMats.get(color);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, fog: false }); blockMats.set(color, m); }
  return m;
}
function planeMat(color) {
  let m = planeMats.get(color);
  if (!m) { m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, fog: false }); planeMats.set(color, m); }
  return m;
}

function createItemMesh(item, count = 1) {
  const group = new THREE.Group();
  const block = getBlock(item.id);
  const itemDef = getItem(item.id);

  // Efeito visual de agrupamento 1.8.9 (réplicas empilhadas conforme a quantidade)
  let subMeshCount = 1;
  if (count > 40) subMeshCount = 5;
  else if (count > 20) subMeshCount = 4;
  else if (count > 5) subMeshCount = 3;
  else if (count > 1) subMeshCount = 2;

  const isBlock = block && block.id > 0 && block.id < 256;

  for (let i = 0; i < subMeshCount; i++) {
    let mesh;
    if (isBlock) {
      // Bloco 3D em miniatura (0.28m)
      mesh = new THREE.Mesh(BLOCK_GEO, blockMat(block.color || 0x888888));
    } else {
      // Item 2D/3D (Placa com recorte ou miniatura)
      mesh = new THREE.Mesh(PLANE_GEO, planeMat(itemDef?.color || 0xffffff));
    }

    // Deslocamento sutil para renderizar o efeito de agrupamento em monte
    if (i > 0) {
      mesh.position.set((i * 0.04) - 0.06, i * 0.05, (i * 0.03) - 0.04);
      mesh.rotation.y = i * 0.4;
    }
    group.add(mesh);
  }

  return group;
}

export class ItemEntityManager {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    // Pré-aquecimento: um item minúsculo e fora da vista força a compilação dos dois shaders já no carregamento
    for (const mat of [blockMat(0x888888), planeMat(0xffffff)]) {
      const w = new THREE.Mesh(mat === blockMats.get(0x888888) ? BLOCK_GEO : PLANE_GEO, mat);
      w.position.set(0, -1000, 0);
      w.scale.setScalar(0.001);
      w.frustumCulled = false;
      scene.add(w);
    }
  }

  rebuildMesh(e) {
    if (e.mesh) {
      this.scene.remove(e.mesh);
    }
    e.mesh = createItemMesh({ id: e.id, meta: e.meta }, e.count);
    e.mesh.position.set(e.pos.x, e.pos.y, e.pos.z);
    this.scene.add(e.mesh);
  }

  spawnItem(itemData, pos, vel = { x: 0, y: 0.2, z: 0 }, pickupDelay = 15) {
    if (!itemData || !itemData.id) return null;
    const count = itemData.count || 1;
    const meta = itemData.meta || 0;

    const mesh = createItemMesh(itemData, count);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.renderOrder = 0;
    this.scene.add(mesh);

    const entity = {
      id: itemData.id,
      count,
      meta,
      pos: { x: pos.x, y: pos.y, z: pos.z },
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

  update(dt, player, inventory, world, time) {
    if (!this.items.length) return;

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

    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      e.age += ticks;

      // Despawn após 5 minutos
      if (e.age >= e.despawnAge) {
        this.removeItem(i);
        continue;
      }

      if (e.pickupDelay > 0) e.pickupDelay = Math.max(0, e.pickupDelay - ticks);

      // Física
      if (!e.onGround) {
        e.vel.y -= GRAVITY * dt;
      }

      const nextX = e.pos.x + e.vel.x * dt;
      const nextY = e.pos.y + e.vel.y * dt;
      const nextZ = e.pos.z + e.vel.z * dt;

      // Colisão simples com chão
      const bx = Math.floor(nextX);
      const by = Math.floor(nextY);
      const bz = Math.floor(nextZ);

      if (world && by >= 0 && by < 256) {
        const blockId = typeof world.getBlockId === 'function' ? world.getBlockId(bx, by, bz) : (typeof world.getBlock === 'function' ? stateId(world.getBlock(bx, by, bz)) : 0);
        const b = getBlock(blockId);
        if (b && b.solid) {
          e.pos.y = by + 1.0;
          e.vel.y = 0;
          e.vel.x *= 0.8;
          e.vel.z *= 0.8;
          e.onGround = true;
        } else {
          e.pos.x = nextX;
          e.pos.y = nextY;
          e.pos.z = nextZ;
          e.onGround = false;
        }
      } else {
        e.pos.x = nextX;
        e.pos.y = nextY;
        e.pos.z = nextZ;
      }

      // Animação 3D: Rotação contínua + Flutuação (bobbing)
      if (e.mesh) {
        const bob = Math.sin(time * 0.1 + e.pos.x) * 0.05 + 0.15;
        e.mesh.position.set(e.pos.x, e.pos.y + bob, e.pos.z);
        e.mesh.rotation.y += 2.5 * dt; // Rotação 3D em torno do eixo Y
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
