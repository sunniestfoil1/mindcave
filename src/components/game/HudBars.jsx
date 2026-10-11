// Hotbar, vida, armadura, fome, bolhas de ar e barra de XP com widgets.png e icons.png, em escala inteira e nas posições do
// GuiIngame da 1.8.9. Coordenadas locais em px de GUI: y = 0 é 49 px acima da base da tela (i = centro da tela).
import React, { useEffect, useState } from 'react';
import ItemSlot from './ItemSlot';
import { Sprite, McText, usePackTexture, useGuiScaleValue } from './GuiSprite';

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

// Texto verde do nível de XP com contorno preto (4 cópias pretas deslocadas, como no jogo)
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
  if (!hud) return null;

  const left = Math.floor((vw - 182 * S) / 2);
  const slots = hud.hotbar || [];
  const isCreative = hud.gamemode === 'creative';
  const isSpectator = hud.gamemode === 'spectator';
  const showStats = !isCreative && !isSpectator;

  // Vida, absorção, armadura e fome em meios pontos
  const health = Math.max(0, hud.health || 0);
  const hearts = [];
  const absorption = hud.absorption || 0;
  for (let i = 0; i < 10; i++) {
    const full = health >= (i + 1) * 2, half = !full && health === i * 2 + 1;
    hearts.push({ i, kind: full ? 'full' : half ? 'half' : 'empty', abs: i < Math.floor(absorption / 2) });
  }
  const hungerPts = Math.max(0, hud.hunger ?? 20);
  const armorPts = hud.armor || 0;
  const hurtBlink = hud.hurtTime > 0 && Math.floor(hud.hurtTime / 3) % 2 === 1; // contorno branco piscando ao tomar dano
  const lowHealthShake = health <= 4 && showStats;

  return (
    <div
      className="pointer-events-none select-none"
      style={{ position: 'fixed', left, bottom: 0, width: 182 * S, height: BAR_H * S, zIndex: 30, imageRendering: 'pixelated' }}
    >
      {showStats && (
        <>
          {/* Armadura (acima da vida): fundo (16,9), meio (25,9), cheio (34,9) */}
          {armorPts > 0 && Array.from({ length: 10 }).map((_, i) => {
            const full = armorPts >= (i + 1) * 2, half = !full && armorPts === i * 2 + 1;
            return (
              <React.Fragment key={'ar' + i}>
                <Sprite url={icons} u={16} v={9} w={9} h={9} S={S} x={i * 8} y={0} />
                {(full || half) && <Sprite url={icons} u={full ? 34 : 25} v={9} w={9} h={9} S={S} x={i * 8} y={0} />}
              </React.Fragment>
            );
          })}

          {/* Vida: fundo (16,0) [piscando: (25,0)], cheio (52,0), meio (61,0); absorção (160,0)/(169,0) */}
          {hearts.map((h) => {
            const y = 10 + (lowHealthShake && (h.i + Math.floor((hud.worldTime || 0) / 3)) % 5 === 0 ? -1 : 0);
            return (
              <React.Fragment key={'h' + h.i}>
                <Sprite url={icons} u={hurtBlink ? 25 : 16} v={0} w={9} h={9} S={S} x={h.i * 8} y={y} />
                {h.kind !== 'empty' && !h.abs && <Sprite url={icons} u={h.kind === 'full' ? 52 : 61} v={0} w={9} h={9} S={S} x={h.i * 8} y={y} />}
                {h.abs && <Sprite url={icons} u={160} v={0} w={9} h={9} S={S} x={h.i * 8} y={y} />}
              </React.Fragment>
            );
          })}

          {/* Fome: da direita para a esquerda; fundo (16,27), cheio (52,27), meio (61,27) */}
          {Array.from({ length: 10 }).map((_, k) => {
            const full = hungerPts >= (k + 1) * 2, half = !full && hungerPts === k * 2 + 1;
            const x = 182 - 9 - k * 8;
            return (
              <React.Fragment key={'f' + k}>
                <Sprite url={icons} u={16} v={27} w={9} h={9} S={S} x={x} y={10} />
                {(full || half) && <Sprite url={icons} u={full ? 52 : 61} v={27} w={9} h={9} S={S} x={x} y={10} />}
              </React.Fragment>
            );
          })}

          {/* Bolhas de ar (acima da fome): cheia (16,18), estourando (25,18) */}
          {hud.air !== undefined && hud.air < 300 && hud.air >= 0 && Array.from({ length: Math.ceil(hud.air / 30) }).map((_, k) => (
            <Sprite key={'b' + k} url={icons} u={16} v={18} w={9} h={9} S={S} x={182 - 9 - k * 8} y={0} />
          ))}
        </>
      )}

      {/* Barra de XP: fundo (0,64) 182×5, preenchimento (0,69) até progresso × 183 */}
      {!isSpectator && !isCreative && (
        <>
          <Sprite url={icons} u={0} v={64} w={182} h={5} S={S} x={0} y={20} />
          {(hud.xpProgress || 0) > 0 && (
            <Sprite url={icons} u={0} v={69} w={Math.min(182, Math.floor((hud.xpProgress || 0) * 183))} h={5} S={S} x={0} y={20} />
          )}
          {hud.xpLevel > 0 && <XpLevel level={hud.xpLevel} x={91} y={14} S={S} />}
        </>
      )}

      {/* Hotbar: fundo (0,0) 182×22, seleção (0,22) 24×24 */}
      <Sprite url={widgets} u={0} v={0} w={182} h={22} S={S} x={0} y={27} />
      <Sprite url={widgets} u={0} v={22} w={24} h={24} S={S} x={-1 + hud.selectedSlot * 20} y={26} z={2} />
      {slots.map((s, i) => (
        <div key={i} style={{ position: 'absolute', left: (3 + i * 20) * S, top: (27 + 3) * S, width: 16 * S, height: 16 * S, zIndex: 3 }}>
          <ItemSlot item={s} size={16 * S} transparent fill guiScale={S} />
        </div>
      ))}
    </div>
  );
}
