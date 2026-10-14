import React, { useState, useRef, useCallback } from 'react';
import { useGui } from './GuiContext';
import { getWidgetsTexture } from '@/game/gui/textures';
import GuiText from './GuiText';

const H = 20; // button height in GUI px

// Shared button background — two halves of the widgets.png button texture
function ButtonBg({ width, scale, stateY, disabled }) {
  const texUrl = getWidgetsTexture();
  const halfW = width / 2;
  const bgSize = 256 * scale;
  const y = (disabled ? 46 : stateY) * scale;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width: halfW * scale, height: H * scale,
        backgroundImage: `url(${texUrl})`, backgroundPosition: `0 ${-y}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, width: halfW * scale, height: H * scale,
        backgroundImage: `url(${texUrl})`, backgroundPosition: `${-(200 - halfW) * scale}px ${-y}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated' }} />
    </>
  );
}

// Inline Java 1.8.9 button — works in flex/grid layouts (not absolute positioned).
// Cycle mode: pass `options` → shows "Label: Value", click advances, Shift+click / right-click reverses.
// Nav mode: no `options` → shows just label, calls onClick.
export function JavaButton({ label, value, options, onChange, onClick, disabled, disabledReason, width = 150 }) {
  const gui = useGui();
  const scale = gui?.scale || 1;
  const [hover, setHover] = useState(false);
  const stateY = hover ? 86 : 66;

  const isCycle = options && options.length > 0;
  const idx = isCycle ? options.findIndex(o => o.value === value) : -1;
  const current = isCycle ? (options[idx] || options[0]) : null;

  const displayText = isCycle
    ? `${label}: ${disabled ? (disabledReason || 'Indisponível') : (current?.label ?? String(value))}`
    : label;

  const handleClick = (e) => {
    if (disabled) return;
    if (isCycle) {
      e.preventDefault();
      const dir = e.shiftKey ? -1 : 1;
      const n = (idx + dir + options.length) % options.length;
      onChange?.(options[n].value);
    } else {
      onClick?.();
    }
  };

  const handleContext = isCycle && !disabled ? (e) => {
    e.preventDefault();
    const n = (idx - 1 + options.length) % options.length;
    onChange?.(options[n].value);
  } : undefined;

  return (
    <div
      style={{ position: 'relative', width: width * scale, height: H * scale, cursor: disabled ? 'default' : 'pointer' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={handleClick}
      onContextMenu={handleContext}
      role="button"
      aria-label={String(displayText).replace(/§./g, '')}
      aria-disabled={disabled ? 'true' : undefined}
    >
      <ButtonBg width={width} scale={scale} stateY={stateY} disabled={disabled} />
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <GuiText text={displayText} color={disabled ? '#A0A0A0' : '#E0E0E0'} shadow scale={scale} />
      </div>
    </div>
  );
}

// Inline Java 1.8.9 slider — drag to change, shows "Label: Value" centered
export function JavaSlider({ label, value, min, max, step = 1, format, onChange, disabled, width = 150 }) {
  const gui = useGui();
  const scale = gui?.scale || 1;
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef(null);
  const stateY = disabled ? 46 : (dragging || hover ? 86 : 66);
  const texUrl = getWidgetsTexture();
  const halfW = width / 2;
  const bgSize = 256 * scale;

  const pct = max > min ? (value - min) / (max - min) : 0;
  const knobX = Math.round(pct * (width - 8));
  const formattedVal = value === 0 ? 'DESATIVADO' : (format ? format(value) : `${value}%`);
  const displayText = label ? `${label}: ${formattedVal}` : formattedVal;

  const updateFromMouse = useCallback((clientX) => {
    if (disabled || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const px = (clientX - rect.left) / scale;
    const newPct = Math.max(0, Math.min(1, (px - 4) / (width - 8)));
    let newVal = min + newPct * (max - min);
    newVal = Math.round(newVal / step) * step;
    newVal = Math.max(min, Math.min(max, newVal));
    onChange?.(newVal);
  }, [scale, width, min, max, step, onChange, disabled]);

  return (
    <div
      ref={trackRef}
      style={{ position: 'relative', width: width * scale, height: H * scale, cursor: disabled ? 'default' : 'pointer' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setDragging(false); }}
      onMouseDown={disabled ? undefined : (e) => { setDragging(true); updateFromMouse(e.clientX); e.preventDefault(); }}
      onMouseMove={(e) => { if (dragging) updateFromMouse(e.clientX); }}
      onMouseUp={() => setDragging(false)}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: halfW * scale, height: H * scale,
        backgroundImage: `url(${texUrl})`, backgroundPosition: `0 ${-stateY * scale}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, width: halfW * scale, height: H * scale,
        backgroundImage: `url(${texUrl})`, backgroundPosition: `${-(200 - halfW) * scale}px ${-stateY * scale}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated' }} />
      {!disabled && (
        <>
          <div style={{ position: 'absolute', left: knobX * scale, top: 0, width: 4 * scale, height: H * scale,
            backgroundImage: `url(${texUrl})`, backgroundPosition: `0 ${-46 * scale}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: (knobX + 4) * scale, top: 0, width: 4 * scale, height: H * scale,
            backgroundImage: `url(${texUrl})`, backgroundPosition: `${-196 * scale}px ${-46 * scale}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated', pointerEvents: 'none' }} />
        </>
      )}
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <GuiText text={displayText} color={disabled ? '#A0A0A0' : '#E0E0E0'} shadow scale={scale} />
      </div>
    </div>
  );
}

// Dispatch — renders the right control for an option definition from optionDefinitions.js
export function JavaOption({ opt, store }) {
  const value = store.get(opt.key);
  const width = 150;

  if (opt.type === 'slider') {
    return (
      <JavaSlider
        label={opt.label} value={value}
        min={opt.min} max={opt.max} step={opt.step}
        format={opt.format}
        onChange={v => store.set(opt.key, v)}
        disabled={opt.disabled}
        width={width}
      />
    );
  }
  if (opt.type === 'toggle') {
    return (
      <JavaButton
        label={opt.label} value={!!value}
        options={[{ value: true, label: 'Ligado' }, { value: false, label: 'Desligado' }]}
        onChange={v => store.set(opt.key, v)}
        disabled={opt.disabled} disabledReason={opt.disabledReason}
        width={width}
      />
    );
  }
  return (
    <JavaButton
      label={opt.label} value={value}
      options={opt.options}
      onChange={v => store.set(opt.key, v)}
      disabled={opt.disabled} disabledReason={opt.disabledReason}
      width={width}
    />
  );
}