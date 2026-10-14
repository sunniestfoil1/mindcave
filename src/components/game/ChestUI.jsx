// Baú (container/generic_54.png, 176×222): a textura tem a parte de cima (linhas do baú) e a de baixo (inventário), recortadas
// conforme o número de linhas, como no GuiChest da 1.8.9.
import React, { useState } from "react";
import ContainerFrame, { PlayerSlots, playerRefs, Sprite } from "./ContainerFrame";
import { McText } from "./GuiSprite";
import { arrRef, shiftMove } from "@/game/slotOps";
import { useT } from "@/game/i18n";

export default function ChestUI({ title, container, inv, onUpdate, onClose }) {
  const t = useT();
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };

  const rows = Math.max(1, Math.min(6, Math.ceil(container.slots.length / 9)));
  const h = 114 + rows * 18;
  const topH = rows * 18 + 17;
  const off = (rows - 4) * 18; // deslocamento do inventário em relação à janela de 4 linhas

  const { hotbar, main } = playerRefs(inv);
  const chest = container.slots.map((_, i) => arrRef(container.slots, i, { group: 'container' }));
  const player = [...hotbar, ...main];
  const targets = (r) => (r.group === 'container' ? player : chest);

  return (
    <ContainerFrame
      texture="textures/gui/container/generic_54.png" w={176} h={h} inv={inv} onClose={onClose} onUpdate={refresh}
      getAllRefs={() => [...chest, ...main, ...hotbar]}
      onShift={(r) => shiftMove(inv, r, targets(r))}
    >
      {({ S, slot, tex }) => (
        <>
          <Sprite url={tex} u={0} v={0} w={176} h={topH} S={S} />
          <Sprite url={tex} u={0} v={126} w={176} h={96} S={S} y={topH} />
          <McText text={title || t(rows > 3 ? 'container.chestDouble' : 'container.chest')} x={8} y={6} S={S} />
          <McText text={t('container.inventory')} x={8} y={h - 94} S={S} />
          {container.slots.map((item, i) => slot('c' + i, 8 + (i % 9) * 18, 18 + Math.floor(i / 9) * 18, item, { ref: chest[i] }))}
          <PlayerSlots refs={{ hotbar, main }} inv={inv} slot={slot} mainY={103 + off} hotY={161 + off} />
        </>
      )}
    </ContainerFrame>
  );
}
