import React from 'react';
import { GuiProvider, useGui } from './GuiContext';
import { getDirtTexture } from '@/game/gui/textures';

// Screen wrapper — PRD 19 RF-006
// background: 'dirt' (menus outside game) or 'gradient' (pause/options over game)
function ScreenBackground({ background, children }) {
  const gui = useGui();
  const scale = gui?.scale || 1;

  if (background === 'death') {
    return (
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'auto',
        background: 'linear-gradient(to bottom, rgba(80, 0, 0, 0.68), rgba(35, 0, 0, 0.88))',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(120, 0, 0, 0.15) 0%, rgba(10, 0, 0, 0.8) 100%)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {children}
        </div>
      </div>
    );
  }

  if (background === 'gradient') {
    return (
      <div style={{
        position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'auto',
        background: 'linear-gradient(to bottom, rgba(16,16,16,0.75), rgba(16,16,16,0.82))',
      }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {children}
        </div>
      </div>
    );
  }

  // dirt
  const dirtUrl = getDirtTexture();
  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'auto',
      backgroundImage: `url(${dirtUrl})`,
      backgroundSize: `${32 * scale}px ${32 * scale}px`,
      imageRendering: 'pixelated',
    }}>
      {/* Sombra de viñeta clássica do Java 1.8.9 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.65) 100%)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {children}
      </div>
    </div>
  );
}

export default function GuiScreen({ children, background = 'dirt' }) {
  return (
    <GuiProvider>
      <ScreenBackground background={background}>
        {children}
      </ScreenBackground>
    </GuiProvider>
  );
}