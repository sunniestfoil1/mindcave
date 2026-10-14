// Peças comuns da GUI com as texturas oficiais do pacote (1.8.9): recorte de sprite em escala inteira e
// posicionamento em "pixels de GUI". Todas as coordenadas dos containers são as do Minecraft; S = fator de escala.
import React, { useEffect, useState } from 'react';
import { getPackUrl, onPackReady, getOverlayUrlSync, MC } from '@/game/pack';
import { getGuiScale } from '@/game/gui/scale';
import { settingsStore } from '@/game/settingsStore';
import { drawMcText, measureMcText } from '@/game/gui/font';

const urlCache = new Map();

// Cópias locais das texturas críticas da HUD (mesmo arquivo oficial do pacote):
// a barra de vida/hotbar não pode esperar o download do pacote inteiro.
const LOCAL_TEXTURES = {
  'textures/gui/widgets.png': '/assets/ui/widgets.png',
  'textures/gui/icons.png': '/assets/ui/icons.png',
};

// URL (blob) de uma textura do pacote. Reaproveita o cache e tenta de novo quando o pacote termina de carregar.
export function usePackTexture(path) {
  const local = getOverlayUrlSync(path) || LOCAL_TEXTURES[path];
  const [url, setUrl] = useState(urlCache.get(path) || local || null);
  useEffect(() => {
    if (local) return undefined;
    if (urlCache.has(path)) { setUrl(urlCache.get(path)); return undefined; }
    let off = false;
    const load = () => getPackUrl(MC + path).then((u) => {
      if (u && !off) { urlCache.set(path, u); setUrl(u); }
    });
    const un = onPackReady(load);
    return () => { off = true; un(); };
  }, [path]);
  return url;
}

// Escala inteira da GUI para a janela atual (mesma regra do Minecraft: mínimo 320×240 de GUI)
export function useGuiScaleValue() {
  const calc = () => {
    const setting = settingsStore.get('device.guiScale');
    const max = !setting || setting === 'auto' ? 0 : parseInt(setting, 10) || 0;
    return getGuiScale(window.innerWidth, window.innerHeight, max);
  };
  const [s, setS] = useState(calc);
  useEffect(() => {
    const onResize = () => setS(calc());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return s;
}

// Recorte de textura posicionado em pixels de GUI. sheet = lado da folha (256 nas texturas de GUI).
export function Sprite({ url, u, v, w, h, S, x = 0, y = 0, sheet = 256, z, style, children, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        position: 'absolute', left: x * S, top: y * S, width: w * S, height: h * S, zIndex: z,
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: `${sheet * S}px ${sheet * S}px`,
        backgroundPosition: `${-u * S}px ${-v * S}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Texto com a fonte do jogo, posicionado em pixels de GUI (cinza 0x404040 dos títulos por padrão)
export function McText({ text, x, y, S, color = '#404040', shadow = false, align = 'left', z }) {
  const ref = React.useRef(null);
  const px = 8 * S;
  const w = text ? measureMcText(text, color, px) : 0;
  const h = Math.ceil(9 * S);
  React.useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !w) return;
    c.width = w + (shadow ? S : 0); c.height = h + (shadow ? S : 0);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawMcText(ctx, text, 0, 0, color, shadow, px);
  }, [text, color, shadow, px, w, h, S]);
  if (!text || !w) return null;
  const left = align === 'center' ? x * S - w / 2 : align === 'right' ? x * S - w : x * S;
  return <canvas ref={ref} style={{ position: 'absolute', left, top: y * S, width: w + (shadow ? S : 0), height: h + (shadow ? S : 0), zIndex: z, pointerEvents: 'none' }} />;
}
