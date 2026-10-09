import React, { useState, useEffect, useRef } from "react";
import ItemSlot from "./ItemSlot";
import { leftClick, rightClick, shiftClick } from "@/game/inventory";
import { matchRecipe, consumeIngredients, createResult } from "@/game/recipes";
import { itemColor } from "@/game/items";
import { EFFECT_INFO } from "@/game/effects";
import { getPackUrl, MC } from "@/game/pack";

export default function InventoryUI({ inv, onUpdate, onClose, hud }) {
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Atualiza resultado do crafting 2x2
  const updateCraftResult = () => {
    const recipe = matchRecipe(inv.crafting, 2);
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
    const recipe = matchRecipe(inv.crafting, 2);
    if (!recipe) return;
    if (!inv.cursor) {
      inv.cursor = createResult(recipe);
      consumeIngredients(inv.crafting);
    } else if (inv.cursor.id === recipe.result.id && inv.cursor.count < 64) {
      inv.cursor.count += recipe.result.count;
      consumeIngredients(inv.crafting);
    }
    updateCraftResult();
    refresh();
  };

  const [containerBg, setContainerBg] = useState(null);

  useEffect(() => {
    getPackUrl(MC + 'textures/gui/container/inventory.png').then(url => {
      if (url) setContainerBg(url);
    });
  }, []);

  const slotSize = 40;
  const gap = 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 select-none pointer-events-auto" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={ref}
        className="relative bg-[#C6C6C6] border-2 border-t-white border-l-white border-r-[#555555] border-b-[#555555] p-3 shadow-2xl"
        style={{
          fontFamily: "monospace",
          imageRendering: "pixelated",
        }}
      >
        {/* Título */}
        <div className="text-[#404040] text-sm font-bold mb-2 text-left pl-1">Inventário</div>

        {/* Linha superior: armadura + crafting */}
        <div className="flex justify-between items-center mb-3 gap-6">
          {/* Armadura */}
          <div className="flex flex-col gap-1">
            {inv.armor.map((item, i) => (
              <ItemSlot key={i} item={item} size={slotSize}
                onClick={() => slotClick(inv.armor, i, true)}
                onRightClick={() => slotClick(inv.armor, i, false)}
                onShiftClick={() => handleShift('armor', i)}
              />
            ))}
          </div>

          {/* Crafting 2x2 + resultado */}
          <div className="flex items-center gap-3 bg-[#B0B0B0] p-2 rounded-sm border border-[#8B8B8B]">
            <div className="text-xs font-bold text-[#404040] mr-1">Criação</div>
            <div className="grid grid-cols-2 gap-1">
              {inv.crafting.map((item, i) => (
                <ItemSlot key={i} item={item} size={slotSize}
                  onClick={() => slotClick(inv.crafting, i, true)}
                  onRightClick={() => slotClick(inv.crafting, i, false)}
                  onShiftClick={() => handleShift('crafting', i)}
                />
              ))}
            </div>
            <div className="text-[#404040] font-bold text-xl px-1">➔</div>
            <ItemSlot item={inv.craftResult} size={slotSize} onClick={takeResult} highlight={!!inv.craftResult} />
          </div>
        </div>

        {/* Inventário principal 3x9 */}
        <div className="grid grid-cols-9 gap-1 mb-3" style={{ gap }}>
          {inv.main.map((item, i) => (
            <ItemSlot key={i} item={item} size={slotSize}
              onClick={() => slotClick(inv.main, i, true)}
              onRightClick={() => slotClick(inv.main, i, false)}
              onShiftClick={() => handleShift('main', i)}
            />
          ))}
        </div>

        {/* Hotbar 1x9 */}
        <div className="grid grid-cols-9 gap-1 pt-2 border-t-2 border-[#8B8B8B]" style={{ gap }}>
          {inv.hotbar.map((item, i) => (
            <ItemSlot key={i} item={item} size={slotSize}
              onClick={() => slotClick(inv.hotbar, i, true)}
              onRightClick={() => slotClick(inv.hotbar, i, false)}
              onShiftClick={() => handleShift('hotbar', i)}
            />
          ))}
        </div>

        {/* Efeitos ativos no lado esquerdo */}
        {hud?.effects && hud.effects.length > 0 && (
          <div className="absolute -left-36 top-0 flex flex-col gap-1.5 w-32">
            {hud.effects.map((e, i) => {
              const info = EFFECT_INFO[e.type];
              if (!info) return null;
              return (
                <div key={i} className="flex items-center gap-2 bg-[#C6C6C6] border-2 border-t-white border-l-white border-r-[#555555] border-b-[#555555] p-1.5 shadow-md">
                  <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ background: info.color }} />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-[#404040] leading-tight">{info.name}</span>
                    <span className="text-[10px] text-[#606060]">{Math.ceil(e.duration / 20)}s</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cursor item */}
      {inv.cursor && (
        <div className="fixed pointer-events-none z-50" style={{ left: mouse.x - 16, top: mouse.y - 16 }}>
          <div className="w-8 h-8 rounded-sm border border-black/40 flex items-center justify-center" style={{ background: itemColor(inv.cursor.id) }}>
            {inv.cursor.count > 1 && (
              <span className="absolute bottom-0 right-0.5 text-xs text-white font-bold" style={{ textShadow: "1px 1px 1px black" }}>
                {inv.cursor.count}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}