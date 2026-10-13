// Fornalha (container/furnace.png, 176×166): entrada (56,17), combustível (56,53), saída (116,35);
// chama em (56,36) com o recorte (176,0) e seta de progresso em (79,34) com o recorte (176,14).
import React, { useState } from "react";
import ContainerFrame, { PlayerSlots, Sprite } from "./ContainerFrame";
import { McText } from "./GuiSprite";
import { leftClick, rightClick, shiftClick } from "@/game/inventory";
import { playClickSound } from "@/game/sounds";

export default function FurnaceUI({ furnace, inv, onUpdate, onClose }) {
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };

  const click = (arr, i, isLeft) => {
    playClickSound();
    const getSlot = () => arr[i];
    const setSlot = (val) => { arr[i] = val; };
    if (isLeft) leftClick(inv, getSlot, setSlot);
    else rightClick(inv, getSlot, setSlot);
    refresh();
  };

  const furnaceClick = (name, isLeft) => {
    playClickSound();
    const getSlot = () => furnace[name];
    const setSlot = (val) => { furnace[name] = val; };
    if (isLeft) leftClick(inv, getSlot, setSlot);
    else rightClick(inv, getSlot, setSlot);
    refresh();
  };

  const flame = furnace.totalBurn > 0 ? Math.min(1, furnace.burnTime / furnace.totalBurn) : 0;
  const cook = Math.min(1, furnace.cookTime / 200);
  const k = Math.ceil(flame * 13); // altura visível da chama, em px de GUI

  return (
    <ContainerFrame texture="textures/gui/container/furnace.png" w={176} h={166} inv={inv} onClose={onClose} onUpdate={refresh}>
      {({ S, slot, tex }) => (
        <>
          <Sprite url={tex} u={0} v={0} w={176} h={166} S={S} />
          <McText text="Fornalha" x={88} y={6} S={S} align="center" />
          {k > 0 && <Sprite url={tex} u={176} v={12 - k} w={14} h={k + 2} S={S} x={56} y={36 + 12 - k} />}
          {cook > 0 && <Sprite url={tex} u={176} v={14} w={Math.ceil(cook * 24)} h={17} S={S} x={79} y={34} />}
          {slot('in', 56, 17, furnace.input, { slotRef: { arr: furnace, index: 'input' }, onClick: () => furnaceClick('input', true), onRightClick: () => furnaceClick('input', false) })}
          {slot('fuel', 56, 53, furnace.fuel, { slotRef: { arr: furnace, index: 'fuel' }, onClick: () => furnaceClick('fuel', true), onRightClick: () => furnaceClick('fuel', false) })}
          {slot('out', 116, 35, furnace.output, { onClick: () => furnaceClick('output', true), onRightClick: () => furnaceClick('output', false) })}

          <PlayerSlots inv={inv} slot={slot} mainY={84} hotY={142}
            click={(a, i) => click(a, i, true)} rightClick={(a, i) => click(a, i, false)}
            shift={(section, index) => { shiftClick(inv, section, index); refresh(); }} />
        </>
      )}
    </ContainerFrame>
  );
}
