// Portais (lógica pura, mundo de teste em Node): o do Nether só nasce em moldura de OBSIDIANA, o do Aether só em moldura de GLOWSTONE (balde de água);
// nenhum outro bloco em volta forma portal; interior sujo ou moldura incompleta não forma; os 4 cantos podem ser qualquer coisa;
// quebrar a moldura apaga todo o portal de uma vez; achar o portal vizinho respeita o tipo.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
try {
  const P = await server.ssrLoadModule('/src/game/portal.js');
  const { packState, stateId } = await server.ssrLoadModule('/src/game/chunk.js');
  const mk = () => { const m = new Map(); return { m, getBlock: (x, y, z) => m.get(x + ',' + y + ',' + z) || 0, setBlock(x, y, z, s) { if (s) m.set(x + ',' + y + ',' + z, s); else m.delete(x + ',' + y + ',' + z); } }; };
  // moldura 4×5 no plano X: base em y=10; frame = id da moldura; corners = id dos 4 cantos
  const frame = (w, frameId, cornerId = frameId, x0 = 5, z0 = 5) => {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
      if (i === 0 || i === 3 || j === 0 || j === 4) { const corner = (i === 0 || i === 3) && (j === 0 || j === 4); w.setBlock(x0 + i, 10 + j, z0, packState(corner ? cornerId : frameId, 0)); }
    }
  };
  const count = (w, id) => { let n = 0; for (const s of w.m.values()) if (stateId(s) === id) n++; return n; };
  const tryN = (w, kind) => P.tryCreatePortal(w, 6, 11, 5, () => {}, kind);

  // Nether
  { const w = mk(); frame(w, 49); ok(tryN(w, P.KINDS.nether) && count(w, 90) === 6, 'moldura 4×5 de obsidiana + pederneira = portal do Nether com 6 blocos (2×3)'); }
  { const w = mk(); frame(w, 49); ok(!tryN(w, P.KINDS.aether) && count(w, 215) === 0, 'moldura de obsidiana NÃO vira portal do Aether'); }
  for (const [id, nome] of [[89, 'glowstone'], [1, 'pedra'], [4, 'pedregulho'], [98, 'tijolo de pedra'], [87, 'netherrack'], [5, 'tábuas'], [7, 'bedrock'], [42, 'bloco de ferro'], [57, 'bloco de diamante']]) {
    const w = mk(); frame(w, id); const a = tryN(w, P.KINDS.nether);
    ok(!a && count(w, 90) === 0, `moldura de ${nome} não forma portal do Nether`);
  }
  // Aether
  { const w = mk(); frame(w, 89); ok(tryN(w, P.KINDS.aether) && count(w, 215) === 6, 'moldura 4×5 de glowstone + água = portal do Aether com 6 blocos'); }
  { const w = mk(); frame(w, 89); ok(!tryN(w, P.KINDS.nether) && count(w, 90) === 0, 'moldura de glowstone NÃO vira portal do Nether'); }
  for (const [id, nome] of [[1, 'pedra'], [49, 'obsidiana'], [169, 'lanterna do mar'], [123, 'lâmpada'], [5, 'tábuas'], [4, 'pedregulho']]) {
    const w = mk(); frame(w, id); const a = tryN(w, P.KINDS.aether);
    ok(!a && count(w, 215) === 0, `moldura de ${nome} não forma portal do Aether`);
  }
  // cantos livres: obsidiana com os cantos de terra ainda forma
  { const w = mk(); frame(w, 49, 3); ok(tryN(w, P.KINDS.nether), 'os 4 cantos da moldura podem ser de qualquer bloco (terra nos cantos)'); }
  // moldura incompleta: falta um bloco de lado
  { const w = mk(); frame(w, 89); w.setBlock(8, 12, 5, 0); ok(!tryN(w, P.KINDS.aether), 'moldura de glowstone com um buraco na lateral não forma'); }
  { const w = mk(); frame(w, 89); w.setBlock(6, 14, 5, 0); ok(!tryN(w, P.KINDS.aether), 'moldura de glowstone sem um bloco do teto não forma'); }
  // interior sujo
  { const w = mk(); frame(w, 49); w.setBlock(6, 11, 5, packState(4, 0)); ok(!tryN(w, P.KINDS.nether), 'pedregulho dentro da moldura impede o portal'); }
  { const w = mk(); frame(w, 89); w.setBlock(6, 12, 5, packState(4, 0)); ok(!tryN(w, P.KINDS.aether), 'pedregulho dentro da moldura de glowstone impede o portal'); }
  // água já no interior não atrapalha o portal do Aether (a água vira o portal); no Nether a água impede
  { const w = mk(); frame(w, 89); w.setBlock(6, 11, 5, packState(9, 0)); ok(tryN(w, P.KINDS.aether), 'água dentro da moldura de glowstone vira portal do Aether'); }
  { const w = mk(); frame(w, 49); w.setBlock(6, 11, 5, packState(9, 0)); ok(!tryN(w, P.KINDS.nether), 'água dentro da moldura de obsidiana não vira portal do Nether'); }
  // largura mínima 2: moldura de 1 de largura não forma
  { const w = mk(); for (let j = 0; j < 5; j++) { w.setBlock(5, 10 + j, 5, packState(89, 0)); w.setBlock(7, 10 + j, 5, packState(89, 0)); } w.setBlock(6, 10, 5, packState(89, 0)); w.setBlock(6, 14, 5, packState(89, 0)); ok(!tryN(w, P.KINDS.aether), 'interior de 1 bloco de largura não forma portal'); }
  // sem o chão da moldura não forma (a célula escolhida flutua)
  { const w = mk(); frame(w, 89); w.setBlock(6, 10, 5, 0); w.setBlock(7, 10, 5, 0); ok(!tryN(w, P.KINDS.aether), 'sem o chão de glowstone não forma portal'); }
  // portal no eixo Z
  { const w = mk(); for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) if (i === 0 || i === 3 || j === 0 || j === 4) w.setBlock(5, 10 + j, 5 + i, packState(89, 0)); ok(P.tryCreatePortal(w, 5, 11, 6, () => {}, P.KINDS.aether) && count(w, 215) === 6, 'a moldura no outro eixo (Z) também forma'); }

  // quebrar a moldura apaga o portal inteiro de uma vez
  for (const [kind, fid, pid, nome] of [[P.KINDS.nether, 49, 90, 'Nether'], [P.KINDS.aether, 89, 215, 'Aether']]) {
    const w = mk(); frame(w, fid); tryN(w, kind);
    const hole = packState(0, 0); w.setBlock(5, 12, 5, hole);
    const removed = P.checkPortalIntegrity(w, 5, 12, 5, () => {});
    ok(removed === 6 && count(w, pid) === 0, `quebrar um bloco da moldura apaga os 6 blocos do portal do ${nome} de uma vez (${removed})`);
    const w2 = mk(); frame(w2, fid); tryN(w2, kind); w2.setBlock(6, 11, 5, 0);
    const removed2 = P.checkPortalIntegrity(w2, 6, 11, 5, () => {});
    ok(removed2 === 5 && count(w2, pid) === 0, `quebrar um bloco do próprio portal do ${nome} apaga o resto em cascata (${removed2} restantes)`);
  }
  // achar o portal vizinho respeita o tipo
  { const w = mk(); frame(w, 49); tryN(w, P.KINDS.nether); ok(P.findNearbyPortal(w, 6, 64, 5, 8, P.KINDS.nether) && !P.findNearbyPortal(w, 6, 64, 5, 8, P.KINDS.aether), 'achar portal vizinho: o do Nether não é confundido com o do Aether'); }
  // portal construído (chegada) é válido: tem moldura completa e 2×3 de portal
  for (const [kind, fid, pid] of [[P.KINDS.nether, 49, 90], [P.KINDS.aether, 89, 215]]) {
    const w = mk(); P.buildPortal(w, 5, 11, 5, () => {}, kind);
    ok(count(w, pid) === 6 && count(w, fid) >= 10, `portal construído de chegada (${kind.name}): 6 blocos de portal e a moldura inteira (${count(w, fid)} blocos)`);
    ok(P.checkPortalIntegrity(w, 5, 11, 5, () => {}) === 0, `o portal construído (${kind.name}) é estável: nada some sozinho`);
  }
} catch (e) { ok(false, 'exceção: ' + (e.stack || e)); }
await server.close();
console.log(out.join('\n'));
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
