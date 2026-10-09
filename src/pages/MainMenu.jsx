import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resolveUser, getNickname } from '@/game/guestIdentity';
import { BUILD_VERSION } from '@/game/constants';
import { GuiScreen, GuiButton, GuiText, useGui } from '@/components/java';
import { settingsStore } from '@/game/settingsStore';
import NicknameModal from '@/components/NicknameModal';

const SPLASHES = [
  '100% puro!', 'Agora com multijogador!', 'Agora em 3D!', 'Milhões de pixels!',
  'Feito por dois devs!', 'Aventura pixel!', 'Mundo infinito!', 'Blocos e mais blocos!',
  'Pode viciar!', 'Cuidado com creepers!', 'Minere, construa, sobreviva!',
  'Areia, cascalho e mais!', 'Não olhe para baixo!', 'Mente Cavernosa!',
];

function MainMenuContent({ user, onNickname }) {
  const navigate = useNavigate();
  const { guiHeight, scale } = useGui();
  const [splash, setSplash] = useState('');
  const [optimized, setOptimized] = useState(false);

  useEffect(() => {
    setSplash(SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);
  }, []);

  const j = Math.floor(guiHeight / 4) + 16;

  const handleOptimized = () => {
    settingsStore.applyOptimized();
    setOptimized(true);
    setTimeout(() => setOptimized(false), 2000);
  };

  return (
    <>
      {/* Logo */}
      <div style={{
        position: 'absolute', left: '50%', top: 20 * scale,
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <img
          src="/minecraft-text.png"
          alt="MIND CAVE"
          style={{
            height: Math.round(70 * scale) + 'px',
            width: 'auto',
            maxHeight: '150px',
            maxWidth: '92vw',
            imageRendering: 'pixelated',
            filter: 'drop-shadow(3px 5px 8px rgba(0, 0, 0, 0.7))',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Splash — alinhado à direita do título no topo, em zIndex alto */}
      <div style={{
        position: 'absolute',
        left: 'calc(50% + 150px * ' + scale + ')',
        top: 52 * scale,
        zIndex: 30,
        pointerEvents: 'none',
        animation: 'mc-splash-pulse 0.75s ease-in-out infinite alternate',
      }}>
        <div style={{ transform: 'rotate(-12deg)' }}>
          <GuiText text={splash} color="#FFFF00" shadow scale={Math.max(1, scale * 0.75)} />
        </div>
      </div>

      {/* Buttons — Padrão Oficial Minecraft 1.8.9 */}
      <GuiButton x={-100} y={j} width={200} label="Um jogador" onClick={() => navigate('/singleplayer')} />
      <GuiButton x={-100} y={j + 24} width={200} label="Multijogador" onClick={() => navigate('/multiplayer')} />
      <GuiButton x={-100} y={j + 48} width={98} label="Opções..." onClick={() => navigate('/options')} />
      <GuiButton x={2} y={j + 48} width={98} label="Sair do jogo" onClick={() => { try { window.close(); } catch {} }} />

      {/* Personalizar Skin / Nick & Modo Otimizado */}
      <GuiButton x={-100} y={j + 76} width={200} label="👤 Personalizar Skin / Nick" onClick={onNickname} />
      <GuiButton
        x={-100} y={j + 100} width={200}
        label={optimized ? '✓ Otimizado aplicado!' : '⚡ Modo Otimizado'}
        onClick={handleOptimized}
      />

      {/* Bottom left */}
      <div style={{ position: 'absolute', left: 2 * scale, bottom: 0 }}>
        <GuiText text={`Mind Cave 1.8.9-dev (${BUILD_VERSION})`} color="#FFFFFF" shadow />
      </div>

      {/* Bottom right */}
      <div style={{ position: 'absolute', right: 2 * scale, bottom: 0 }}>
        <GuiText text="Mind Cave — feito por dois devs" color="#FFFFFF" shadow />
      </div>

      {/* Nickname */}
      <div style={{ position: 'absolute', right: 2 * scale, top: 2 * scale, cursor: 'pointer' }} onClick={onNickname}>
        <GuiText text={user?.full_name || getNickname()} color="#FFFFFF" shadow />
      </div>
    </>
  );
}

export default function MainMenu() {
  const [user, setUser] = useState(null);
  const [showNickname, setShowNickname] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { user: u } = await resolveUser();
        setUser(u);
      } catch {}
    })();
  }, []);

  return (
    <GuiScreen>
      <MainMenuContent user={user} onNickname={() => setShowNickname(true)} />
      {showNickname && (
        <NicknameModal
          onClose={() => setShowNickname(false)}
          onSaved={(name) => setUser(prev => prev ? { ...prev, full_name: name } : prev)}
        />
      )}
    </GuiScreen>
  );
}