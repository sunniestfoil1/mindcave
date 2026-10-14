// Texturas oficiais do Minecraft 1.8.9, extraídas do pacote e servidas localmente em /assets/ui/
// (carga instantânea, sem esperar o download do zip e sem textura inventada)
import { getOverlayUrlSync } from '../pack';

const UI_BASE = '/assets/ui/';

// Um pacote de recursos escolhido que traga widgets.png já está pronto (URL de blob) desde o boot
export function getWidgetsTexture() {
  return getOverlayUrlSync('textures/gui/widgets.png') || UI_BASE + 'widgets.png';
}

export function getDirtTexture() {
  return UI_BASE + 'dirt.png';
}
