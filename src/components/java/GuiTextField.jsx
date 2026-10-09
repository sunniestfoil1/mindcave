import React, { useState, useRef, useEffect } from 'react';
import { useGui } from './GuiContext';

// Text field — PRD 19 RF-007
export default function GuiTextField({ x, y, width = 200, value, onChange, placeholder, maxLength, focused, autoFocus }) {
  const gui = useGui();
  const scale = gui?.scale || 1;
  const guiWidth = gui?.guiWidth || 0;
  const inputRef = useRef(null);
  const [internalFocused, setInternalFocused] = useState(autoFocus || false);
  const isFocused = focused !== undefined ? focused : internalFocused;
  const [cursorBlink, setCursorBlink] = useState(true);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    const interval = setInterval(() => setCursorBlink(c => !c), 500);
    return () => clearInterval(interval);
  }, []);

  const left = (guiWidth / 2 + x) * scale;
  const top = y * scale;
  const w = width * scale;
  const h = 20 * scale;

  return (
    <div style={{
      position: 'absolute', left, top, width: w, height: h,
      background: '#000000',
      border: `${scale}px solid #A0A0A0`,
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange?.(maxLength ? e.target.value.slice(0, maxLength) : e.target.value)}
        onFocus={() => setInternalFocused(true)}
        onBlur={() => setInternalFocused(false)}
        placeholder={placeholder}
        style={{
          width: '100%', height: '100%',
          background: 'transparent', border: 'none', outline: 'none',
          color: '#E0E0E0', caretColor: 'transparent',
          fontSize: `${8 * scale}px`,
          fontFamily: 'monospace',
          padding: `0 ${4 * scale}px`,
          imageRendering: 'pixelated',
        }}
      />
      {/* Cursor */}
      {isFocused && cursorBlink && (
        <div style={{
          position: 'absolute',
          left: `${4 * scale + (value.length * 5 * scale)}px`,
          top: `${4 * scale}px`,
          width: `${scale}px`,
          height: `${8 * scale}px`,
          background: '#D0D0D0',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}