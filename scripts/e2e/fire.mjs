// Fogo do 1.8.9 (BlockFire): sobe a idade devagar, só espalha para o ar colado em bloco inflamável, só queima o que está encostado, dura pouco
// em chão de pedra, nunca morre no netherrack, a chuva apaga e o TNT encostado acende. Lógica pura (mundo de teste em Node), sorteios com semente.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
try {
  const F = await server.ssrLoadModule('/src/game/fire.js');
  const { chunkIndex, packState, stateId } = await server.ssrLoadModule('/src/game/chunk.js');
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // mundo de 1 chunk (x, z em 0..15), chão de pedra em y = 63
  const mk = (floorId = 1) => {
    const data = new Uint16Array(16 * 256 * 16);
    const chunk = { baseX: 0, baseZ: 0, data, secCount: new Uint16Array(16).fill(1), ver: 1 };
    const w = {
      chunks: new Map([['c', chunk]]), tnt: [],
      getBlock: (x, y, z) => (x < 0 || x > 15 || z < 0 || z > 15 || y < 0 || y > 255 ? 0 : data[chunkIndex(x, y, z)]),
      setBlock(x, y, z, s) { if (x < 0 || x > 15 || z < 0 || z > 15 || y < 0 || y > 255) return; data[chunkIndex(x, y, z)] = s; chunk.ver++; },
      onTntIgnite(x, y, z) { this.tnt.push([x, y, z]); },
    };
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) w.setBlock(x, 63, z, packState(floorId, 0));
    return w;
  };
  const run = (w, ticks, seed, weather = null) => { const rand = mulberry(seed); for (let t = 0; t < ticks; t++) F.tickFire(w, t, weather, {}, 'normal', rand); };
  const count = (w, id) => { let n = 0; for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 60; y < 80; y++) if (stateId(w.getBlock(x, y, z)) === id) n++; return n; };
  const rain = { isRainingAt: () => true, isThundering: () => false };

  // 1) fogo sozinho em chão de pedra: vive pouco (idade sobe 0–1 a cada 30–39 ticks e some depois de idade 3) e nunca se espalha
  let life = [];
  for (let s = 1; s <= 20; s++) { const w = mk(); w.setBlock(8, 64, 8, packState(51, 0)); let t = 0; const rand = mulberry(s); for (; t < 3000 && stateId(w.getBlock(8, 64, 8)) === 51; t++) F.tickFire(w, t, null, {}, 'normal', rand); life.push(t); }
  const avg = life.reduce((a, b) => a + b, 0) / life.length;
  ok(avg > 100 && avg < 900 && Math.max(...life) < 3000, `fogo sozinho na pedra dura ${Math.round(avg)} ticks em média (${Math.min(...life)}–${Math.max(...life)}), ~${(avg / 20).toFixed(0)} s e some`);
  // 2) sobre netherrack nunca se apaga
  { const w = mk(87); w.setBlock(8, 64, 8, packState(51, 0)); run(w, 4000, 7); ok(stateId(w.getBlock(8, 64, 8)) === 51, 'sobre netherrack o fogo dura para sempre (4000 ticks)'); }
  // 3) chuva apaga
  { const w = mk(); w.setBlock(8, 64, 8, packState(51, 0)); run(w, 200, 3, rain); ok(count(w, 51) === 0, 'a chuva apaga o fogo'); }
  // 4) parede de tábuas: o fogo encostado queima e se espalha só pelas tábuas
  let burned = 0, trials = 20;
  for (let s = 1; s <= trials; s++) {
    const w = mk();
    for (let y = 64; y < 68; y++) for (let x = 6; x <= 9; x++) w.setBlock(x, y, 8, packState(5, 0));
    w.setBlock(7, 64, 7, packState(51, 0));
    run(w, 1500, s);
    if (count(w, 5) < 16) burned++;
  }
  ok(burned >= trials * 0.9, `fogo encostado numa parede de tábuas queima parte dela em ${burned}/${trials} testes (1500 ticks)`);
  // 5) bloco inflamável LONGE (5 blocos) nunca é tocado
  { let touched = 0; for (let s = 1; s <= 20; s++) { const w = mk(); w.setBlock(2, 64, 2, packState(5, 0)); w.setBlock(12, 64, 12, packState(51, 0)); run(w, 1500, s); if (stateId(w.getBlock(2, 64, 2)) !== 5) touched++; } ok(touched === 0, `tábua a 10 blocos do fogo nunca queima (${touched}/20 queimaram)`); }
  // 6) pedra e terra ao lado do fogo nunca somem
  { const w = mk(); for (const [x, z] of [[7, 8], [9, 8], [8, 7], [8, 9]]) w.setBlock(x, 64, z, packState(1, 0)); w.setBlock(8, 64, 8, packState(51, 0)); run(w, 1500, 11); ok([[7, 8], [9, 8], [8, 7], [8, 9]].every(([x, z]) => stateId(w.getBlock(x, 64, z)) === 1), 'pedra colada no fogo não queima'); }
  // 7) nenhum bloco vira fogo se não tem inflamável encostado: o fogo só nasce em ar colado em algo que queima
  { let bad = 0; for (let s = 1; s <= 20; s++) { const w = mk(); w.setBlock(8, 64, 8, packState(5, 0)); w.setBlock(8, 65, 8, packState(51, 0)); run(w, 600, s);
      for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 64; y < 70; y++) if (stateId(w.getBlock(x, y, z)) === 51) {
        const near = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => F.FLAMMABILITY[stateId(w.getBlock(x + a, y + b, z + c))]) || stateId(w.getBlock(x, y - 1, z)) === 1;
        if (!near) bad++;
      } } ok(bad === 0, `todo fogo está colado em algo que queima ou apoiado em chão sólido (${bad} soltos)`); }
  // 8) TNT encostado: a ignição é avisada
  { let ig = 0; for (let s = 1; s <= 20; s++) { const w = mk(); w.setBlock(8, 64, 8, packState(46, 0)); w.setBlock(7, 64, 8, packState(51, 0)); run(w, 1500, s); if (w.tnt.length) ig++; } ok(ig >= 15, `TNT encostado no fogo acende em ${ig}/20 testes`); }
  // 9) só nasce fogo onde pode existir: flint & steel no ar sem chão nem vizinho inflamável não acende
  { const w = mk(); ok(F.canPlaceFire(w, 8, 64, 8) === true && F.canPlaceFire(w, 8, 70, 8) === false, 'fogo precisa de chão sólido ou de um vizinho inflamável (no ar solto não existe)'); }
  // 10) lados: sem chão, mostra a chama colada na parede inflamável
  { const w = mk(); w.setBlock(8, 70, 8, packState(5, 0)); const s1 = F.fireSides(w, 8, 70, 9); const s2 = F.fireSides(w, 8, 64, 8); ok(s1.n === true && !s1.s && s2.n === false && s2.up === false, 'fogo no ar mostra a chama no lado do bloco inflamável; com chão sólido não mostra lados'); }
} catch (e) { out.push('FALHA erro: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')); }
await server.close();
console.log(out.join('\n'));
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
