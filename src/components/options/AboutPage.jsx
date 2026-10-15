import React, { useEffect, useState } from "react";
import { GuiScreen, GuiButton, GuiText, useGui } from "@/components/java";
import { BUILD_VERSION } from "@/game/constants";
import { useT } from "@/game/i18n";

function detectGPU() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'Indisponível';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'WebGL ativo';
  } catch { return 'Erro'; }
}

const FEATURES = [
  { name: 'WebGL2', check: () => !!document.createElement('canvas').getContext('webgl2') },
  { name: 'Texture Arrays', check: () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } } },
  { name: 'Pointer Lock', check: () => 'pointerLockElement' in document },
  { name: 'Raw Input', check: () => 'getCapabilities' in (navigator.keyboard || {}) || 'Keyboard' in window },
  { name: 'Keyboard Lock API', check: () => 'keyboard' in navigator && 'lock' in (navigator.keyboard || {}) },
  { name: 'Fullscreen API', check: () => 'requestFullscreen' in document.documentElement },
  { name: 'Gamepad API', check: () => 'getGamepads' in navigator },
  { name: 'WebRTC (P2P)', check: () => typeof RTCPeerConnection !== 'undefined' },
];

const PRD_STATUS = [
  { id: '01', name: 'Fundação', status: 'done', evidence: 'engine, world, chunk, save, physics, textures' },
  { id: '02', name: 'Iluminação e Fluidos', status: 'done', evidence: 'lighting, mesher, materials, sky, fluids' },
  { id: '03', name: 'Configurações', status: 'done', evidence: 'settingsStore, Options + sub-páginas' },
  { id: '04', name: 'Geração de Mundo', status: 'done', evidence: 'biomeGen, terrain, vegetation, worldgen' },
  { id: '05', name: 'Sobrevivência e Comandos', status: 'done', evidence: 'survival, commands, effects, furnace' },
  { id: '06', name: 'Inventário e Itens', status: 'done', evidence: 'inventory, recipes, containers, CreativeUI' },
  { id: '07', name: 'Combate e Animação', status: 'done', evidence: 'combat, animation, projectiles, playerModel' },
  { id: '08', name: 'Mobs e Multiplayer', status: 'done', evidence: 'mobManager, aiGoals, webrtc, roomManager' },
  { id: '09', name: 'Mind Cave (Armas de fogo)', status: 'done', evidence: 'guns/shooting, models, noiseSystem, registry' },
  { id: '10', name: 'Mind Cave Studio', status: 'done', evidence: 'assetStore, customItemRegistry, Studio UI' },
  { id: '11', name: 'Redstone e Automação', status: 'done', evidence: 'redstone, agricultura, explosões, portas, placas de pressão' },
  { id: '12', name: 'Stats e Conquistas', status: 'done', evidence: 'achievements, stats, F3 shortcuts' },
  { id: '15', name: 'Multijogador (UI)', status: 'done', evidence: 'ChatUI, ConnectionScreen, OpenToLAN' },
  { id: '19', name: 'Visual Java 1.8.9', status: 'done', evidence: 'GuiButton, GuiScreen, GuiSlider, font bitmap' },
  { id: '20', name: 'Opções 1.8.9', status: 'done', evidence: 'GuiOptionPage + sub-páginas 100% integradas no padrão Java' },
];

function AboutContent({ onBack }) {
  const { guiHeight, scale } = useGui();
  const t = useT();
  const [gpu, setGpu] = useState('');
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    setGpu(detectGPU());
    setFeatures(FEATURES.map(f => ({ name: f.name, ok: f.check() })));
  }, []);

  return (
    <>
      {/* Título padrão 1.8.9 */}
      <div style={{ position: 'absolute', left: '50%', top: 8 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Sobre o Mind Cave" color="#FFFFFF" shadow scale={scale} />
      </div>

      {/* Caixa de conteúdo rolável no padrão 1.8.9 */}
      <div
        className="mc-scrollbar"
        style={{
          position: 'absolute',
          left: '50%',
          top: 24 * scale,
          bottom: 34 * scale,
          width: 320 * scale,
          transform: 'translateX(-50%)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 6 * scale,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 10 * scale,
        }}
      >
        {/* Bloco 1: Informações do Sistema */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: 8 * scale,
        }}>
          <div style={{ marginBottom: 4 * scale }}>
            <GuiText text="Mind Cave" color="#FFFF55" shadow scale={scale} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 * scale }}>
            <GuiText text={`Versão do build: ${BUILD_VERSION}`} color="#A0A0A0" shadow scale={scale} />
            <GuiText text="Desenvolvido por: Junior · Deyvid" color="#A0A0A0" shadow scale={scale} />
            <GuiText text={`Resolução: ${window.screen.width}x${window.screen.height}`} color="#A0A0A0" shadow scale={scale} />
            <GuiText text={`GPU: ${gpu.length > 36 ? gpu.slice(0, 36) + '...' : gpu}`} color="#A0A0A0" shadow scale={scale} />
          </div>
        </div>

        {/* Bloco 2: Recursos do Navegador */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: 8 * scale,
        }}>
          <div style={{ marginBottom: 4 * scale }}>
            <GuiText text="Recursos Web Suportados" color="#55FF55" shadow scale={scale} />
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4 * scale,
          }}>
            {features.map((f) => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 4 * scale }}>
                <GuiText text={f.ok ? '✓' : '✗'} color={f.ok ? '#55FF55' : '#FF5555'} shadow scale={scale} />
                <GuiText text={f.name} color="#A0A0A0" shadow scale={scale} />
              </div>
            ))}
          </div>
        </div>

        {/* Bloco 3: PRDs Implementados */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: 8 * scale,
        }}>
          <div style={{ marginBottom: 4 * scale }}>
            <GuiText text="Módulos & Especificações" color="#FFAA00" shadow scale={scale} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 * scale }}>
            {PRD_STATUS.map((p) => (
              <div key={p.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 * scale }}>
                  <GuiText text={p.status === 'done' ? '✓' : '◐'} color={p.status === 'done' ? '#55FF55' : '#FFFF55'} shadow scale={scale} />
                  <GuiText text={`PRD ${p.id} — ${p.name}`} color="#FFFFFF" shadow scale={scale} />
                </div>
                <div style={{ marginLeft: 10 * scale }}>
                  <GuiText text={p.evidence} color="#888888" shadow scale={scale} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bloco 4: Licenças */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: 6 * scale,
          textAlign: 'center',
        }}>
          <GuiText text="three.js · React · Tailwind CSS · Base44 SDK" color="#888888" shadow scale={scale} />
        </div>
      </div>

      {/* Botão Concluído padrão 1.8.9 */}
      <GuiButton
        x={-100}
        y={guiHeight - 28}
        width={200}
        label={t('gui.done')}
        onClick={onBack}
      />
    </>
  );
}

export default function AboutPage({ onBack }) {
  return (
    <GuiScreen background="dirt">
      <AboutContent onBack={onBack} />
    </GuiScreen>
  );
}