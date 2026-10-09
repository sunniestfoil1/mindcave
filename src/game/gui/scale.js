// GUI scale calculation — PRD 19 RF-001
export function getGuiScale(width, height, maxFactor = 0) {
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