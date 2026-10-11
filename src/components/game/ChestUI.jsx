// Baú (container/generic_54.png, 176×222): a textura tem a parte de cima (linhas do baú) e a de baixo (inventário), recortadas
// conforme o número de linhas, como no GuiChest da 1.8.9.
import React, { useState } from "react";
import ContainerFrame, { PlayerSlots, Sprite } from "./ContainerFrame";
import { McText } from "./GuiSprite";
import { leftClick, rightClick, shiftClick } from "@/game/inventory";
import { playClickSound } from "@/game/sounds";

export default function ChestUI({ title, container, inv, onUpdate, onClose }) {
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

  const rows = Math.max(1, Math.min(6, Math.ceil(container.slots.length / 9)));
  const h = 114 + rows * 18;
  const topH = rows * 18 + 17;
  const off = (rows - 4) * 18; // deslocamento do inventário em relação à janela de 4 linhas

  return (
    <ContainerFrame texture="textures/gui/container/generic_54.png" w={176} h={h} inv={inv} onClose={onClose}>
      {({ S, slot, tex }) => (
        <>
          <Sprite url={tex} u={0} v={0} w={176} h={topH} S={S} />
          <Sprite url={tex} u={0} v={126} w={176} h={96} S={S} y={topH} />
          <McText text={title || 'Baú'} x={8} y={6} S={S} />
          <McText text="Inventário" x={8} y={h - 94} S={S} />
          {container.slots.map((item, i) => slot('c' + i, 8 + (i % 9) * 18, 18 + Math.floor(i / 9) * 18, item, {
            onClick: () => click(container.slots, i, true),
            onRightClick: () => click(container.slots, i, false),
          }))}
          <PlayerSlots inv={inv} slot={slot} mainY={103 + off} hotY={161 + off}
            click={(a, i) => click(a, i, true)} rightClick={(a, i) => click(a, i, false)}
            shift={(section, index) => { shiftClick(inv, section, index); refresh(); }} />
        </>
      )}
    </ContainerFrame>
  );
}
