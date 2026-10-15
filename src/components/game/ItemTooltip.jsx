import React, { useEffect, useState } from "react";
import { ITEMS } from "@/game/items";
import { BLOCKS, blockDisplayName } from "@/game/blocks";
import { GUNS } from "@/game/guns/registry";
import { useGuiScaleValue } from "./GuiSprite";

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const ENCH_NAMES = {
  sharpness: 'Afiação',
  smite: 'Julgamento',
  bane_of_arthropods: 'Ruína dos Artrópodes',
  knockback: 'Repulsão',
  fire_aspect: 'Aspecto Flamejante',
  looting: 'Pilhagem',
  efficiency: 'Eficiência',
  silk_touch: 'Toque Suave',
  unbreaking: 'Inquebrável',
  fortune: 'Fortuna',
  power: 'Força',
  punch: 'Impacto',
  flame: 'Chama',
  infinity: 'Infinidade',
  protection: 'Proteção',
  fire_protection: 'Proteção contra Fogo',
  feather_falling: 'Peso Pena',
  blast_protection: 'Proteção contra Explosões',
  projectile_protection: 'Proteção contra Projéteis',
  thorns: 'Espinhos',
};

let advancedTooltipsEnabled = false;
const advListeners = new Set();

if (typeof window !== 'undefined' && !window.__mcF3HBound) {
  window.__mcF3HBound = true;
  const f3Down = { current: false };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') f3Down.current = true;
    if (f3Down.current && e.code === 'KeyH') {
      e.preventDefault();
      advancedTooltipsEnabled = !advancedTooltipsEnabled;
      advListeners.forEach((fn) => fn(advancedTooltipsEnabled));
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'F3') f3Down.current = false;
  });
}

export default function ItemTooltip({ item, mousePos }) {
  const S = useGuiScaleValue();
  const [advanced, setAdvanced] = useState(advancedTooltipsEnabled);

  useEffect(() => {
    advListeners.add(setAdvanced);
    return () => advListeners.delete(setAdvanced);
  }, []);

  if (!item || !item.id) return null;

  const isBlock = item.id < 256;
  const blockDef = isBlock ? BLOCKS[item.id] : null;
  const itemDef = !isBlock ? ITEMS[item.id] : null;

  const namePt =
    item.customName ||
    item.name ||
    (blockDef && blockDisplayName(item.id, item.meta)) ||
    blockDef?.namePt ||
    itemDef?.namePt ||
    `Item #${item.id}`;
  const rawRegistryName = blockDef?.name || itemDef?.name || `item_${item.id}`;

  const hasEnch = Array.isArray(item.enchantments) && item.enchantments.length > 0;
  const rarity =
    itemDef?.rarity ||
    (item.id === 399 || item.id === 466 || (item.id === 322 && item.meta === 1)
      ? 'epic'
      : item.id === 322 || item.id === 384
      ? 'rare'
      : hasEnch
      ? 'aqua'
      : 'common');

  let nameColor = '#FFFFFF';
  if (rarity === 'epic') nameColor = '#FF55FF';
  else if (rarity === 'rare' || rarity === 'aqua') nameColor = '#55FFFF';
  else if (rarity === 'uncommon') nameColor = '#FFFF55';

  const idSuffix = advanced
    ? ` (#${String(item.id).padStart(4, '0')}${item.meta ? `/${item.meta}` : ''})`
    : '';

  const gunKey = itemDef?.gun;
  const gunDef = gunKey && GUNS[gunKey] ? GUNS[gunKey] : null;
  const maxDur = itemDef?.durability || gunDef?.durability || 0;
  const curDur = item.durability ?? item.data?.durability ?? maxDur;

  let posX = mousePos.x + 12;
  let posY = mousePos.y - 12;
  if (typeof window !== 'undefined') {
    if (posX + 240 > window.innerWidth) posX = mousePos.x - 248;
    if (posY + 140 > window.innerHeight) posY = window.innerHeight - 148;
  }

  const fontPx = Math.max(12, 8 * Math.min(2, S));

  return (
    <div
      className="fixed z-[100] pointer-events-none select-none"
      style={{
        left: posX,
        top: posY,
        backgroundColor: 'rgba(16, 0, 16, 0.94)',
        border: `${Math.max(2, S)}px solid #28005a`,
        outline: `${Math.max(1, Math.floor(S / 2))}px solid #100010`,
        padding: `${3 * S}px ${4 * S}px`,
        fontFamily: "'Minecraft', monospace",
        fontSize: `${fontPx}px`,
        lineHeight: `${fontPx + 3}px`,
        color: '#FFFFFF',
        textShadow: '1px 1px 0 #3f3f3f',
        imageRendering: 'pixelated',
      }}
    >
      {/* Nome do item (+ ID se F3+H estiver ativo) */}
      <div style={{ color: nameColor }}>
        {namePt}
        {idSuffix && <span style={{ color: '#FFFFFF' }}>{idSuffix}</span>}
      </div>

      {/* Encantamentos */}
      {hasEnch && (
        <div style={{ marginTop: 2 }}>
          {item.enchantments.map((e, idx) => {
            const label = ENCH_NAMES[e.id] || e.name || e.id;
            const lvl = ROMAN[e.level] || e.level || '';
            return (
              <div key={idx} style={{ color: '#AAAAAA' }}>
                {label} {lvl}
              </div>
            );
          })}
        </div>
      )}

      {/* Atributos de Combate / Armadura (1.8.9) */}
      {(itemDef?.weaponDamage || itemDef?.armor?.points) && (
        <div style={{ marginTop: 6 }}>
          {itemDef?.weaponDamage && (
            <div style={{ color: '#5555FF' }}>+{itemDef.weaponDamage} Dano de Ataque</div>
          )}
          {itemDef?.armor?.points && (
            <div style={{ color: '#5555FF' }}>+{itemDef.armor.points} Armadura</div>
          )}
        </div>
      )}

      {/* Atributos de Armas de Fogo Mind Cave */}
      {gunDef && (
        <div style={{ marginTop: 4 }}>
          <div style={{ color: '#5555FF' }}>+{gunDef.damage} Dano por Disparo</div>
          <div style={{ color: '#AAAAAA' }}>
            Munição: {item.data?.ammoInMag ?? 0}/{gunDef.magSize}
          </div>
        </div>
      )}

      {/* Informações extras do F3 + H (Tooltips Avançados da 1.8.9) */}
      {advanced && (
        <div style={{ marginTop: 4 }}>
          {maxDur > 0 && curDur < maxDur && (
            <div style={{ color: '#AAAAAA' }}>
              Durabilidade: {curDur} / {maxDur}
            </div>
          )}
          <div style={{ color: '#555555' }}>minecraft:{rawRegistryName}</div>
        </div>
      )}
    </div>
  );
}
