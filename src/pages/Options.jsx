import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { mindcaveApi } from "@/api/supabaseClient";
import { useSettings, settingsStore } from "@/game/settingsStore";
import { GuiScreen, GuiButton, GuiText, GuiSlider, useGui } from "@/components/java";
import GuiOptionPage from "@/components/java/GuiOptionPage";
import { JavaButton } from "@/components/java/GuiOptionControls";
import KeybindsPage from "@/components/options/KeybindsPage";
import QualityProfilesPage from "@/components/options/QualityProfilesPage";
import WorldSettingsPage from "@/components/options/WorldSettingsPage";
import AboutPage from "@/components/options/AboutPage";
import ImportExportPage from "@/components/options/ImportExportPage";
import SkinPage from "@/components/options/SkinPage";
import { VIDEO_SECTIONS, SHADERS_SECTIONS, SHADOW_SECTIONS, AUDIO_SECTIONS, CHAT_SECTIONS, ACCESSIBILITY_SECTIONS, PERFORMANCE_SECTIONS, NETWORK_SECTIONS } from "@/components/options/optionDefinitions";
import CreditsScreen from "@/components/game/CreditsScreen";
import DevManual from "@/components/game/DevManual";

// Layout 1.8.9 §2.1 — coluna esquerda | coluna direita, intercalados
const MENU_ITEMS = [
  { id: 'skin', label: 'Personalização de skin...' },
  { id: 'audio', label: 'Músicas e sons...' },
  { id: 'video', label: 'Configurações de vídeo...' },
  { id: 'controls', label: 'Controles...' },
  { id: 'language', label: 'Idioma...', disabled: true },
  { id: 'chat', label: 'Configurações do chat...' },
  { id: 'resourcepacks', label: 'Pacotes de recursos...', disabled: true },
  { id: 'network', label: 'Multijogador e rede...' },
  { id: 'shaders', label: 'Shaders...' },
  { id: 'performance', label: 'Desempenho...' },
  { id: 'accessibility', label: 'Acessibilidade...' },
  { id: 'quality', label: 'Perfis de qualidade...' },
  { id: 'world', label: 'Configurações do mundo...' },
  { id: 'importexport', label: 'Importar/Exportar...' },
  { id: 'about', label: 'Sobre o build' },
  { id: 'credits', label: 'Créditos' },
  { id: 'devmanual', label: 'Manual do Desenvolvedor' },
];

function MainOptions({ onNavigate, onClose, worldId }) {
  const store = useSettings();
  const { guiHeight, scale } = useGui();

  // World-only items disabled when not in a world (§2.1)
  const items = MENU_ITEMS.map(i => ({
    ...i,
    disabled: i.disabled || (i.id === 'world' && !worldId),
  }));

  return (
    <>
      {/* Title */}
      <div style={{ position: 'absolute', left: '50%', top: 6 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Opções" color="#FFFFFF" shadow scale={scale} />
      </div>

      {/* Row 1: FOV slider + Difficulty (§2.1) */}
      <GuiSlider
        x={-152} y={20} width={150}
        value={store.get('user.fov') || 70}
        min={30} max={110} step={1}
        onChange={v => store.set('user.fov', v)}
        format={v => v === 70 ? 'Campo de visão: Normal' : v === 110 ? 'Campo de visão: Quake Pro' : `Campo de visão: ${v}`}
      />
      <GuiButton x={2} y={20} width={150}
        label="Dificuldade..."
        disabled={!worldId}
        onClick={() => onNavigate('world')}
      />

      {/* Scrollable 2-column grid of 150px buttons */}
      <div
        className="mc-scrollbar"
        style={{
          position: 'absolute', left: '50%', top: 44 * scale, bottom: 32 * scale,
          width: 312 * scale, transform: 'translateX(-50%)',
          overflowY: 'auto', overflowX: 'hidden',
          paddingRight: 4 * scale,
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: `${150 * scale}px ${150 * scale}px`,
          gap: `${2 * scale}px`,
          justifyContent: 'center',
        }}>
          {items.map(item => (
            <JavaButton
              key={item.id}
              label={item.label}
              disabled={item.disabled}
              onClick={() => onNavigate(item.id)}
              width={150}
            />
          ))}
        </div>
      </div>

      {/* Done button */}
      <GuiButton x={-100} y={guiHeight - 28} width={200} label="Pronto" onClick={onClose} />
    </>
  );
}

export default function Options({ onClose, worldId }) {
  const [page, setPage] = useState('main');
  const navigate = useNavigate();
  useSettings(); // re-render on settings change for dynamic disabled states

  useEffect(() => {
    base44AuthInit();
  }, []);

  const back = () => setPage('main');
  const close = onClose || (() => navigate('/'));

  // Esc = Pronto (§1 RF-006)
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (page === 'main') { onClose ? onClose() : navigate('/'); }
      else setPage('main');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [page, onClose, navigate]);

  if (page === 'main') return <GuiScreen><MainOptions onNavigate={setPage} onClose={close} worldId={worldId} /></GuiScreen>;
  if (page === 'video') return <GuiOptionPage title="Configurações de Vídeo" sections={VIDEO_SECTIONS(settingsStore)} onBack={back} resetScope="device" />;
  if (page === 'shaders') return <GuiOptionPage title="Configurações de Shaders" sections={[...SHADERS_SECTIONS(settingsStore), ...SHADOW_SECTIONS(settingsStore)]} onBack={back} resetScope="device" />;
  if (page === 'quality') return <QualityProfilesPage onBack={back} />;
  if (page === 'performance') return <GuiOptionPage title="Desempenho Avançado" sections={PERFORMANCE_SECTIONS} onBack={back} resetScope="device" />;
  if (page === 'controls') return <KeybindsPage onBack={back} />;
  if (page === 'audio') return <GuiOptionPage title="Música e Sons" sections={AUDIO_SECTIONS} onBack={back} resetScope="user" />;
  if (page === 'skin') return <SkinPage onBack={back} />;
  if (page === 'chat') return <GuiOptionPage title="Configurações de Chat" sections={CHAT_SECTIONS} onBack={back} resetScope="user" />;
  if (page === 'accessibility') return <GuiOptionPage title="Acessibilidade" sections={ACCESSIBILITY_SECTIONS} onBack={back} resetScope="user" />;
  if (page === 'network') return <GuiOptionPage title="Multijogador e Rede" sections={NETWORK_SECTIONS} onBack={back} resetScope="device" />;
  if (page === 'world') return <WorldSettingsPage onBack={back} worldId={worldId} />;
  if (page === 'importexport') return <ImportExportPage onBack={back} />;
  if (page === 'about') return <AboutPage onBack={back} />;
  if (page === 'credits') return <CreditsScreen onClose={back} />;
  if (page === 'devmanual') return <DevManual onClose={back} />;
  return <MainOptions onNavigate={setPage} onClose={close} worldId={worldId} />;
}

async function base44AuthInit() {
  try { const u = await mindcaveApi.auth.me(); settingsStore.initCloud(u); } catch {}
}