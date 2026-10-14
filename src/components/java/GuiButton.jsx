import React, { useState } from 'react';
import { useGui } from './GuiContext';
import { getWidgetsTexture } from '@/game/gui/textures';
import GuiText from './GuiText';

import { playClickSound } from '@/game/sounds';

// Java 1.8.9 button — PRD 19 RF-004
// x is relative to screen center; y is from top; all in GUI pixels
export default function GuiButton({ x, y, width = 200, label, onClick, disabled, title, icon }) {
  const gui = useGui();
  const scale = gui?.scale || 1;
  const guiWidth = gui?.guiWidth || 0;
  const [hover, setHover] = useState(false);

  const stateY = disabled ? 46 : hover ? 86 : 66;
  const textColor = disabled ? '#A0A0A0' : hover ? '#FFFFA0' : '#E0E0E0';
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
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleClick}
      title={title}
      role="button"
      aria-label={typeof label === 'string' ? label.replace(/§./g, '') : undefined}
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