// Nametag — porte de NameTagObject do skinview3d (MIT)
// Sprite billboard com fundo semi-transparente e texto branco.
// Referência: 07-animacoes-jogador-e-armaduras/skinview3d/src/nametag.ts
import * as THREE from 'three';

export function createNametag(text) {
  const material = new THREE.SpriteMaterial({
    transparent: true,
    alphaTest: 1e-5,
    depthTest: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 999;

  const obj = {
    sprite,
    material,
    text: text || '',
    font: 'bold 36px sans-serif',
    margin: [4, 8, 4, 8],
    textStyle: 'white',
    backgroundStyle: 'rgba(0,0,0,.35)',
    height: 0.3,
  };

  paintNametag(obj);
  return sprite;
}

function paintNametag(obj) {
  const { text, font, margin, textStyle, backgroundStyle, height, material } = obj;
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
  material.map = texture;
  material.needsUpdate = true;

  // Tamanho do sprite (mantém aspect ratio)
  obj.sprite.scale.x = (canvas.width / canvas.height) * height;
  obj.sprite.scale.y = height;
}

export function setNametagText(sprite, text) {
  if (!sprite || !sprite.material) return;
  // Reutilizar os parâmetros armazenados no material (hack: criar novo canvas)
  const canvas = document.createElement('canvas');
  const font = 'bold 36px sans-serif';
  const margin = [4, 8, 4, 8];

  let ctx = canvas.getContext('2d');
  ctx.font = font;
  const metrics = ctx.measureText(text);

  canvas.width = Math.ceil(margin[3] + metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight + margin[1]);
  canvas.height = Math.ceil(margin[0] + metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent + margin[2]);

  ctx = canvas.getContext('2d');
  ctx.font = font;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.fillText(text, margin[3] + metrics.actualBoundingBoxLeft, margin[0] + metrics.actualBoundingBoxAscent);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  sprite.scale.x = (canvas.width / canvas.height) * 0.3;
  sprite.scale.y = 0.3;
}