import React, { useEffect, useState } from 'react';
import { McText, useGuiScaleValue } from '@/components/game/GuiSprite';
import ItemSlot from '@/components/game/ItemSlot';
import { ITEMS } from '@/game/items';
import { clientStore, useClientStore } from '@/game/client/clientStore';
import { getSelectedPackIds } from '@/game/resourcePacks';

// Widgets de HUD dos módulos do Mind Client (FPS, CPS, Coordinates, Direction, Keystrokes, Memory, Ping, Armor HUD).
// Texto na fonte do jogo, em px de GUI como o resto do HUD; só os módulos ligados são desenhados.
const FACING = ['S', 'SO', 'O', 'NO', 'N', 'NE', 'L', 'SE'];   // yaw 0 = sul, cresce no sentido horário visto de cima (oeste em 90°)

function Keystrokes({ engine, S }) {
  const [, tick] = useState(0);
  const showMouse = clientStore.get('keystrokes', 'mouse');
  const showSpace = clientStore.get('keystrokes', 'space');
  useEffect(() => {
    let last = '';
    const update = () => {
      const k = engine?.keys || {};
      const m = engine?.mouseBtn || {};
      const sig = [k.KeyW, k.KeyA, k.KeyS, k.KeyD, k.Space, m[0], m[2]].map((v) => (v ? 1 : 0)).join('');
      if (sig !== last) {
        last = sig;
        tick((n) => n + 1);
      }
    };
    window.addEventListener('keydown', update);
    window.addEventListener('keyup', update);
    window.addEventListener('mousedown', update);
    window.addEventListener('mouseup', update);
    return () => {
      window.removeEventListener('keydown', update);
      window.removeEventListener('keyup', update);
      window.removeEventListener('mousedown', update);
      window.removeEventListener('mouseup', update);
    };
  }, [engine]);
  const keys = engine?.keys || {};
  const mouse = engine?.mouseBtn || {};
  const size = 16 * S;
  const box = (label, down, w = size, h = size) => (
    <div key={label} style={{
      width: w, height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
      background: down ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.42)', border: `${Math.max(1, S / 2)}px solid rgba(255,255,255,0.25)`,
      color: down ? '#000' : '#fff', fontFamily: "'Minecraft', monospace", fontSize: 7 * S, lineHeight: 1,
    }}>{label}</div>
  );
  const gap = S;
  return (
    <div style={{ position: 'absolute', left: 4 * S, bottom: 20 * S, display: 'flex', flexDirection: 'column', gap, alignItems: 'center', width: size * 3 + gap * 2 }}>
      <div style={{ display: 'flex' }}>{box('W', keys.KeyW)}</div>
      <div style={{ display: 'flex', gap }}>{box('A', keys.KeyA)}{box('S', keys.KeyS)}{box('D', keys.KeyD)}</div>
      {showMouse && <div style={{ display: 'flex', gap }}>{box('LMB', mouse[0], (size * 3 + gap * 2 - gap) / 2, size)}{box('RMB', mouse[2], (size * 3 + gap * 2 - gap) / 2, size)}</div>}
      {showSpace && box('━━', keys.Space, size * 3 + gap * 2, size * 0.7)}
    </div>
  );
}

function ArmorHud({ engine, S }) {
  const armor = engine?.inventory?.armor || engine?.player?.inventory?.armor || [];
  const scale = clientStore.get('armorhud', 'scale') / 100;
  const showDur = clientStore.get('armorhud', 'durability');
  const slot = 18 * S * scale;
  // da cabeça aos pés: o 1.8.9 guarda capacete, peitoral, calça, bota nos índices 3..0
  const order = [3, 2, 1, 0];
  const worn = order.map((i) => armor[i]).filter((it) => it && it.id);
  if (worn.length === 0) return null;
  return (
    <div style={{ position: 'absolute', right: 4 * S, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 2 * S, alignItems: 'flex-end' }}>
      {worn.map((it) => {
        const def = ITEMS[it.id];
        const max = def?.durability;
        const left = max ? (it.durability ?? max) : null;
        return (
          <div key={it.id + ':' + (it.slotKey ?? '')} style={{ display: 'flex', alignItems: 'center', gap: 3 * S }}>
            {showDur && left !== null && <McText text={`${left}`} x={0} y={0} S={S * scale} color="#FFFFFF" shadow align="right" />}
            <ItemSlot item={it} size={slot} transparent guiScale={S} />
          </div>
        );
      })}
    </div>
  );
}

export default function ClientHud({ hud, engine }) {
  useClientStore();
  const S = useGuiScaleValue();
  if (!hud || hud.hideHud || hud.f3) return null;
  const txt = (text, style, key) => (
    <div key={key} style={{ position: 'absolute', pointerEvents: 'none', ...style }}>
      <McText text={text} x={0} y={0} S={S} color="#FFFFFF" shadow align={style.textAlign === 'center' ? 'center' : style.right !== undefined ? 'right' : 'left'} />
    </div>
  );
  const out = [];
  if (clientStore.isOn('fps')) out.push(txt(`FPS: ${hud.fps}`, { left: '50%', top: 6 * S, textAlign: 'center' }, 'fps'));
  if (clientStore.isOn('coordinates')) {
    const d = clientStore.get('coordinates', 'decimals');
    const f = (n) => Number(n).toFixed(d);
    out.push(txt(`XYZ: ${f(hud.px)} / ${f(hud.py)} / ${f(hud.pz)}`, { left: 4 * S, top: 4 * S }, 'xyz'));
  }
  if (clientStore.isOn('direction')) {
    const yaw = ((Number(hud.yaw) % 360) + 360) % 360;
    out.push(txt(`Direção: ${FACING[Math.round(yaw / 45) % 8]} (${yaw.toFixed(0)}°)`, { left: 4 * S, top: (clientStore.isOn('coordinates') ? 16 : 4) * S }, 'dir'));
  }
  if (clientStore.isOn('cps')) out.push(txt(`${hud.cps} CPS`, { left: 5 * S, top: '40%' }, 'cps'));
  if (clientStore.isOn('memory')) {
    const m = typeof performance !== 'undefined' ? performance.memory : null;
    if (m) out.push(txt(`Mem: ${Math.round(m.usedJSHeapSize / 1048576)} / ${Math.round(m.jsHeapSizeLimit / 1048576)} MB`, { right: 4 * S, top: 4 * S }, 'mem'));
  }
  if (clientStore.isOn('ping') && hud.pings && hud.pings.length > 1) {
    const me = hud.pings.find((p) => p.name === hud.selfName);
    if (me && me.pingMs != null) out.push(txt(`Ping: ${Math.round(me.pingMs)} ms`, { right: 4 * S, top: (clientStore.isOn('memory') ? 16 : 4) * S }, 'ping'));
  }
  if (clientStore.isOn('packoverlay')) {
    const packs = getSelectedPackIds();
    const activePackName = packs.length > 0 ? packs[0].replace('.zip', '') : 'Padrão 1.8.9';
    const pos = clientStore.get('packoverlay', 'position') || 'top-right';
    const style = pos === 'top-left'
      ? { left: 4 * S, top: (clientStore.isOn('direction') ? 28 : (clientStore.isOn('coordinates') ? 16 : 4)) * S }
      : pos === 'bottom-left'
      ? { left: 4 * S, bottom: 44 * S }
      : { right: 4 * S, top: ((clientStore.isOn('memory') ? 12 : 0) + (clientStore.isOn('ping') ? 12 : 0) + 4) * S };

    out.push(
      <div key="packoverlay" style={{
        position: 'absolute', pointerEvents: 'none', ...style,
        display: 'flex', alignItems: 'center', gap: 3 * S,
        background: 'rgba(0, 0, 0, 0.45)', border: `${Math.max(1, S / 2)}px solid rgba(255, 255, 255, 0.25)`,
        padding: `${2 * S}px ${4 * S}px`, boxSizing: 'border-box',
      }}>
        <McText text={`[${activePackName}]`} x={0} y={0} S={S} color="#FFFFA0" shadow />
      </div>
    );
  }
  return (
    <div className="pointer-events-none fixed inset-0 select-none" data-client-hud>
      {out}
      {clientStore.isOn('keystrokes') && <Keystrokes engine={engine} S={S} />}
      {clientStore.isOn('armorhud') && <ArmorHud engine={engine} S={S} />}
    </div>
  );
}
