import React, { useEffect, useRef, useState } from 'react';
import GuiButton from '@/components/java/GuiButton';
import GuiContext, { useGui } from '@/components/java/GuiContext';
import { Sprite, useGuiScaleValue } from '@/components/game/GuiSprite';
import ItemSlot from '@/components/game/ItemSlot';
import { getWidgetsTexture } from '@/game/gui/textures';
import { settingsStore } from '@/game/settingsStore';
import { gameXY, gameDelta, swallowNextClick, viewSize } from '@/game/touch';

// Controles de toque (celular) sobre o HUD de sempre. Tudo em pixels de GUI, com os botões do jogo (GuiButton, widgets.png):
//  · joystick à esquerda (andar; empurrar até o fim para a frente = correr)    · arrastar o dedo no resto da tela = olhar
//  · toque rápido = usar/colocar (ou bater, se há mob na mira); segurar = quebrar/bater (comida e arco: segurar = usar)
//  · tocar num slot da hotbar seleciona    · Pular (grande), Agachar (botas) e Inventário (baú) no canto direito    · Chat (livro e pena) e Pausa no alto à direita
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
        position: 'absolute', left: 18 * S, top: (H - 18 - 2 * R) * S, width: 2 * R * S, height: 2 * R * S, borderRadius: '50%', touchAction: 'none',
        background: 'rgba(0,0,0,0.35)', border: `${S}px solid rgba(255,255,255,0.45)`, boxSizing: 'border-box',
      }} onPointerDown={stickStart} onPointerMove={stickMove} onPointerUp={stickEnd} onPointerCancel={stickEnd}>
        <div ref={thumb} style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -12 * S, marginTop: -12 * S, pointerEvents: 'none' }}>
          <Sprite url={getWidgetsTexture()} u={0} v={22} w={24} h={24} S={S} />
        </div>
      </div>

      {/* botões do jogo (margem de 16 px de GUI das bordas: a barra do navegador/indicador do iPhone come os cantos) */}
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {/* Pular: grande, no canto onde o polegar direito repousa (o botão do jogo ampliado 1,4×, mantendo os pixels da textura) */}
        <div className="absolute inset-0" style={{ pointerEvents: 'none', transformOrigin: `${(W - 16) * S}px ${(H - 16) * S}px`, transform: 'scale(1.4)' }}>
          <GuiButton x={bx(W - 16 - 52)} y={H - 16 - 20} width={52} label="Pular" {...hold('jump')} />
        </div>
        {/* acima do Pular: Agachar (botas, fica aceso enquanto agachado) e Inventário (baú). Ícones do jogo em vez de texto. */}
        <GuiButton x={bx(W - 16 - 24)} y={H - 70} width={24} title="Inventário" {...tap(() => engine.touchKey('inventory', true))}
          icon={<ItemSlot item={{ id: 54, count: 1 }} size={16 * S} transparent guiScale={S} />} />
        <GuiButton x={bx(W - 16 - 24 - 4 - 24)} y={H - 70} width={24} title="Agachar" active={sneak} {...tap(toggleSneak)}
          icon={<ItemSlot item={{ id: 301, count: 1 }} size={16 * S} transparent guiScale={S} />} />
        {/* canto superior direito: Chat (livro e pena) e Pausa (o ícone de pausa do rádio) */}
        <GuiButton x={bx(W - 28 - 4 - 24)} y={8} width={24} title="Chat" {...tap(() => engine.touchKey('chat', true))}
          icon={<ItemSlot item={{ id: 386, count: 1 }} size={16 * S} transparent guiScale={S} />} />
        <GuiButton x={bx(W - 28)} y={8} width={20} title="Pausa" {...tap(() => engine.touchPause())}
          icon={(
            <div style={{ display: 'flex', gap: 2 * S }}>
              {[0, 1].map((i) => <div key={i} style={{ width: 2 * S, height: 6 * S, background: '#E0E0E0', boxShadow: `${S}px ${S}px 0 #3F3F3F` }} />)}
            </div>
          )} />
      </div>
    </div>
  );
}

export default function TouchControls({ engine, hud }) {
  // Os controles seguem a escala do HUD (a mesma da hotbar que eles cobrem), não a dos menus: GuiButton lê a escala do contexto
  const S = useGuiScaleValue();
  const [dims, setDims] = useState(viewSize);
  useEffect(() => {
    const on = () => setDims(viewSize());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  if (!engine || !hud) return null;
  const active = !(hud.hasGuiOpen || hud.paused || hud.chatOpen || hud.isDead || hud.sleeping || hud.hideHud);
  if (!active) return null;
  const ctx = { scale: S, guiWidth: Math.floor(dims.w / S), guiHeight: Math.floor(dims.h / S), screenWidth: dims.w, screenHeight: dims.h };
  return <GuiContext.Provider value={ctx}><Controls engine={engine} /></GuiContext.Provider>;
}
