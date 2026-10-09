import React, { useState, useEffect } from "react";
import SettingsLayout from "./SettingsLayout";
import { mindcaveApi } from "@/api/supabaseClient";
import { OptionButton, OptionSlider, OptionToggle } from "./OptionControls";

const DEFAULT_RULES = {
  doDaylightCycle: true, doMobSpawning: true, doMobLoot: true, doTileDrops: true,
  doEntityDrops: true, doFireTick: true, keepInventory: false, mobGriefing: true,
  naturalRegeneration: true, randomTickSpeed: 3, showDeathMessages: true,
  sendCommandFeedback: true, commandBlockOutput: true, logAdminCommands: true,
  reducedDebugInfo: false,
};
const DEFAULT_MC_RULES = { gunsEnabled: true, techZombies: true, techZombieChance: 15, friendlyFire: true, explosionsBreakBlocks: true, devTools: true };

function parseJSON(s, fallback) { try { return { ...fallback, ...JSON.parse(s || '{}') }; } catch { return { ...fallback }; } }

export default function WorldSettingsPage({ onBack, worldId }) {
  const [world, setWorld] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveTimer, setSaveTimer] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const w = await mindcaveApi.entities.World.get(worldId);
        setWorld(w);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [worldId]);

  const update = (field, value) => {
    const nw = { ...world, [field]: value };
    setWorld(nw);
    clearTimeout(saveTimer);
    setSaveTimer(setTimeout(async () => {
      try { await mindcaveApi.entities.World.update(worldId, { [field]: value }); } catch (e) {}
    }, 1000));
  };

  const updateRules = (key, value, field = 'gameRules', defaults = DEFAULT_RULES) => {
    const rules = parseJSON(world[field], defaults);
    rules[key] = value;
    update(field, JSON.stringify(rules));
  };

  if (loading) return <SettingsLayout title="Configurações do mundo"><div className="text-center text-muted-foreground py-8">Carregando...</div></SettingsLayout>;
  if (!world) return <SettingsLayout title="Configurações do mundo"><div className="text-center text-muted-foreground py-8">Mundo não encontrado.</div></SettingsLayout>;

  const rules = parseJSON(world.gameRules, DEFAULT_RULES);
  const mcRules = parseJSON(world.mcGameRules, DEFAULT_MC_RULES);
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
            <OptionToggle label="Armas de fogo (gunsEnabled)" value={!!mcRules.gunsEnabled} onChange={v => updateRules('gunsEnabled', v, 'mcGameRules', DEFAULT_MC_RULES)} perfImpact="none" />
            <OptionToggle label="Zumbis tecnológicos" value={!!mcRules.techZombies} onChange={v => updateRules('techZombies', v, 'mcGameRules', DEFAULT_MC_RULES)} perfImpact="none" />
            <OptionSlider label="Chance de zumbi tech" value={mcRules.techZombieChance ?? 15} min={0} max={100} step={5}
              format={v => `${v}%`} onChange={v => updateRules('techZombieChance', v, 'mcGameRules', DEFAULT_MC_RULES)} perfImpact="none" />
            <OptionToggle label="Fogo amigo" value={!!mcRules.friendlyFire} onChange={v => updateRules('friendlyFire', v, 'mcGameRules', DEFAULT_MC_RULES)} perfImpact="none" />
            <OptionToggle label="Explosões quebram blocos" value={!!mcRules.explosionsBreakBlocks} onChange={v => updateRules('explosionsBreakBlocks', v, 'mcGameRules', DEFAULT_MC_RULES)} perfImpact="none" />
            <OptionToggle label="Ferramentas de dev (devTools)" value={!!mcRules.devTools} onChange={v => updateRules('devTools', v, 'mcGameRules', DEFAULT_MC_RULES)} perfImpact="none" />
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