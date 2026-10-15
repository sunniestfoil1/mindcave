import React, { useEffect, useState, useRef } from 'react';
import ItemSlot from './ItemSlot';
import { Sprite, McText, usePackTexture, useGuiScaleValue } from './GuiSprite';
import { ITEMS } from '@/game/items';
import { BLOCKS, blockDisplayName } from '@/game/blocks';

const BAR_H = 49;

function useViewportWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

function getHeldItemName(item) {
  if (!item || !item.id || item.id <= 0) return '';
  if (item.customName || item.name) return item.customName || item.name;
  if (item.id < 256) {
    const b = BLOCKS[item.id];
    return (b && blockDisplayName(item.id, item.meta)) || b?.namePt || b?.name || '';
  }
  const it = ITEMS[item.id];
  return it?.namePt || it?.name || '';
}

function XpLevel({ level, x, y, S }) {
  const t = String(level);
  return (
    <>
      {[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy], i) => (
        <McText key={i} text={t} x={x + dx} y={y + dy} S={S} color="#000000" align="center" />
      ))}
      <McText text={t} x={x} y={y} S={S} color="#80FF20" align="center" />
    </>
  );
}

export default function HudBars({ hud }) {
  const S = useGuiScaleValue();
  const vw = useViewportWidth();
  const widgets = usePackTexture('textures/gui/widgets.png');
  const icons = usePackTexture('textures/gui/icons.png');

  const [heldLabel, setHeldLabel] = useState('');
  const [heldAlpha, setHeldAlpha] = useState(0);
  const lastKeyRef = useRef('');

  const slots = hud?.hotbar || [];
  const selectedSlot = hud?.selectedSlot ?? 0;
  const currentItem = slots[selectedSlot];
  const currentKey = `${selectedSlot}:${currentItem?.id || 0}:${currentItem?.meta || 0}`;

  useEffect(() => {
    if (currentKey === lastKeyRef.current) return undefined;
    lastKeyRef.current = currentKey;
    const label = getHeldItemName(currentItem);
    if (!label) {
      setHeldAlpha(0);
      return undefined;
    }
    setHeldLabel(label);
    setHeldAlpha(1);
    const fadeStart = setTimeout(() => setHeldAlpha(0), 2000);
    return () => clearTimeout(fadeStart);
  }, [currentKey, currentItem]);

  if (!hud) return null;

  const left = Math.floor((vw - 182 * S) / 2);
  const isCreative = hud.gamemode === 'creative';
  const isSpectator = hud.gamemode === 'spectator';
  const showStats = !isCreative && !isSpectator;

  const effects = hud.effects || [];
  const hasPoison = effects.some((e) => e.type === 'poison');
  const hasWither = effects.some((e) => e.type === 'wither');
  const hasRegen = effects.some((e) => e.type === 'regeneration');
  const hasHungerEffect = effects.some((e) => e.type === 'hunger');

  const heartV = hud.isHardcore ? 45 : 0;
  const heartBaseU = hasWither ? 124 : hasPoison ? 88 : 52;

  const health = Math.max(0, hud.health || 0);
  const absorption = hud.absorption || 0;
  const hearts = [];
  for (let i = 0; i < 10; i++) {
    const full = health >= (i + 1) * 2;
    const half = !full && health === i * 2 + 1;
    hearts.push({
      i,
      kind: full ? 'full' : half ? 'half' : 'empty',
      abs: i < Math.floor(absorption / 2),
    });
  }

  const hungerPts = Math.max(0, hud.hunger ?? 20);
  const armorPts = hud.armor || 0;
  const hurtBlink = hud.hurtTime > 0 && Math.floor(hud.hurtTime / 3) % 2 === 1;
  const lowHealthShake = health <= 4 && showStats;
  const regenBounceIdx = hasRegen ? Math.floor((hud.worldTime || 0) / 2) % 25 : -1;

  return (
    <div
      className="pointer-events-none select-none"
      style={{
        position: 'fixed',
        left,
        bottom: 0,
        width: 182 * S,
        height: BAR_H * S,
        zIndex: 30,
        imageRendering: 'pixelated',
      }}
    >
      {/* Nome do item selecionado acima da Hotbar (1.8.9) */}
      {heldLabel && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: (showStats ? -12 : 12) * S,
            opacity: heldAlpha,
            transition: heldAlpha === 0 ? 'opacity 400ms linear' : 'none',
            pointerEvents: 'none',
          }}
        >
          <McText text={heldLabel} x={91} y={0} S={S} color="#FFFFFF" shadow align="center" />
        </div>
      )}

      {showStats && (
        <>
          {/* Armadura */}
          {armorPts > 0 &&
            Array.from({ length: 10 }).map((_, i) => {
              const full = armorPts >= (i + 1) * 2;
              const half = !full && armorPts === i * 2 + 1;
              return (
                <React.Fragment key={'ar' + i}>
                  <Sprite url={icons} u={16} v={9} w={9} h={9} S={S} x={i * 8} y={0} />
                  {(full || half) && <Sprite url={icons} u={full ? 34 : 25} v={9} w={9} h={9} S={S} x={i * 8} y={0} />}
                </React.Fragment>
              );
            })}

          {/* Corações (Normal / Hardcore / Veneno / Wither / Absorção / Regeneração) */}
          {hearts.map((h) => {
            const shakeY = lowHealthShake && (h.i + Math.floor((hud.worldTime || 0) / 3)) % 5 === 0 ? -1 : 0;
            const regenY = h.i === regenBounceIdx ? -2 : 0;
            const y = 10 + shakeY + regenY;
            return (
              <React.Fragment key={'h' + h.i}>
                <Sprite url={icons} u={hurtBlink ? 25 : 16} v={heartV} w={9} h={9} S={S} x={h.i * 8} y={y} />
                {h.kind !== 'empty' && !h.abs && (
                  <Sprite
                    url={icons}
                    u={h.kind === 'full' ? heartBaseU : heartBaseU + 9}
                    v={heartV}
                    w={9}
                    h={9}
                    S={S}
                    x={h.i * 8}
                    y={y}
                  />
                )}
                {h.abs && <Sprite url={icons} u={160} v={heartV} w={9} h={9} S={S} x={h.i * 8} y={y} />}
              </React.Fragment>
            );
          })}

          {/* Fome */}
          {Array.from({ length: 10 }).map((_, k) => {
            const full = hungerPts >= (k + 1) * 2;
            const half = !full && hungerPts === k * 2 + 1;
            const x = 182 - 9 - k * 8;
            const containerU = hasHungerEffect ? 133 : 16;
            const fillBaseU = hasHungerEffect ? 88 : 52;
            return (
              <React.Fragment key={'f' + k}>
                <Sprite url={icons} u={containerU} v={27} w={9} h={9} S={S} x={x} y={10} />
                {(full || half) && (
                  <Sprite url={icons} u={full ? fillBaseU : fillBaseU + 9} v={27} w={9} h={9} S={S} x={x} y={10} />
                )}
              </React.Fragment>
            );
          })}

          {/* Bolhas de ar debaixo d'água */}
          {hud.air !== undefined &&
            hud.air < 300 &&
            hud.air >= 0 &&
            Array.from({ length: Math.ceil(hud.air / 30) }).map((_, k) => (
              <Sprite key={'b' + k} url={icons} u={16} v={18} w={9} h={9} S={S} x={182 - 9 - k * 8} y={0} />
            ))}
        </>
      )}

      {/* Barra de XP */}
      {!isSpectator && !isCreative && (
        <>
          <Sprite url={icons} u={0} v={64} w={182} h={5} S={S} x={0} y={20} />
          {(hud.xpProgress || 0) > 0 && (
            <Sprite url={icons} u={0} v={69} w={Math.min(182, Math.floor((hud.xpProgress || 0) * 183))} h={5} S={S} x={0} y={20} />
          )}
          {hud.xpLevel > 0 && <XpLevel level={hud.xpLevel} x={91} y={14} S={S} />}
        </>
      )}

      {/* Hotbar */}
      <Sprite url={widgets} u={0} v={0} w={182} h={22} S={S} x={0} y={27} />
      <Sprite url={widgets} u={0} v={22} w={24} h={24} S={S} x={-1 + selectedSlot * 20} y={26} z={2} />
      {slots.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: (3 + i * 20) * S,
            top: (27 + 3) * S,
            width: 16 * S,
            height: 16 * S,
            zIndex: 3,
          }}
        >
          <ItemSlot item={s} size={16 * S} transparent fill guiScale={S} />
        </div>
      ))}
    </div>
  );
}
