// Moldura comum dos containers (bancada, fornalha, baú): textura oficial na escala inteira da GUI, slots de 16×16 px de GUI
// sobre a malha da textura, item no cursor, tooltip e as teclas E/Esc. O conteúdo é desenhado pelo filho com { S, slot, tex }.
import React, { useState, useEffect } from 'react';
import ItemSlot from './ItemSlot';
import ItemTooltip from './ItemTooltip';
import { Sprite, usePackTexture, useGuiScaleValue } from './GuiSprite';

export default function ContainerFrame({ texture, w, h, inv, onClose, children }) {
  const S = useGuiScaleValue();
  const tex = usePackTexture(texture);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const onMove = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('keydown', onKey, true); };
  }, [onClose]);

  const slot = (key, x, y, item, props) => (
    <div key={key} style={{ position: 'absolute', left: x * S, top: y * S, width: 16 * S, height: 16 * S }}>
      <ItemSlot item={item} size={16 * S} transparent fill guiScale={S} onHover={(it) => setHovered(it)} {...props} />
    </div>
  );

  const left = Math.floor((window.innerWidth - w * S) / 2);
  const top = Math.floor((window.innerHeight - h * S) / 2);

  return (
    <div
      className="fixed inset-0 z-50 select-none pointer-events-auto"
      style={{ background: 'rgba(0,0,0,0.6)', imageRendering: 'pixelated' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: 'absolute', left, top, width: w * S, height: h * S }}>
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
        onClick: () => click(inv.main, i), onRightClick: () => rightClick(inv.main, i), onShiftClick: () => shift('main', i),
      }))}
      {inv.hotbar.map((item, i) => slot('h' + i, 8 + i * 18, hotY, item, {
        onClick: () => click(inv.hotbar, i), onRightClick: () => rightClick(inv.hotbar, i), onShiftClick: () => shift('hotbar', i),
      }))}
    </>
  );
}

export { Sprite };
