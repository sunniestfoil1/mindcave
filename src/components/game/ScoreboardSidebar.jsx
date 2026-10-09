// Renderizador do Scoreboard Lateral (MC25-RF-040)
import React from 'react';

function parseMcCodes(text) {
  if (!text) return text;
  return text.replace(/§[0-9a-fk-or]/gi, '');
}

export default function ScoreboardSidebar({ scoreboard }) {
  if (!scoreboard || scoreboard.display !== 'sidebar' || !scoreboard.objective) return null;
  const lines = scoreboard.lines || [];
  if (lines.length === 0) return null;

  return (
    <div className="fixed top-1/3 right-3 z-40 bg-black/60 backdrop-blur-xs p-2 rounded border border-white/10 select-none pointer-events-none min-w-[150px] font-mono text-xs shadow-lg">
      {/* Título */}
      <div className="text-center font-bold text-yellow-300 border-b border-white/15 pb-1 mb-1 tracking-wide">
        {parseMcCodes(scoreboard.displayName || scoreboard.objective)}
      </div>

      {/* Linhas (name : score) */}
      <div className="flex flex-col gap-0.5">
        {lines.slice(0, 15).map((l, i) => (
          <div key={i} className="flex justify-between items-center gap-3">
            <span className="text-white font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
              {parseMcCodes(l.name)}
            </span>
            <span className="text-red-400 font-bold font-mono">
              {l.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
