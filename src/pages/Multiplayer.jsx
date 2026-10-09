// Tela Multijogador — PRD 19 RF-023 (Java 1.8.9 style)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveUser } from '@/game/guestIdentity';
import { roomManager } from '@/game/net/roomManager';
import { BUILD_VERSION } from '@/game/constants';
import LobbyChat from '@/components/game/LobbyChat';
import { GuiScreen, GuiButton, GuiText, GuiList, useGui } from '@/components/java';

function PingBars({ scale }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1 * scale, height: 10 * scale }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          width: 2 * scale, height: i * 2 * scale,
          background: i <= 3 ? '#55FF55' : '#555555',
        }} />
      ))}
    </div>
  );
}

function MultiplayerContent({ user }) {
  const navigate = useNavigate();
  const { guiHeight, scale } = useGui();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(-1);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [favorites, setFavorites] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { const list = await roomManager.listOpenRooms(); setRooms(list); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const unsub = roomManager.subscribeToRooms(() => refresh());
    const interval = setInterval(refresh, 10000);
    try { setFavorites(JSON.parse(localStorage.getItem('mc_favorites') || '[]')); } catch {}
    return () => { unsub(); clearInterval(interval); };
  }, [refresh]);

  const handleJoin = () => {
    if (selected < 0 || !rooms[selected]) return;
    const room = rooms[selected];
    if (room.buildVersion && room.buildVersion !== BUILD_VERSION) return;
    if (room.playerCount >= room.maxPlayers) return;
    navigate(`/play/${room.worldId}?room=${room.id}`);
  };

  const handleCodeJoin = async () => {
    if (!code.trim()) return;
    setError(null);
    try {
      const room = await roomManager.findByCode(code);
      if (!room) { setError('Nenhum mundo encontrado.'); return; }
      navigate(`/play/${room.worldId}?room=${room.id}`);
    } catch { setError('Erro ao buscar código.'); }
  };

  const handleFavorite = () => {
    if (selected < 0 || !rooms[selected]) return;
    const worldId = rooms[selected].worldId;
    const newFav = favorites.includes(worldId)
      ? favorites.filter(id => id !== worldId)
      : [...favorites, worldId];
    setFavorites(newFav);
    localStorage.setItem('mc_favorites', JSON.stringify(newFav));
  };

  const handleRemove = () => {
    if (selected < 0 || !rooms[selected]) return;
    const worldId = rooms[selected].worldId;
    const newFav = favorites.filter(id => id !== worldId);
    setFavorites(newFav);
    localStorage.setItem('mc_favorites', JSON.stringify(newFav));
  };

  const renderRoom = (room, index, isSelected, scale) => {
    const isFull = room.playerCount >= room.maxPlayers;
    const versionMismatch = room.buildVersion && room.buildVersion !== BUILD_VERSION;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 * scale, padding: `${2 * scale}px ${4 * scale}px`, height: '100%' }}>
        {/* Icon */}
        <div style={{ width: 20 * scale, height: 20 * scale, background: '#404040', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GuiText text="⛏" color="#FFFFFF" scale={scale} />
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <GuiText text={favorites.includes(room.worldId) ? `★ ${room.worldName}` : room.worldName} color={isSelected ? '#FFFFFF' : '#E0E0E0'} shadow scale={scale} />
          <GuiText text={room.motd ? room.motd.replace(/\u00a7[0-9a-fklmnor]/g, '') : room.hostName} color="#808080" shadow scale={scale} />
        </div>
        {/* Players */}
        <GuiText text={`${room.playerCount}/${room.maxPlayers}`} color="#808080" shadow scale={scale} />
        {/* Ping */}
        <PingBars scale={scale} />
        {/* Status */}
        {(isFull || versionMismatch) && (
          <GuiText text={isFull ? 'Cheio' : 'Versão'} color="#FF5555" shadow scale={scale} />
        )}
      </div>
    );
  };

  const listTop = 32;
  const listHeight = guiHeight - 64 - listTop;

  return (
    <>
      {/* Title */}
      <div style={{ position: 'absolute', left: '50%', top: 8 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Jogar multijogador" color="#FFFFFF" shadow scale={scale} />
      </div>

      {/* Room list */}
      <GuiList
        x={-110} y={listTop} width={220} height={listHeight}
        items={rooms}
        selectedIndex={selected}
        onSelect={setSelected}
        onDoubleClick={handleJoin}
        renderItem={renderRoom}
        rowHeight={36}
      />

      {loading && rooms.length === 0 && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
          <GuiText text="Procurando mundos na rede..." color="#808080" shadow scale={scale} />
        </div>
      )}

      {!loading && rooms.length === 0 && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
          <GuiText text="Nenhum mundo aberto" color="#FFFFFF" shadow scale={scale} />
        </div>
      )}

      {/* Top buttons */}
      <GuiButton x={-154} y={guiHeight - 52} width={100} label="Entrar no servidor" onClick={handleJoin} disabled={selected < 0} />
      <GuiButton x={-50} y={guiHeight - 52} width={100} label="Conexão direta" onClick={() => setShowCode(true)} />
      <GuiButton x={54} y={guiHeight - 52} width={100} label="Adicionar servidor" onClick={handleFavorite} disabled={selected < 0} />

      {/* Bottom buttons */}
      <GuiButton x={-154} y={guiHeight - 28} width={70} label="Editar" disabled={selected < 0} />
      <GuiButton x={-74} y={guiHeight - 28} width={70} label="Remover" onClick={handleRemove} disabled={selected < 0} />
      <GuiButton x={4} y={guiHeight - 28} width={70} label="Atualizar" onClick={refresh} />
      <GuiButton x={80} y={guiHeight - 28} width={75} label="Cancelar" onClick={() => navigate('/')} />

      {/* Code input dialog */}
      {showCode && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', zIndex: 100, pointerEvents: 'auto' }}>
          <div style={{ background: '#000000', border: `${2 * scale}px solid #FFFFFF`, padding: 16 * scale, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 * scale, width: 220 * scale }}>
            <GuiText text="Conexão direta" color="#FFFFFF" shadow scale={scale} />
            <GuiText text="Digite o código numérico da sala:" color="#A0A0A0" shadow scale={scale} />
            
            <input
              type="text"
              autoFocus
              inputMode="numeric"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter') handleCodeJoin(); if (e.key === 'Escape') setShowCode(false); }}
              placeholder="000000"
              style={{
                width: 140 * scale,
                height: 22 * scale,
                background: '#101010',
                border: `${scale}px solid #A0A0A0`,
                color: '#55FF55',
                textAlign: 'center',
                fontSize: 10 * scale,
                fontFamily: 'monospace',
                fontWeight: 'bold',
                letterSpacing: 2 * scale,
                outline: 'none',
              }}
            />

            {error && <GuiText text={error} color="#FF5555" shadow scale={scale} />}

            <div style={{ display: 'flex', gap: 6 * scale, marginTop: 4 * scale, width: '100%', justifyContent: 'center' }}>
              <GuiButton x={0} y={0} width={90} label="Entrar" onClick={handleCodeJoin} disabled={code.length < 4} />
              <GuiButton x={0} y={0} width={90} label="Cancelar" onClick={() => { setShowCode(false); setError(null); }} />
            </div>
          </div>
        </div>
      )}

      {/* Lobby chat */}
      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 250 * scale, maxHeight: 150 * scale, overflow: 'hidden' }}>
        <LobbyChat user={user} />
      </div>
    </>
  );
}

export default function Multiplayer() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    (async () => {
      try { const { user: u } = await resolveUser(); setUser(u); } catch {}
    })();
  }, []);
  if (!user) return <GuiScreen><div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}><GuiText text="Carregando..." color="#FFFFFF" shadow /></div></GuiScreen>;
  return <GuiScreen><MultiplayerContent user={user} /></GuiScreen>;
}