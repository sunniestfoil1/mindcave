// Fornalha (container/furnace.png, 176×166): entrada (56,17), combustível (56,53), saída (116,35);
// chama em (56,36) com o recorte (176,0) e seta de progresso em (79,34) com o recorte (176,14).
import React, { useState } from "react";
import ContainerFrame, { PlayerSlots, playerRefs, Sprite } from "./ContainerFrame";
import { McText } from "./GuiSprite";
import { objRef, shiftMove, mergeInto } from "@/game/slotOps";
import { getSmeltingResult, isFuel } from "@/game/furnace";
import { useT } from "@/game/i18n";

export default function FurnaceUI({ furnace, inv, onUpdate, onClose }) {
  const t = useT();
  const [, forceUpdate] = useState(0);
  const refresh = () => { forceUpdate(n => n + 1); onUpdate?.(); };

  const flame = furnace.totalBurn > 0 ? Math.min(1, furnace.burnTime / furnace.totalBurn) : 0;
  const cook = Math.min(1, furnace.cookTime / 200);
  const k = Math.ceil(flame * 13); // altura visível da chama, em px de GUI

  const { hotbar, main } = playerRefs(inv);
  const input = objRef(furnace, 'input', { group: 'furnace' });
  const fuel = objRef(furnace, 'fuel', { group: 'furnace' });
  const output = objRef(furnace, 'output', { group: 'furnace', output: true });
  const player = [...hotbar, ...main];

  // Shift: do jogador vai para a entrada (se der para fundir) ou para o combustível; dos slots da fornalha vai para o jogador
  const onShift = (r) => {
    if (r.group === 'furnace') return shiftMove(inv, r, player);
    const item = r.get();
    if (!item) return false;
    if (getSmeltingResult(item.id)) { r.set(mergeInto([input], item)); if (!r.get()) return true; }
    const rest = r.get();
    if (rest && isFuel(rest.id)) { r.set(mergeInto([fuel], rest)); if (!r.get()) return true; }
    return shiftMove(inv, r, r.group === 'hotbar' ? main : hotbar);
  };

  return (
    <ContainerFrame
      texture="textures/gui/container/furnace.png" w={176} h={166} inv={inv} onClose={onClose} onUpdate={refresh}
      getAllRefs={() => [input, fuel, ...main, ...hotbar]}
      onShift={onShift}
    >
      {({ S, slot, tex }) => (
        <>
          <Sprite url={tex} u={0} v={0} w={176} h={166} S={S} />
          <McText text={t('container.furnace')} x={88} y={6} S={S} align="center" />
          {k > 0 && <Sprite url={tex} u={176} v={12 - k} w={14} h={k + 2} S={S} x={56} y={36 + 12 - k} />}
          {cook > 0 && <Sprite url={tex} u={176} v={14} w={Math.ceil(cook * 24)} h={17} S={S} x={79} y={34} />}
          {slot('in', 56, 17, furnace.input, { ref: input })}
          {slot('fuel', 56, 53, furnace.fuel, { ref: fuel })}
          {slot('out', 116, 35, furnace.output, { ref: output })}
          <PlayerSlots refs={{ hotbar, main }} inv={inv} slot={slot} mainY={84} hotY={142} />
        </>
      )}
    </ContainerFrame>
  );
}
