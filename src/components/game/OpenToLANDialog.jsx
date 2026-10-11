// Abrir para LAN — PRD 15 MC15-RF-010..013
// Dialog do menu de pausa para abrir/configurar/fechar o mundo para outros.
import React, { useState, useEffect } from 'react';
import { roomManager } from '@/game/net/roomManager';
import { NetHost } from '@/game/net/netManager';
import { X, Lock, Globe, KeyRound, Wifi } from 'lucide-react';

const VIS_OPTIONS = [
  { value: 'public', label: 'Aberto para todos', desc: 'Aparece na lista de mundos online', icon: Globe },
  { value: 'code', label: 'Somente com código', desc: 'Não aparece na lista, entra pelo código', icon: KeyRound },
  { value: 'private', label: 'Privado', desc: 'Mundo não é aberto', icon: Lock },
];

const GAME_MODES = [
  { value: 'survival', label: 'Sobrevivência' },
  { value: 'creative', label: 'Criativo' },
  { value: 'adventure', label: 'Aventura' },
  { value: 'spectator', label: 'Espectador' },
];

export default function OpenToLANDialog({ engine, world, user, netHost, onNetHostChange, onClose }) {
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if room already open
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
  }, []);

  const handleOpen = async () => {
    setLoading(true);
    try {
      const host = new NetHost({
        engine, world, user,
        onChatMessage: (msg) => { engine.onChatMessage?.(msg); },
      });
      const r = await host.start(settings);
      onNetHostChange(host);
      setRoom(r);
      setCode(r.code);
      setIsOpen(true);
      engine.onChatMessage?.({ type: 'system', text: '§aMundo aberto. Código: §e§l' + r.code + '§r§a — visível para todos', timestamp: Date.now() });
    } catch (e) {
      console.error(e);
      alert('Erro ao abrir mundo: ' + e.message);
    }
    setLoading(false);
  };

  const handleClose = async () => {
    if (!netHost) return;
    setLoading(true);
    try {
      await netHost.close();
      onNetHostChange(null);
      setIsOpen(false);
      setRoom(null);
      engine.onChatMessage?.({ type: 'system', text: '§7Mundo fechado para outros jogadores.', timestamp: Date.now() });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleUpdate = async () => {
    if (!room) return;
    setLoading(true);
    try {
      await roomManager.updateSettings(room.id, settings);
      engine.onChatMessage?.({ type: 'system', text: '§7Configurações da sala atualizadas.', timestamp: Date.now() });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const update = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto text-white">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{isOpen ? 'Configurações da sala' : 'Abrir para LAN'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded"><X className="w-5 h-5" /></button>
        </div>

        {isOpen && code && (
          <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-500/30 rounded-lg text-center">
            <p className="text-xs text-white/50 mb-1">Código do mundo</p>
            <button
              onClick={() => { navigator.clipboard?.writeText(code); engine.onChatMessage?.({ type: 'system', text: '§7Código copiado: ' + code, timestamp: Date.now() }); }}
              className="text-2xl font-bold font-mono tracking-widest text-emerald-400 hover:text-emerald-300"
            >
              {code}
            </button>
          </div>
        )}

        {/* Visibility */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-white/60 mb-2">Visibilidade</label>
          <div className="space-y-1.5">
            {VIS_OPTIONS.map(v => {
              const Icon = v.icon;
              return (
                <button
                  key={v.value}
                  onClick={() => update('visibility', v.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm border transition-all ${settings.visibility === v.value ? 'bg-emerald-600/30 border-emerald-400/50' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                >
                  <Icon className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="font-semibold">{v.label}</div>
                    <div className="text-xs text-white/40">{v.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* MOTD */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-white/60 mb-1.5">Mensagem do mundo (MOTD)</label>
          <input
            value={settings.motd}
            onChange={(e) => update('motd', e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm outline-none focus:border-emerald-400/50"
            placeholder="§aBem-vindo!"
          />
        </div>

        {/* Guest game mode + commands */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Modo dos convidados</label>
            <select
              value={settings.guestGameMode}
              onChange={(e) => update('guestGameMode', e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm outline-none"
            >
              {GAME_MODES.map(g => <option key={g.value} value={g.value} className="bg-slate-800">{g.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">Máx. jogadores</label>
            <input
              type="number" min={1} max={16}
              value={settings.maxPlayers}
              onChange={(e) => update('maxPlayers', parseInt(e.target.value) || 8)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => update('allowCommands', !settings.allowCommands)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border ${settings.allowCommands ? 'bg-emerald-600/25 border-emerald-400/40' : 'bg-white/5 border-white/10'}`}
          >Permitir comandos</button>
          <button
            onClick={() => update('pvp', !settings.pvp)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border ${settings.pvp ? 'bg-red-600/25 border-red-400/40' : 'bg-white/5 border-white/10'}`}
          >PVP (FOGO AMIGO)</button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {!isOpen ? (
            <>
              <button
                onClick={handleOpen}
                disabled={loading || settings.visibility === 'private'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg font-semibold text-sm"
              >
                <Wifi className="w-4 h-4" /> Abrir mundo
              </button>
              <button onClick={onClose} className="px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-sm">Cancelar</button>
            </>
          ) : (
            <>
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/15 rounded-lg font-semibold text-sm"
              >Atualizar configurações</button>
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-red-600/80 hover:bg-red-500 rounded-lg font-semibold text-sm"
              >Fechar para outros</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}