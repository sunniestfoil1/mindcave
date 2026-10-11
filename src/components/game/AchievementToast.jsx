import React, { useState, useEffect } from 'react';
import { getPackUrl, MC } from '@/game/pack';
import { playLevelUpSound } from '@/game/sounds';

// Aviso temporário: entra deslizando pela direita, fica 4 s e sai deslizando para a direita (some sozinho,
// mesmo que o jogador abra o inventário ou morra enquanto ele está na tela).
const ENTER_MS = 300, HOLD_MS = 4000, EXIT_MS = 350;

export default function AchievementToast({ toast, onClose }) {
  const [bgUrl, setBgUrl] = useState(null);
  const [phase, setPhase] = useState('enter'); // enter → hold → exit

  useEffect(() => {
    getPackUrl(MC + 'textures/gui/achievement/achievement_bg.png').then(url => { if (url) setBgUrl(url); });
    playLevelUpSound();
  }, [toast]);

  useEffect(() => {
    if (!toast) return undefined;
    setPhase('enter');
    const t1 = setTimeout(() => setPhase('hold'), 30); // um quadro depois de montar, para a transição de entrada rodar
    const t2 = setTimeout(() => setPhase('exit'), ENTER_MS + HOLD_MS);
    const t3 = setTimeout(() => onClose?.(), ENTER_MS + HOLD_MS + EXIT_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!toast) return null;
  const shown = phase === 'hold';

  return (
    <div
      className="absolute top-4 right-4 z-[200] pointer-events-none"
      style={{
        transform: shown ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
        opacity: shown ? 1 : 0.9,
        transition: `transform ${phase === 'exit' ? EXIT_MS : ENTER_MS}ms ease-out`,
      }}
    >
      <div
        className="relative flex items-center gap-3 p-3 w-[260px] h-[64px] border-2 border-stone-900 rounded-sm shadow-2xl bg-stone-800"
        style={{ backgroundImage: bgUrl ? `url(${bgUrl})` : undefined, backgroundSize: '100% 100%', imageRendering: 'pixelated' }}
      >
        <div className="text-2xl flex-shrink-0 text-yellow-300 drop-shadow">{toast.icon || '🏆'}</div>
        <div className="flex-1 overflow-hidden">
          <div className="text-yellow-400 font-bold text-xs tracking-wider" style={{ textShadow: '1px 1px 2px black, -1px -1px 2px black' }}>
            Conquista obtida!
          </div>
          <div className="text-white font-bold text-xs truncate mt-0.5" style={{ textShadow: '1px 1px 2px black, -1px -1px 2px black' }}>
            {toast.name}
          </div>
        </div>
      </div>
    </div>
  );
}
