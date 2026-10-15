import React, { useState } from "react";
import ContainerFrame, { PlayerSlots, playerRefs, Sprite } from "./ContainerFrame";
import PlayerPreview from "./PlayerPreview";
import { McText } from "./GuiSprite";
import { arrRef, shiftMove } from "@/game/slotOps";
import { matchRecipe, consumeIngredients, createResult } from "@/game/recipes";
import { EFFECT_INFO } from "@/game/effects";
import { useT } from "@/game/i18n";

const ARMOR_GHOST = [
  'textures/items/empty_armor_slot_helmet.png',
  'textures/items/empty_armor_slot_chestplate.png',
  'textures/items/empty_armor_slot_leggings.png',
  'textures/items/empty_armor_slot_boots.png',
];

// Coordenadas (col, row) na grade 18x18 de ícones de efeitos em inventory.png (início em u=0, v=198)
const EFFECT_ICON_UV = {
  speed: [0, 0],
  slowness: [1, 0],
  haste: [2, 0],
  mining_fatigue: [3, 0],
  strength: [4, 0],
  weakness: [5, 0],
  poison: [6, 0],
  regeneration: [7, 0],
  invisibility: [0, 1],
  hunger: [1, 1],
  jump_boost: [2, 1],
  nausea: [3, 1],
  night_vision: [4, 1],
  blindness: [5, 1],
  resistance: [6, 1],
  fire_resistance: [7, 1],
  water_breathing: [0, 2],
  wither: [1, 2],
  absorption: [2, 2],
};

function formatEffectDuration(ticks) {
  const totalSec = Math.max(0, Math.ceil((ticks || 0) / 20));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function InventoryUI({ inv, onUpdate, onClose, hud, onCraft }) {
  const t = useT();
  const [, forceUpdate] = useState(0);
  const refresh = () => {
    forceUpdate((n) => n + 1);
    onUpdate?.();
  };

  const updateCraftResult = () => {
    const recipe = matchRecipe(inv.crafting, 2);
    inv.craftResult = recipe ? createResult(recipe) : null;
  };

  const { hotbar, main } = playerRefs(inv);
  const armor = inv.armor.map((_, i) => arrRef(inv.armor, i, { group: 'armor', armorSlot: i, ghost: ARMOR_GHOST[i] }));
  const grid = inv.crafting.map((_, i) => arrRef(inv.crafting, i, { group: 'grid' }));
  const result = {
    group: 'result',
    output: true,
    repeatable: true,
    get: () => inv.craftResult,
    set: () => {},
    afterTake: () => {
      consumeIngredients(inv.crafting);
      updateCraftResult();
      onCraft?.();
    },
  };

  const player = [...hotbar, ...main];
  const targets = (r) => (r.group === 'hotbar' ? main : r.group === 'main' ? hotbar : player);

  return (
    <ContainerFrame
      texture="textures/gui/container/inventory.png"
      w={176}
      h={166}
      inv={inv}
      onClose={onClose}
      onUpdate={refresh}
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

          {/* Efeitos de poção à esquerda do inventário com ícones reais da 1.8.9 */}
          {hud?.effects?.map((e, i) => {
            const info = EFFECT_INFO[e.type];
            if (!info) return null;
            const uv = EFFECT_ICON_UV[e.type];
            const amp = e.amplifier > 0 ? ` ${['II', 'III', 'IV', 'V'][e.amplifier - 1] || ''}` : '';
            return (
              <div key={'e' + i}>
                <Sprite url={tex} u={0} v={166} w={120} h={32} S={S} x={-124} y={i * 33} />
                {uv ? (
                  <Sprite url={tex} u={uv[0] * 18} v={198 + uv[1] * 18} w={18} h={18} S={S} x={-124 + 6} y={i * 33 + 7} />
                ) : (
                  <div
                    style={{
                      position: 'absolute',
                      left: (-124 + 6) * S,
                      top: (i * 33 + 7) * S,
                      width: 18 * S,
                      height: 18 * S,
                      background: info.color,
                    }}
                  />
                )}
                <McText text={`${info.name}${amp}`} x={-124 + 28} y={i * 33 + 6} S={S} color="#FFFFFF" shadow />
                <McText text={formatEffectDuration(e.duration)} x={-124 + 28} y={i * 33 + 16} S={S} color="#7F7F7F" shadow />
              </div>
            );
          })}
        </>
      )}
    </ContainerFrame>
  );
}
