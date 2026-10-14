// Bancada de trabalho (container/crafting_table.png, 176×166): grade 3×3 em (30,17), resultado em (124,35).
import React, { useState } from "react";
import ContainerFrame, { PlayerSlots, playerRefs, Sprite } from "./ContainerFrame";
import { McText } from "./GuiSprite";
import { arrRef, shiftMove } from "@/game/slotOps";
import { matchRecipe, consumeIngredients, createResult } from "@/game/recipes";
import { useT } from "@/game/i18n";

export default function CraftingTableUI({ inv, onUpdate, onClose, onCraft }) {
  const t = useT();
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };

  if (!inv.crafting3) inv.crafting3 = new Array(9).fill(null);

  const updateCraftResult = () => {
    const recipe = matchRecipe(inv.crafting3, 3);
    inv.craftResult = recipe ? createResult(recipe) : null;
  };

  const { hotbar, main } = playerRefs(inv);
  const grid = inv.crafting3.map((_, i) => arrRef(inv.crafting3, i, { group: 'grid' }));
  const result = {
    group: 'result', output: true, repeatable: true,
    get: () => inv.craftResult, set: () => {},
    afterTake: () => { consumeIngredients(inv.crafting3); updateCraftResult(); onCraft?.(); },
  };
  const player = [...hotbar, ...main];
  const targets = (r) => (r.group === 'hotbar' ? main : r.group === 'main' ? hotbar : player);

  return (
    <ContainerFrame
      texture="textures/gui/container/crafting_table.png" w={176} h={166} inv={inv} onClose={onClose} onUpdate={refresh}
      onChange={updateCraftResult}
      getAllRefs={() => [...grid, ...main, ...hotbar]}
      onShift={(r) => shiftMove(inv, r, targets(r))}
    >
      {({ S, slot, tex }) => (
        <>
          <Sprite url={tex} u={0} v={0} w={176} h={166} S={S} />
          <McText text={t('container.crafting')} x={28} y={6} S={S} />
          {inv.crafting3.map((item, i) => slot('c' + i, 30 + (i % 3) * 18, 17 + Math.floor(i / 3) * 18, item, { ref: grid[i] }))}
          {slot('result', 124, 35, inv.craftResult, { ref: result })}
          <PlayerSlots refs={{ hotbar, main }} inv={inv} slot={slot} mainY={84} hotY={142} />
        </>
      )}
    </ContainerFrame>
  );
}
