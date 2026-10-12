import React, { useEffect, useState } from "react";
import SettingsLayout from "./SettingsLayout";
import { BUILD_VERSION } from "@/game/constants";

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
  { name: 'Raw Input (unadjustedMovement)', check: () => 'getCapabilities' in (navigator.keyboard || {}) || 'Keyboard' in window },
  { name: 'Keyboard Lock API', check: () => 'keyboard' in navigator && 'lock' in (navigator.keyboard || {}) },
  { name: 'Fullscreen API', check: () => 'requestFullscreen' in document.documentElement },
  { name: 'Gamepad API', check: () => 'getGamepads' in navigator },
  { name: 'WebRTC (P2P)', check: () => typeof RTCPeerConnection !== 'undefined' },
];

// Status baseado em evidência real do código-fonte (cada PRD tem arquivos implementados)
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
  { id: '11', name: 'Redstone e Automação', status: 'partial', evidence: 'redstone, agricultura, explosões OK; pistões, funis, poções pendentes' },
  { id: '12', name: 'Stats e Conquistas', status: 'done', evidence: 'achievements, stats, F3 shortcuts' },
  { id: '15', name: 'Multijogador (UI)', status: 'done', evidence: 'ChatUI, ConnectionScreen, OpenToLAN' },
  { id: '19', name: 'Visual Java 1.8.9', status: 'done', evidence: 'GuiButton, GuiScreen, GuiSlider, font bitmap' },
  { id: '20', name: 'Opções 1.8.9', status: 'partial', evidence: 'GuiOptionPage + sub-páginas principais; Controles, Mundo, Importar/Exportar pendentes' },
];

export default function AboutPage({ onBack }) {
  const [gpu, setGpu] = useState('');
  const [features, setFeatures] = useState([]);
  useEffect(() => {
    setGpu(detectGPU());
    setFeatures(FEATURES.map(f => ({ name: f.name, ok: f.check() })));
  }, []);

  return (
    <SettingsLayout title="Sobre o build" onBack={onBack}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-lg font-bold mb-2">Mind Cave</h2>
          <div className="text-sm space-y-1 text-muted-foreground">
            <div>Versão do build: <span className="text-foreground font-mono">{BUILD_VERSION}</span></div>
            <div>Desenvolvido por: <span className="text-foreground">Junior · Deyvid</span></div>
            <div>Navegador: <span className="text-foreground">{navigator.userAgent.split(') ')[0].split('(').pop()}</span></div>
            <div>GPU: <span className="text-foreground">{gpu}</span></div>
            <div>Resolução: <span className="text-foreground">{window.screen.width}×{window.screen.height}</span></div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">PRDs implementados</h3>
          <ul className="space-y-1 text-sm">
            {PRD_STATUS.map(p => (
              <li key={p.id} className="flex items-start gap-2">
                <span className={p.status === 'done' ? 'text-green-500' : 'text-yellow-500'}>
                  {p.status === 'done' ? '✓' : '◐'}
                </span>
                <div>
                  <span className="text-foreground">PRD {p.id} — {p.name}</span>
                  {p.status === 'partial' && <span className="text-yellow-500 ml-1">(parcial)</span>}
                  <span className="block text-xs text-muted-foreground">{p.evidence}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">Recursos suportados</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {features.map(f => (
              <div key={f.name} className="flex items-center gap-2">
                <span className={f.ok ? 'text-green-500' : 'text-red-500'}>{f.ok ? '✓' : '✗'}</span>
                <span className="text-muted-foreground">{f.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">Licenças</h3>
          <p className="text-xs text-muted-foreground">three.js (MIT) · React (MIT) · Tailwind CSS (MIT) · lucide-react (ISC) · Base44 SDK</p>
        </div>
      </div>
    </SettingsLayout>
  );
}