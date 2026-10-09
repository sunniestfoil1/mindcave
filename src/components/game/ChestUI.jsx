import React, { useState, useEffect } from "react";
import ItemSlot from "./ItemSlot";
import { leftClick, rightClick, shiftClick } from "@/game/inventory";
import { itemColor } from "@/game/items";
import { getPackUrl, MC } from "@/game/pack";

export default function ChestUI({ title, container, inv, onUpdate, onClose }) {
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [bgUrl, setBgUrl] = useState(null);

  useEffect(() => {
    getPackUrl(MC + 'textures/gui/container/generic_54.png').then(url => {
      if (url) setBgUrl(url);
    });
  }, []);

  useEffect(() => {
    const h = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', h);
    const kh = (e) => { if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', kh);
    return () => { window.removeEventListener('mousemove', h); window.removeEventListener('keydown', kh); };
  }, [onClose]);

  const slotClick = (arr, i, isLeft) => {
    const getSlot = () => arr[i];
    const setSlot = (val) => { arr[i] = val; };
    if (isLeft) leftClick(inv, getSlot, setSlot);
    else rightClick(inv, getSlot, setSlot);
    refresh();
  };

  const chestClick = (i, isLeft) => {
    const getSlot = () => container.slots[i];
    const setSlot = (val) => { container.slots[i] = val; };
    if (isLeft) leftClick(inv, getSlot, setSlot);
    else rightClick(inv, getSlot, setSlot);
    refresh();
  };

  const handleShift = (section, index) => {
    shiftClick(inv, section, index);
    refresh();
  };

  const sz = 38;
  const cols = container.slots.length > 27 ? 9 : 9;
  const rows = Math.ceil(container.slots.length / cols);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-stone-800 border-2 border-stone-900 rounded-lg p-4 shadow-2xl" style={{ fontFamily: "monospace", backgroundImage: bgUrl ? `url(${bgUrl})` : undefined, backgroundSize: "cover", imageRendering: "pixelated" }}>
        <div className="text-white/80 text-sm mb-2 text-center">{title || 'Baú'}</div>
        {/* Slots do baú */}
        <div className={"grid gap-1 mb-2"} style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}>
          {container.slots.map((item, i) => (
            <ItemSlot key={i} item={item} size={sz}
              onClick={() => chestClick(i, true)}
              onRightClick={() => chestClick(i, false)}
            />
          ))}
        </div>
        {/* Inventário principal */}
        <div className="grid grid-cols-9 gap-1 mb-2 pt-2 border-t border-stone-700">
          {inv.main.map((item, i) => (
            <ItemSlot key={i} item={item} size={sz}
              onClick={() => slotClick(inv.main, i, true)}
              onRightClick={() => slotClick(inv.main, i, false)}
              onShiftClick={() => handleShift('main', i)}
            />
          ))}
        </div>
        {/* Hotbar */}
        <div className="grid grid-cols-9 gap-1 pt-2 border-t border-stone-700">
          {inv.hotbar.map((item, i) => (
            <ItemSlot key={i} item={item} size={sz}
              onClick={() => slotClick(inv.hotbar, i, true)}
              onRightClick={() => slotClick(inv.hotbar, i, false)}
              onShiftClick={() => handleShift('hotbar', i)}
            />
          ))}
        </div>
      </div>
      {inv.cursor && (
        <div className="fixed pointer-events-none z-50" style={{ left: mouse.x - 16, top: mouse.y - 16 }}>
          <div className="w-8 h-8 rounded-sm border border-black/40" style={{ background: itemColor(inv.cursor.id) }}>
            {inv.cursor.count > 1 && <span className="absolute bottom-0 right-0.5 text-xs text-white font-bold" style={{ textShadow: "1px 1px 1px black" }}>{inv.cursor.count}</span>}
          </div>
        </div>
      )}
    </div>
  );
}