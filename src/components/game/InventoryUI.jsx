// Inventário de sobrevivência (container/inventory.png, 176×166). Toda a interação de slots vem do ContainerFrame + slotOps.
import React, { useState } from "react";
import ContainerFrame, { PlayerSlots, playerRefs, Sprite } from "./ContainerFrame";
import PlayerPreview from "./PlayerPreview";
import { McText } from "./GuiSprite";
import { arrRef, shiftMove } from "@/game/slotOps";
import { matchRecipe, consumeIngredients, createResult } from "@/game/recipes";
import { EFFECT_INFO } from "@/game/effects";
import { useT } from "@/game/i18n";

// Ícones dos slots de armadura vazios (os mesmos do 1.8.9: textures/items/empty_armor_slot_*.png)
const ARMOR_GHOST = [
  'textures/items/empty_armor_slot_helmet.png', 'textures/items/empty_armor_slot_chestplate.png',
  'textures/items/empty_armor_slot_leggings.png', 'textures/items/empty_armor_slot_boots.png',
];

export default function InventoryUI({ inv, onUpdate, onClose, hud, onCraft }) {
  const t = useT();
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };

  const updateCraftResult = () => {
    const recipe = matchRecipe(inv.crafting, 2);
    inv.craftResult = recipe ? createResult(recipe) : null;
  };

  const { hotbar, main } = playerRefs(inv);
  const armor = inv.armor.map((_, i) => arrRef(inv.armor, i, { group: 'armor', armorSlot: i, ghost: ARMOR_GHOST[i] }));
  const grid = inv.crafting.map((_, i) => arrRef(inv.crafting, i, { group: 'grid' }));
  const result = {
    group: 'result', output: true, repeatable: true,
    get: () => inv.craftResult, set: () => {},
    afterTake: () => { consumeIngredients(inv.crafting); updateCraftResult(); onCraft?.(); },
  };
  const player = [...hotbar, ...main];
  const targets = (r) => (r.group === 'hotbar' ? main : r.group === 'main' ? hotbar : player);

  return (
    <ContainerFrame
      texture="textures/gui/container/inventory.png" w={176} h={166} inv={inv} onClose={onClose} onUpdate={refresh}
      onChange={updateCraftResult}
      getAllRefs={() => [...armor, ...grid, ...main, ...hotbar]}
      onShift={(r) => shiftMove(inv, r, targets(r), (slot) => armor[slot])}
    >
      {({ S, slot, tex }) => (
        <>
          <Sprite url={tex} u={0} v={0} w={176} h={166} S={S} />
          <PlayerPreview S={S} />
          <McText text={t('container.crafting')} x={86} y={16} S={S} />

          {inv.armor.map((item, i) => slot('a' + i, 8, 8 + i * 18, item, { ref: armor[i] }))}
          {inv.crafting.map((item, i) => slot('c' + i, 88 + (i % 2) * 18, 26 + Math.floor(i / 2) * 18, item, { ref: grid[i] }))}
          {slot('result', 144, 36, inv.craftResult, { ref: result })}
          <PlayerSlots refs={{ hotbar, main }} inv={inv} slot={slot} mainY={84} hotY={142} />

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
        </>
      )}
    </ContainerFrame>
  );
}
