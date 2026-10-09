import React, { useState, useEffect } from "react";
import { EFFECT_INFO } from "@/game/effects";
import { getPackUrl, MC } from "@/game/pack";

function IconSprite({ x, y, width = 9, height = 9, scale = 2.5, keyName, iconsUrl }) {
  if (!iconsUrl) {
    return <div key={keyName} className="w-5 h-5 inline-block bg-red-500/50 rounded-full" />;
  }
  return (
    <div
      key={keyName}
      style={{
        width: width * scale,
        height: height * scale,
        backgroundImage: `url(${iconsUrl})`,
        backgroundPosition: `-${x * scale}px -${y * scale}px`,
        backgroundSize: `${256 * scale}px ${256 * scale}px`,
        imageRendering: 'pixelated',
        display: 'inline-block',
      }}
    />
  );
}

function HeartIcon({ type, iconsUrl }) {
  return (
    <div className="relative w-[22.5px] h-[22.5px] inline-block">
      <IconSprite x={16} y={0} iconsUrl={iconsUrl} />
      {type === 'full' && (
        <div className="absolute inset-0">
          <IconSprite x={52} y={0} iconsUrl={iconsUrl} />
        </div>
      )}
      {type === 'half' && (
        <div className="absolute inset-0">
          <IconSprite x={61} y={0} iconsUrl={iconsUrl} />
        </div>
      )}
      {type === 'absFull' && (
        <div className="absolute inset-0">
          <IconSprite x={160} y={0} iconsUrl={iconsUrl} />
        </div>
      )}
      {type === 'absHalf' && (
        <div className="absolute inset-0">
          <IconSprite x={169} y={0} iconsUrl={iconsUrl} />
        </div>
      )}
    </div>
  );
}

function HungerIcon({ type, iconsUrl }) {
  return (
    <div className="relative w-[22.5px] h-[22.5px] inline-block">
      <IconSprite x={16} y={27} iconsUrl={iconsUrl} />
      {type === 'full' && (
        <div className="absolute inset-0">
          <IconSprite x={52} y={27} iconsUrl={iconsUrl} />
        </div>
      )}
      {type === 'half' && (
        <div className="absolute inset-0">
          <IconSprite x={61} y={27} iconsUrl={iconsUrl} />
        </div>
      )}
    </div>
  );
}

function ArmorIcon({ type, iconsUrl }) {
  return (
    <div className="relative w-[22.5px] h-[22.5px] inline-block">
      <IconSprite x={16} y={9} iconsUrl={iconsUrl} />
      {type === 'full' && (
        <div className="absolute inset-0">
          <IconSprite x={34} y={9} iconsUrl={iconsUrl} />
        </div>
      )}
      {type === 'half' && (
        <div className="absolute inset-0">
          <IconSprite x={25} y={9} iconsUrl={iconsUrl} />
        </div>
      )}
    </div>
  );
}

export default function SurvivalHud({ hud }) {
  const [iconsUrl, setIconsUrl] = useState(null);

  useEffect(() => {
    getPackUrl(MC + 'textures/gui/icons.png').then(url => {
      if (url) setIconsUrl(url);
    });
  }, []);

  if (!hud) return null;
  const healthHalf = hud.health % 2 !== 0;
  const healthFull = Math.floor(hud.health / 2);
  const healthEmpty = Math.max(0, 10 - healthFull - (healthHalf ? 1 : 0));
  const absHalf = (hud.absorption || 0) % 2 !== 0;
  const absFull = Math.floor((hud.absorption || 0) / 2);

  const hungerFull = Math.floor(hud.hunger / 2);
  const hungerHalf = hud.hunger % 2 !== 0;
  const hungerEmpty = Math.max(0, 10 - hungerFull - (hungerHalf ? 1 : 0));

  const armorPts = hud.armor || 0;
  const armorFull = Math.floor(armorPts / 2);
  const armorHalf = armorPts % 2 !== 0;
  const armorEmpty = Math.max(0, 10 - armorFull - (armorHalf ? 1 : 0));

  const isCreative = hud.gamemode === 'creative';
  const isSpectator = hud.gamemode === 'spectator';
  const xpProgress = hud.xpProgress || 0;

  // Lista de 10 ícones de armadura (20px de espaçamento = 202px total)
  const armorList = [];
  for (let i = 0; i < 10; i++) {
    if (i < armorFull) armorList.push('full');
    else if (i === armorFull && armorHalf) armorList.push('half');
    else armorList.push('empty');
  }

  // Lista de 10 ícones de vida (20px de espaçamento = 202px total)
  const heartsList = [];
  for (let i = 0; i < 10; i++) {
    if (i < healthFull) heartsList.push('full');
    else if (i === healthFull && healthHalf) heartsList.push('half');
    else heartsList.push('empty');
  }
  for (let i = 0; i < absFull; i++) {
    if (i < heartsList.length) heartsList[heartsList.length - 1 - i] = 'absFull';
  }

  // Lista de 10 ícones de fome (20px de espaçamento = 202px total)
  const hungerList = [];
  for (let i = 0; i < 10; i++) {
    if (i < hungerFull) hungerList.push('full');
    else if (i === hungerFull && hungerHalf) hungerList.push('half');
    else hungerList.push('empty');
  }

  return (
    <>
      {/* Burning overlay */}
      {hud.fireTicks > 0 && (
        <div className="absolute inset-0 bg-orange-600/15 pointer-events-none" />
      )}

      {/* Hurt flash vignette */}
      {hud.hurtTime > 0 && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-75 z-40"
          style={{
            background: 'radial-gradient(circle at center, rgba(255, 0, 0, 0.15) 20%, rgba(220, 0, 0, 0.5) 100%)',
            opacity: Math.min(1, hud.hurtTime / 10),
          }}
        />
      )}

      {/* Hearts + Armor + Hunger (Alinhamento exato Minecraft 1.8.9 sobre a Hotbar ampliada de 455px) */}
      {!isCreative && !isSpectator && (
        <div className="absolute bottom-[80px] left-1/2 -translate-x-1/2 w-[455px] flex justify-between items-end pointer-events-none select-none z-30">
          {/* Esquerda: Armadura (topo) + Corações (base) */}
          <div className="relative w-[202px] flex flex-col gap-1 items-start">
            {/* Barra de Armadura */}
            {armorPts > 0 && (
              <div className="relative w-[202px] h-[22.5px]">
                {armorList.map((type, i) => (
                  <div key={`arm${i}`} className="absolute top-0" style={{ left: `${i * 20}px` }}>
                    <ArmorIcon type={type} iconsUrl={iconsUrl} />
                  </div>
                ))}
              </div>
            )}
            {/* Corações */}
            <div className="relative w-[202px] h-[22.5px]">
              {heartsList.map((type, i) => (
                <div key={`heart${i}`} className="absolute top-0" style={{ left: `${i * 20}px` }}>
                  <HeartIcon type={type} iconsUrl={iconsUrl} />
                </div>
              ))}
            </div>
          </div>

          {/* Direita: Bolhas de Ar (topo) + Fome (base) */}
          <div className="relative w-[202px] flex flex-col gap-1 items-end">
            {/* Bolhas de Ar */}
            {hud.air < 300 && hud.air >= 0 && (
              <div className="relative w-[202px] h-[22.5px]">
                {Array.from({ length: Math.ceil(hud.air / 30) }).map((_, i) => (
                  <div key={`air${i}`} className="absolute top-0" style={{ right: `${i * 20}px` }}>
                    <IconSprite keyName={`air${i}`} x={16} y={18} iconsUrl={iconsUrl} />
                  </div>
                ))}
              </div>
            )}
            {/* Barra de Fome */}
            <div className="relative w-[202px] h-[22.5px]">
              {hungerList.map((type, i) => (
                <div key={`hunger${i}`} className="absolute top-0" style={{ right: `${i * 20}px` }}>
                  <HungerIcon type={type} iconsUrl={iconsUrl} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* XP bar */}
      {!isSpectator && (
        <div className="absolute bottom-[63px] left-1/2 -translate-x-1/2 w-[455px] pointer-events-none select-none z-30">
          <div className="relative h-3 bg-black/70 rounded-sm border border-black/40 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-lime-500 to-green-400 rounded-sm"
              style={{ width: `${Math.min(100, xpProgress * 100)}%` }}
            />
          </div>
          {hud.xpLevel > 0 && (
            <div
              className="absolute -top-4 left-1/2 -translate-x-1/2 font-bold text-base text-[#80FF20]"
              style={{
                textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 2px 2px rgba(0,0,0,0.8)'
              }}
            >
              {hud.xpLevel}
            </div>
          )}
        </div>
      )}

      {/* Toggle Sprint indicator (Lunar / Badlion / CM Client style) */}
      {hud.sprintToggled && !hud.paused && (
        <div className="absolute bottom-2 left-2 text-xs font-mono text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] bg-black/30 px-2 py-0.5 rounded pointer-events-none z-30">
          [Corrida: Ativada]
        </div>
      )}

      {/* Effect indicators */}
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

      {/* Weather indicator */}
      {hud.weather && hud.weather !== 'clear' && (
        <div className="absolute top-8 right-2 text-xs text-white/60 bg-black/30 px-2 py-0.5 rounded">
          {hud.weather === 'rain' ? '🌧' : hud.weather === 'thunder' ? '⛈' : hud.weather === 'snow' ? '❄' : ''}
        </div>
      )}

      {/* Eating progress */}
      {hud.eating && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-32 h-1 bg-black/40 rounded-sm overflow-hidden">
          <div className="h-full bg-yellow-400" style={{ width: `${(hud.eatingTicks / 32) * 100}%` }} />
        </div>
      )}
    </>
  );
}