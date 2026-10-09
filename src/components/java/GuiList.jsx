import React, { useState, useRef, useEffect } from 'react';
import { useGui } from './GuiContext';

// Scrollable list with selection — PRD 19 RF-010 (Java 1.8.9 style)
export default function GuiList({ x, y, width = 220, height, items, selectedIndex, onSelect, onDoubleClick, renderItem, rowHeight = 36 }) {
  const gui = useGui();
  const scale = gui?.scale || 1;
  const guiWidth = gui?.guiWidth || 0;
  const [scroll, setScroll] = useState(0);
  const containerRef = useRef(null);

  const left = (guiWidth / 2 + x) * scale;
  const top = y * scale;
  const w = width * scale;
  const h = height * scale;
  const rh = rowHeight * scale;

  const visibleRows = Math.floor(h / rh);
  const maxScroll = Math.max(0, items.length - visibleRows);

  useEffect(() => {
    if (selectedIndex !== undefined && selectedIndex !== null && selectedIndex >= 0) {
      if (selectedIndex < scroll) setScroll(selectedIndex);
      else if (selectedIndex >= scroll + visibleRows) setScroll(selectedIndex - visibleRows + 1);
    }
  }, [selectedIndex, visibleRows]);

  const onWheel = (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    setScroll(s => Math.max(0, Math.min(maxScroll, s + dir)));
  };

  const thumbH = Math.max(20, (visibleRows / Math.max(1, items.length)) * h);
  const thumbY = maxScroll > 0 ? (scroll / maxScroll) * (h - thumbH) : 0;

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      style={{
        position: 'absolute', left, top, width: w, height: h,
        background: '#141414',
        border: `${Math.max(1, scale)}px solid #282828`,
        boxShadow: `inset 0 ${4 * scale}px ${8 * scale}px rgba(0,0,0,0.8), inset 0 ${-4 * scale}px ${8 * scale}px rgba(0,0,0,0.8)`,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Items List */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: `${6 * scale}px`, height: '100%', overflow: 'hidden' }}>
        {items.map((item, realIndex) => {
          const isSelected = realIndex === selectedIndex;
          const itemTop = (realIndex - scroll) * rh;
          if (itemTop + rh < -10 || itemTop > h + 10) return null;

          return (
            <div
              key={item.id || realIndex}
              onMouseDown={(e) => {
                e.stopPropagation();
                onSelect?.(realIndex);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(realIndex);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onDoubleClick?.(realIndex);
              }}
              style={{
                position: 'absolute',
                top: `${itemTop + 2 * scale}px`,
                left: `${2 * scale}px`,
                width: `${(width - 14) * scale}px`,
                height: `${rh - 2 * scale}px`,
                cursor: 'pointer',
                border: isSelected ? `${Math.max(1.5, 2 * scale)}px solid #A0A0A0` : '1px solid transparent',
                background: isSelected ? '#000000' : 'rgba(0, 0, 0, 0.35)',
                boxSizing: 'border-box',
                zIndex: isSelected ? 10 : 1,
              }}
            >
              {renderItem?.(item, realIndex, isSelected, scale)}
            </div>
          );
        })}
      </div>

      {/* Top/bottom darker gradient overlays - pointerEvents: none */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: `${6 * scale}px`, height: `${16 * scale}px`, background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)', pointerEvents: 'none', zIndex: 15 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: `${6 * scale}px`, height: `${16 * scale}px`, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', pointerEvents: 'none', zIndex: 15 }} />

      {/* Scrollbar */}
      {maxScroll > 0 && (
        <div style={{
          position: 'absolute', right: 0, top: 0,
          width: `${6 * scale}px`, height: '100%',
          background: '#000000',
          zIndex: 20,
        }}>
          <div style={{
            position: 'absolute', right: 0, top: thumbY,
            width: `${6 * scale}px`, height: thumbH,
            background: '#808080',
            boxShadow: `inset 0 0 0 ${scale}px #C0C0C0`,
          }} />
        </div>
      )}
    </div>
  );
}