// Texto das placas: um plano com o texto (fonte Minecraft, 4 linhas) colado na frente da placa, só para as placas perto do jogador.
// O texto vive em containers.js (getSign/setSign); a placa em pé mostra o texto dos dois lados (o jogo não guarda para onde a frente olha).
import * as THREE from 'three';
import { allSigns } from './containers';
import { stateId, stateMeta } from './chunk';
import { WALL_META_DIR } from './blocksMore';

const DF = [[-1, 0], [0, -1], [1, 0], [0, 1]];
const RANGE = 24;

function textTexture(lines) {
  const cv = document.createElement('canvas');
  cv.width = 224; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '16px Minecraft, monospace';
  lines.forEach((l, i) => ctx.fillText(l, 112, 16 + i * 32));
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  return tex;
}

export class SignRenderer {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map();   // "x,y,z" → { group, text }
    this.geo = new THREE.PlaneGeometry(0.875, 0.5);
    this.tick = 0;
    this._fonts = false;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { this._fonts = true; this.meshes.forEach((m) => this._dispose(m)); this.meshes.clear(); });
  }

  _dispose(m) { this.scene.remove(m.group); m.group.children.forEach((c) => { c.material.map?.dispose(); c.material.dispose(); }); }

  // Chamado a cada tick: cria/atualiza/remove só o que mudou
  update(world, pos) {
    if (++this.tick % 10 !== 0) return;
    const seen = new Set();
    for (const s of allSigns()) {
      if (Math.abs(s.x - pos.x) > RANGE || Math.abs(s.z - pos.z) > RANGE || Math.abs(s.y - pos.y) > RANGE) continue;
      const st = world.getBlock(s.x, s.y, s.z);
      const id = stateId(st);
      if (id !== 63 && id !== 68) continue;
      const key = s.x + ',' + s.y + ',' + s.z;
      const text = s.lines.join('\n');
      seen.add(key);
      const meta = stateMeta(st);
      const sig = text + '|' + id + '|' + meta;
      const cur = this.meshes.get(key);
      if (cur && cur.sig === sig) continue;
      if (cur) this._dispose(cur);
      const group = new THREE.Group();
      const mk = (cx, cy, cz, nx, nz) => {
        const mat = new THREE.MeshBasicMaterial({ map: textTexture(s.lines), transparent: true, side: THREE.FrontSide, depthWrite: false });
        const m = new THREE.Mesh(this.geo, mat);
        m.position.set(cx, cy, cz);
        m.rotation.y = Math.atan2(nx, nz);
        m.renderOrder = 5;
        group.add(m);
      };
      if (id === 68) {
        const [dx, dz] = DF[WALL_META_DIR[Math.min(4, Math.max(1, meta & 7))]];
        mk(s.x + 0.5 + dx * 0.373, s.y + 0.53125, s.z + 0.5 + dz * 0.373, -dx, -dz);
      } else {
        const alongX = ((meta >> 2) & 1) === 1;
        const cy = s.y + 0.75;
        if (alongX) { mk(s.x + 0.5, cy, s.z + 0.5 + 0.0645, 0, 1); mk(s.x + 0.5, cy, s.z + 0.5 - 0.0645, 0, -1); }
        else { mk(s.x + 0.5 + 0.0645, cy, s.z + 0.5, 1, 0); mk(s.x + 0.5 - 0.0645, cy, s.z + 0.5, -1, 0); }
      }
      this.scene.add(group);
      this.meshes.set(key, { group, sig });
    }
    for (const [key, m] of this.meshes) if (!seen.has(key)) { this._dispose(m); this.meshes.delete(key); }
  }

  dispose() { this.meshes.forEach((m) => this._dispose(m)); this.meshes.clear(); this.geo.dispose(); }
}
