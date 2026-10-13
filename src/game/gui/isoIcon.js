// Ícone isométrico (32×32) de um bloco feito de caixas: o mesmo desenho do cubo de inventário, mas com altura/largura por caixa.
// Caixas em 0..1 (x ↔ u, z ↔ v). A face de cima é a de y máximo; esquerda = z máximo; direita = x máximo.
const K = 0.4375; // inclinação do losango (7/12 · 0,75)

// Recorta (sx, sy, sw, sh) da imagem e a desenha no sistema de coordenadas da face (já transformado)
function sub(ctx, img, sx, sy, sw, sh, shade) {
  if (sw <= 0 || sh <= 0) return;
  ctx.drawImage(img, sx, sy, sw, sh, sx, sy, sw, sh);
  if (shade) { ctx.fillStyle = shade; ctx.fillRect(sx, sy, sw, sh); }
}

export function drawIsoBoxes(ctx, boxes, topImg, sideImg, bottomImg, leftImg) {
  const side = sideImg || topImg;
  const left = leftImg || side;
  for (const [x0, y0, z0, x1, y1, z1] of boxes) {
    const ux0 = x0 * 16, ux1 = x1 * 16, vz0 = z0 * 16, vz1 = z1 * 16, h0 = y0 * 16, h1 = y1 * 16;
    // cima: no topo da caixa (cada px de altura desloca 0,875 px para baixo quando abaixo de 16)
    if (topImg) {
      ctx.save();
      ctx.setTransform(0.75, K, -0.75, K, 16, 2 + (16 - h1) * 0.875);
      sub(ctx, topImg, ux0, vz0, ux1 - ux0, vz1 - vz0);
      ctx.restore();
    }
    // esquerda (plano z = z1): desloca para a direita/cima quando z1 < 16
    ctx.save();
    ctx.setTransform(0.75, K, 0, 0.875, 4 + 0.75 * (16 - vz1), 9 - K * (16 - vz1));
    sub(ctx, left, ux0, 16 - h1, ux1 - ux0, h1 - h0, 'rgba(0,0,0,0.15)');
    ctx.restore();
    // direita (plano x = x1): u' = 16 − z
    ctx.save();
    ctx.setTransform(0.75, -K, 0, 0.875, 16 - 0.75 * (16 - ux1), 16 - K * (16 - ux1));
    sub(ctx, side, 16 - vz1, 16 - h1, vz1 - vz0, h1 - h0, 'rgba(0,0,0,0.35)');
    ctx.restore();
  }
}

// Caixas do ícone: laje de baixo; escada subindo para o fundo-direita (como no inventário do original)
export const ICON_SLAB = [[0, 0, 0, 1, 0.5, 1]];
export const ICON_STAIRS = [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 1, 1, 0.5]];

// Cerca (poste + 2 barras de cada lado) e portão (2 postes + barras): ícones de inventário
export const ICON_FENCE = [[0.375, 0, 0.375, 0.625, 1, 0.625], [0, 0.375, 0.4375, 0.375, 0.5625, 0.5625], [0, 0.75, 0.4375, 0.375, 0.9375, 0.5625], [0.625, 0.375, 0.4375, 1, 0.5625, 0.5625], [0.625, 0.75, 0.4375, 1, 0.9375, 0.5625]];
export const ICON_GATE = [[0, 0.3125, 0.375, 0.125, 1, 0.625], [0.875, 0.3125, 0.375, 1, 1, 0.625], [0.125, 0.375, 0.4375, 0.875, 0.5625, 0.5625], [0.125, 0.75, 0.4375, 0.875, 0.9375, 0.5625]];

export const ICON_CHEST = [[0.0625, 0, 0.0625, 0.9375, 0.875, 0.9375]];
