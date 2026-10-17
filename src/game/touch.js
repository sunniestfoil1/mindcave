// Suporte a celular/tablet: detecção de toque, tela sempre deitada (sem aviso) e zoom travado.
// Tela em pé: tenta travar em paisagem (Android, via tela cheia) e, se não der (iOS), gira a página inteira 90° por CSS (classe mc-rotate
// em <html>, regra em index.css). Nesse caso o tamanho da tela e as coordenadas do dedo precisam ser trocados: viewSize() e gameXY().

export function isTouchDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if ((navigator.maxTouchPoints || 0) < 1 && !('ontouchstart' in window)) return false;
  // aparelho híbrido (notebook com tela de toque + mouse): o ponteiro principal é fino, então continua em modo desktop
  return !!window.matchMedia?.('(pointer: coarse)').matches;
}

const isRotated = () => typeof document !== 'undefined' && document.documentElement.classList.contains('mc-rotate');

// Tamanho da área de jogo (já trocado quando a página está girada por CSS). Com o teclado virtual aberto (campo de texto em foco, como o
// chat) o navegador encolhe a janela; a GUI NÃO acompanha: o tamanho de antes do teclado vale até ele fechar, senão todos os botões encolhem.
let stable = null;
const typing = () => { const t = typeof document !== 'undefined' ? document.activeElement?.tagName : null; return t === 'INPUT' || t === 'TEXTAREA'; };
export function viewSize() {
  const w = window.innerWidth, h = window.innerHeight;
  const cur = isRotated() ? { w: h, h: w } : { w, h };
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('mc-touch')) {
    if (typing() && stable) return stable;
    stable = cur;
  }
  return cur;
}

// Posição do dedo no sistema de coordenadas do jogo. A página girada 90° no sentido horário com origem no canto superior esquerdo
// leva o ponto (x, y) do jogo para (innerWidth - y, x) na tela; aqui é o caminho de volta.
export function gameXY(e) {
  return isRotated() ? { x: e.clientY, y: window.innerWidth - e.clientX } : { x: e.clientX, y: e.clientY };
}

// Deslocamento do dedo (dx, dy da tela) no sistema do jogo
export function gameDelta(dx, dy) {
  return isRotated() ? { x: dy, y: -dx } : { x: dx, y: dy };
}

// Em pé = a janela é mais alta que larga (screen.orientation mente em alguns emuladores e navegadores)
const portrait = () => window.innerHeight > window.innerWidth;

// O toque na tela de jogo (usar/colocar, abrir baú ou bancada) gera um "click" depois de soltar o dedo; se o toque abriu uma tela, esse
// click cairia no fundo dela e fecharia na hora. Quem trata o toque pede para engolir o click que vem a seguir.
let swallowUntil = 0;
export function swallowNextClick(ms = 450) { swallowUntil = performance.now() + ms; }

let started = false;
export function initTouch() {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (!isTouchDevice()) return;
  const root = document.documentElement;
  root.classList.add('mc-touch');
  // iOS: segurar o dedo num controle seleciona texto/imagem ou abre o menu de contexto; nada disso vale no jogo (campos de texto continuam normais)
  const inField = (e) => !!(e.target && e.target.closest && e.target.closest('input, textarea'));
  document.addEventListener('selectstart', (e) => { if (!inField(e)) e.preventDefault(); });
  document.addEventListener('contextmenu', (e) => { if (!inField(e)) e.preventDefault(); });
  window.addEventListener('click', (e) => { if (performance.now() < swallowUntil) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  const update = () => root.classList.toggle('mc-rotate', portrait());
  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  window.screen?.orientation?.addEventListener?.('change', update);

  // Zoom: o meta viewport e o touch-action já travam; o iOS ignora os dois, então bloqueia o gesto de pinça também
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  // Primeiro toque (gesto válido): tela cheia + trava em paisagem. Onde não há API (iOS) fica a rotação por CSS.
  if (window.screen?.orientation?.lock) {
    const lock = async () => {
      window.removeEventListener('pointerdown', lock, true);
      try {
        if (!document.fullscreenElement) await root.requestFullscreen?.({ navigationUI: 'hide' });
        await window.screen.orientation.lock('landscape');
      } catch { /* recusado ou sem suporte: segue com a rotação por CSS */ }
      update();
    };
    window.addEventListener('pointerdown', lock, true);
  }
}
