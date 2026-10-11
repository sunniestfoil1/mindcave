// Laboratório do HUD: monta os componentes REAIS do jogo (hotbar, XP, criativo, inventário) sem mapa.
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import '/src/index.css';
import { loadPack } from '/src/game/pack.js';
import { loadRealTextures } from '/src/game/textures.js';
import { createInventory } from '/src/game/inventory.js';
import InventoryUI from '/src/components/game/InventoryUI.jsx';
import CreativeUI from '/src/components/game/CreativeUI.jsx';
import GameHud from '/src/components/game/GameHud.jsx';
import CraftingTableUI from '/src/components/game/CraftingTableUI.jsx';
import FurnaceUI from '/src/components/game/FurnaceUI.jsx';
import ChestUI from '/src/components/game/ChestUI.jsx';

const params = new URLSearchParams(location.search);
const out = document.getElementById('out');
const log = (m) => { out.textContent += m + '\n'; };

function App() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState(params.get('mode') || 'hud');
  const [rev, setRev] = useState(0);
  const inv = useMemo(() => {
    const i = createInventory();
    i.hotbar[0] = { id: 276, count: 1, meta: 0 };
    i.hotbar[1] = { id: 1, count: 64, meta: 0 };
    i.hotbar[2] = { id: 2, count: 12, meta: 0 };
    i.hotbar[3] = { id: 17, count: 5, meta: 0 };
    i.main[0] = { id: 297, count: 3, meta: 0 };
    i.main[5] = { id: 264, count: 2, meta: 0 };
    return i;
  }, []);
  const furnace = useMemo(() => ({ input: { id: 12, count: 8, meta: 0 }, fuel: { id: 263, count: 5, meta: 0 }, output: { id: 20, count: 3, meta: 0 }, burnTime: 120, totalBurn: 200, cookTime: 90 }), []);
  const chest = useMemo(() => ({ slots: Array.from({ length: 27 }, (_, i) => (i % 5 === 0 ? { id: 1 + (i % 7), count: 8 + i, meta: 0 } : null)) }), []);
  useEffect(() => { loadPack().then(() => loadRealTextures()).then((ok) => { log('texturas reais: ' + ok); setReady(true); }); }, []);
  window.__hudLab = { inv, setMode, mode, rev };
  const hud = {
    hotbar: inv.hotbar, selectedSlot: 1, health: 14, hunger: 15, armor: 6, absorption: 0, xpProgress: 0.6, xpLevel: 7, gamemode: 'survival',
    paused: false, chatOpen: false, realTextures: true, clock: '12:00', shaderMode: 0, air: 300, effects: [], hurtTime: 0,
  };
  if (!ready) return <div style={{ color: '#fff', padding: 60 }}>carregando pack…</div>;
  return (
    <>
      <GameHud hud={mode === 'hud-creative' ? { ...hud, gamemode: 'creative' } : hud} onPause={() => {}} />
      {mode === 'inventory' && <InventoryUI inv={inv} onUpdate={() => setRev((r) => r + 1)} onClose={() => setMode('hud')} hud={hud} />}
      {mode === 'crafting' && <CraftingTableUI inv={inv} onUpdate={() => setRev((r) => r + 1)} onClose={() => setMode('hud')} />}
      {mode === 'furnace' && <FurnaceUI furnace={furnace} inv={inv} onUpdate={() => setRev((r) => r + 1)} onClose={() => setMode('hud')} />}
      {mode === 'chest' && <ChestUI title="Baú" container={chest} inv={inv} onUpdate={() => setRev((r) => r + 1)} onClose={() => setMode('hud')} />}
      {mode === 'creative' && <CreativeUI inv={inv} onUpdate={() => setRev((r) => r + 1)} onClose={() => setMode('hud')} />}
    </>
  );
}

const bar = document.getElementById('bar');
for (const m of ['hud', 'hud-creative', 'inventory', 'creative', 'crafting', 'furnace', 'chest']) {
  const b = document.createElement('button'); b.textContent = m; b.onclick = () => window.__hudLab.setMode(m); bar.append(b);
}
createRoot(document.getElementById('root')).render(<App />);
