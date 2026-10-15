import React from "react";
import { McText, useGuiScaleValue } from "./GuiSprite";

export default function SurvivalHud({ hud }) {
  const S = useGuiScaleValue();
  if (!hud) return null;

  return (
    <>
      {hud.fireTicks > 0 && (
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: '45%',
            background: 'linear-gradient(to top, rgba(220, 80, 0, 0.45), rgba(220, 120, 0, 0.15) 60%, transparent)',
          }}
        />
      )}
      {hud.sprintToggled && !hud.paused && (
        <div style={{ position: 'absolute', left: 5 * S, bottom: 3 * S, width: 160 * S, height: 9 * S, pointerEvents: 'none' }}>
          <McText text="[Sprinting (Toggled)]" x={0} y={0} S={S} color="#FFFFFF" shadow />
        </div>
      )}
    </>
  );
}
