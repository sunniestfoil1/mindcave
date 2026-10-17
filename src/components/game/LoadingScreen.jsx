import React from 'react';
import { McText, useGuiScaleValue } from '@/components/game/GuiSprite';

// Tela "Carregando mundo" do 1.8.9 (LoadingScreenRenderer): fundo de terra escurecido (tile de 32 px de GUI, cor 0x404040), título e
// mensagem centralizados em branco com sombra e a barra de 100×2 px de GUI (cinza 0x808080, preenchida em verde 0x80FF80).
// `percent` e `status` vêm do carregamento de verdade (engine.start): bytes do pacote, texturas, chunks e shaders.
export default function LoadingScreen({ percent, status }) {
  const S = useGuiScaleValue();
  const pct = Math.max(0, Math.min(100, percent || 0));
  return (
    <div
      className="fixed inset-0 select-none"
      data-loading-screen
      data-status={status || ''}
      style={{
        zIndex: 50, imageRendering: 'pixelated',
        backgroundColor: '#404040', backgroundImage: 'url(/assets/ui/dirt.png)', backgroundBlendMode: 'multiply',
        backgroundSize: `${32 * S}px ${32 * S}px`,
      }}
    >
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 0 }}>
        <div style={{ position: 'absolute', left: '50%', top: -20 * S }}><McText text="Carregando mundo" x={0} y={0} S={S} color="#FFFFFF" shadow align="center" /></div>
        <div style={{ position: 'absolute', left: '50%', top: 4 * S }}><McText text={status || ''} x={0} y={0} S={S} color="#FFFFFF" shadow align="center" /></div>
        <div style={{ position: 'absolute', left: '50%', top: 16 * S, width: 100 * S, height: 2 * S, marginLeft: -50 * S, background: '#808080' }}>
          <div data-loading-bar style={{ width: `${pct}%`, height: '100%', background: '#80FF80' }} />
        </div>
      </div>
    </div>
  );
}
