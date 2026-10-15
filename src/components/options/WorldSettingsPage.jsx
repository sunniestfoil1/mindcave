import React, { useState, useEffect, useRef } from "react";
import { GuiScreen, GuiButton, GuiText, JavaButton, JavaSlider, useGui } from "@/components/java";
import { getWorld, updateWorld } from "@/game/save";
import { DEFAULT_GAME_RULES } from "@/game/constants";
import { useT } from "@/game/i18n";

// Defaults da página = regras do motor (constants) + chaves que só existem aqui
const PAGE_RULE_DEFAULTS = {
  ...DEFAULT_GAME_RULES,
  randomTickSpeed: 3, showDeathMessages: true, sendCommandFeedback: true,
  commandBlockOutput: true, logAdminCommands: true, reducedDebugInfo: false, devTools: true,
};

function parseJSON(s, fallback) {
  try { return { ...fallback, ...JSON.parse(s || '{}') }; } catch { return { ...fallback }; }
}

const DIFFICULTY_OPTIONS = [
  { value: 'peaceful', label: 'Pacífico' },
  { value: 'easy', label: 'Fácil' },
  { value: 'normal', label: 'Normal' },
  { value: 'hard', label: 'Difícil' },
];

function WorldSettingsContent({ onBack, worldId }) {
  const { guiHeight, scale } = useGui();
  const t = useT();
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
      } catch (e) {
        if (!cancelled) setLoadError(`Falha ao ler o mundo: ${e.message}`);
      }
      if (!cancelled) setLoading(false);
    })();

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
    const job = async () => {
      try { await updateWorld(worldId, { [field]: value }); } catch (e) { console.warn('[WorldSettings]', e); }
    };
    saveTimer.current = { id: setTimeout(job, 1000), fn: job };
  };

  const updateRules = (key, value) => {
    const currentRules = parseJSON(world.gameRules, PAGE_RULE_DEFAULTS);
    currentRules[key] = value;
    update('gameRules', JSON.stringify(currentRules));
  };

  if (loading) {
    return (
      <div style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%, -50%)' }}>
        <GuiText text="Carregando configurações do mundo..." color="#A0A0A0" shadow scale={scale} />
      </div>
    );
  }

  if (loadError || !world) {
    return (
      <>
        <div style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%, -50%)' }}>
          <GuiText text={loadError || 'Mundo não encontrado.'} color="#FF5555" shadow scale={scale} />
        </div>
        <GuiButton x={-100} y={guiHeight - 28} width={200} label={t('gui.done')} onClick={onBack} />
      </>
    );
  }

  const rules = parseJSON(world.gameRules, PAGE_RULE_DEFAULTS);
  const isHost = true;

  const toggleRule = (key) => {
    updateRules(key, !rules[key]);
  };

  return (
    <>
      {/* Título */}
      <div style={{ position: 'absolute', left: '50%', top: 8 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Configurações do Mundo" color="#FFFFFF" shadow scale={scale} />
      </div>

      {/* Grid de opções rolável clássico 1.8.9 */}
      <div
        className="mc-scrollbar"
        style={{
          position: 'absolute',
          left: '50%',
          top: 24 * scale,
          bottom: 34 * scale,
          width: 312 * scale,
          transform: 'translateX(-50%)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 4 * scale,
          boxSizing: 'border-box',
        }}
      >
        {/* Seção 1: Dificuldade */}
        <div style={{ marginBottom: 6 * scale }}>
          <div style={{ marginBottom: 2 * scale, textAlign: 'center' }}>
            <GuiText text="Dificuldade" color="#A0A0A0" shadow scale={scale} />
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${150 * scale}px ${150 * scale}px`,
            gap: `${2 * scale}px`,
            justifyContent: 'center',
          }}>
            <JavaButton
              label="Dificuldade"
              value={world.difficulty || 'normal'}
              options={DIFFICULTY_OPTIONS}
              onChange={v => update('difficulty', v)}
              disabled={!isHost || !!world.lockDifficulty}
              disabledReason={world.lockDifficulty ? 'Travada' : 'Apenas o host'}
              width={150}
            />
            <JavaButton
              label={`Travar Dif.: ${world.lockDifficulty ? 'SIM' : 'NÃO'}`}
              onClick={() => update('lockDifficulty', !world.lockDifficulty)}
              width={150}
            />
          </div>
        </div>

        {/* Seção 2: Regras do Jogo (1.8.9) */}
        <div style={{ marginBottom: 6 * scale }}>
          <div style={{ marginBottom: 2 * scale, textAlign: 'center' }}>
            <GuiText text="Regras do Jogo (Gamerules)" color="#A0A0A0" shadow scale={scale} />
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${150 * scale}px ${150 * scale}px`,
            gap: `${2 * scale}px`,
            justifyContent: 'center',
          }}>
            <JavaButton
              label={`Ciclo Dia/Noite: ${rules.doDaylightCycle ? 'SIM' : 'NÃO'}`}
              onClick={() => toggleRule('doDaylightCycle')}
              width={150}
            />
            <JavaButton
              label={`Spawn Mobs: ${rules.doMobSpawning ? 'SIM' : 'NÃO'}`}
              onClick={() => toggleRule('doMobSpawning')}
              width={150}
            />
            <JavaButton
              label={`Loot de Mobs: ${rules.doMobLoot ? 'SIM' : 'NÃO'}`}
              onClick={() => toggleRule('doMobLoot')}
              width={150}
            />
            <JavaButton
              label={`Drop de Blocos: ${rules.doTileDrops ? 'SIM' : 'NÃO'}`}
              onClick={() => toggleRule('doTileDrops')}
              width={150}
            />
            <JavaButton
              label={`Drop Entidades: ${rules.doEntityDrops ? 'SIM' : 'NÃO'}`}
              onClick={() => toggleRule('doEntityDrops')}
              width={150}
            />
            <JavaButton
              label={`Alastrar Fogo: ${rules.doFireTick ? 'SIM' : 'NÃO'}`}
              onClick={() => toggleRule('doFireTick')}
              width={150}
            />
            <JavaButton
              label={`Manter Inv.: ${rules.keepInventory ? 'SIM' : 'NÃO'}`}
              onClick={() => toggleRule('keepInventory')}
              width={150}
            />
            <JavaButton
              label={`Mob Griefing: ${rules.mobGriefing ? 'SIM' : 'NÃO'}`}
              onClick={() => toggleRule('mobGriefing')}
              width={150}
            />
            <JavaButton
              label={`Regen Natural: ${rules.naturalRegeneration ? 'SIM' : 'NÃO'}`}
              onClick={() => toggleRule('naturalRegeneration')}
              width={150}
            />
            <JavaButton
              label={`Msg de Morte: ${rules.showDeathMessages ? 'SIM' : 'NÃO'}`}
              onClick={() => toggleRule('showDeathMessages')}
              width={150}
            />
            <JavaButton
              label={`Retorno Cmds: ${rules.sendCommandFeedback ? 'SIM' : 'NÃO'}`}
              onClick={() => toggleRule('sendCommandFeedback')}
              width={150}
            />
            <JavaSlider
              label="randomTickSpeed"
              value={rules.randomTickSpeed ?? 3}
              min={0}
              max={20}
              step={1}
              format={v => `${v}`}
              onChange={v => updateRules('randomTickSpeed', v)}
              width={150}
            />
          </div>
        </div>

        {/* Seção 3: Regras Mind Cave */}
        <div style={{ marginBottom: 6 * scale }}>
          <div style={{ marginBottom: 2 * scale, textAlign: 'center' }}>
            <GuiText text="Regras Mind Cave" color="#A0A0A0" shadow scale={scale} />
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${150 * scale}px ${150 * scale}px`,
            gap: `${2 * scale}px`,
            justifyContent: 'center',
          }}>
            <JavaButton
              label={`Armas Fogo: ${rules.gunsEnabled !== false ? 'SIM' : 'NÃO'}`}
              onClick={() => updateRules('gunsEnabled', rules.gunsEnabled === false)}
              width={150}
            />
            <JavaButton
              label={`Zumbi Tech: ${rules.techZombies !== false ? 'SIM' : 'NÃO'}`}
              onClick={() => updateRules('techZombies', rules.techZombies === false)}
              width={150}
            />
            <JavaSlider
              label="Chance Zumbi"
              value={Math.round((rules.techZombieChance ?? 0.15) * 100)}
              min={0}
              max={100}
              step={5}
              format={v => `${v}%`}
              onChange={v => updateRules('techZombieChance', v / 100)}
              width={150}
            />
            <JavaButton
              label={`Fogo Amigo: ${rules.friendlyFire !== false ? 'SIM' : 'NÃO'}`}
              onClick={() => updateRules('friendlyFire', rules.friendlyFire === false)}
              width={150}
            />
            <JavaButton
              label={`Explosão Bloco: ${rules.explosionsBreakBlocks !== false ? 'SIM' : 'NÃO'}`}
              onClick={() => updateRules('explosionsBreakBlocks', rules.explosionsBreakBlocks === false)}
              width={150}
            />
            <JavaButton
              label={`Dev Tools: ${rules.devTools !== false ? 'SIM' : 'NÃO'}`}
              onClick={() => updateRules('devTools', rules.devTools === false)}
              width={150}
            />
          </div>
        </div>

        {/* Seção 4: Rede & Multijogador */}
        <div style={{ marginBottom: 6 * scale }}>
          <div style={{ marginBottom: 2 * scale, textAlign: 'center' }}>
            <GuiText text="Rede (Host)" color="#A0A0A0" shadow scale={scale} />
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `${150 * scale}px ${150 * scale}px`,
            gap: `${2 * scale}px`,
            justifyContent: 'center',
          }}>
            <JavaSlider
              label="Máx Jogadores"
              value={world.maxPlayers ?? 8}
              min={1}
              max={16}
              step={1}
              format={v => `${v}`}
              onChange={v => update('maxPlayers', v)}
              width={150}
            />
            <JavaSlider
              label="Distância Visão"
              value={world.guestRenderDistance ?? 12}
              min={2}
              max={32}
              step={1}
              format={v => `${v} ch`}
              onChange={v => update('guestRenderDistance', v)}
              width={150}
            />
            <JavaSlider
              label="Simulação"
              value={world.simulationDistance ?? 6}
              min={2}
              max={16}
              step={1}
              format={v => `${v} ch`}
              onChange={v => update('simulationDistance', v)}
              width={150}
            />
            <JavaButton
              label={`PvP: ${world.pvp !== false ? 'SIM' : 'NÃO'}`}
              onClick={() => update('pvp', world.pvp === false)}
              width={150}
            />
          </div>
        </div>
      </div>

      {/* Botão Concluído */}
      <GuiButton
        x={-100}
        y={guiHeight - 28}
        width={200}
        label={t('gui.done')}
        onClick={onBack}
      />
    </>
  );
}

export default function WorldSettingsPage({ onBack, worldId }) {
  return (
    <GuiScreen background="dirt">
      <WorldSettingsContent onBack={onBack} worldId={worldId} />
    </GuiScreen>
  );
}