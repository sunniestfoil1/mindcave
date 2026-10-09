// Tela de conexão — PRD 15 MC15-RF-030..032
import React, { useState, useEffect } from 'react';
import { roomManager } from '@/game/net/roomManager';
import { NetClient } from '@/game/net/netManager';

const STEPS = [
  'Conectando ao host…',
  'Negociando conexão…',
  'Fazendo login…',
  'Carregando terreno…',
];

export default function ConnectionScreen({ room, user, world, engine, onSuccess, onCancel, onError }) {
  const [step, setStep] = useState(0);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(room?.passwordHash ? true : false);

  const startConnection = async (pwd) => {
    setError(null);
    setStep(0);

    try {
      // Verifica se a sala ainda está aberta
      const fresh = await roomManager.getRoom(room.id);
      if (!fresh || fresh.status === 'closed') {
        throw new Error('Este mundo não está mais aberto.');
      }

      // Verifica senha
      if (fresh.passwordHash) {
        const valid = await roomManager.verifyPassword(fresh, pwd);
        if (!valid) throw new Error('Senha incorreta.');
      }

      // Verifica se está cheio
      if (fresh.playerCount >= fresh.maxPlayers) {
        throw new Error(`O mundo está cheio (${fresh.maxPlayers}/${fresh.maxPlayers}).`);
      }

      // Verifica banimento
      const banned = roomManager.getBannedList(fresh);
      if (banned.find(b => b.userId === user.id)) {
        throw new Error('Você foi banido deste mundo: ' + (banned.find(b => b.userId === user.id)?.reason || ''));
      }

      // Verifica whitelist
      if (fresh.whitelistEnabled && !(fresh.whitelist || []).includes(user.id)) {
        throw new Error('Você não está na lista de permitidos deste mundo.');
      }

      setStep(1);

      const client = new NetClient({
        engine, world, user, room: fresh,
        onStateChange: (s) => {
          if (s === 'connected') { setStep(2); setTimeout(() => { setStep(3); onSuccess(fresh, client); }, 500); }
          if (s === 'failed') setError('Não foi possível conectar ao host. Tente novamente ou verifique o servidor TURN nas Opções → Multijogador.');
          if (s === 'closed' && step < 3) setError('A conexão caiu durante a negociação.');
        },
        onRouteChange: (r) => setRoute(r),
        onChatMessage: () => {},
      });

      await client.connect(pwd);

      // Timeout de 15s
      const timeout = setTimeout(() => {
        if (step < 2) setError('Não foi possível conectar ao host. Tente novamente ou verifique o servidor TURN nas Opções → Multijogador.');
      }, 15000);

      return () => clearTimeout(timeout);
    } catch (e) {
      setError(e.message || 'Erro ao conectar.');
    }
  };

  // Auto-start se não tem senha
  useEffect(() => {
    if (!showPassword) startConnection('');
  }, []);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 text-white">
        <div className="text-center max-w-md">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            {showPassword && <button onClick={() => { setError(null); setShowPassword(true); }} className="px-4 py-2 bg-white/10 rounded hover:bg-white/20">Tentar senha novamente</button>}
            <button onClick={onCancel} className="px-4 py-2 bg-white/10 rounded hover:bg-white/20">Voltar</button>
          </div>
        </div>
      </div>
    );
  }

  if (showPassword && step === 0 && !error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 text-white">
        <div className="text-center max-w-md">
          <p className="text-lg mb-4">Este mundo requer senha:</p>
          <input
            type="password" autoFocus value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && password) { setShowPassword(false); startConnection(password); } }}
            className="w-64 px-3 py-2 bg-white/10 rounded border border-white/20 text-center mb-3 outline-none focus:border-emerald-400/50"
            placeholder="Senha do mundo"
          />
          <div className="flex gap-2 justify-center">
            <button onClick={() => { if (password) { setShowPassword(false); startConnection(password); } }} disabled={!password} className="px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-500 disabled:opacity-50">Entrar</button>
            <button onClick={onCancel} className="px-4 py-2 bg-white/10 rounded hover:bg-white/20">Cancelar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 text-white">
      <div className="text-center max-w-md">
        <div className="w-12 h-12 border-4 border-white/20 border-t-emerald-400 rounded-full animate-spin mx-auto mb-6" />
        <p className="text-lg mb-4">{STEPS[step]}</p>
        {route && (
          <p className="text-sm text-white/50 mb-2">
            Rota: <span className={route === 'direct' ? 'text-emerald-400' : route === 'stun' ? 'text-yellow-400' : 'text-orange-400'}>
              {route === 'direct' ? 'Direta' : route === 'stun' ? 'STUN' : 'TURN (relay)'}
            </span>
          </p>
        )}
        <div className="flex gap-1 justify-center mb-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i <= step ? 'bg-emerald-400' : 'bg-white/20'}`} />
          ))}
        </div>
        <button onClick={() => { onCancel(); }} className="text-sm text-white/40 hover:text-white/70">Cancelar</button>
      </div>
    </div>
  );
}