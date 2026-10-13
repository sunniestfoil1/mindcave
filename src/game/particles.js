// Sistema de partículas — estilo 1.8.9 (blocos quebrados, respingos)
// Partículas são pequenos cubos coloridos com física (gravidade, colisão, drag).
import * as THREE from 'three';
import { getBlock } from './blocks';
import { stateId } from './chunk';
import { isFluid } from './blocks';

const MAX_PARTICLES = 600;
const PARTICLE_SIZE = 0.1;
const GRAVITY = 0.04; // blocks/tick² — 1.8.9 usa ~0.04 para partículas

// Cor representativa de cada bloco (derivada do center pixel das texturas procedurais)
const BLOCK_COLORS = {
  1: [127, 127, 127], 2: [134, 96, 67], 3: [134, 96, 67], 4: [110, 110, 110],
  7: [85, 85, 85], 8: [50, 90, 200], 9: [50, 90, 200], 10: [220, 100, 20],
  11: [220, 100, 20], 12: [219, 207, 163], 13: [120, 116, 112], 14: [170, 150, 130],
  15: [170, 150, 130], 16: [100, 100, 100], 17: [150, 115, 60], 18: [60, 130, 45],
  20: [205, 230, 235], 21: [40, 60, 180], 22: [40, 60, 180], 24: [219, 207, 163],
  41: [220, 180, 40], 42: [220, 220, 220], 45: [150, 70, 55], 47: [160, 130, 75],
  48: [90, 105, 80], 49: [30, 20, 40], 56: [120, 180, 180], 57: [100, 230, 230],
  58: [160, 130, 75], 61: [127, 127, 127], 62: [127, 127, 127], 73: [160, 80, 80],
  78: [245, 250, 255], 79: [170, 200, 230], 80: [245, 250, 255], 82: [160, 165, 170],
  87: [120, 50, 50], 88: [100, 75, 60], 89: [200, 160, 50], 95: [205, 230, 235],
  97: [120, 50, 50], 98: [120, 120, 120], 110: [110, 95, 105], 112: [60, 30, 30],
  121: [220, 215, 165], 129: [60, 180, 70], 133: [40, 200, 80], 152: [200, 30, 30],
  155: [235, 232, 225], 159: [160, 115, 90], 168: [80, 140, 130], 169: [180, 230, 220],
  170: [200, 180, 50], 173: [30, 30, 30], 174: [120, 50, 50], 175: [80, 120, 50],
};
const DEFAULT_COLOR = [127, 127, 127];

// Paletas ricas por bloco: extrai múltiplos tons da textura oficial (ex: grama tem verde vibrante e terra marrom)
const BLOCK_PALETTES = {
  // Grama (bloco 2): pixels do topo verde e laterais de terra
  2: [
    [118, 178, 62], [102, 162, 48], [88, 148, 38], // verde da grama
    [134, 96, 67], [120, 85, 58], [148, 108, 78],  // terra da raiz
  ],
  // Terra (bloco 3)
  3: [[134, 96, 67], [120, 85, 58], [148, 108, 78]],
  // Pedra (bloco 1)
  1: [[125, 125, 125], [112, 112, 112], [138, 138, 138]],
  // Pedregulho (bloco 4)
  4: [[110, 110, 110], [95, 95, 95], [125, 125, 125], [82, 82, 82]],
  // Tábuas de madeira (5, 53, 126, 85, 107)
  5: [[162, 130, 78], [178, 145, 90], [145, 115, 65]],
  // Tronco (17, 162)
  17: [[105, 80, 50], [120, 95, 60], [165, 135, 85]],
  // Folhas (18, 161)
  18: [[65, 140, 48], [75, 155, 55], [55, 125, 40]],
  // Areia (12, 24)
  12: [[219, 207, 163], [205, 195, 150], [230, 220, 175]],
  // Cascalho (13)
  13: [[125, 120, 120], [140, 135, 135], [110, 105, 105]],
  // Carvão minério (16)
  16: [[120, 120, 120], [45, 45, 45], [30, 30, 30]],
  // Ferro minério (15)
  15: [[120, 120, 120], [190, 160, 140], [175, 145, 125]],
  // Ouro minério (14)
  14: [[120, 120, 120], [240, 210, 60], [220, 190, 45]],
  // Diamante minério (56)
  56: [[120, 120, 120], [90, 220, 220], [65, 195, 195]],
  // Redstone minério (73)
  73: [[120, 120, 120], [230, 35, 35], [195, 20, 20]],
  // Bancada (58)
  58: [[162, 130, 78], [140, 105, 60], [180, 145, 90]],
  // Fornalha (61, 62)
  61: [[125, 125, 125], [105, 105, 105], [85, 85, 85]],
  // Baú (54)
  54: [[160, 115, 45], [180, 130, 55], [135, 95, 35]],
  // Vidro (20)
  20: [[205, 230, 235], [225, 245, 250], [185, 215, 225]],
  // Neve / Gelo (78, 79, 80)
  78: [[245, 250, 255], [230, 240, 250]],
  79: [[155, 195, 245], [180, 215, 255]],
  // Obsidiana (49)
  49: [[30, 22, 42], [22, 15, 32], [42, 30, 58]],
  // Tijolos (45)
  45: [[155, 75, 60], [140, 65, 50], [170, 85, 70]],
};

function getBlockParticleColor(blockId) {
  const pal = BLOCK_PALETTES[blockId];
  if (pal && pal.length > 0) {
    return pal[Math.floor(Math.random() * pal.length)];
  }
  const simple = BLOCK_COLORS[blockId];
  if (simple) return simple;
  const blk = getBlock(blockId);
  if (blk?.color) {
    const c = blk.color;
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  }
  return DEFAULT_COLOR;
}

export class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];

    const geo = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
    this.geometry = geo;
    this.material = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.instancedMesh = new THREE.InstancedMesh(geo, this.material, MAX_PARTICLES);
    this.instancedMesh.count = 0;
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.instancedMesh);

    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this._cursor = 0;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        r: 0, g: 0, b: 0, life: 0, maxLife: 0, onGround: false,
      });
    }
  }

  _getFreeParticle() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const idx = (this._cursor + i) % MAX_PARTICLES;
      if (!this.particles[idx].active) {
        this._cursor = (idx + 1) % MAX_PARTICLES;
        return this.particles[idx];
      }
    }
    const p = this.particles[this._cursor];
    this._cursor = (this._cursor + 1) % MAX_PARTICLES;
    return p;
  }

  // Blocos quebrados — cubos pequenos com amostragem real da textura do bloco (sem partículas pretas)
  spawnBlockBreak(x, y, z, blockId) {
    const count = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
      const color = getBlockParticleColor(blockId);
      const p = this._getFreeParticle();
      p.active = true;
      p.x = x + 0.15 + Math.random() * 0.7;
      p.y = y + 0.15 + Math.random() * 0.7;
      p.z = z + 0.15 + Math.random() * 0.7;
      p.vx = (Math.random() - 0.5) * 0.28;
      p.vy = 0.14 + Math.random() * 0.22;
      p.vz = (Math.random() - 0.5) * 0.28;
      // Variação leve no tom dos pixels
      const vary = (Math.random() - 0.5) * 16;
      p.r = Math.max(10, Math.min(255, color[0] + vary));
      p.g = Math.max(10, Math.min(255, color[1] + vary));
      p.b = Math.max(10, Math.min(255, color[2] + vary));
      p.life = 0;
      p.maxLife = 24 + Math.floor(Math.random() * 16);
      p.onGround = false;
    }
  }

  // Respungos de água — partículas azul-claro ao entrar na água
  spawnSplash(x, y, z, intensity = 1) {
    const count = Math.floor((8 + Math.floor(Math.random() * 8)) * intensity);
    for (let i = 0; i < count; i++) {
      const p = this._getFreeParticle();
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.5;
      p.y = y + 0.5 + Math.random() * 0.3;
      p.z = z + (Math.random() - 0.5) * 0.5;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.08 + Math.random() * 0.2;
      p.vx = Math.cos(angle) * speed;
      p.vy = 0.15 + Math.random() * 0.25;
      p.vz = Math.sin(angle) * speed;
      p.r = 100 + Math.floor(Math.random() * 40);
      p.g = 150 + Math.floor(Math.random() * 40);
      p.b = 220 + Math.floor(Math.random() * 35);
      p.life = 0;
      p.maxLife = 12 + Math.floor(Math.random() * 10);
      p.onGround = false;
    }
  }

  // Efeito clássico de morte (nuvem branca de fumaça / poof da 1.8.9)
  spawnDeathPoof(x, y, z) {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const p = this._getFreeParticle();
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 0.6;
      p.y = y + 0.2 + Math.random() * 0.6;
      p.z = z + (Math.random() - 0.5) * 0.6;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.04 + Math.random() * 0.08;
      p.vx = Math.cos(angle) * speed;
      p.vy = 0.06 + Math.random() * 0.1;
      p.vz = Math.sin(angle) * speed;
      const shade = 220 + Math.floor(Math.random() * 35);
      p.r = shade; p.g = shade; p.b = shade;
      p.life = 0;
      p.maxLife = 18 + Math.floor(Math.random() * 12);
      p.onGround = false;
    }
  }

  tick(world) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      // Física
      if (!p.onGround) {
        p.vy -= GRAVITY;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      // Resistência do ar
      p.vx *= 0.96;
      p.vz *= 0.96;

      // Colisão com blocos sólidos (chão)
      if (world && p.vy <= 0 && p.y > 0 && p.y < 256) {
        const bx = Math.floor(p.x);
        const by = Math.floor(p.y - 0.06);
        const bz = Math.floor(p.z);
        const block = world.getBlock(bx, by, bz);
        const bid = stateId(block);
        if (bid !== 0 && !isFluid(bid)) {
          p.y = by + 1;
          p.vy = 0;
          p.vx *= 0.5;
          p.vz *= 0.5;
          p.onGround = true;
        } else {
          p.onGround = false;
        }
      }

      p.life++;
      if (p.life >= p.maxLife) {
        p.active = false;
      }
    }
  }

  renderUpdate() {
    let idx = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      this._dummy.position.set(p.x, p.y, p.z);

      // Encolhe e desaparece no final da vida
      const lifeRatio = p.life / p.maxLife;
      const scale = lifeRatio > 0.75 ? Math.max(0.01, 1 - (lifeRatio - 0.75) * 4) : 1;
      this._dummy.scale.setScalar(scale);
      this._dummy.rotation.set(0, 0, 0);
      this._dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(idx, this._dummy.matrix);

      this._color.setRGB(p.r / 255, p.g / 255, p.b / 255);
      this.instancedMesh.setColorAt(idx, this._color);
      idx++;
    }
    this.instancedMesh.count = idx;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) this.instancedMesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.instancedMesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}