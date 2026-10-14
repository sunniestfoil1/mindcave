// Mira do 1.8.9 (GuiIngame.renderGameOverlay): o sprite 16×16 de (0,0) do icons.png, em (i/2 - 7, j/2 - 7) da GUI, com
// tryBlendFuncSeparate(775, 769, 1, 0) = (ONE_MINUS_DST_COLOR, ONE_MINUS_SRC_COLOR) e teste alfa 0,1: o branco do sprite inverte a cor
// do que está atrás (src + dst - 2·src·dst). É um único quad no mesmo canvas do jogo, sem DOM nem camada extra do compositor.
import * as THREE from 'three';
import { MC, getPackCanvas, onPackReady, getOverlayUrlSync } from './pack';
import { getGuiScale } from './gui/scale';
import { settingsStore } from './settingsStore';

const LOCAL_ICONS = '/assets/ui/icons.png';

function cropSprite(source) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const sx = source.width / 256;   // pacotes em alta resolução têm a folha maior; o sprite continua sendo 1/16 dela
  cv.getContext('2d').drawImage(source, 0, 0, 16 * sx, 16 * sx, 0, 0, 16, 16);
  return cv;
}

export function createCrosshair(renderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  const material = new THREE.MeshBasicMaterial({
    transparent: true, alphaTest: 0.1, depthTest: false, depthWrite: false, toneMapped: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneMinusDstColorFactor, blendDst: THREE.OneMinusSrcColorFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.ZeroFactor,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.visible = false;
  scene.add(mesh);

  let texture = null;
  const setSprite = (canvas) => {
    const next = new THREE.CanvasTexture(canvas);
    next.magFilter = next.minFilter = THREE.NearestFilter;
    next.generateMipmaps = false;
    texture?.dispose();
    texture = next;
    material.map = next;
    material.needsUpdate = true;
  };

  let disposed = false;
  const img = new Image();
  img.onload = () => { if (!disposed && !texture) setSprite(cropSprite(img)); };
  img.src = getOverlayUrlSync('textures/gui/icons.png') || LOCAL_ICONS;
  // o pacote ativo pode trazer outra mira: quando carrega, passa a valer a dele
  const offPack = onPackReady(() => {
    getPackCanvas(MC + 'textures/gui/icons.png').then((cv) => { if (cv && !disposed) setSprite(cropSprite(cv)); });
  });

  let lastW = 0, lastH = 0, lastS = 0, lastX = NaN, lastY = NaN;

  return {
    // w, h em px CSS do canvas; visible = regra de showCrosshair
    render(w, h, visible) {
      if (!visible || !texture || !w || !h) return;
      const setting = settingsStore.get('device.guiScale');
      const max = !setting || setting === 'auto' ? 0 : parseInt(setting, 10) || 0;
      const S = getGuiScale(w, h, max);
      if (w !== lastW || h !== lastH) {
        camera.left = 0; camera.right = w; camera.top = h; camera.bottom = 0;
        camera.updateProjectionMatrix();
        lastW = w; lastH = h;
      }
      // ScaledResolution: largura/altura da GUI arredondadas para cima; posição em inteiros da GUI (divisão inteira do Java)
      const gx = Math.floor(Math.ceil(w / S) / 2) - 7;
      const gy = Math.floor(Math.ceil(h / S) / 2) - 7;
      if (S !== lastS || gx !== lastX || gy !== lastY) {
        mesh.scale.set(16 * S, 16 * S, 1);
        mesh.position.set(gx * S + 8 * S, h - (gy * S + 8 * S), 0);
        lastS = S; lastX = gx; lastY = gy;
      }
      mesh.visible = true;
      const prev = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = prev;
    },
    dispose() {
      disposed = true;
      offPack();
      texture?.dispose();
      material.dispose();
      mesh.geometry.dispose();
    },
  };
}
