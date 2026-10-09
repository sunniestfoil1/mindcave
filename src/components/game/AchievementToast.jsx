import React, { useState, useEffect } from 'react';
import { getPackUrl, MC } from '@/game/pack';
import { playLevelUpSound } from '@/game/sounds';

export default function AchievementToast({ toast, onClose }) {
  const [bgUrl, setBgUrl] = useState(null);

  useEffect(() => {
    getPackUrl(MC + 'textures/gui/achievement/achievement_bg.png').then(url => {
      if (url) setBgUrl(url);
    });
    playLevelUpSound();
  }, []);

  if (!toast) return null;

  return (
    <div className="absolute top-4 right-4 z-50 animate-in fade-in slide-in-from-right duration-300 pointer-events-auto">
      <div
        className="relative flex items-center gap-3 p-3 w-[260px] h-[64px] border-2 border-stone-900 rounded-sm shadow-2xl bg-stone-800"
        style={{
          backgroundImage: bgUrl ? `url(${bgUrl})` : undefined,
          backgroundSize: '100% 100%',
          imageRendering: 'pixelated',
        }}
      >
        <div className="text-2xl flex-shrink-0 text-yellow-300 drop-shadow">{toast.icon || '🏆'}</div>
        <div className="flex-1 overflow-hidden">
          <div className="text-yellow-400 font-bold text-xs tracking-wider" style={{ textShadow: "1px 1px 2px black, -1px -1px 2px black" }}>
            Conquista obtida!
          </div>
          <div className="text-white font-bold text-xs truncate mt-0.5" style={{ textShadow: "1px 1px 2px black, -1px -1px 2px black" }}>
            {toast.name}
          </div>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white text-xs px-1 font-bold">
          ✕
        </button>
      </div>
    </div>
  );
}