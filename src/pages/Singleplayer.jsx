import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { mindcaveApi } from '@/api/supabaseClient';
import { resolveUser } from '@/game/guestIdentity';
import { listWorlds, deleteWorld, createWorld } from '@/game/save';
import { GuiScreen, GuiButton, GuiText, GuiList, useGui } from '@/components/java';
import { settingsStore } from '@/game/settingsStore';

const GAME_MODES = {
  creative: 'Criativo', survival: 'Sobrevivência', adventure: 'Aventura', hardcore: 'Hardcore',
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function SingleplayerContent({ user }) {
  const navigate = useNavigate();
  const { guiHeight, scale } = useGui();
  const [worlds, setWorlds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(-1);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let ws = await listWorlds(user.id);
      if (ws.length === 0) {
        // Se ainda não houver nenhum mundo local, cria um mundo inicial com o nome oficial 'Novo Mundo'
        const defaultWorld = await createWorld({
          name: 'Novo Mundo',
          seed: Math.floor(Math.random() * 1000000000),
          mapType: 'open_world',
          gameMode: 'survival',
          allowCommands: true,
          ownerId: user.id,
        });
        ws = [defaultWorld];
      }
      setWorlds(ws.filter(w => w && w.id));
    } catch (e) {
      console.error('[Singleplayer] Failed to load worlds:', e);
      setWorlds([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-selecionar o primeiro mundo quando a lista carrega
  useEffect(() => {
    if (selected < 0 && worlds.length > 0) setSelected(0);
  }, [worlds, selected]);

  const listTop = 32;
  const listHeight = guiHeight - 64 - listTop;

  const handlePlay = () => {
    if (selected < 0 || !worlds[selected]) return;
    navigate(`/play/${worlds[selected].id}`);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteWorld(deleteConfirm.id);
    setDeleteConfirm(null);
    setSelected(-1);
    await refresh();
  };

  const handleRecreate = async () => {
    if (selected < 0 || !worlds[selected]) return;
    const w = worlds[selected];
    const nw = await createWorld({
      name: w.name + ' (cópia)', seed: w.seed, mapType: w.mapType,
      gameMode: w.gameMode, allowCommands: w.allowCommands, ownerId: user.id,
      genParams: w.genParams, generateStructures: w.generateStructures, bonusChest: w.bonusChest,
    });
    navigate(`/play/${nw.id}`);
  };

  const renderWorld = (w, index, isSelected, scale) => (
    <div style={{ padding: `${2 * scale}px ${4 * scale}px`, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', pointerEvents: 'none' }}>
      <GuiText text={w.name} color="#FFFFFF" shadow scale={scale} />
      <GuiText text={`${(w.id || '???').slice(0, 12)} · ${formatDate(w.lastPlayedAt)}`} color="#808080" shadow scale={scale} />
      <GuiText text={`${GAME_MODES[w.gameMode] || w.gameMode}, ${w.mapType === 'superflat' ? 'Plano' : 'Aberto'}, seed ${w.seed}`} color="#808080" shadow scale={scale} />
    </div>
  );

  return (
    <>
      <div style={{ position: 'absolute', left: '50%', top: 8 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Selecionar mundo" color="#FFFFFF" shadow scale={scale} />
      </div>

      <GuiList
        x={-110} y={listTop} width={220} height={listHeight}
        items={worlds}
        selectedIndex={selected}
        onSelect={setSelected}
        onDoubleClick={handlePlay}
        renderItem={renderWorld}
        rowHeight={36}
      />

      {/* Top row buttons */}
      <GuiButton x={-154} y={guiHeight - 52} width={150} label="Jogar mundo selecionado" onClick={handlePlay} disabled={selected < 0} />
      <GuiButton x={4} y={guiHeight - 52} width={150} label="Criar novo mundo" onClick={() => navigate('/create-world')} />

      {/* Bottom row buttons */}
      <GuiButton x={-154} y={guiHeight - 28} width={72} label="Renomear" disabled={selected < 0} />
      <GuiButton x={-76} y={guiHeight - 28} width={72} label="Apagar" onClick={() => selected >= 0 && setDeleteConfirm(worlds[selected])} disabled={selected < 0} />
      <GuiButton x={4} y={guiHeight - 28} width={72} label="Recriar" onClick={handleRecreate} disabled={selected < 0} />
      <GuiButton x={82} y={guiHeight - 28} width={72} label="Cancelar" onClick={() => navigate('/')} />

      {loading && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
          <GuiText text="Carregando mundos..." color="#FFFFFF" shadow scale={scale} />
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', pointerEvents: 'auto' }}>
          <div style={{ textAlign: 'center', maxWidth: 300 * scale }}>
            <div style={{ marginBottom: 8 * scale }}>
              <GuiText text="Tem certeza que deseja apagar este mundo?" color="#FFFFFF" shadow scale={scale} />
            </div>
            <div style={{ marginBottom: 8 * scale }}>
              <GuiText text={`'${deleteConfirm.name}' será perdido para sempre!`} color="#FFFFFF" shadow scale={scale} />
            </div>
            <div style={{ display: 'flex', gap: 4 * scale, justifyContent: 'center' }}>
              <GuiButton x={0} y={0} width={100} label="Apagar" onClick={handleDelete} />
              <GuiButton x={0} y={0} width={100} label="Cancelar" onClick={() => setDeleteConfirm(null)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Singleplayer() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    (async () => {
      try { const { user: u } = await resolveUser(); setUser(u); } catch {}
    })();
  }, []);
  if (!user) return <GuiScreen><div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}><GuiText text="Carregando..." color="#FFFFFF" shadow /></div></GuiScreen>;
  return <GuiScreen><SingleplayerContent user={user} /></GuiScreen>;
}