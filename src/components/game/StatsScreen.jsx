import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ACHIEVEMENTS, getAchievementProgress } from '@/game/achievements';

function StatRow({ label, value }) {
  return (
    <div className="flex justify-between py-1 border-b border-white/10 text-sm">
      <span className="text-white/70">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  );
}

export default function StatsScreen({ stats, achievements, onClose }) {
  const [tab, setTab] = useState('stats');
  const [sortAsc, setSortAsc] = useState(false);

  if (!stats) return null;

  const fmt = (n) => {
    if (typeof n !== 'number') return n || '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const fmtTime = (ticks) => {
    const s = Math.floor(ticks / 20);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const fmtDist = (blocks) => {
    if (blocks >= 1000) return (blocks / 1000).toFixed(1) + ' km';
    return Math.floor(blocks) + ' m';
  };

  const sortedBlockTypes = Object.entries(stats.blocksMinedByType || {})
    .sort(([, a], [, b]) => sortAsc ? a - b : b - a);

  const sortedMobTypes = Object.entries(stats.mobsKilledByType || {})
    .sort(([, a], [, b]) => sortAsc ? a - b : b - a);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div className="bg-slate-900 border border-white/20 rounded-lg w-[700px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/20">
          <h2 className="text-xl font-bold text-white">Estatísticas e Conquistas</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex gap-1 p-2 border-b border-white/10">
          {[
            { id: 'stats', label: 'Geral' },
            { id: 'blocks', label: 'Blocos' },
            { id: 'mobs', label: 'Mobs' },
            { id: 'tech', label: 'Tecnologia' },
            { id: 'achv', label: 'Conquistas' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded text-sm font-medium ${tab === t.id ? 'bg-green-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'stats' && (
            <div className="space-y-1">
              <StatRow label="Tempo jogado" value={fmtTime(stats.playTime)} />
              <StatRow label="Distância andada" value={fmtDist(stats.distanceWalked)} />
              <StatRow label="Distância correndo" value={fmtDist(stats.distanceSprinted)} />
              <StatRow label="Distância voando" value={fmtDist(stats.distanceFlown)} />
              <StatRow label="Distância em queda" value={fmtDist(stats.distanceFallen)} />
              <StatRow label="Saltos" value={fmt(stats.jumps)} />
              <StatRow label="Blocos minerados" value={fmt(stats.blocksMined)} />
              <StatRow label="Blocos colocados" value={fmt(stats.blocksPlaced)} />
              <StatRow label="Itens criados" value={fmt(stats.itemsCrafted)} />
              <StatRow label="Mobs mortos" value={fmt(stats.mobsKilled)} />
              <StatRow label="Mortes" value={fmt(stats.deaths)} />
              <StatRow label="Dano causado" value={fmt(Math.round(stats.damageDealt))} />
              <StatRow label="Dano sofrido" value={fmt(Math.round(stats.damageTaken))} />
              <StatRow label="Peixes pescados" value={fmt(stats.fishCaught)} />
              <StatRow label="Animais reproduzidos" value={fmt(stats.animalsBred)} />
            </div>
          )}
          {tab === 'blocks' && (
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-white/70 text-sm">Blocos minerados por tipo</span>
                <button onClick={() => setSortAsc(!sortAsc)} className="text-xs text-green-400 hover:text-green-300">
                  Ordenar: {sortAsc ? 'Menor' : 'Maior'}
                </button>
              </div>
              {sortedBlockTypes.length === 0 ? (
                <p className="text-white/40 text-sm">Nenhum bloco minerado ainda.</p>
              ) : (
                <div className="space-y-1">
                  {sortedBlockTypes.map(([type, count]) => (
                    <StatRow key={type} label={type} value={fmt(count)} />
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'mobs' && (
            <div>
              <span className="text-white/70 text-sm">Mobs mortos por tipo</span>
              {sortedMobTypes.length === 0 ? (
                <p className="text-white/40 text-sm mt-2">Nenhum mob morto ainda.</p>
              ) : (
                <div className="space-y-1 mt-2">
                  {sortedMobTypes.map(([type, count]) => (
                    <StatRow key={type} label={type} value={fmt(count)} />
                  ))}
                </div>
              )}
            </div>
          )}
          {tab === 'tech' && (
            <div className="space-y-1">
              <StatRow label="Disparos feitos" value={fmt(stats.shotsFired)} />
              <StatRow label="Tiros na cabeça" value={fmt(stats.headshots)} />
              <StatRow label="Atiradores de Elite mortos" value={fmt(stats.eliteKilled)} />
              <StatRow label="Blocos de redstone colocados" value={fmt(stats.redstonePlaced)} />
              <StatRow label="Plantações colhidas" value={fmt(stats.cropsHarvested)} />
              <StatRow label="Bancada de Armeiro criada" value={stats.gunsmithBenchCrafted ? 'Sim' : 'Não'} />
            </div>
          )}
          {tab === 'achv' && (
            <div>
              <div className="mb-3 text-white/70 text-sm">
                {getAchievementProgress(achievements || { unlocked: [] }).unlocked} / {ACHIEVEMENTS.length} conquistas
              </div>
              <div className="grid grid-cols-1 gap-2">
                {ACHIEVEMENTS.map(a => {
                  const unlocked = (achievements?.unlocked || []).includes(a.id);
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 p-2 rounded border ${unlocked ? 'bg-yellow-900/30 border-yellow-600/50' : 'bg-white/5 border-white/10 opacity-60'}`}
                    >
                      <div className={`text-2xl ${unlocked ? '' : 'grayscale opacity-40'}`}>{a.icon}</div>
                      <div className="flex-1">
                        <div className={`text-sm font-semibold ${unlocked ? 'text-yellow-300' : 'text-white/50'}`}>{a.name}</div>
                        <div className="text-xs text-white/40">{a.desc}</div>
                      </div>
                      {unlocked && <span className="text-yellow-400 text-xs">✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}