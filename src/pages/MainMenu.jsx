import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { resolveUser, getNickname } from '@/game/guestIdentity';
import { BUILD_VERSION } from '@/game/constants';
import { GuiScreen, GuiButton, GuiText, useGui } from '@/components/java';
import { settingsStore } from '@/game/settingsStore';
import { getSkinFaceUrl } from '@/game/skinStore';
import { onPackReady } from '@/game/pack';
import { useT } from '@/game/i18n';
import SkinPage from '@/components/options/SkinPage';
import OptimizedPackDialog from '@/components/options/OptimizedPackDialog';
import { OPTIMIZED_PACK_ID, getSelectedPackIds } from '@/game/resourcePacks';

const SPLASHES = [
  '100% puro!', 'Agora com multijogador!', 'Agora em 3D!', 'Milhões de pixels!',
  'Feito por dois devs!', 'Aventura pixel!', 'Mundo infinito!', 'Blocos e mais blocos!',
  'Pode viciar!', 'Cuidado com creepers!', 'Minere, construa, sobreviva!',
  'Areia, cascalho e mais!', 'Não olhe para baixo!', 'Mente Cavernosa!',
];

function MainMenuContent({ user, onNickname, editingSkin }) {
  const navigate = useNavigate();
  const { guiHeight, scale } = useGui();
  const t = useT();
  const [splash, setSplash] = useState('');
  const [optimized, setOptimized] = useState(false);
  const [askPack, setAskPack] = useState(false);
  const [heads, setHeads] = useState(null);

  useEffect(() => {
    setSplash(SPLASHES[Math.floor(Math.random() * SPLASHES.length)]);
  }, []);

  // Cabeças Steve e Alex do pacote oficial — recarrega quando o pack ficar pronto
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [steve, alex] = await Promise.all([
        getSkinFaceUrl(2, { kind: 'steve' }),
        getSkinFaceUrl(2, { kind: 'alex' }),
      ]);
      if (alive && steve && alex) setHeads({ steve, alex });
    };
    load();
    const off = onPackReady(load);
    return () => { alive = false; if (off) off(); };
  }, []);

  const headsIcon = heads ? (
    <span style={{ display: 'flex', gap: 2 * scale, flexShrink: 0 }}>
      <img src={heads.steve} alt="" width={8 * scale} height={8 * scale}
        style={{ imageRendering: 'pixelated' }} draggable={false} />
      <img src={heads.alex} alt="" width={8 * scale} height={8 * scale}
        style={{ imageRendering: 'pixelated' }} draggable={false} />
    </span>
  ) : null;

  const j = Math.floor(guiHeight / 4) + 16;
  // Logo: em telas baixas (celular em paisagem) ele sobe e encolhe para não cobrir o primeiro botão (que começa em j)
  const logoTop0 = editingSkin ? 8 : 20, logoH0 = editingSkin ? 56 : 70;
  const logoTop = j - logoTop0 - 4 >= logoH0 ? logoTop0 : 6;
  const logoH = Math.max(24, Math.min(logoH0, j - logoTop - 6));

  const handleOptimized = () => {
    settingsStore.applyOptimized();
    setOptimized(true);
    setTimeout(() => setOptimized(false), 2000);
    if (!getSelectedPackIds().includes(OPTIMIZED_PACK_ID)) setAskPack(true);
  };

  return (
    <>
      {/* Logo — na tela de editar skin encolhe 20% e sobe para dar espaço ao modal */}
      <div style={{
        position: 'absolute', left: '50%', top: logoTop * scale,
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
            height: Math.round(logoH * scale) + 'px',
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
      <GuiButton x={-100} y={j} width={200} label={t('menu.singleplayer')} onClick={() => navigate('/singleplayer')} />
      <GuiButton x={-100} y={j + 24} width={200} label={t('menu.multiplayer')} onClick={() => navigate('/multiplayer')} />
      <GuiButton x={-100} y={j + 48} width={200} label={t('menu.options')} onClick={() => navigate('/options')} />
      {/* "Sair do jogo" removido: em site não fecha aba e não faz sentido no menu */}

      {/* Personalizar Skin / Nick & Modo Otimizado */}
      <GuiButton x={-100} y={j + 76} width={200} icon={headsIcon} label={t('main.personalize')} onClick={onNickname} />
      <GuiButton
        x={-100} y={j + 100} width={200}
        icon={<Zap size={10 * scale} color="#FFD84D" fill="#FFD84D" strokeWidth={1.5} style={{ flexShrink: 0 }} />}
        label={optimized ? t('main.optimizedApplied') : t('main.optimized')}
        onClick={handleOptimized}
      />

      {/* Bottom left */}
      <div style={{ position: 'absolute', left: 2 * scale, bottom: 0 }}>
        <GuiText text={`Mind Cave 1.8.9-dev (${BUILD_VERSION})`} color="#FFFFFF" shadow />
      </div>

      {/* Bottom right */}
      <div style={{ position: 'absolute', right: 2 * scale, bottom: 0 }}>
        <GuiText text={t('main.byDevs')} color="#FFFFFF" shadow />
      </div>

      {/* Nickname */}
      <div style={{ position: 'absolute', right: 2 * scale, top: 2 * scale, cursor: 'pointer' }} onClick={onNickname}>
        <GuiText text={user?.full_name || getNickname()} color="#FFFFFF" shadow />
      </div>

      {askPack && <OptimizedPackDialog onClose={() => setAskPack(false)} />}
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

  // Personalizar jogador usa a mesma tela do menu de opções (Opções > Personalização de skin)
  if (showNickname) {
    return <SkinPage onBack={() => setShowNickname(false)} onSaved={(name) => setUser(prev => prev ? { ...prev, full_name: name } : prev)} />;
  }

  return (
    <GuiScreen>
      <MainMenuContent user={user} onNickname={() => setShowNickname(true)} editingSkin={false} />
    </GuiScreen>
  );
}
