// Componente da Lista de Jogadores no TAB — PRD 25 MC25-RF-010..014
import React, { useState, useEffect } from 'react';
import { getPackUrl, MC } from '@/game/pack';

function PingBars({ pingMs, iconsUrl }) {
  let level = 0;
  if (pingMs === null || pingMs === undefined || pingMs > 600) level = 0;
  else if (pingMs <= 25) level = 5;
  else if (pingMs <= 75) level = 4;
  else if (pingMs <= 150) level = 3;
  else if (pingMs <= 300) level = 2;
  else level = 1;

  if (iconsUrl) {
    // Renderiza a partir do icons.png oficial (x=0..50, y=176, w=10, h=8)
    const offsetX = (5 - level) * 10;
    return (
      <div
        title={pingMs !== null && pingMs !== undefined ? `${pingMs} ms` : 'Medindo...'}
        style={{
          width: 10 * 2,
          height: 8 * 2,
          backgroundImage: `url(${iconsUrl})`,
          backgroundPosition: `-${offsetX * 2}px -${176 * 2}px`,
          backgroundSize: `${256 * 2}px ${256 * 2}px`,
          imageRendering: 'pixelated',
          display: 'inline-block',
        }}
      />
    );
  }

  // Fallback visual de barras coloridas estilo Minecraft
  const colors = ['#555555', '#FF5555', '#FFAA00', '#FFFF55', '#55FF55', '#00AA00'];
  const activeColor = colors[level];
  return (
    <div
      className="flex items-end gap-[2px] h-3.5 w-5 pointer-events-auto"
      title={pingMs !== null && pingMs !== undefined ? `${pingMs} ms` : 'Medindo...'}
    >
      {[1, 2, 3, 4, 5].map((b) => (
        <div
          key={b}
          className="w-1 rounded-xs transition-colors duration-200"
          style={{
            height: `${b * 2.5 + 2}px`,
            backgroundColor: b <= level ? activeColor : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </div>
  );
}

export default function PlayerListOverlay({ visible, worldName, maxPlayers = 8, players = [], isHost = false, iconsUrl: customIconsUrl }) {
  const [iconsUrl, setIconsUrl] = useState(customIconsUrl || null);

  useEffect(() => {
    if (!iconsUrl && !customIconsUrl) {
      getPackUrl(MC + 'textures/gui/icons.png').then(url => {
        if (url) setIconsUrl(url);
      });
    }
  }, [customIconsUrl, iconsUrl]);

  if (!visible || !players || players.length === 0) return null;

  const totalConnected = players.length;
  const numColumns = totalConnected > 10 ? 2 : 1;

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 w-auto max-w-[80vw] z-50 pointer-events-none select-none">
      <div className="bg-black/75 backdrop-blur-md rounded border border-white/20 p-3 shadow-2xl flex flex-col gap-2 min-w-[320px]">
        {/* Título & Cabeçalho */}
        <div className="text-center font-mono">
          <div className="text-sm font-bold text-yellow-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
            {worldName || 'Mundo'} <span className="text-gray-400 font-normal">— TAB</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Jogadores ({totalConnected}/{maxPlayers})
          </div>
        </div>

        {/* Grade de Jogadores */}
        <div
          className={`grid gap-x-6 gap-y-1 mt-1 max-h-[60vh] overflow-y-auto font-mono text-xs ${
            numColumns === 2 ? 'grid-cols-2' : 'grid-cols-1'
          }`}
          style={{ scrollbarWidth: 'thin' }}
        >
          {players.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors pointer-events-auto"
              title={`${p.name || 'Jogador'} (${p.pingMs !== null && p.pingMs !== undefined ? p.pingMs + ' ms' : 'medindo...'})`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {/* Ícone de Cabeça/Face da Skin 16x16 */}
                <div className="w-4 h-4 bg-yellow-700/80 border border-amber-900 rounded-xs flex items-center justify-center text-[10px] shrink-0 overflow-hidden shadow-xs">
                  <span>👤</span>
                </div>
                {/* Nome do Jogador */}
                <span className="text-white font-medium truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
                  {p.isHost && <span className="text-yellow-400 font-bold mr-1">♔</span>}
                  {p.name}
                </span>
              </div>

              {/* Voice Chat Mic Status & Barras de Ping */}
              <div className="flex items-center gap-2 shrink-0">
                {p.voiceStatus === 'speaking' ? (
                  <span className="text-green-400 text-xs animate-pulse" title="Falando">🎙️</span>
                ) : p.voiceStatus === 'muted' ? (
                  <span className="text-red-400/60 text-xs" title="Microfone Mutado">🔇</span>
                ) : p.voiceStatus === 'active' ? (
                  <span className="text-gray-400/80 text-xs" title="Microfone Conectado">🎤</span>
                ) : null}
                <PingBars pingMs={p.pingMs} iconsUrl={iconsUrl} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
