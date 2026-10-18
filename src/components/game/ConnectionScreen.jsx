import React, { useState, useEffect } from 'react';
import { roomManager } from '@/game/net/roomManager';
import { NetClient } from '@/game/net/netManager';
import { explainFailure } from '@/game/net/webrtc';
import { GuiScreen, GuiButton, GuiText, useGui } from '@/components/java';

const STEPS = [
  'Conectando ao servidor...',
  'Negociando conexão...',
  'Fazendo login...',
  'Baixando terreno...',
];

function ConnectionContent({ room, user, world, engine, engineReady, onSuccess, onCancel }) {
  const { guiHeight, scale } = useGui();
  const [step, setStep] = useState(0);
  const [route, setRoute] = useState(null);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(room?.passwordHash ? true : false);

  const startConnection = async (pwd) => {
    setError(null);
    setStep(0);
    try {
      const fresh = (room._fetchedAt && Date.now() - room._fetchedAt < 10000) ? room : await roomManager.getRoom(room.id);   // a sala acabou de ser lida pelo jogo
      if (!fresh || fresh.status === 'closed') {
        throw new Error('Este mundo não está mais aberto.');
      }
      if (fresh.passwordHash) {
        const valid = await roomManager.verifyPassword(fresh, pwd);
        if (!valid) throw new Error('Senha incorreta.');
      }
      if (fresh.playerCount >= fresh.maxPlayers) {
        throw new Error(`O servidor está cheio (${fresh.maxPlayers}/${fresh.maxPlayers}).`);
      }
      const banned = roomManager.getBannedList(fresh);
      if (banned.find((b) => b.userId === user.id)) {
        throw new Error('Você foi banido deste mundo: ' + (banned.find((b) => b.userId === user.id)?.reason || ''));
      }
      if (fresh.whitelistEnabled && !(fresh.whitelist || []).includes(user.id)) {
        throw new Error('Você não está na whitelist deste mundo.');
      }
      setStep(1);
      let done = false;   // conectou (ou já falhou): o limite de tempo abaixo não pode mais mostrar erro
      const client = new NetClient({
        engine,
        world,
        user,
        room: fresh,
        onStateChange: (s) => {
          if (s === 'connected') {
            done = true;
            setStep(3);
            onSuccess(fresh, client);   // sem espera artificial: entra assim que o canal abre
          }
          if (s === 'failed') {
            setError('Falha ao conectar: ' + explainFailure(client.conn && client.conn.failureInfo && client.conn.failureInfo()));
          }
          if (s === 'closed' && step < 3) {
            setError('Conexão perdida durante a negociação.');
          }
        },
        onRouteChange: (r) => setRoute(r),
        onChatMessage: () => {},
      });
      engineReady?.then((e) => client.attachEngine(e));   // o motor pode chegar depois da conexão
      await client.connect(pwd);
      setTimeout(() => {   // a conexão já tem limite de 30 s por dentro; este só cobre travar antes de a negociação começar
        if (!done) setError('Falha ao conectar: ' + explainFailure(client.conn && client.conn.failureInfo && client.conn.failureInfo()));
      }, 35000);
    } catch (e) {
      setError(e.message || 'Erro ao conectar.');
    }
  };

  useEffect(() => {
    if (!showPassword) startConnection('');
  }, []);

  const midY = Math.floor(guiHeight / 2);

  if (error) {
    return (
      <>
        <div style={{ position: 'absolute', left: '50%', top: (midY - 36) * scale, transform: 'translateX(-50%)' }}>
          <GuiText text="Falha ao conectar ao servidor" color="#AAAAAA" shadow scale={scale} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: (midY - 16) * scale,
            transform: 'translateX(-50%)',
            maxWidth: 320 * scale,
            textAlign: 'center',
          }}
        >
          <GuiText text={error} color="#FFFFFF" shadow scale={scale} />
        </div>
        {showPassword && (
          <GuiButton
            x={-100}
            y={midY + 12}
            width={200}
            label="Tentar senha novamente"
            onClick={() => {
              setError(null);
              setShowPassword(true);
            }}
          />
        )}
        <GuiButton
          x={-100}
          y={midY + (showPassword ? 36 : 16)}
          width={200}
          label="Voltar à lista de servidores"
          onClick={onCancel}
        />
      </>
    );
  }

  if (showPassword && step === 0 && !error) {
    return (
      <>
        <div style={{ position: 'absolute', left: '50%', top: (midY - 40) * scale, transform: 'translateX(-50%)' }}>
          <GuiText text="Este mundo requer senha:" color="#FFFFFF" shadow scale={scale} />
        </div>
        <div style={{ position: 'absolute', left: '50%', top: (midY - 18) * scale, transform: 'translateX(-50%)' }}>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password) {
                setShowPassword(false);
                startConnection(password);
              }
            }}
            placeholder="Senha"
            style={{
              width: 200 * scale,
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
        <GuiButton
          x={-100}
          y={midY + 10}
          width={200}
          label="Entrar no Servidor"
          disabled={!password}
          onClick={() => {
            if (password) {
              setShowPassword(false);
              startConnection(password);
            }
          }}
        />
        <GuiButton x={-100} y={midY + 34} width={200} label="Cancelar" onClick={onCancel} />
      </>
    );
  }

  return (
    <>
      <div style={{ position: 'absolute', left: '50%', top: (midY - 24) * scale, transform: 'translateX(-50%)' }}>
        <GuiText text={STEPS[step] || STEPS[0]} color="#FFFFFF" shadow scale={scale} />
      </div>
      {route && (
        <div style={{ position: 'absolute', left: '50%', top: (midY - 8) * scale, transform: 'translateX(-50%)' }}>
          <GuiText
            text={`Rota: ${route === 'direct' ? 'Direta' : route === 'stun' ? 'STUN' : 'TURN (Relay)'}`}
            color="#808080"
            shadow
            scale={scale}
          />
        </div>
      )}
      <GuiButton x={-100} y={midY + 24} width={200} label="Cancelar" onClick={onCancel} />
    </>
  );
}

export default function ConnectionScreen(props) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <GuiScreen background="dirt">
        <ConnectionContent {...props} />
      </GuiScreen>
    </div>
  );
}