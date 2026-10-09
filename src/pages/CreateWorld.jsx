import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveUser } from '@/game/guestIdentity';
import { createWorld } from '@/game/save';
import { seedFromString } from '@/game/prng';
import { GuiScreen, GuiButton, GuiText, GuiTextField, useGui } from '@/components/java';

const GAME_MODES = [
  { value: 'survival', label: 'Sobrevivência', desc: 'Explore o mundo, colete recursos e sobreviva.' },
  { value: 'creative', label: 'Criativo', desc: 'Recursos ilimitados, voo livre, sem perigo.' },
  { value: 'adventure', label: 'Aventura', desc: 'Quebra de blocos apenas com ferramentas.' },
  { value: 'hardcore', label: 'Hardcore', desc: 'Sobrevivência com uma vida apenas (difícil).' },
];

const WORLD_TYPES = [
  { value: 'default', label: 'Padrão' },
  { value: 'large_biomes', label: 'Biomas grandes' },
  { value: 'amplified', label: 'Amplificado' },
  { value: 'superflat', label: 'Superplano' },
];

function CreateWorldContent({ user }) {
  const navigate = useNavigate();
  const { guiHeight, scale } = useGui();
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const [gameModeIndex, setGameModeIndex] = useState(0);
  const [worldTypeIndex, setWorldTypeIndex] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [generateStructures, setGenerateStructures] = useState(true);
  const [allowCommands, setAllowCommands] = useState(true);
  const [bonusChest, setBonusChest] = useState(false);
  const [creating, setCreating] = useState(false);

  const gm = GAME_MODES[gameModeIndex];
  const wt = WORLD_TYPES[worldTypeIndex];

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const seedVal = seedFromString(seed);
      const isFlat = wt.value === 'superflat';
      const genParams = isFlat ? { superflatPreset: 'lab' } : { worldType: wt.value };
      const gameRules = isFlat ? JSON.stringify({ doDaylightCycle: false, doMobSpawning: false, doWeatherCycle: false }) : '{}';
      const worldTime = isFlat ? 6000 : 0;
      const w = await createWorld({
        name: name.trim(), seed: seedVal, mapType: isFlat ? 'superflat' : 'open_world',
        gameMode: gm.value, allowCommands, ownerId: user.id,
        genParams: JSON.stringify(genParams), generateStructures, bonusChest,
        gameRules, worldTime,
      });
      navigate(`/play/${w.id}`);
    } catch (e) { console.error(e); alert('Erro ao criar mundo: ' + e.message); }
    setCreating(false);
  };

  const cycleGameMode = () => setGameModeIndex(i => (i + 1) % GAME_MODES.length);
  const cycleWorldType = () => setWorldTypeIndex(i => (i + 1) % WORLD_TYPES.length);

  if (showMore) {
    return (
      <>
        <div style={{ position: 'absolute', left: '50%', top: 8 * scale, transform: 'translateX(-50%)' }}>
          <GuiText text="Mais opções de mundo" color="#FFFFFF" shadow scale={scale} />
        </div>

        {/* Seed field */}
        <div style={{ position: 'absolute', left: '50%', top: 40 * scale, transform: 'translateX(-50%)' }}>
          <GuiTextField x={-100} y={40} width={200} value={seed} onChange={setSeed} placeholder="Semente" />
        </div>

        {/* Options as buttons */}
        <GuiButton x={-155} y={80} width={150} label={`Gerar estruturas: ${generateStructures ? 'Sim' : 'Não'}`} onClick={() => setGenerateStructures(s => !s)} />
        <GuiButton x={5} y={80} width={150} label={`Tipo de mundo: ${wt.label}`} onClick={cycleWorldType} />
        <GuiButton x={-155} y={104} width={150} label={`Permitir comandos: ${allowCommands ? 'Sim' : 'Não'}`} onClick={() => setAllowCommands(s => !s)} />
        <GuiButton x={5} y={104} width={150} label={`Baú bônus: ${bonusChest ? 'Sim' : 'Não'}`} onClick={() => setBonusChest(s => !s)} />

        {/* Back to basic */}
        <GuiButton x={-155} y={128} width={150} label="Voltar" onClick={() => setShowMore(false)} />
        <GuiButton x={5} y={128} width={150} label="Criar novo mundo" onClick={handleCreate} disabled={!name.trim() || creating} />

        <GuiButton x={-100} y={guiHeight - 28} width={200} label="Pronto" onClick={handleCreate} disabled={!name.trim() || creating} />
      </>
    );
  }

  return (
    <>
      <div style={{ position: 'absolute', left: '50%', top: 8 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Criar novo mundo" color="#FFFFFF" shadow scale={scale} />
      </div>

      {/* Name field */}
      <GuiTextField x={-100} y={60} width={200} value={name} onChange={setName} placeholder="Nome do mundo" autoFocus />
      <div style={{ position: 'absolute', left: '50%', top: 84 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Será salvo em: " color="#808080" shadow scale={scale} />
      </div>

      {/* Game mode button + description */}
      <GuiButton x={-75} y={115} width={150} label={`Modo de jogo: ${gm.label}`} onClick={cycleGameMode} />
      <div style={{ position: 'absolute', left: '50%', top: 138 * scale, transform: 'translateX(-50%)', maxWidth: 280 * scale, textAlign: 'center' }}>
        <GuiText text={gm.desc} color="#808080" shadow scale={scale} />
      </div>

      {/* More options */}
      <GuiButton x={-75} y={187} width={150} label="Mais opções de mundo..." onClick={() => setShowMore(true)} />

      {/* Create / Cancel */}
      <GuiButton x={-155} y={guiHeight - 28} width={150} label="Criar novo mundo" onClick={handleCreate} disabled={!name.trim() || creating} />
      <GuiButton x={5} y={guiHeight - 28} width={150} label="Cancelar" onClick={() => navigate('/singleplayer')} />
    </>
  );
}

export default function CreateWorld() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  React.useEffect(() => {
    (async () => {
      try { const { user: u } = await resolveUser(); setUser(u); } catch { navigate('/'); }
    })();
  }, []);
  if (!user) return <GuiScreen><div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}><GuiText text="Carregando..." color="#FFFFFF" shadow /></div></GuiScreen>;
  return <GuiScreen><CreateWorldContent user={user} /></GuiScreen>;
}