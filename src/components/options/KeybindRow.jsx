import React, { useState } from 'react';
import { useGui } from '@/components/java/GuiContext';
import { getWidgetsTexture } from '@/game/gui/textures';
import GuiText from '@/components/java/GuiText';
import { keyLabel } from '@/game/settingsDefaults';

// Linha de tecla no estilo Java 1.8.9: rótulo à esquerda + botão de widget à direita.
const H = 20;

export default function KeybindRow({ label, code, isListening, conflict, onClick }) {
  const gui = useGui();
  const scale = gui?.scale || 1;
  const [hover, setHover] = useState(false);
  const texUrl = getWidgetsTexture();
  const bgSize = 256 * scale;

  const rowW = 302;
  const btnW = 100;
  const halfW = btnW / 2;
  const labelW = rowW - btnW;

  const stateY = isListening ? 86 : (hover ? 86 : 66);
  const displayText = isListening ? '>' : (code ? keyLabel(code) : '—');
  const keyColor = isListening ? '#FFFFA0' : conflict ? '#FF5555' : '#E0E0E0';
  const labelColor = conflict ? '#FF5555' : '#E0E0E0';

  return (
    <div style={{ position: 'relative', width: rowW * scale, height: H * scale, display: 'flex', alignItems: 'center', marginBottom: 2 * scale }}>
      <div style={{ width: labelW * scale, display: 'flex', alignItems: 'center' }}>
        <GuiText text={label} color={labelColor} shadow scale={scale} />
      </div>
      <div
        style={{ position: 'relative', width: btnW * scale, height: H * scale, cursor: 'pointer', flexShrink: 0 }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick?.(); }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, width: halfW * scale, height: H * scale,
          backgroundImage: `url(${texUrl})`, backgroundPosition: `0 ${-stateY * scale}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, width: halfW * scale, height: H * scale,
          backgroundImage: `url(${texUrl})`, backgroundPosition: `${-(200 - halfW) * scale}px ${-stateY * scale}px`, backgroundSize: `${bgSize}px ${bgSize}px`, imageRendering: 'pixelated' }} />
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <GuiText text={displayText} color={keyColor} shadow scale={scale} />
        </div>
      </div>
    </div>
  );
}