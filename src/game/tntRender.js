// TNT acesa: UMA malha instanciada (um desenho para todas) com a textura do bloco (lados, topo e base) em vez de uma malha e um material
// novos por TNT. O pisca branco vem da cor da instância (valor > 1 estoura para branco) e o "inchaço" antes de explodir, da escala.
import * as THREE from 'three';
import { getAtlasTileCanvas } from './textures';

const MAX = 2048;
const WHITE = new THREE.Color(6, 6, 6), PLAIN = new THREE.Color(1, 1, 1);

function buildTexture() {
  const c = document.createElement('canvas');
  c.width = 48; c.height = 16;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  [['tnt', 0], ['tnt_top', 16], ['tnt_bottom', 32]].forEach(([n, ox]) => { const t = getAtlasTileCanvas(n); if (t) x.drawImage(t, ox, 0, 16, 16); });
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  return tex;
}

export class TntRenderer {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    // BoxGeometry: grupos de 4 vértices por face na ordem +x, -x, +y, -y, +z, -z → recorta a faixa certa da textura de 48 px
    const uv = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const slot = f === 2 ? 1 : f === 3 ? 2 : 0;   // topo, base, lados
      for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setX(i, (slot + uv.getX(i)) / 3); }
    }
    this.mat = new THREE.MeshBasicMaterial({ map: buildTexture() });
    // pisca = mistura com branco (0,8) em vez de multiplicar a cor: multiplicar deixava o TNT amarelado
    this.mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', 'float fl = clamp((vColor.r - 1.0) / 5.0, 0.0, 1.0); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), fl * 0.8);');
    };
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, PLAIN);
    scene.add(this.mesh);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3();
  }

  // list: [{ pos:{x,y,z}, fuse }]
  update(list) {
    const n = Math.min(list.length, MAX);
    for (let i = 0; i < n; i++) {
      const t = list[i];
      const pulse = t.fuse < 10 ? 1 + (10 - t.fuse) * 0.012 : 1;   // incha um pouco nos últimos ticks
      this._p.set(t.pos.x, t.pos.y, t.pos.z);
      this._s.set(0.98 * pulse, 0.98 * pulse, 0.98 * pulse);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, Math.floor(t.fuse / 5) % 2 === 0 ? WHITE : PLAIN);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose(); this.mat.map.dispose(); this.mat.dispose(); this.mesh.dispose();
  }
}
