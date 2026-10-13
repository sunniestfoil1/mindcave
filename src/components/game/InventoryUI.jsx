// Inventário de sobrevivência com a textura oficial (container/inventory.png, 176×166).
// Os slots são uma malha invisível sobre os quadrados da textura; as coordenadas são as do GuiInventory da 1.8.9.
import React, { useState, useEffect } from "react";
import ItemSlot from "./ItemSlot";
import ItemTooltip from "./ItemTooltip";
import PlayerPreview from "./PlayerPreview";
import { Sprite, McText, usePackTexture, useGuiScaleValue } from "./GuiSprite";
import { leftClick, rightClick, shiftClick } from "@/game/inventory";
import { matchRecipe, consumeIngredients, createResult } from "@/game/recipes";
import { EFFECT_INFO } from "@/game/effects";
import { playClickSound } from "@/game/sounds";

const WIN = { w: 176, h: 166 };

export default function InventoryUI({ inv, onUpdate, onClose, hud }) {
  const S = useGuiScaleValue();
  const tex = usePackTexture('textures/gui/container/inventory.png');
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    let rafId = 0;
    let lastX = 0, lastY = 0;
    const handler = (e) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          setMouse({ x: lastX, y: lastY });
          rafId = 0;
        });
      }
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handler);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E' || e.code === 'KeyE') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  // Atualiza resultado do crafting 2x2
  const updateCraftResult = () => {
    const recipe = matchRecipe(inv.crafting, 2);
    inv.craftResult = recipe ? createResult(recipe) : null;
  };

  const slotClick = (arr, i, isLeft) => {
    playClickSound();
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

  // Slot de 16×16 px de GUI no ponto (x, y) da janela (a textura desenha a moldura de 18×18 ao redor)
  const slot = (key, x, y, item, props) => (
    <div key={key} style={{ position: 'absolute', left: x * S, top: y * S, width: 16 * S, height: 16 * S }}>
      <ItemSlot item={item} size={16 * S} transparent fill guiScale={S} onHover={(it) => setHovered(it)} {...props} />
    </div>
  );

  const left = Math.floor((window.innerWidth - WIN.w * S) / 2);
  const top = Math.floor((window.innerHeight - WIN.h * S) / 2);

  return (
    <div className="fixed inset-0 z-50 select-none pointer-events-auto" style={{ background: 'rgba(0,0,0,0.6)', imageRendering: 'pixelated' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: 'absolute', left, top, width: WIN.w * S, height: WIN.h * S }}>
        <Sprite url={tex} u={0} v={0} w={WIN.w} h={WIN.h} S={S} />
        <PlayerPreview S={S} />
        <McText text="Criação" x={86} y={16} S={S} />

        {inv.armor.map((item, i) => slot('a' + i, 8, 8 + i * 18, item, {
          onClick: () => slotClick(inv.armor, i, true),
          onRightClick: () => slotClick(inv.armor, i, false),
          onShiftClick: () => handleShift('armor', i),
        }))}

        {inv.crafting.map((item, i) => slot('c' + i, 88 + (i % 2) * 18, 26 + Math.floor(i / 2) * 18, item, {
          onClick: () => slotClick(inv.crafting, i, true),
          onRightClick: () => slotClick(inv.crafting, i, false),
          onShiftClick: () => handleShift('crafting', i),
        }))}
        {slot('result', 144, 36, inv.craftResult, { onClick: takeResult, onRightClick: takeResult, onShiftClick: takeResult })}

        {inv.main.map((item, i) => slot('m' + i, 8 + (i % 9) * 18, 84 + Math.floor(i / 9) * 18, item, {
          onClick: () => slotClick(inv.main, i, true),
          onRightClick: () => slotClick(inv.main, i, false),
          onShiftClick: () => handleShift('main', i),
        }))}

        {inv.hotbar.map((item, i) => slot('h' + i, 8 + i * 18, 142, item, {
          onClick: () => slotClick(inv.hotbar, i, true),
          onRightClick: () => slotClick(inv.hotbar, i, false),
          onShiftClick: () => handleShift('hotbar', i),
        }))}

        {/* Efeitos ativos à esquerda da janela, com o fundo da textura (0,166 · 120×32) */}
        {hud?.effects?.map((e, i) => {
          const info = EFFECT_INFO[e.type];
          if (!info) return null;
          return (
            <div key={'e' + i}>
              <Sprite url={tex} u={0} v={166} w={120} h={32} S={S} x={-124} y={i * 33} />
              <div style={{ position: 'absolute', left: (-124 + 6) * S, top: (i * 33 + 7) * S, width: 18 * S, height: 18 * S, background: info.color }} />
              <McText text={info.name} x={-124 + 28} y={i * 33 + 6} S={S} color="#FFFFFF" shadow />
              <McText text={`${Math.ceil(e.duration / 20)}s`} x={-124 + 28} y={i * 33 + 16} S={S} color="#7F7F7F" shadow />
            </div>
          );
        })}
      </div>

      {hovered && !inv.cursor && <ItemTooltip item={hovered} mousePos={mouse} />}

      {/* Item no cursor */}
      {inv.cursor && (
        <div className="fixed pointer-events-none z-[120]" style={{ left: mouse.x - 8 * S, top: mouse.y - 8 * S, width: 16 * S, height: 16 * S }}>
          <ItemSlot item={inv.cursor} size={16 * S} transparent fill guiScale={S} />
        </div>
      )}
    </div>
  );
}
