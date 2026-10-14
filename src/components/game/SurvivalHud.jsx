// Overlays e indicadores do modo sobrevivência. Hotbar, vida, fome, armadura e XP ficam em HudBars (textura oficial).
import React from "react";
import { EFFECT_INFO } from "@/game/effects";
import { McText, useGuiScaleValue } from "./GuiSprite";

const WEATHER_TEXT = { rain: 'Chuva', thunder: 'Tempestade', snow: 'Neve' };

export default function SurvivalHud({ hud }) {
  const S = useGuiScaleValue();
  if (!hud) return null;
  return (
    <>
      {/* Overlay de fogo */}
      {hud.fireTicks > 0 && (
        <div className="absolute inset-0 bg-orange-600/15 pointer-events-none" />
      )}

      {/* Indicador de corrida alternada: só o texto, branco com sombra, na fonte e no tamanho do jogo (escala da GUI).
          Posição medida no print do jogo original: caixa de 9 px de GUI com a base 3 px acima do rodapé, 4 px da esquerda */}
      {hud.sprintToggled && !hud.paused && (
        <div style={{ position: 'absolute', left: 5 * S, bottom: 3 * S, width: 160 * S, height: 9 * S, pointerEvents: 'none' }}>
          <McText text="[Sprinting (Toggled)]" x={0} y={0} S={S} color="#FFFFFF" shadow />
        </div>
      )}

      {/* Efeitos ativos */}
      {hud.effects && hud.effects.length > 0 && (
        <div className="absolute top-16 right-2 flex flex-col gap-1">
          {hud.effects.map((e, i) => {
            const info = EFFECT_INFO[e.type];
            if (!info) return null;
            const seconds = Math.ceil(e.duration / 20);
            return (
              <div key={i} className="flex items-center gap-1 bg-black/50 rounded px-1 py-0.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: info.color }} />
                <span className="text-xs text-white/80">{info.name}</span>
                <span className="text-xs text-white/50">{seconds}s</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Clima */}
      {hud.weather && WEATHER_TEXT[hud.weather] && (
        <div className="absolute top-8 right-2 text-xs text-white/60 bg-black/30 px-2 py-0.5 rounded">
          {WEATHER_TEXT[hud.weather]}
        </div>
      )}

      {/* Progresso de comer */}
      {hud.eating && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32 h-1 bg-black/40 rounded-sm overflow-hidden">
          <div className="h-full bg-yellow-400" style={{ width: `${(hud.eatingTicks / 32) * 100}%` }} />
        </div>
      )}
    </>
  );
}
