import React, { useEffect, useRef, useState } from 'react';
import { McText, useGuiScaleValue } from '@/components/game/GuiSprite';
import ItemSlot from '@/components/game/ItemSlot';
import { ITEMS } from '@/game/items';
import { clientStore, useClientStore } from '@/game/client/clientStore';
import { getSelectedPackIds } from '@/game/resourcePacks';

// Widgets de HUD dos módulos do Mind Client (FPS, CPS, Coordinates, Direction, Keystrokes, Memory, Ping, Armor HUD).
// Texto na fonte do jogo, em px de GUI como o resto do HUD; só os módulos ligados são desenhados.
const FACING = ['S', 'SO', 'O', 'NO', 'N', 'NE', 'L', 'SE'];   // yaw 0 = sul, cresce no sentido horário visto de cima (oeste em 90°)


// Posição arrastável dos widgets. Fora do modo de edição o widget só ganha o deslocamento salvo (sem receber clique);
// no modo de edição ele ganha contorno e vira alvo de arrasto, limitado à janela.
function useWidget(id, editing, base, label) {
  const stored = clientStore.getPos(id);
  const [live, setLive] = useState(null);
  const ref = useRef(null);
  const W = typeof window !== 'undefined' ? window.innerWidth : 1;
  const H = typeof window !== 'undefined' ? window.innerHeight : 1;
  const cur = live || { x: stored.x * W, y: stored.y * H };
  const onPointerDown = editing ? (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = ref.current.getBoundingClientRect();
    const start = { sx: e.clientX, sy: e.clientY, ox: cur.x, oy: cur.y };
    let last = { x: cur.x, y: cur.y };
    const move = (ev) => {
      const dx = Math.min(Math.max(ev.clientX - start.sx, -r.left), window.innerWidth - r.right);
      const dy = Math.min(Math.max(ev.clientY - start.sy, -r.top), window.innerHeight - r.bottom);
      last = { x: start.ox + dx, y: start.oy + dy };
      setLive(last);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      clientStore.setPos(id, last.x / window.innerWidth, last.y / window.innerHeight);
      setLive(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  } : undefined;
  const style = {
    ...base,
    transform: [base.transform, `translate(${cur.x}px, ${cur.y}px)`].filter(Boolean).join(' '),
    ...(editing
      ? { pointerEvents: 'auto', cursor: 'move', touchAction: 'none', outline: '1px dashed rgba(255,255,255,0.9)', outlineOffset: 2 * 1, minWidth: 24, minHeight: 10 }
      : { pointerEvents: 'none' }),
  };
  return { ref, style, onPointerDown, title: editing ? label : undefined, 'data-hud-widget': id };
}

function TxtWidget({ id, label, editing, S, text, pos }) {
  const w = useWidget(id, editing, { position: 'absolute', ...pos }, label);
  return (
    <div {...w}>
      <McText text={text} x={0} y={0} S={S} color="#FFFFFF" shadow align={pos.textAlign === 'center' ? 'center' : pos.right !== undefined ? 'right' : 'left'} />
    </div>
  );
}

function Keystrokes({ engine, S, editing }) {
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
  const w = useWidget('keystrokes', editing, { position: 'absolute', left: 4 * S, bottom: 20 * S, display: 'flex', flexDirection: 'column', gap, alignItems: 'center', width: size * 3 + gap * 2 }, 'Keystrokes');
  return (
    <div {...w}>
      <div style={{ display: 'flex' }}>{box('W', keys.KeyW)}</div>
      <div style={{ display: 'flex', gap }}>{box('A', keys.KeyA)}{box('S', keys.KeyS)}{box('D', keys.KeyD)}</div>
      {showMouse && <div style={{ display: 'flex', gap }}>{box('LMB', mouse[0], (size * 3 + gap * 2 - gap) / 2, size)}{box('RMB', mouse[2], (size * 3 + gap * 2 - gap) / 2, size)}</div>}
      {showSpace && box('━━', keys.Space, size * 3 + gap * 2, size * 0.7)}
    </div>
  );
}

function ArmorHud({ engine, S, editing }) {
  const armor = engine?.inventory?.armor || engine?.player?.inventory?.armor || [];
  const scale = clientStore.get('armorhud', 'scale') / 100;
  const showDur = clientStore.get('armorhud', 'durability');
  const slot = 18 * S * scale;
  const w = useWidget('armorhud', editing, { position: 'absolute', right: 4 * S, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 2 * S, alignItems: 'flex-end' }, 'Armor HUD');
  // da cabeça aos pés: índice 0 = capacete, 1 = peitoral, 2 = calça, 3 = bota (igual ao inventário)
  const worn = [0, 1, 2, 3].map((i) => armor[i]).filter((it) => it && it.id);
  if (worn.length === 0) {
    if (!editing) return null;
    // sem armadura vestida, o modo de edição mostra um espaço para você posicionar o widget
    return <div {...w}><div style={{ width: slot, height: slot * 2, border: `${Math.max(1, S / 2)}px dashed rgba(255,255,255,0.5)`, boxSizing: 'border-box' }} /></div>;
  }
  return (
    <div {...w}>
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

function PackOverlay({ S, editing }) {
  const packs = getSelectedPackIds();
  const activePackName = packs.length > 0 ? packs[0].replace('.zip', '') : 'Padrão 1.8.9';
  const w = useWidget('packoverlay', editing, {
    position: 'absolute', left: 4 * S, top: 4 * S, display: 'flex', alignItems: 'center', gap: 3 * S,
    background: 'rgba(0, 0, 0, 0.45)', border: `${Math.max(1, S / 2)}px solid rgba(255, 255, 255, 0.25)`,
    padding: `${2 * S}px ${4 * S}px`, boxSizing: 'border-box',
  }, 'Pack Overlay');
  return <div {...w}><McText text={`[${activePackName}]`} x={0} y={0} S={S} color="#FFFFA0" shadow /></div>;
}

export default function ClientHud({ hud, engine }) {
  useClientStore();
  const S = useGuiScaleValue();
  const editing = clientStore.isEditing();
  if (!hud || ((hud.hideHud || hud.f3) && !editing)) return null;
  const out = [];
  const txt = (id, label, text, pos) => out.push(<TxtWidget key={id} id={id} label={label} editing={editing} S={S} text={text} pos={pos} />);
  if (clientStore.isOn('fps')) txt('fps', 'FPS', `FPS: ${hud.fps}`, { left: '50%', top: 6 * S, textAlign: 'center' });
  if (clientStore.isOn('coordinates')) {
    const d = clientStore.get('coordinates', 'decimals');
    const f = (n) => Number(n).toFixed(d);
    txt('coordinates', 'Coordinates', `XYZ: ${f(hud.px)} / ${f(hud.py)} / ${f(hud.pz)}`, { left: 4 * S, top: (clientStore.isOn('packoverlay') ? 20 : 4) * S });
  }
  if (clientStore.isOn('direction')) {
    const yaw = ((Number(hud.yaw) % 360) + 360) % 360;
    txt('direction', 'Direction Hud', `Direção: ${FACING[Math.round(yaw / 45) % 8]} (${yaw.toFixed(0)}°)`, { left: 4 * S, top: ((clientStore.isOn('packoverlay') ? 20 : 4) + (clientStore.isOn('coordinates') ? 12 : 0)) * S });
  }
  if (clientStore.isOn('cps')) txt('cps', 'CPS', `${hud.cps} CPS`, { left: 5 * S, top: '40%' });
  if (clientStore.isOn('memory')) {
    const m = typeof performance !== 'undefined' ? performance.memory : null;
    const pos = { right: 4 * S, top: 4 * S };
    if (m) txt('memory', 'Memory', `Mem: ${Math.round(m.usedJSHeapSize / 1048576)} / ${Math.round(m.jsHeapSizeLimit / 1048576)} MB`, pos);
    else if (editing) txt('memory', 'Memory', 'Mem: -- MB', pos);
  }
  if (clientStore.isOn('ping')) {
    const me = hud.pings && hud.pings.length > 1 ? hud.pings.find((p) => p.name === hud.selfName) : null;
    const pos = { right: 4 * S, top: (clientStore.isOn('memory') ? 16 : 4) * S };
    if (me && me.pingMs != null) txt('ping', 'Ping Display', `Ping: ${Math.round(me.pingMs)} ms`, pos);
    else if (editing) txt('ping', 'Ping Display', 'Ping: -- ms', pos);
  }
  return (
    <div className="pointer-events-none fixed inset-0 select-none" data-client-hud>
      {out}
      {clientStore.isOn('packoverlay') && <PackOverlay S={S} editing={editing} />}
      {clientStore.isOn('keystrokes') && <Keystrokes engine={engine} S={S} editing={editing} />}
      {clientStore.isOn('armorhud') && <ArmorHud engine={engine} S={S} editing={editing} />}
    </div>
  );
}
