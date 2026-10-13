import React, { useState, useEffect, useRef } from 'react';
import ItemSlot from './ItemSlot';
import ItemTooltip from './ItemTooltip';
import { Sprite, usePackTexture, useGuiScaleValue } from './GuiSprite';
import { settingsStore } from '@/game/settingsStore';
import { playClickSound } from '@/game/sounds';

export default function ContainerFrame({ texture, w, h, inv, onClose, onUpdate, children }) {
  const S = useGuiScaleValue();
  const tex = usePackTexture(texture);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(null);
  const hoveredSlotRef = useRef(null);

  useEffect(() => {
    const onMove = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      const invKey = settingsStore.get('user.keys.inventory') || 'KeyE';
      if (e.key === 'Escape' || e.code === invKey || (invKey.startsWith('Key') && e.key.toLowerCase() === invKey.slice(3).toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
        return;
      }
      // Troca rápida de slots 1-9 com a hotbar
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && hoveredSlotRef.current) {
        const targetHotbarIdx = num - 1;
        const target = hoveredSlotRef.current;
        if (target && target.arr && target.index !== undefined && inv?.hotbar) {
          e.preventDefault();
          e.stopPropagation();
          const temp = target.arr[target.index];
          target.arr[target.index] = inv.hotbar[targetHotbarIdx];
          inv.hotbar[targetHotbarIdx] = temp;
          playClickSound();
          onUpdate?.();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('keydown', onKey, true); };
  }, [onClose, inv, onUpdate]);

  const slot = (key, x, y, item, props) => (
    <div
      key={key}
      style={{ position: 'absolute', left: x * S, top: y * S, width: 16 * S, height: 16 * S }}
      onMouseEnter={() => { if (props?.slotRef) hoveredSlotRef.current = props.slotRef; }}
      onMouseLeave={() => { if (hoveredSlotRef.current === props?.slotRef) hoveredSlotRef.current = null; }}
    >
      <ItemSlot item={item} size={16 * S} transparent fill guiScale={S} onHover={(it) => setHovered(it)} {...props} />
    </div>
  );

  const left = Math.max(0, Math.floor((window.innerWidth - w * S) / 2));
  const top = Math.max(0, Math.floor((window.innerHeight - h * S) / 2));

  return (
    <div
      className="fixed inset-0 z-50 select-none pointer-events-auto"
      style={{ background: 'rgba(0,0,0,0.6)', imageRendering: 'pixelated', userSelect: 'none' }}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{ position: 'absolute', left, top, width: w * S, height: h * S, userSelect: 'none' }}
      >
        {children({ S, slot, tex })}
      </div>
      {hovered && !inv.cursor && <ItemTooltip item={hovered} mousePos={mouse} />}
      {inv.cursor && (
        <div className="fixed pointer-events-none z-[120]" style={{ left: mouse.x - 8 * S, top: mouse.y - 8 * S, width: 16 * S, height: 16 * S }}>
          <ItemSlot item={inv.cursor} size={16 * S} transparent fill guiScale={S} />
        </div>
      )}
    </div>
  );
}

// Inventário do jogador (3×9 + hotbar) abaixo do container: mainY = y da primeira linha, hotY = y da hotbar
export function PlayerSlots({ inv, slot, mainY, hotY, click, rightClick, shift }) {
  return (
    <>
      {inv.main.map((item, i) => slot('m' + i, 8 + (i % 9) * 18, mainY + Math.floor(i / 9) * 18, item, {
        slotRef: { arr: inv.main, index: i },
        onClick: () => click(inv.main, i), onRightClick: () => rightClick(inv.main, i), onShiftClick: () => shift('main', i),
      }))}
      {inv.hotbar.map((item, i) => slot('h' + i, 8 + i * 18, hotY, item, {
        slotRef: { arr: inv.hotbar, index: i },
        onClick: () => click(inv.hotbar, i), onRightClick: () => rightClick(inv.hotbar, i), onShiftClick: () => shift('hotbar', i),
      }))}
    </>
  );
}


export { Sprite };
