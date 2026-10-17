import React, { useState, useEffect } from 'react';
import { GuiScreen, GuiButton, GuiText, useGui } from '@/components/java';
import { JavaButton, JavaSlider } from '@/components/java/GuiOptionControls';
import { useSettings } from '@/game/settingsStore';
import { KEY_ACTIONS, DEFAULT_USER } from '@/game/settingsDefaults';
import KeybindRow from './KeybindRow';
import { isTouchDevice } from '@/game/touch';

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function KeybindsContent({ onBack }) {
  const store = useSettings();
  const { guiHeight, scale } = useGui();
  const [listening, setListening] = useState(null);
  const [conflicts, setConflicts] = useState({});

  const keys = store.get('user.keys') || {};

  // Captura de tecla/botão para reatribuição (capture phase — não dispara ações do jogo)
  useEffect(() => {
    if (!listening) return;
    const handler = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.type === 'keydown') {
        if (e.code === 'Escape') { setListening(null); return; }
        if (e.code === 'Backspace' || e.code === 'Delete') {
          store.set(`user.keys.${listening}`, '');
          setListening(null);
          return;
        }
        store.set(`user.keys.${listening}`, e.code);
        setListening(null);
      }
    };
    const mouseHandler = (e) => {
      e.preventDefault(); e.stopPropagation();
      store.set(`user.keys.${listening}`, 'Mouse' + e.button);
      setListening(null);
    };
    window.addEventListener('keydown', handler, true);
    window.addEventListener('mousedown', mouseHandler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
      window.removeEventListener('mousedown', mouseHandler, true);
    };
  }, [listening]);

  // Detecção de conflitos (permite use/aim/attack compartilharem botões do mouse)
  useEffect(() => {
    const seen = {};
    for (const [action, code] of Object.entries(keys)) {
      if (!code) continue;
      if (!seen[code]) seen[code] = [];
      seen[code].push(action);
    }
    const cmap = {};
    for (const [code, actions] of Object.entries(seen)) {
      if (actions.length > 1) {
        const allowed = actions.every(a => ['use', 'aim', 'attack'].includes(a));
        if (!allowed) for (const a of actions) cmap[a] = actions.filter(x => x !== a);
      }
    }
    setConflicts(cmap);
  }, [keys]);

  const resetKeys = () => store.set('user.keys', clone(DEFAULT_USER.keys));

  const mouseOpts = [
    { type: 'slider', key: 'user.mouseSensitivity', label: 'Sensibilidade', min: 0, max: 200, step: 5,
      format: v => v === 0 ? 'Sens.: Bocejo' : v >= 200 ? 'Sens.: HIPER!!!' : `Sens.: ${v}%` },
    ...(isTouchDevice() ? [
      { type: 'slider', key: 'user.touchLookSensitivity', label: 'Câmera (toque)', min: 10, max: 300, step: 5, format: v => `Câmera: ${v}%` },
      { type: 'slider', key: 'user.touchMoveSensitivity', label: 'Joystick', min: 25, max: 200, step: 5, format: v => `Joystick: ${v}%` },
    ] : []),
    { type: 'toggle', key: 'user.invertMouse', label: 'Inverter mouse' },
    { type: 'toggle', key: 'user.rawInput', label: 'Entrada bruta' },
    { type: 'slider', key: 'user.scrollSensitivity', label: 'Rolagem', min: 1, max: 100, step: 1,
      format: v => `Rolagem: ${(v / 10).toFixed(1)}` },
    { type: 'toggle', key: 'user.discreteScroll', label: 'Rolagem discreta' },
    { type: 'slider', key: 'user.adsSensitivity', label: 'Sens. ADS', min: 10, max: 200, step: 5,
      format: v => `Sens. ADS: ${v}%` },
    { type: 'slider', key: 'user.zoomSensitivity', label: 'Sens. zoom', min: 10, max: 100, step: 5,
      format: v => `Sens. zoom: ${v}%` },
  ];

  const modeOpts = [
    { type: 'cycle', key: 'user.sneakMode', label: 'Agachar', options: [{ value: 'hold', label: 'Segurar' }, { value: 'toggle', label: 'Alternar' }] },
    { type: 'cycle', key: 'user.sprintMode', label: 'Correr', options: [{ value: 'hold', label: 'Segurar' }, { value: 'toggle', label: 'Alternar' }, { value: 'auto', label: 'Automático' }] },
    { type: 'cycle', key: 'user.aimMode', label: 'Mirar (ADS)', options: [{ value: 'hold', label: 'Segurar' }, { value: 'toggle', label: 'Alternar' }] },
  ];

  const renderOpt = (opt) => {
    const value = store.get(opt.key);
    if (opt.type === 'slider')
      return <JavaSlider key={opt.key} label={opt.label} value={value} min={opt.min} max={opt.max} step={opt.step} format={opt.format} onChange={v => store.set(opt.key, v)} width={150} />;
    if (opt.type === 'toggle')
      return <JavaButton key={opt.key} label={opt.label} value={!!value} options={[{ value: true, label: 'Ligado' }, { value: false, label: 'Desligado' }]} onChange={v => store.set(opt.key, v)} width={150} />;
    return <JavaButton key={opt.key} label={opt.label} value={value} options={opt.options} onChange={v => store.set(opt.key, v)} width={150} />;
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `${150 * scale}px ${150 * scale}px`,
    gap: `${2 * scale}px`,
    justifyContent: 'center',
  };

  return (
    <>
      <div style={{ position: 'absolute', left: '50%', top: 6 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Controles" color="#FFFFFF" shadow scale={scale} />
      </div>

      <div style={{
        position: 'absolute', left: '50%', top: 20 * scale, bottom: 32 * scale,
        width: 312 * scale, transform: 'translateX(-50%)',
        overflowY: 'auto', overflowX: 'hidden',
      }}>
        {/* Mouse */}
        <div style={{ marginBottom: 2 * scale, textAlign: 'center' }}>
          <GuiText text="Mouse" color="#A0A0A0" shadow scale={scale} />
        </div>
        <div style={{ ...gridStyle, marginBottom: 8 * scale }}>
          {mouseOpts.map(renderOpt)}
        </div>

        {/* Grupos de teclas */}
        {KEY_ACTIONS.map(group => (
          <div key={group.group} style={{ marginBottom: 6 * scale }}>
            <div style={{ marginBottom: 2 * scale, textAlign: 'center' }}>
              <GuiText text={group.group} color="#A0A0A0" shadow scale={scale} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {group.actions.map(a => (
                <KeybindRow
                  key={a.id}
                  label={a.label}
                  code={keys[a.id]}
                  isListening={listening === a.id}
                  conflict={conflicts[a.id]}
                  onClick={() => setListening(listening === a.id ? null : a.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Modos */}
        <div style={{ marginBottom: 2 * scale, textAlign: 'center' }}>
          <GuiText text="Modos" color="#A0A0A0" shadow scale={scale} />
        </div>
        <div style={{ ...gridStyle, marginBottom: 8 * scale }}>
          {modeOpts.map(renderOpt)}
        </div>

        {/* Ajuda */}
        <div style={{ textAlign: 'center', marginBottom: 2 * scale }}>
          <GuiText text="Clique numa ação e pressione uma tecla." color="#707070" shadow scale={scale} />
        </div>
        <div style={{ textAlign: 'center', marginBottom: 4 * scale }}>
          <GuiText text="Backspace remove. Esc cancela. Vermelho = conflito." color="#707070" shadow scale={scale} />
        </div>
      </div>

      <GuiButton x={-204} y={guiHeight - 28} width={98} label="Restaurar" onClick={resetKeys} />
      <GuiButton x={-100} y={guiHeight - 28} width={200} label="Pronto" onClick={onBack} />
    </>
  );
}

export default function KeybindsPage({ onBack }) {
  return (
    <GuiScreen>
      <KeybindsContent onBack={onBack} />
    </GuiScreen>
  );
}