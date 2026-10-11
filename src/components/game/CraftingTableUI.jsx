import React, { useState, useEffect } from "react";
import ItemSlot from "./ItemSlot";
import { leftClick, rightClick, shiftClick } from "@/game/inventory";
import { matchRecipe, consumeIngredients, createResult } from "@/game/recipes";
import { itemColor } from "@/game/items";
import { getPackUrl, MC } from "@/game/pack";

export default function CraftingTableUI({ inv, onUpdate, onClose }) {
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [bgUrl, setBgUrl] = useState(null);

  useEffect(() => {
    getPackUrl(MC + 'textures/gui/container/crafting_table.png').then(url => {
      if (url) setBgUrl(url);
    });
  }, []);

  useEffect(() => {
    const h = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', h);
    const kh = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
      }
    };
    window.addEventListener('keydown', kh, true);
    return () => { window.removeEventListener('mousemove', h); window.removeEventListener('keydown', kh, true); };
  }, [onClose]);

  // Crafting 3x3
  if (!inv.crafting3) inv.crafting3 = new Array(9).fill(null);

  const updateCraftResult = () => {
    const recipe = matchRecipe(inv.crafting3, 3);
    inv.craftResult = recipe ? createResult(recipe) : null;
  };

  const slotClick = (arr, i, isLeft) => {
    const getSlot = () => arr[i];
    const setSlot = (val) => { arr[i] = val; };
    if (isLeft) leftClick(inv, getSlot, setSlot);
    else rightClick(inv, getSlot, setSlot);
    updateCraftResult();
    refresh();
  };

  const handleShift = (section, index) => {
    shiftClick(inv, section, index);
    updateCraftResult();
    refresh();
  };

  const takeResult = () => {
    if (!inv.craftResult) return;
    const recipe = matchRecipe(inv.crafting3, 3);
    if (!recipe) return;
    if (!inv.cursor) {
      inv.cursor = createResult(recipe);
      consumeIngredients(inv.crafting3);
    } else if (inv.cursor.id === recipe.result.id) {
      inv.cursor.count += recipe.result.count;
      consumeIngredients(inv.crafting3);
    }
    updateCraftResult();
    refresh();
  };

  const sz = 38;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-stone-800 border-2 border-stone-900 rounded-lg p-4 shadow-2xl" style={{ fontFamily: "monospace", backgroundImage: bgUrl ? `url(${bgUrl})` : undefined, backgroundSize: "cover", imageRendering: "pixelated" }}>
        <div className="text-white/80 text-sm mb-2 text-center">Bancada de Trabalho</div>
        <div className="flex items-center gap-3 mb-3 justify-center">
          <div className="grid grid-cols-3 gap-1">
            {inv.crafting3.map((item, i) => (
              <ItemSlot key={i} item={item} size={sz}
                onClick={() => slotClick(inv.crafting3, i, true)}
                onRightClick={() => slotClick(inv.crafting3, i, false)}
                onShiftClick={() => handleShift('crafting', i)}
              />
            ))}
          </div>
          <div className="text-white/40 text-xl">→</div>
          <ItemSlot item={inv.craftResult} size={sz} onClick={takeResult} highlight={!!inv.craftResult} />
        </div>
        <div className="grid grid-cols-9 gap-1 mb-2">
          {inv.main.map((item, i) => (
            <ItemSlot key={i} item={item} size={sz}
              onClick={() => slotClick(inv.main, i, true)}
              onRightClick={() => slotClick(inv.main, i, false)}
              onShiftClick={() => handleShift('main', i)}
            />
          ))}
        </div>
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