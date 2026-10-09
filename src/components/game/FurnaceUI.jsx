import React, { useState, useEffect } from "react";
import ItemSlot from "./ItemSlot";
import { leftClick, rightClick, shiftClick } from "@/game/inventory";
import { tickFurnace, isFuel, getSmeltingResult } from "@/game/furnace";
import { itemColor } from "@/game/items";
import { getPackUrl, MC } from "@/game/pack";

export default function FurnaceUI({ furnace, inv, onUpdate, onClose }) {
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [bgUrl, setBgUrl] = useState(null);

  useEffect(() => {
    getPackUrl(MC + 'textures/gui/container/furnace.png').then(url => {
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

  const furnaceSlotClick = (slot, isLeft) => {
    const getSlot = () => furnace[slot];
    const setSlot = (val) => { furnace[slot] = val; };
    if (isLeft) leftClick(inv, getSlot, setSlot);
    else rightClick(inv, getSlot, setSlot);
    refresh();
  };

  const sz = 38;
  const flameRatio = furnace.totalBurn > 0 ? furnace.burnTime / furnace.totalBurn : 0;
  const cookRatio = furnace.cookTime / 200;
  const canSmelt = furnace.input && getSmeltingResult(furnace.input?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-stone-800 border-2 border-stone-900 rounded-lg p-4 shadow-2xl" style={{ fontFamily: "monospace", backgroundImage: bgUrl ? `url(${bgUrl})` : undefined, backgroundSize: "cover", imageRendering: "pixelated" }}>
        <div className="text-white/80 text-sm mb-2 text-center">Fornalha</div>
        <div className="flex items-center gap-4 mb-3 justify-center">
          {/* Slots da fornalha */}
          <div className="flex flex-col items-center gap-2">
            {/* Entrada */}
            <ItemSlot item={furnace.input} size={sz}
              onClick={() => furnaceSlotClick('input', true)}
              onRightClick={() => furnaceSlotClick('input', false)}
            />
            {/* Combustível */}
            <ItemSlot item={furnace.fuel} size={sz}
              onClick={() => furnaceSlotClick('fuel', true)}
              onRightClick={() => furnaceSlotClick('fuel', false)}
            />
          </div>
          {/* Chama + progresso */}
          <div className="flex flex-col items-center gap-2">
            {/* Chama */}
            <div className="w-6 h-12 bg-black/40 rounded-sm overflow-hidden flex items-end">
              <div className="w-full bg-orange-500 transition-all" style={{ height: `${flameRatio * 100}%` }} />
            </div>
            {/* Seta de progresso */}
            <div className="w-12 h-4 bg-black/40 rounded-sm overflow-hidden">
              <div className="h-full bg-white/60 transition-all" style={{ width: `${cookRatio * 100}%` }} />
            </div>
          </div>
          {/* Saída */}
          <ItemSlot item={furnace.output} size={sz}
            onClick={() => furnaceSlotClick('output', true)}
            onRightClick={() => furnaceSlotClick('output', false)}
          />
        </div>
        <div className="grid grid-cols-9 gap-1 mb-2">
          {inv.main.map((item, i) => (
            <ItemSlot key={i} item={item} size={sz}
              onClick={() => slotClick(inv.main, i, true)}
              onRightClick={() => slotClick(inv.main, i, false)}
              onShiftClick={() => { shiftClick(inv, 'main', i); refresh(); }}
            />
          ))}
        </div>
        <div className="grid grid-cols-9 gap-1 pt-2 border-t border-stone-700">
          {inv.hotbar.map((item, i) => (
            <ItemSlot key={i} item={item} size={sz}
              onClick={() => slotClick(inv.hotbar, i, true)}
              onRightClick={() => slotClick(inv.hotbar, i, false)}
              onShiftClick={() => { shiftClick(inv, 'hotbar', i); refresh(); }}
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