import React, { useEffect, useState } from 'react';
import { getPackUrl, onPackReady, getOverlayUrlSync, MC } from '@/game/pack';
import { getGuiScale } from '@/game/gui/scale';
import { settingsStore } from '@/game/settingsStore';
import { drawMcText, measureMcText } from '@/game/gui/font';

const urlCache = new Map();
const LOCAL_TEXTURES = {
  'textures/gui/widgets.png': '/assets/ui/widgets.png',
  'textures/gui/icons.png': '/assets/ui/icons.png',
};

export function usePackTexture(path) {
  const local = getOverlayUrlSync(path) || LOCAL_TEXTURES[path];
  const [url, setUrl] = useState(urlCache.get(path) || local || null);
  useEffect(() => {
    if (local) return undefined;
    if (urlCache.has(path)) {
      setUrl(urlCache.get(path));
      return undefined;
    }
    let off = false;
    const load = () =>
      getPackUrl(MC + path).then((u) => {
        if (u && !off) {
          urlCache.set(path, u);
          setUrl(u);
        }
      });
    const un = onPackReady(load);
    return () => {
      off = true;
      un();
    };
  }, [path, local]);
  return url;
}

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

export const Sprite = React.memo(function Sprite({
  url, u, v, w, h, S, x = 0, y = 0, sheet = 256, z, style, children, ...rest
}) {
  return (
    <div
      {...rest}
      style={{
        position: 'absolute',
        left: x * S,
        top: y * S,
        width: w * S,
        height: h * S,
        zIndex: z,
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
});

export const McText = React.memo(function McText({
  text, x, y, S, color = '#404040', shadow = false, align = 'left', z,
}) {
  const ref = React.useRef(null);
  const px = 8 * S;
  const w = text ? measureMcText(text, color, px) : 0;
  const h = Math.ceil(9 * S);
  const targetW = w + (shadow ? S : 0);
  const targetH = h + (shadow ? S : 0);

  React.useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !w) return;
    const ctx = c.getContext('2d');
    // Só redimensiona o buffer se o tamanho realmente mudou (evita realocar textura na GPU)
    if (c.width !== targetW || c.height !== targetH) {
      c.width = targetW;
      c.height = targetH;
    } else {
      ctx.clearRect(0, 0, targetW, targetH);
    }
    ctx.imageSmoothingEnabled = false;
    drawMcText(ctx, text, 0, 0, color, shadow, px);
  }, [text, color, shadow, px, w, targetW, targetH]);

  if (!text || !w) return null;
  const left = align === 'center' ? x * S - w / 2 : align === 'right' ? x * S - w : x * S;
  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute',
        left,
        top: y * S,
        width: targetW,
        height: targetH,
        zIndex: z,
        pointerEvents: 'none',
      }}
    />
  );
});
