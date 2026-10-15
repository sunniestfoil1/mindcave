import React, { useState, useEffect } from 'react';
import { roomManager } from '@/game/net/roomManager';
import { NetHost } from '@/game/net/netManager';
import { GuiScreen, GuiButton, GuiText, JavaButton, JavaSlider, useGui } from '@/components/java';

const VIS_OPTIONS = [
  { value: 'public', label: 'Público (Lista)' },
  { value: 'code', label: 'Apenas Código' },
  { value: 'private', label: 'Privado' },
];

const GAME_MODES = [
  { value: 'survival', label: 'Sobrevivência' },
  { value: 'creative', label: 'Criativo' },
  { value: 'adventure', label: 'Aventura' },
  { value: 'spectator', label: 'Espectador' },
];

function OpenToLANContent({ engine, world, user, netHost, onNetHostChange, onClose }) {
  const { guiHeight, scale } = useGui();
  const [settings, setSettings] = useState({
    visibility: 'public',
    password: '',
    motd: '§aBem-vindo ao ' + (world?.name || 'Mundo') + '!',
    guestGameMode: world?.gameMode || 'survival',
    allowCommands: false,
    pvp: world?.pvp ?? true,
    maxPlayers: world?.maxPlayers || 8,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [room, setRoom] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (netHost?.room) {
      setRoom(netHost.room);
      setIsOpen(true);
      setCode(netHost.room.code);
      setSettings({
        visibility: netHost.room.visibility,
        password: '',
        motd: netHost.room.motd,
        guestGameMode: netHost.room.guestGameMode,
        allowCommands: netHost.room.allowCommands,
        pvp: netHost.room.pvp,
        maxPlayers: netHost.room.maxPlayers,
      });
    }
  }, [netHost]);

  const handleOpen = async () => {
    setLoading(true);
    try {
      const host = new NetHost({
        engine,
        world,
        user,
        onChatMessage: (msg) => {
          engine.onChatMessage?.(msg);
        },
      });
      const r = await host.start(settings);
      onNetHostChange(host);
      setRoom(r);
      setCode(r.code);
      setIsOpen(true);
      engine.onChatMessage?.({
        type: 'system',
        text: '§aMundo aberto para LAN. Código: §e§l' + r.code,
        timestamp: Date.now(),
      });
      onClose();
    } catch (e) {
      console.error(e);
      engine.onChatMessage?.({
        type: 'system',
        text: '§cErro ao abrir mundo: ' + e.message,
        timestamp: Date.now(),
      });
    }
    setLoading(false);
  };

  const handleCloseRoom = async () => {
    if (!netHost) return;
    setLoading(true);
    try {
      await netHost.close();
      onNetHostChange(null);
      setIsOpen(false);
      setRoom(null);
      engine.onChatMessage?.({
        type: 'system',
        text: '§7Mundo fechado para outros jogadores.',
        timestamp: Date.now(),
      });
      onClose();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleUpdate = async () => {
    if (!room) return;
    setLoading(true);
    try {
      await roomManager.updateSettings(room.id, settings);
      engine.onChatMessage?.({
        type: 'system',
        text: '§7Configurações da sala atualizadas.',
        timestamp: Date.now(),
      });
      onClose();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const update = (key, val) => setSettings((prev) => ({ ...prev, [key]: val }));

  return (
    <>
      <div style={{ position: 'absolute', left: '50%', top: 20 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text={isOpen ? 'Configurações do Mundo LAN' : 'Mundo em Rede Local (LAN)'} color="#FFFFFF" shadow scale={scale} />
      </div>

      <div style={{ position: 'absolute', left: '50%', top: 42 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Configurações para Outros Jogadores" color="#A0A0A0" shadow scale={scale} />
      </div>

      {isOpen && code && (
        <div
          onClick={() => {
            navigator.clipboard?.writeText(code);
            engine.onChatMessage?.({ type: 'system', text: '§7Código copiado: ' + code, timestamp: Date.now() });
          }}
          style={{
            position: 'absolute',
            left: '50%',
            top: 56 * scale,
            transform: 'translateX(-50%)',
            cursor: 'pointer',
          }}
          title="Clique para copiar o código"
        >
          <GuiText text={`Código da Sala: §e${code} §7(Clique para copiar)`} color="#55FF55" shadow scale={scale} />
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 76 * scale,
          width: 310 * scale,
          transform: 'translateX(-50%)',
          display: 'grid',
          gridTemplateColumns: `${150 * scale}px ${150 * scale}px`,
          gap: `${4 * scale}px ${10 * scale}px`,
          justifyContent: 'center',
        }}
      >
        <JavaButton
          label="Modo de Jogo"
          value={settings.guestGameMode}
          options={GAME_MODES}
          onChange={(v) => update('guestGameMode', v)}
          width={150}
        />
        <JavaButton
          label="Permitir Cheats"
          value={!!settings.allowCommands}
          options={[
            { value: true, label: 'Ligado' },
            { value: false, label: 'Desligado' },
          ]}
          onChange={(v) => update('allowCommands', v)}
          width={150}
        />
        <JavaButton
          label="Visibilidade"
          value={settings.visibility}
          options={VIS_OPTIONS}
          onChange={(v) => update('visibility', v)}
          width={150}
        />
        <JavaButton
          label="PvP"
          value={!!settings.pvp}
          options={[
            { value: true, label: 'Ligado' },
            { value: false, label: 'Desligado' },
          ]}
          onChange={(v) => update('pvp', v)}
          width={150}
        />
        <JavaSlider
          label="Máx. Jogadores"
          value={settings.maxPlayers}
          min={2}
          max={16}
          step={1}
          format={(v) => `${v}`}
          onChange={(v) => update('maxPlayers', v)}
          width={150}
        />
      </div>

      {/* Campo MOTD estilo 1.8.9 */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 152 * scale,
          width: 310 * scale,
          transform: 'translateX(-50%)',
        }}
      >
        <div style={{ marginBottom: 3 * scale }}>
          <GuiText text="Mensagem do Mundo (MOTD):" color="#A0A0A0" shadow scale={scale} />
        </div>
        <input
          value={settings.motd}
          onChange={(e) => update('motd', e.target.value)}
          placeholder="§aBem-vindo!"
          style={{
            width: '100%',
            height: 20 * scale,
            background: '#000000',
            border: `${scale}px solid #A0A0A0`,
            color: '#E0E0E0',
            fontFamily: "'Minecraft', monospace",
            fontSize: `${8 * scale}px`,
            padding: `0 ${4 * scale}px`,
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {!isOpen ? (
        <>
          <GuiButton
            x={-155}
            y={guiHeight - 28}
            width={150}
            label={loading ? 'Abrindo...' : 'Iniciar Mundo LAN'}
            disabled={loading || settings.visibility === 'private'}
            onClick={handleOpen}
          />
          <GuiButton x={5} y={guiHeight - 28} width={150} label="Cancelar" onClick={onClose} />
        </>
      ) : (
        <>
          <GuiButton
            x={-155}
            y={guiHeight - 52}
            width={150}
            label="Salvar Alterações"
            disabled={loading}
            onClick={handleUpdate}
          />
          <GuiButton
            x={5}
            y={guiHeight - 52}
            width={150}
            label="Fechar Sala LAN"
            disabled={loading}
            onClick={handleCloseRoom}
          />
          <GuiButton x={-100} y={guiHeight - 28} width={200} label="Concluído" onClick={onClose} />
        </>
      )}
    </>
  );
}

export default function OpenToLANDialog(props) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <GuiScreen background="gradient">
        <OpenToLANContent {...props} />
      </GuiScreen>
    </div>
  );
}