// Prévia do jogador dentro da caixa preta do inventário (como GuiInventory.drawEntityOnScreen da 1.8.9):
// de frente, o corpo gira um pouco e a cabeça segue o mouse.
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildPlayerModel, applyPackSkin, applyCapeToModel } from '@/game/playerModel';
import { createAnimationState, applyThirdPersonPose } from '@/game/animation';

const DEG = Math.PI / 180;

// Predefinições (coordenadas da janela, px de GUI). Inventário de sobrevivência: caixa 52×70 em (26, 8), pés em (51, 75), escala 30,
// referência do mouse 50 px acima dos pés. Aba "Inventário" do criativo: caixa 32×43 em (28, 6), pés em (43, 45), escala 20, referência 30.
export const PREVIEW_SURVIVAL = { box: { x: 26, y: 8, w: 52, h: 70 }, feet: { x: 51, y: 75 }, unit: 30, refUp: 50 };
export const PREVIEW_CREATIVE = { box: { x: 28, y: 6, w: 32, h: 43 }, feet: { x: 43, y: 45 }, unit: 20, refUp: 30 };

export default function PlayerPreview({ S, preset = PREVIEW_SURVIVAL, capeVisible = true }) {
  const { box, feet, unit, refUp } = preset;
  const FEET_Y = feet.y - box.y;       // pés, a partir do topo da caixa
  const CENTER_X = feet.x - box.x;     // centro do corpo, a partir da esquerda da caixa
  const canvasRef = useRef(null);
  const mouse = useRef({ x: null, y: null });

  useEffect(() => {
    const onMove = (e) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const W = box.w * S, H = box.h * S;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 0.35);
    key.position.set(-1, 2, 3);
    scene.add(key);

    // Ortográfica: 1 bloco = UNIT px de GUI; y = 0 (pés) cai em FEET_Y a partir do topo
    const left = -CENTER_X / unit, right = (box.w - CENTER_X) / unit;
    const top = FEET_Y / unit, bottom = -(box.h - FEET_Y) / unit;
    const camera = new THREE.OrthographicCamera(left, right, top, bottom, -10, 10);
    camera.position.set(0, 0, 5);

    const model = buildPlayerModel();
    model.visible = true;
    scene.add(model);
    const body = { vel: { x: 0, y: 0, z: 0 }, sprinting: false, sneaking: false, pitch: 0, isDead: false };
    const anim = createAnimationState();
    let raf = 0, disposed = false;
    applyPackSkin(model, null).catch(() => {});
    applyCapeToModel(model, capeVisible);

    const draw = () => {
      if (disposed) return;
      raf = requestAnimationFrame(draw);
      const r = canvas.getBoundingClientRect();
      // pontos de referência da 1.8.9: x = centro do corpo; y = refUp px de GUI acima dos pés
      const refX = r.left + CENTER_X * S, refY = r.top + (FEET_Y - refUp) * S;
      const mx = mouse.current.x ?? refX, my = mouse.current.y ?? refY;
      const dx = (mx - refX) / S, dy = (refY - my) / S;       // dx > 0: mouse à direita; dy > 0: mouse acima
      const bodyYaw = Math.atan(dx / 40) * 20 * DEG;
      const headYaw = Math.atan(dx / 40) * 20 * DEG;           // relativo ao corpo (total = 40° · atan)
      const pitch = -Math.atan(dy / 40) * 20 * DEG;            // negativo = olhando para cima
      anim.walkPhase += 0.02;
      body.pitch = pitch;
      model.position.set(0, 0, 0);
      model.rotation.set(0, bodyYaw, 0);
      applyThirdPersonPose(model, anim, body, 0);
      model.userData.head.rotation.y = headYaw;
      renderer.render(scene, camera);
    };
    draw();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
    };
  }, [S, preset, capeVisible]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', left: box.x * S, top: box.y * S, width: box.w * S, height: box.h * S, pointerEvents: 'none' }}
    />
  );
}
