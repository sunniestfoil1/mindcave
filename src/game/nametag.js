// Nametag — porte de NameTagObject do skinview3d (MIT)
// Sprite billboard com fundo semi-transparente e texto branco.
// Referência: 07-animacoes-jogador-e-armaduras/skinview3d/src/nametag.ts
import * as THREE from 'three';

// Nome sobre o jogador, como no 1.8.9 (RendererLivingEntity.renderLivingLabel): duas camadas — uma sem teste de profundidade e fraca, que aparece
// ATRÁS de blocos e paredes, e uma sólida, que só aparece quando o jogador está à vista. Some por distância (64 blocos; agachado, 32), com um
// esmaecer nos últimos 8. Devolve um Group (posição/visible como antes); `updateNametagFade(tag, distância, agachado)` ajusta a transparência.
export function createNametag(text) {
  const make = (depthTest) => new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, alphaTest: 1e-5, depthTest, depthWrite: false }));
  const ghost = make(false), solid = make(true);   // `ghost`: visível através dos blocos
  ghost.renderOrder = 998; solid.renderOrder = 999;
  ghost.material.opacity = 0.3;
  const group = new THREE.Group();
  group.add(ghost, solid);
  const obj = {
    sprites: [ghost, solid],
    materials: [ghost.material, solid.material],
    text: text || '',
    font: 'bold 36px sans-serif',
    margin: [4, 8, 4, 8],
    textStyle: 'white',
    backgroundStyle: 'rgba(0,0,0,0.22)',
    height: 0.3,
  };
  paintNametag(obj);
  group.userData.nametag = { ghost, solid };
  return group;
}

export const NAMETAG_RANGE = 64, NAMETAG_RANGE_SNEAK = 32, NAMETAG_FADE = 8;
// Opacidade do nome pela distância: 1 perto, 0 além do alcance; a camada atrás dos blocos é bem mais fraca que a sólida
export function nametagFade(distance, sneaking = false) {
  const range = sneaking ? NAMETAG_RANGE_SNEAK : NAMETAG_RANGE;
  return Math.max(0, Math.min(1, (range - distance) / NAMETAG_FADE));
}
export function updateNametagFade(tag, distance, sneaking = false) {
  const t = tag && tag.userData && tag.userData.nametag;
  if (!t) return;
  const f = nametagFade(distance, sneaking);
  t.solid.material.opacity = f;
  t.ghost.material.opacity = 0.3 * f;
  tag.visible = f > 0.01 ? tag.visible : false;
}

function paintNametag(obj) {
  const { text, font, margin, textStyle, backgroundStyle, height } = obj;
  const canvas = document.createElement('canvas');

  // Medir texto
  let ctx = canvas.getContext('2d');
  ctx.font = font;
  const metrics = ctx.measureText(text);

  // Tamanho do canvas
  canvas.width = Math.ceil(margin[3] + metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight + margin[1]);
  canvas.height = Math.ceil(margin[0] + metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + margin[2]);

  // Re-criar contexto após redimensionar canvas
  ctx = canvas.getContext('2d');
  ctx.font = font;

  // Fundo
  ctx.fillStyle = backgroundStyle;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Texto
  ctx.fillStyle = textStyle;
  ctx.fillText(
    text,
    margin[3] + metrics.actualBoundingBoxLeft,
    margin[0] + metrics.actualBoundingBoxAscent
  );

  // Aplicar textura
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  for (const m of obj.materials) { m.map = texture; m.needsUpdate = true; }

  // Tamanho dos sprites (mantém aspect ratio)
  for (const sp of obj.sprites) { sp.scale.x = (canvas.width / canvas.height) * height; sp.scale.y = height; }
}
