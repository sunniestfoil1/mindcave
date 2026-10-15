import React, { useState } from 'react';
import { ACHIEVEMENTS, getAchievementProgress } from '@/game/achievements';
import { GuiScreen, GuiButton, GuiText, JavaButton, useGui } from '@/components/java';

function StatRow({ label, value, scale, odd }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${3 * scale}px ${6 * scale}px`,
        background: odd ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
      }}
    >
      <GuiText text={label} color="#CCCCCC" shadow scale={scale} />
      <GuiText text={String(value)} color="#FFFFFF" shadow scale={scale} />
    </div>
  );
}

function StatsContent({ stats, achievements, onClose }) {
  const { guiHeight, scale } = useGui();
  const [tab, setTab] = useState('stats');
  const [sortAsc, setSortAsc] = useState(false);

  const fmt = (n) => {
    if (typeof n !== 'number') return n || '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const fmtTime = (ticks) => {
    const s = Math.floor((ticks || 0) / 20);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const fmtDist = (blocks) => {
    const b = blocks || 0;
    if (b >= 1000) return (b / 1000).toFixed(2) + ' km';
    return Math.floor(b) + ' m';
  };

  const sortedBlockTypes = Object.entries(stats?.blocksMinedByType || {}).sort(([, a], [, b]) =>
    sortAsc ? a - b : b - a
  );
  const sortedMobTypes = Object.entries(stats?.mobsKilledByType || {}).sort(([, a], [, b]) =>
    sortAsc ? a - b : b - a
  );

  const generalRows = [
    ['Tempo jogado', fmtTime(stats?.playTime)],
    ['Distância andada', fmtDist(stats?.distanceWalked)],
    ['Distância correndo', fmtDist(stats?.distanceSprinted)],
    ['Distância voando', fmtDist(stats?.distanceFlown)],
    ['Distância em queda', fmtDist(stats?.distanceFallen)],
    ['Saltos', fmt(stats?.jumps || 0)],
    ['Blocos minerados', fmt(stats?.blocksMined || 0)],
    ['Blocos colocados', fmt(stats?.blocksPlaced || 0)],
    ['Itens criados', fmt(stats?.itemsCrafted || 0)],
    ['Mobs mortos', fmt(stats?.mobsKilled || 0)],
    ['Mortes', fmt(stats?.deaths || 0)],
    ['Dano causado', fmt(Math.round(stats?.damageDealt || 0))],
    ['Dano sofrido', fmt(Math.round(stats?.damageTaken || 0))],
    ['Peixes pescados', fmt(stats?.fishCaught || 0)],
    ['Animais reproduzidos', fmt(stats?.animalsBred || 0)],
  ];

  const techRows = [
    ['Disparos feitos', fmt(stats?.shotsFired || 0)],
    ['Tiros na cabeça', fmt(stats?.headshots || 0)],
    ['Atiradores de Elite mortos', fmt(stats?.eliteKilled || 0)],
    ['Blocos de redstone colocados', fmt(stats?.redstonePlaced || 0)],
    ['Plantações colhidas', fmt(stats?.cropsHarvested || 0)],
    ['Bancada de Armeiro criada', stats?.gunsmithBenchCrafted ? 'Sim' : 'Não'],
  ];

  return (
    <>
      <div style={{ position: 'absolute', left: '50%', top: 8 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Estatísticas e Conquistas" color="#FFFFFF" shadow scale={scale} />
      </div>

      {/* Abas estilo 1.8.9 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 22 * scale,
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 2 * scale,
        }}
      >
        {[
          { id: 'stats', label: 'Geral' },
          { id: 'blocks', label: 'Blocos' },
          { id: 'mobs', label: 'Mobs' },
          { id: 'tech', label: 'Tecnologia' },
          { id: 'achv', label: 'Conquistas' },
        ].map((t) => (
          <JavaButton key={t.id} label={t.label} onClick={() => setTab(t.id)} width={62} />
        ))}
      </div>

      {/* Lista Central Escura Afundada (GuiSlot 1.8.9) */}
      <div
        className="mc-scrollbar"
        style={{
          position: 'absolute',
          left: '50%',
          top: 46 * scale,
          bottom: 34 * scale,
          width: 318 * scale,
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.68)',
          borderTop: `${scale}px solid #000000`,
          borderBottom: `${scale}px solid #282828`,
          boxShadow: `inset 0 ${4 * scale}px ${8 * scale}px rgba(0,0,0,0.85)`,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: `${6 * scale}px`,
          boxSizing: 'border-box',
        }}
      >
        {tab === 'stats' &&
          generalRows.map(([lbl, val], i) => (
            <StatRow key={lbl} label={lbl} value={val} scale={scale} odd={i % 2 === 1} />
          ))}

        {tab === 'blocks' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 * scale }}>
              <GuiText text="Blocos minerados por tipo" color="#A0A0A0" shadow scale={scale} />
              <JavaButton
                label={`Ordem: ${sortAsc ? 'Menor' : 'Maior'}`}
                onClick={() => setSortAsc(!sortAsc)}
                width={90}
              />
            </div>
            {sortedBlockTypes.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 20 * scale }}>
                <GuiText text="Nenhum bloco minerado ainda." color="#808080" shadow scale={scale} />
              </div>
            ) : (
              sortedBlockTypes.map(([type, count], i) => (
                <StatRow key={type} label={type} value={fmt(count)} scale={scale} odd={i % 2 === 1} />
              ))
            )}
          </>
        )}

        {tab === 'mobs' && (
          <>
            <div style={{ marginBottom: 4 * scale }}>
              <GuiText text="Mobs derrotados por tipo" color="#A0A0A0" shadow scale={scale} />
            </div>
            {sortedMobTypes.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 20 * scale }}>
                <GuiText text="Nenhum mob derrotado ainda." color="#808080" shadow scale={scale} />
              </div>
            ) : (
              sortedMobTypes.map(([type, count], i) => (
                <StatRow key={type} label={type} value={fmt(count)} scale={scale} odd={i % 2 === 1} />
              ))
            )}
          </>
        )}

        {tab === 'tech' &&
          techRows.map(([lbl, val], i) => (
            <StatRow key={lbl} label={lbl} value={val} scale={scale} odd={i % 2 === 1} />
          ))}

        {tab === 'achv' && (
          <div>
            <div style={{ marginBottom: 6 * scale, textAlign: 'center' }}>
              <GuiText
                text={`Conquistas desbloqueadas: ${getAchievementProgress(achievements || { unlocked: [] }).unlocked} / ${ACHIEVEMENTS.length}`}
                color="#FFFF55"
                shadow
                scale={scale}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 * scale }}>
              {ACHIEVEMENTS.map((a) => {
                const unlocked = (achievements?.unlocked || []).includes(a.id);
                return (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: `${4 * scale}px ${6 * scale}px`,
                      background: unlocked ? 'rgba(60, 50, 10, 0.55)' : 'rgba(20, 20, 20, 0.55)',
                      border: `${scale}px solid ${unlocked ? '#AA8800' : '#373737'}`,
                    }}
                  >
                    <div>
                      <GuiText text={a.name} color={unlocked ? '#FFFF55' : '#808080'} shadow scale={scale} />
                      <div style={{ marginTop: 2 * scale }}>
                        <GuiText text={a.desc} color={unlocked ? '#CCCCCC' : '#555555'} shadow scale={scale} />
                      </div>
                    </div>
                    <GuiText text={unlocked ? 'Desbloqueada' : 'Bloqueada'} color={unlocked ? '#55FF55' : '#555555'} shadow scale={scale} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <GuiButton x={-100} y={guiHeight - 28} width={200} label="Concluído" onClick={onClose} />
    </>
  );
}

export default function StatsScreen(props) {
  if (!props.stats) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <GuiScreen background="dirt">
        <StatsContent {...props} />
      </GuiScreen>
    </div>
  );
}