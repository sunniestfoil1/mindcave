// Quem manda no rádio do jogo: o jogador (liga/desliga no botão) ou o próprio jogo (um jukebox perto abafa o rádio e, quando o jukebox some
// ou o jogador se afasta, o rádio volta sozinho). Quem pausou por ordem do jogo tem de despausar sozinho; quem o jogador pausou, não.
const subs = new Set();
const reasons = new Set();
export const radioBus = {
  duck(reason) { const was = reasons.size > 0; reasons.add(reason); if (!was) subs.forEach((f) => f(true)); },
  release(reason) { if (!reasons.delete(reason)) return; if (reasons.size === 0) subs.forEach((f) => f(false)); },
  isDucked() { return reasons.size > 0; },
  subscribe(fn) { subs.add(fn); fn(reasons.size > 0); return () => subs.delete(fn); },
  reset() { reasons.clear(); },
};
