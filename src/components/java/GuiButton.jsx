import React, { useState } from 'react';
import { useGui } from './GuiContext';
import { getWidgetsTexture } from '@/game/gui/textures';
import GuiText from './GuiText';

import { playClickSound } from '@/game/sounds';

// Java 1.8.9 button — PRD 19 RF-004
// x is relative to screen center; y is from top; all in GUI pixels
export default function GuiButton({ x, y, width = 200, label, onClick, disabled, title, icon, active, onPointerDown, onPointerUp, onPointerCancel }) {
  const gui = useGui();
  const scale = gui?.scale || 1;
  const guiWidth = gui?.guiWidth || 0;
  const [hover, setHover] = useState(false);

  // "active" = botão de liga/desliga ligado: usa o visual de destaque do jogo (o mesmo do mouse em cima)
  const lit = hover || active;
  const stateY = disabled ? 46 : lit ? 86 : 66;
  const textColor = disabled ? '#A0A0A0' : lit ? '#FFFFA0' : '#E0E0E0';
  const texUrl = getWidgetsTexture();
  const halfW = width / 2;

  const left = (guiWidth / 2 + x) * scale;
  const top = y * scale;
  const w = width * scale;
  const h = 20 * scale;
  const bgSize = 256 * scale;

  const handleClick = (e) => {
    if (disabled) return;
    playClickSound();
    if (onClick) onClick(e);
  };

  return (
    <div
      style={{
        position: 'absolute',
        left, top, width: w, height: h,
        cursor: disabled ? 'default' : 'pointer',
        touchAction: 'none',
        pointerEvents: 'auto',
      }}
      // só o mouse destaca ao passar por cima: no toque o navegador finge um "mouseenter" e deixa o botão aceso depois do dedo sair
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
      onPointerLeave={() => setHover(false)}
      onClick={handleClick}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      title={title}
      role="button"
      aria-label={typeof label === 'string' ? label.replace(/§./g, '') : title}
      aria-disabled={disabled ? 'true' : undefined}
    >
      <div style={{
        position: 'absolute', left: 0, top: 0,
        width: halfW * scale, height: h,
        backgroundImage: `url(${texUrl})`,
        backgroundPosition: `0 ${-stateY * scale}px`,
        backgroundSize: `${bgSize}px ${bgSize}px`,
        imageRendering: 'pixelated',
      }} />
      <div style={{
        position: 'absolute', right: 0, top: 0,
        width: halfW * scale, height: h,
        backgroundImage: `url(${texUrl})`,
        backgroundPosition: `${-(200 - halfW) * scale}px ${-stateY * scale}px`,
        backgroundSize: `${bgSize}px ${bgSize}px`,
        imageRendering: 'pixelated',
      }} />
      {(label || icon) && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 4 * scale,
        }}>
          {icon}
          {label && <GuiText text={label} color={textColor} shadow scale={scale} />}
        </div>
      )}
    </div>
  );
}