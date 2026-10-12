import React, { useState, useEffect, useRef } from "react";
import SettingsLayout from "./SettingsLayout";
import { getWorld, updateWorld } from "@/game/save";
import { DEFAULT_GAME_RULES } from "@/game/constants";
import { OptionButton, OptionSlider, OptionToggle } from "./OptionControls";

// Defaults da página = regras do motor (constants) + chaves que só existem aqui
const PAGE_RULE_DEFAULTS = {
  ...DEFAULT_GAME_RULES,
  randomTickSpeed: 3, showDeathMessages: true, sendCommandFeedback: true,
  commandBlockOutput: true, logAdminCommands: true, reducedDebugInfo: false, devTools: true,
};

function parseJSON(s, fallback) { try { return { ...fallback, ...JSON.parse(s || '{}') }; } catch { return { ...fallback }; } }

export default function WorldSettingsPage({ onBack, worldId }) {
  const [world, setWorld] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const saveTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const w = await getWorld(worldId);
        if (!cancelled) {
          if (w) setWorld(w);
          else setLoadError('Mundo não encontrado.');
        }
      } catch (e) { if (!cancelled) setLoadError(`Falha ao ler o mundo: ${e.message}`); }
      if (!cancelled) setLoading(false);
    })();
    // Desmonta com salvamento pendente: fecha a tela logo após um toque, não perde o ajuste
    return () => {
      cancelled = true;
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current.fn?.();
      }
    };
  }, [worldId]);

  const update = (field, value) => {
    const nw = { ...world, [field]: value };
    setWorld(nw);
    if (saveTimer.current) clearTimeout(saveTimer.current.id);
    const job = async () => { try { await updateWorld(worldId, { [field]: value }); } catch (e) { console.warn('[WorldSettings]', e); } };
    saveTimer.current = { id: setTimeout(job, 1000), fn: job };
  };

  const updateRules = (key, value) => {
    const rules = parseJSON(world.gameRules, PAGE_RULE_DEFAULTS);
    rules[key] = value;
    update('gameRules', JSON.stringify(rules));
  };

  if (loading) return <SettingsLayout title="Configurações do mundo"><div className="text-center text-muted-foreground py-8">Carregando...</div></SettingsLayout>;
  if (loadError) return <SettingsLayout title="Configurações do mundo" onBack={onBack}><div className="text-center text-red-400 py-8">{loadError}</div></SettingsLayout>;
  if (!world) return <SettingsLayout title="Configurações do mundo"><div className="text-center text-muted-foreground py-8">Mundo não encontrado.</div></SettingsLayout>;

  const rules = parseJSON(world.gameRules, PAGE_RULE_DEFAULTS);
  const isHost = true; // simplificado: quem joga é host

  return (
    <SettingsLayout title="Configurações do mundo" onBack={onBack}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dificuldade</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <OptionButton label="Dificuldade" value={world.difficulty || 'normal'} options={[
              { value: 'peaceful', label: 'Pacífico' }, { value: 'easy', label: 'Fácil' },
              { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Difícil' }
            ]} onChange={v => update('difficulty', v)} tooltip="Host apenas. Efeitos reais no PRD 05/08." perfImpact="none" disabled={!isHost} disabledReason="Apenas o host" />
            <OptionToggle label="Travar dificuldade" value={!!world.lockDifficulty} onChange={v => update('lockDifficulty', v)} tooltip="Impede mudança de dificuldade durante o jogo." perfImpact="none" />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Regras do jogo (1.8.9)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries({
              doDaylightCycle: 'Ciclo dia/noite avança', doMobSpawning: 'Mobs nascem naturalmente',
              doMobLoot: 'Mobs dropam itens', doTileDrops: 'Blocos quebrados dropam',
              doEntityDrops: 'Entidades não-mob dropam', doFireTick: 'Fogo se espalha/apaga',
              keepInventory: 'Mantém inventário ao morrer', mobGriefing: 'Creepers/endermen destroem',
              naturalRegeneration: 'Regeneração por fome', showDeathMessages: 'Mensagens de morte no chat',
              sendCommandFeedback: 'Retorno de comandos', commandBlockOutput: 'Saída de blocos de comando',
              logAdminCommands: 'Registrar comandos de operador', reducedDebugInfo: 'Força F3 reduzido',
            }).map(([k, label]) => (
              <OptionToggle key={k} label={label} value={!!rules[k]} onChange={v => updateRules(k, v)} perfImpact="none" />
            ))}
            <OptionSlider label="randomTickSpeed" value={rules.randomTickSpeed ?? 3} min={0} max={20} step={1}
              format={v => `${v}`} onChange={v => updateRules('randomTickSpeed', v)} tooltip="Blocos por seção por tick." perfImpact="none" />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Regras Mind Cave</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <OptionToggle label="Armas de fogo (gunsEnabled)" value={rules.gunsEnabled !== false} onChange={v => updateRules('gunsEnabled', v)} perfImpact="none" />
            <OptionToggle label="Zumbis tecnológicos" value={rules.techZombies !== false} onChange={v => updateRules('techZombies', v)} perfImpact="none" />
            <OptionSlider label="Chance de zumbi tech" value={Math.round((rules.techZombieChance ?? 0.15) * 100)} min={0} max={100} step={5}
              format={v => `${v}%`} onChange={v => updateRules('techZombieChance', v / 100)} perfImpact="none" />
            <OptionToggle label="Fogo amigo" value={rules.friendlyFire !== false} onChange={v => updateRules('friendlyFire', v)} perfImpact="none" />
            <OptionToggle label="Explosões quebram blocos" value={rules.explosionsBreakBlocks !== false} onChange={v => updateRules('explosionsBreakBlocks', v)} perfImpact="none" />
            <OptionToggle label="Ferramentas de dev (devTools)" value={rules.devTools !== false} onChange={v => updateRules('devTools', v)} perfImpact="none" />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rede (host)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <OptionSlider label="Máximo de jogadores" value={world.maxPlayers ?? 8} min={1} max={16} step={1}
              onChange={v => update('maxPlayers', v)} perfImpact="none" />
            <OptionSlider label="Dist. visão máx. convidados" value={world.guestRenderDistance ?? 12} min={2} max={32} step={1}
              format={v => `${v} chunks`} onChange={v => update('guestRenderDistance', v)} tooltip="Limita o raio que o servidor envia aos convidados." perfImpact="none" />
            <OptionSlider label="Distância de simulação" value={world.simulationDistance ?? 6} min={2} max={16} step={1}
              format={v => `${v} chunks`} onChange={v => update('simulationDistance', v)} tooltip="Raio em que o servidor faz ticks de entidades/blocos." perfImpact="none" />
            <OptionToggle label="PvP" value={world.pvp ?? true} onChange={v => update('pvp', v)} perfImpact="none" />
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}