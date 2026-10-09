import React, { useState, useRef, useCallback } from 'react';
import { useGui } from './GuiContext';
import { getWidgetsTexture } from '@/game/gui/textures';
import GuiText from './GuiText';

// Java 1.8.9 slider — uses the same widgets.png button texture for the track,
// and the disabled-state texture (y=46) for the 8px knob.
export default function GuiSlider({ x, y, width = 200, label, value, min = 0, max = 100, step = 1, onChange, format }) {
  const gui = useGui();
  const scale = gui?.scale || 1;
  const guiWidth = gui?.guiWidth || 0;
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef(null);

  const stateY = dragging || hover ? 86 : 66;
  const texUrl = getWidgetsTexture();
  const halfW = width / 2;

  const left = (guiWidth / 2 + x) * scale;
  const top = y * scale;
  const w = width * scale;
  const h = 20 * scale;
  const bgSize = 256 * scale;

  const pct = max > min ? (value - min) / (max - min) : 0;
  const knobX = Math.round(pct * (width - 8));
  const displayText = format ? format(value) : `${label}: ${value}`;

  const updateFromMouse = useCallback((clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const px = (clientX - rect.left) / scale;
    const newPct = Math.max(0, Math.min(1, (px - 4) / (width - 8)));
    let newVal = min + newPct * (max - min);
    newVal = Math.round(newVal / step) * step;
    newVal = Math.max(min, Math.min(max, newVal));
    onChange?.(newVal);
  }, [scale, width, min, max, step, onChange]);

  return (
    <div
      ref={trackRef}
      style={{ position: 'absolute', left, top, width: w, height: h, cursor: 'pointer' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDragging(false); }}
      onMouseDown={(e) => { setDragging(true); updateFromMouse(e.clientX); e.preventDefault(); }}
      onMouseMove={(e) => { if (dragging) updateFromMouse(e.clientX); }}
      onMouseUp={() => setDragging(false)}
    >
      {/* Track — left half */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: halfW * scale, height: h, backgroundImage: `url(${texUrl})`, backgroundPosition: `0 ${-stateY * scale}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated' }} />
      {/* Track — right half */}
      <div style={{ position: 'absolute', right: 0, top: 0, width: halfW * scale, height: h, backgroundImage: `url(${texUrl})`, backgroundPosition: `${-(200 - halfW) * scale}px ${-stateY * scale}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated' }} />
      {/* Knob left 4px (disabled-state texture) */}
      <div style={{ position: 'absolute', left: knobX * scale, top: 0, width: 4 * scale, height: h, backgroundImage: `url(${texUrl})`, backgroundPosition: `0 ${-46 * scale}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated', pointerEvents: 'none' }} />
      {/* Knob right 4px */}
      <div style={{ position: 'absolute', left: (knobX + 4) * scale, top: 0, width: 4 * scale, height: h, backgroundImage: `url(${texUrl})`, backgroundPosition: `${-196 * scale}px ${-46 * scale}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated', pointerEvents: 'none' }} />
      {/* Label */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <GuiText text={displayText} color="#E0E0E0" shadow scale={scale} />
      </div>
    </div>
  );
}