// Moldura comum dos painéis (inventário, bancada, baú, fornalha): janela centrada, slots, cursor com o item e toda a interação de mouse
// no estilo do 1.8.9 (clique, shift-click, duplo clique que junta tudo, arrastar para distribuir). Sem som: mexer em item não toca nada.
import React, { useState, useEffect, useRef } from 'react';
import ItemSlot from './ItemSlot';
import ItemTooltip from './ItemTooltip';
import { Sprite, usePackTexture, useGuiScaleValue } from './GuiSprite';
import { settingsStore } from '@/game/settingsStore';
import * as ops from '@/game/slotOps';
import { canStack } from '@/game/inventory';

import { viewSize } from '@/game/touch';
const DOUBLE_CLICK_MS = 300;
// As refs são recriadas a cada render: a identidade do slot é grupo:índice
const keyOf = (r) => (r ? `${r.group || 'x'}:${r.index}` : null);

function GhostIcon({ path, S }) {
  const url = usePackTexture(path);
  if (!url) return null;
  return <img src={url} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: 16 * S, height: 16 * S, imageRendering: 'pixelated', pointerEvents: 'none', opacity: 0.5 }} />;
}

/**
 * Props: texture, w, h, inv, onClose, onUpdate, children({ S, slot, tex })
 *  - getAllRefs(): todos os slots (para o duplo clique)
 *  - onShift(ref): o que o shift-click faz neste painel
 *  - onChange(): chamado depois de qualquer mudança (recalcula o resultado da fabricação etc.)
 */
export default function ContainerFrame({ texture, w, h, inv, onClose, onUpdate, getAllRefs, onShift, onChange, children }) {
  const S = useGuiScaleValue();
  const tex = usePackTexture(texture);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(null);
  const hoveredRef = useRef(null);
  const st = useRef({ drag: null, last: { ref: null, t: 0, btn: -1 }, shiftDrag: false });
  const live = useRef({});
  live.current = { inv, getAllRefs, onShift, onChange, onUpdate };

  const changed = () => { live.current.onChange?.(); live.current.onUpdate?.(); };

  useEffect(() => {
    let raf = 0, lx = 0, ly = 0;
    const onMove = (e) => { lx = e.clientX; ly = e.clientY; if (!raf) raf = requestAnimationFrame(() => { setMouse({ x: lx, y: ly }); raf = 0; }); };
    window.addEventListener('mousemove', onMove, { passive: true });
    // soltar o botão fora de qualquer slot encerra o arrasto (aplica a distribuição se passou por 2+ slots)
    const onUp = () => {
      const s = st.current;
      if (s.drag && s.drag.refs.length >= 2) { ops.applyDrag(live.current.inv, s.drag.refs, s.drag.button); changed(); }
      s.drag = null; s.shiftDrag = false;
    };
    window.addEventListener('mouseup', onUp);
    const onKey = (e) => {
      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      const invKey = settingsStore.get('user.keys.inventory') || 'KeyE';
      if (e.key === 'Escape' || e.code === invKey || (invKey.startsWith('Key') && e.key.toLowerCase() === invKey.slice(3).toLowerCase())) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
        onClose();
        return;
      }
      // Teclas 1–9: troca o slot sob o mouse com a hotbar (sem som)
      const num = parseInt(e.key, 10);
      const target = hoveredRef.current;
      if (num >= 1 && num <= 9 && target && inv?.hotbar) {
        const hb = ops.arrRef(inv.hotbar, num - 1);
        if (target.output) return;
        const a = target.get(), b = hb.get();
        if (!ops.accepts(target, b) || !ops.accepts(hb, a)) return;
        e.preventDefault(); e.stopPropagation();
        target.set(b); hb.set(a);
        changed();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('keydown', onKey, true); if (raf) cancelAnimationFrame(raf); };
  }, [onClose, inv]);

  const click = (r, button) => { (button === 2 ? ops.rightClick : ops.leftClick)(inv, r); };

  const down = (r, e) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const s = st.current, now = performance.now();
    if (e.shiftKey && e.button === 0) {
      live.current.onShift?.(r); s.shiftDrag = true; s.last = { ref: null, t: 0, btn: -1 }; changed(); return;
    }
    if (e.button === 0 && inv.cursor && keyOf(s.last.ref) === keyOf(r) && s.last.btn === 0 && now - s.last.t < DOUBLE_CLICK_MS) {
      ops.collectAll(inv, live.current.getAllRefs?.() || []);
      s.last = { ref: null, t: 0, btn: -1 }; changed(); return;
    }
    if (inv.cursor && !r.output) { s.drag = { button: e.button, refs: [r] }; return; }
    click(r, e.button);
    s.last = { ref: r, t: now, btn: e.button };
    changed();
  };
  const enter = (r) => {
    hoveredRef.current = r;
    const s = st.current;
    if (s.shiftDrag && r.get()) { live.current.onShift?.(r); changed(); return; }
    if (s.drag && inv.cursor && !s.drag.refs.some((x) => keyOf(x) === keyOf(r)) && !r.output) {
      const sl = r.get();
      if (ops.accepts(r, inv.cursor) && (!sl || canStack(sl, inv.cursor))) s.drag.refs.push(r);
    }
  };
  const up = (r, e) => {
    const s = st.current;
    if (!s.drag) { s.shiftDrag = false; return; }
    const d = s.drag; s.drag = null; e.stopPropagation();
    if (d.refs.length >= 2) ops.applyDrag(inv, d.refs, d.button);
    else { click(d.refs[0], d.button); s.last = { ref: d.refs[0], t: performance.now(), btn: d.button }; }
    changed();
  };

  const slot = (key, x, y, item, props = {}) => {
    const { ref, ...rest } = props;
    return (
      <div
        key={key}
        data-slot={ref ? `${ref.group || 'x'}:${ref.index ?? key}` : undefined}
        style={{ position: 'absolute', left: x * S, top: y * S, width: 16 * S, height: 16 * S }}
        onMouseDown={ref ? (e) => down(ref, e) : undefined}
        onMouseEnter={ref ? () => enter(ref) : undefined}
        onMouseUp={ref ? (e) => up(ref, e) : undefined}
        onMouseLeave={() => { if (hoveredRef.current === ref) hoveredRef.current = null; }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!item && ref?.ghost && <GhostIcon path={ref.ghost} S={S} />}
        <ItemSlot item={item} size={16 * S} transparent fill guiScale={S} onHover={(it) => setHovered(it)} {...rest} />
      </div>
    );
  };

  const left = Math.max(0, Math.floor((viewSize().w - w * S) / 2));
  const top = Math.max(0, Math.floor((viewSize().h - h * S) / 2));

  return (
    <div
      className="fixed inset-0 z-50 select-none pointer-events-auto"
      style={{ background: 'rgba(0,0,0,0.6)', imageRendering: 'pixelated', userSelect: 'none' }}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{ position: 'absolute', left, top, width: w * S, height: h * S, userSelect: 'none' }}
      >
        {children({ S, slot, tex })}
      </div>
      {hovered && !inv.cursor && <ItemTooltip item={hovered} mousePos={mouse} />}
      {inv.cursor && (
        <div className="fixed pointer-events-none z-[120]" style={{ left: mouse.x - 8 * S, top: mouse.y - 8 * S, width: 16 * S, height: 16 * S }}>
          <ItemSlot item={inv.cursor} size={16 * S} transparent fill guiScale={S} />
        </div>
      )}
    </div>
  );
}

// Refs do inventário do jogador (hotbar e inventário de cima): hotbar primeiro nos destinos do shift-click
export function playerRefs(inv) {
  return {
    hotbar: inv.hotbar.map((_, i) => ops.arrRef(inv.hotbar, i, { group: 'hotbar' })),
    main: inv.main.map((_, i) => ops.arrRef(inv.main, i, { group: 'main' })),
  };
}

// Inventário do jogador (3×9 + hotbar) abaixo do container: mainY = y da primeira linha, hotY = y da hotbar
export function PlayerSlots({ refs, inv, slot, mainY, hotY }) {
  return (
    <>
      {inv.main.map((item, i) => slot('m' + i, 8 + (i % 9) * 18, mainY + Math.floor(i / 9) * 18, item, { ref: refs.main[i] }))}
      {inv.hotbar.map((item, i) => slot('h' + i, 8 + i * 18, hotY, item, { ref: refs.hotbar[i] }))}
    </>
  );
}

export { Sprite };
