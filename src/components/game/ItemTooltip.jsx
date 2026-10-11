import React from "react";
import { ITEMS } from "@/game/items";
import { BLOCKS, blockDisplayName } from "@/game/blocks";
import { GUNS } from "@/game/guns/registry";
import { FOODS } from "@/game/survival";

// Tooltip oficial Java 1.8.9 com cores e raridades
export default function ItemTooltip({ item, mousePos }) {
  if (!item || !item.id) return null;

  const isBlock = item.id < 256;
  const blockDef = isBlock ? BLOCKS[item.id] : null;
  const itemDef = !isBlock ? ITEMS[item.id] : null;

  const namePt = item.name || (blockDef && blockDisplayName(item.id, item.meta)) || blockDef?.namePt || itemDef?.namePt || `Item #${item.id}`;
  const nameEn = item.nameEn || blockDef?.name || itemDef?.name || '';
  const rarity = itemDef?.rarity || (item.id === 399 || item.id === 466 ? 'epic' : item.id === 322 || item.id === 384 ? 'rare' : 'common');

  let nameColor = '#FFFFFF';
  if (rarity === 'epic') nameColor = '#FF55FF';
  else if (rarity === 'rare') nameColor = '#55FFFF';
  else if (itemDef?.weapon || itemDef?.gun) nameColor = '#FFAA00';
  else if (itemDef?.tool?.material === 'diamond' || itemDef?.armor?.material === 'diamond') nameColor = '#55FFFF';
  else if (itemDef?.tool?.material === 'gold' || itemDef?.armor?.material === 'gold') nameColor = '#FFFF55';

  const foodData = FOODS[item.id];
  const gunKey = itemDef?.gun;
  const gunDef = gunKey && GUNS[gunKey] ? GUNS[gunKey] : null;

  let posX = mousePos.x + 14;
  let posY = mousePos.y - 12;

  if (typeof window !== 'undefined') {
    if (posX + 260 > window.innerWidth) posX = mousePos.x - 270;
    if (posY + 200 > window.innerHeight) posY = window.innerHeight - 210;
  }

  return (
    <div
      className="fixed z-[100] pointer-events-none px-3 py-2 text-xs font-minecraft select-none shadow-2xl"
      style={{
        left: posX,
        top: posY,
        backgroundColor: '#100010',
        border: '2px solid #280048',
        borderRadius: '3px',
        maxWidth: '300px',
        color: '#FFFFFF',
        textShadow: '1px 1px 0 #3f3f3f',
      }}
    >
      <div className="font-bold text-sm tracking-wide" style={{ color: nameColor }}>
        {namePt}
      </div>
      {nameEn && nameEn !== namePt && (
        <div className="text-stone-400 text-[11px] italic mb-1">{nameEn}</div>
      )}

      {itemDef?.weaponDamage && (
        <div className="text-[#55FF55] font-semibold mt-1">
          +{itemDef.weaponDamage} Dano de Ataque
        </div>
      )}

      {gunDef && (
        <div className="mt-1 pt-1 border-t border-purple-900/50 text-[11px]">
          <div className="text-[#FFAA00]">Arma: {gunDef.name} ({gunDef.type.toUpperCase()})</div>
          <div className="text-stone-300">Dano por Tiro: {gunDef.damage}</div>
          <div className="text-stone-300">Capacidade: {gunDef.magCapacity} disparos</div>
        </div>
      )}

      {foodData && (
        <div className="mt-1 pt-1 border-t border-purple-900/50 text-[11px]">
          <div className="text-[#FFAA00] font-semibold">+{foodData.hunger} Pontos de Fome</div>
          <div className="text-stone-300">Saturação: +{foodData.saturation.toFixed(1)}</div>
        </div>
      )}

      <div className="mt-1 pt-1 border-t border-purple-900/40 text-[10px] text-stone-500">
        #{item.id} ({isBlock ? 'Bloco' : 'Item'})
      </div>
    </div>
  );
}

