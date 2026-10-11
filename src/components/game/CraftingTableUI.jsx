// Bancada de trabalho (container/crafting_table.png, 176×166): grade 3×3 em (30,17), resultado em (124,35).
import React, { useState } from "react";
import ContainerFrame, { PlayerSlots, Sprite } from "./ContainerFrame";
import { McText } from "./GuiSprite";
import { leftClick, rightClick, shiftClick } from "@/game/inventory";
import { matchRecipe, consumeIngredients, createResult } from "@/game/recipes";
import { playClickSound } from "@/game/sounds";

export default function CraftingTableUI({ inv, onUpdate, onClose }) {
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };

  // Crafting 3x3
  if (!inv.crafting3) inv.crafting3 = new Array(9).fill(null);

  const updateCraftResult = () => {
    const recipe = matchRecipe(inv.crafting3, 3);
    inv.craftResult = recipe ? createResult(recipe) : null;
  };

  const click = (arr, i, isLeft) => {
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

  return (
    <ContainerFrame texture="textures/gui/container/crafting_table.png" w={176} h={166} inv={inv} onClose={onClose}>
      {({ S, slot, tex }) => (
        <>
          <Sprite url={tex} u={0} v={0} w={176} h={166} S={S} />
          <McText text="Criação" x={28} y={6} S={S} />
          {inv.crafting3.map((item, i) => slot('c' + i, 30 + (i % 3) * 18, 17 + Math.floor(i / 3) * 18, item, {
            onClick: () => click(inv.crafting3, i, true),
            onRightClick: () => click(inv.crafting3, i, false),
            onShiftClick: () => handleShift('crafting', i),
          }))}
          {slot('result', 124, 35, inv.craftResult, { onClick: takeResult, onRightClick: takeResult, onShiftClick: takeResult })}
          <PlayerSlots inv={inv} slot={slot} mainY={84} hotY={142}
            click={(a, i) => click(a, i, true)} rightClick={(a, i) => click(a, i, false)} shift={handleShift} />
        </>
      )}
    </ContainerFrame>
  );
}
