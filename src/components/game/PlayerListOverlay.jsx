// Lista de jogadores (TAB), no estilo do GuiPlayerTabOverlay da 1.8.9: cabeça da skin, [CARGO] nome e barras de ping do icons.png.
// Não pausa o jogo. Ping: medido pelo host e difundido a todos (netManager.getAllPings).
import React, { useEffect, useState } from 'react';
import { Sprite, McText, usePackTexture, useGuiScaleValue } from './GuiSprite';
import { measureMcText } from '@/game/gui/font';
import { getRank } from '@/game/ranks';
import { getSkinFaceUrl, getSkinChoice, onSkinChange } from '@/game/skinStore';

const ROW_H = 10, ROW_W = 190, MAX_PER_COL = 20;

// Linha de ping do icons.png (0, 176 + j·8, 10×8): 0 = ótimo … 4 = péssimo, 5 = sem medida
export function pingRow(ms) {
  if (ms === null || ms === undefined || ms < 0) return 5;
  return ms < 150 ? 0 : ms < 300 ? 1 : ms < 600 ? 2 : ms < 1000 ? 3 : 4;
}

function useFaces() {
  const [faces, setFaces] = useState({});
  useEffect(() => {
    let off = false;
    const load = async () => {
      const steve = await getSkinFaceUrl(8, { kind: 'steve' });
      const mine = await getSkinFaceUrl(8, getSkinChoice());
      if (!off) setFaces({ steve, mine });
    };
    load();
    const un = onSkinChange(load);
    return () => { off = true; un(); };
  }, []);
  return faces;
}

export default function PlayerListOverlay({ visible, worldName, players = [], selfName }) {
  const S = useGuiScaleValue();
  const icons = usePackTexture('textures/gui/icons.png');
  const faces = useFaces();
  if (!visible || !players.length) return null;

  const sorted = [...players].sort((a, b) => getRank(a.rank).order - getRank(b.rank).order || String(a.name).localeCompare(String(b.name)));
  const cols = Math.ceil(sorted.length / MAX_PER_COL);
  const perCol = Math.ceil(sorted.length / cols);
  const width = cols * ROW_W + (cols - 1) * 2;
  const header = worldName ? 14 : 0;
  const height = header + perCol * ROW_H + 2;

  return (
    <div className="fixed left-1/2 z-50 pointer-events-none select-none" style={{ top: 10 * S, transform: 'translateX(-50%)', width: (width + 2) * S, height: (height + 2) * S }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
      {worldName && <McText text={worldName} x={(width + 2) / 2} y={3} S={S} color="#FFFFFF" shadow align="center" />}
      {sorted.map((p, i) => {
        const col = Math.floor(i / perCol), row = i % perCol;
        const x = 1 + col * (ROW_W + 2), y = 1 + header + row * ROW_H;
        const rank = getRank(p.rank);
        const isMe = p.name === selfName;
        const tag = `[${rank.tag}]`;
        const tagW = measureMcText(tag, rank.color, 8 * S) / S;
        return (
          <React.Fragment key={`${p.id}-${i}`}>
            <div style={{ position: 'absolute', left: x * S, top: y * S, width: ROW_W * S, height: (ROW_H - 1) * S, background: 'rgba(255,255,255,0.13)' }} />
            {(isMe ? faces.mine : faces.steve) && (
              <img alt="" src={isMe ? faces.mine : faces.steve} style={{ position: 'absolute', left: (x + 1) * S, top: (y + 0.5) * S, width: 8 * S, height: 8 * S, imageRendering: 'pixelated' }} />
            )}
            <McText text={tag} x={x + 11} y={y + 0.5} S={S} color={rank.color} shadow />
            <McText text={String(p.name)} x={x + 11 + tagW + 3} y={y + 0.5} S={S} color={isMe ? '#FFFF55' : '#FFFFFF'} shadow />
            <Sprite url={icons} u={0} v={176 + pingRow(p.pingMs) * 8} w={10} h={8} S={S} x={x + ROW_W - 11} y={y + 0.5} title={p.pingMs != null ? `${p.pingMs} ms` : 'medindo'} />
          </React.Fragment>
        );
      })}
    </div>
  );
}
