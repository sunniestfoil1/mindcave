// GUI scale calculation — PRD 19 RF-001
import { isTouchDevice } from '@/game/touch';

export function getGuiScale(width, height, maxFactor = 0) {
  let factor = 1;
  const limit = maxFactor === 0 || maxFactor === 'auto' ? Infinity : maxFactor;
  while (factor < limit) {
    const next = factor + 1;
    if (width / next < 320 || height / next < 240) break;
    factor = next;
    if (factor >= 10) break;
  }
  // Celular em paisagem (altura ~360): o cálculo do 1.8.9 dá 1 e a hotbar fica com slots de 20 px, pequenos demais para o dedo.
  // Em "Auto" o mínimo no toque é 2 (as telas do jogo cabem a partir de ~330 px de altura).
  if ((maxFactor === 0 || maxFactor === 'auto') && factor < 2 && height >= 330 && isTouchDevice()) return 2;
  return factor;
}