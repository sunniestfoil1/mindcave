import React, { useEffect, useRef, useState } from 'react';
import GuiButton from '@/components/java/GuiButton';
import { GuiProvider, useGui } from '@/components/java/GuiContext';
import { Sprite } from '@/components/game/GuiSprite';
import { getWidgetsTexture } from '@/game/gui/textures';
import { settingsStore } from '@/game/settingsStore';
import { gameXY, gameDelta, swallowNextClick } from '@/game/touch';

// Controles de toque (celular) sobre o HUD de sempre. Tudo em pixels de GUI, com os botões do jogo (GuiButton, widgets.png):
//  · joystick à esquerda (andar; empurrar até o fim para a frente = correr)    · arrastar o dedo no resto da tela = olhar
//  · toque rápido = usar/colocar (ou bater, se há mob na mira); segurar = quebrar/bater (comida e arco: segurar = usar)
//  · tocar num slot da hotbar seleciona    · Pular / Agachar à direita    · Inv ao lado da hotbar    · Pausa e Chat no alto
// A entrada vai para o motor pelas rotas do teclado e do mouse (engine.touch*), com as teclas que o jogador configurou.
const R = 30;          // raio da base do joystick (px de GUI)
const HOLD_MS = 250;   // dedo parado por este tempo vira "segurar"
const MOVED_PX = 10;   // andou isso na tela e deixa de ser toque

function Controls({ engine }) {
  const { scale: S, guiWidth: W, guiHeight: H } = useGui();
  const [sneak, setSneak] = useState(false);
  const base = useRef(null), thumb = useRef(null);
  const stick = useRef(null), look = useRef(null);

  useEffect(() => () => { engine.touchReset(); }, [engine]);

  // ---- joystick ----
  const stickMove = (e) => {
    const s = stick.current;
    if (!s || s.id !== e.pointerId) return;
    const p = gameXY(e);
    let nx = (p.x - s.cx) / (R * S), ny = (p.y - s.cy) / (R * S);
    const len = Math.hypot(nx, ny);
    if (len > 1) { nx /= len; ny /= len; }
    thumb.current.style.transform = `translate(${nx * R * S}px, ${ny * R * S}px)`;
    // sensibilidade do joystick: quanto maior, menos ele precisa ser empurrado para andar
    const sens = settingsStore.get('user.touchMoveSensitivity') ?? 100;
    const thr = Math.min(0.9, Math.max(0.06, 0.3 / (sens / 100)));
    engine.touchMove(ny < -thr, ny > thr, nx < -thr, nx > thr, ny < -0.92);
  };
  const stickEnd = (e) => {
    if (!stick.current || stick.current.id !== e.pointerId) return;
    stick.current = null;
    thumb.current.style.transform = 'translate(0px, 0px)';
    engine.touchMove(false, false, false, false, false);
  };
  const stickStart = (e) => {
    e.preventDefault();
    if (stick.current) return;
    const r = base.current.getBoundingClientRect();
    const c = gameXY({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    stick.current = { id: e.pointerId, cx: c.x, cy: c.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stickMove(e);
  };

  // ---- câmera / usar / quebrar ----
  const lookEnd = (e) => {
    const l = look.current;
    if (!l || l.id !== e.pointerId) return;
    clearTimeout(l.timer);
    look.current = null;
    if (e.type === 'pointerup') swallowNextClick();
    if (l.holding !== null) engine.touchButton(l.holding, false);
    else if (!l.moved && e.type === 'pointerup' && performance.now() - l.t < 400) engine.touchTap();
  };
  const lookStart = (e) => {
    e.preventDefault();
    if (look.current) return;
    const l = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, holding: null, t: performance.now() };
    l.timer = setTimeout(() => {
      if (look.current === l && !l.moved) { l.holding = engine.touchHoldButton(); engine.touchButton(l.holding, true); }
    }, HOLD_MS);
    look.current = l;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const lookMove = (e) => {
    const l = look.current;
    if (!l || l.id !== e.pointerId) return;
    if (!l.moved && Math.hypot(e.clientX - l.sx, e.clientY - l.sy) > MOVED_PX) { l.moved = true; if (l.holding === null) clearTimeout(l.timer); }
    if (!l.moved) return;   // antes de passar do limite o dedo ainda conta como toque; o trecho já andado entra no primeiro giro
    const d = gameDelta(e.clientX - l.x, e.clientY - l.y);
    l.x = e.clientX; l.y = e.clientY;
    engine.touchLook(d.x, d.y);
  };

  // botão que fica apertado enquanto o dedo está nele (pular)
  const hold = (action) => ({
    onPointerDown: (e) => { e.preventDefault(); engine.touchKey(action, true); },
    onPointerUp: () => engine.touchKey(action, false),
    onPointerCancel: () => engine.touchKey(action, false),
  });
  // botões que abrem telas (Inv, Pausa, Chat) agem no click, depois de soltar o dedo: agir ao encostar faria o click seguinte cair na tela nova e fechá-la
  const tap = (fn) => ({ onClick: fn });

  const toggleSneak = () => { const on = !sneak; setSneak(on); engine.touchKey('sneak', on); };
  // GuiButton posiciona a partir do centro da tela (x) e do topo (y), em px de GUI
  const bx = (left) => left - W / 2;

  return (
    <div className="fixed inset-0" style={{ touchAction: 'none', zIndex: 5 }} data-touch-controls>
      {/* câmera: tudo que não é controle */}
      <div className="absolute inset-0" style={{ touchAction: 'none' }}
        onPointerDown={lookStart} onPointerMove={lookMove} onPointerUp={lookEnd} onPointerCancel={lookEnd} />

      {/* hotbar: toque seleciona o slot (os slots do 1.8.9 têm 20 px, começando 1 px dentro da moldura de 182) */}
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} data-touch-slot={i} style={{ position: 'absolute', left: (W / 2 - 90 + i * 20) * S, top: (H - 22) * S, width: 20 * S, height: 22 * S, touchAction: 'none' }}
          onPointerDown={(e) => { e.preventDefault(); engine.player.selectedSlot = i; }} />
      ))}

      {/* joystick */}
      <div ref={base} data-touch-stick style={{
        position: 'absolute', left: 10 * S, top: (H - 10 - 2 * R) * S, width: 2 * R * S, height: 2 * R * S, borderRadius: '50%', touchAction: 'none',
        background: 'rgba(0,0,0,0.35)', border: `${S}px solid rgba(255,255,255,0.45)`, boxSizing: 'border-box',
      }} onPointerDown={stickStart} onPointerMove={stickMove} onPointerUp={stickEnd} onPointerCancel={stickEnd}>
        <div ref={thumb} style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -12 * S, marginTop: -12 * S, pointerEvents: 'none' }}>
          <Sprite url={getWidgetsTexture()} u={0} v={22} w={24} h={24} S={S} />
        </div>
      </div>

      {/* botões do jogo */}
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        <GuiButton x={bx(W - 62)} y={H - 46} width={52} label="Pular" {...hold('jump')} />
        <GuiButton x={bx(W - 62)} y={H - 22} width={52} label={sneak ? '§aAgachar' : 'Agachar'} {...tap(toggleSneak)} />
        <GuiButton x={bx(W / 2 + 94)} y={H - 22} width={30} label="Inv" {...tap(() => engine.touchKey('inventory', true))} />
        <GuiButton x={bx(W - 56)} y={4} width={52} label="Pausa" {...tap(() => engine.touchPause())} />
        <GuiButton x={bx(W - 110)} y={4} width={52} label="Chat" {...tap(() => engine.touchKey('chat', true))} />
      </div>
    </div>
  );
}

export default function TouchControls({ engine, hud }) {
  if (!engine || !hud) return null;
  const active = !(hud.hasGuiOpen || hud.paused || hud.chatOpen || hud.isDead || hud.sleeping || hud.hideHud);
  if (!active) return null;
  return <GuiProvider><Controls engine={engine} /></GuiProvider>;
}
