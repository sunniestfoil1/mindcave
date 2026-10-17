// GUI scale calculation — PRD 19 RF-001
import { isTouchDevice } from '@/game/touch';

// Regra do 1.8.9: o maior inteiro em que a tela ainda tem ao menos 320×240 px de GUI
function vanillaScale(width, height, maxFactor) {
  let factor = 1;
  const limit = maxFactor === 0 || maxFactor === 'auto' ? Infinity : maxFactor;
  while (factor < limit) {
    const next = factor + 1;
    if (width / next < 320 || height / next < 240) break;
    factor = next;
    if (factor >= 10) break;
  }
  return factor;
}
const isAuto = (maxFactor) => maxFactor === 0 || maxFactor === 'auto';

// HUD e inventários dentro do jogo. No celular em paisagem (altura ~360) a regra do 1.8.9 dá 1 e a hotbar ficaria com slots de 20 px, pequenos
// demais para o dedo: em "Auto" o mínimo no toque é 2 (inventário, hotbar e barras cabem a partir de ~330 px de altura).
export function getGuiScale(width, height, maxFactor = 0) {
  const factor = vanillaScale(width, height, maxFactor);
  if (isAuto(maxFactor) && factor < 2 && height >= 330 && isTouchDevice()) return 2;
  return factor;
}

// Telas de menu (principal, opções, pausa, criar mundo): foram desenhadas para 320×240 de GUI e quebram com menos (textos por cima dos botões).
// No celular a escala sobe em passos de 0,25 até onde a tela ainda tem 240 de altura de GUI: maior que o 1 do 1.8.9, sem estourar o layout.
export function getMenuScale(width, height, maxFactor = 0) {
  const factor = vanillaScale(width, height, maxFactor);
  if (!isAuto(maxFactor) || factor >= 2 || !isTouchDevice()) return factor;
  const fit = Math.min(width / 320, height / 240);
  return Math.max(1, Math.floor(fit * 4) / 4);
}
