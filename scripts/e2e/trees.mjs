// Árvores portadas do 1.8.9 (src/game/trees.js, mesma ordem de sorteios do MCP): lógica pura em Node, sem navegador.
// Confere para cada espécie: planta no chão plano, usa o tronco e a folha da variante certa, altura dentro da faixa do original,
// mesma semente = mesma árvore (determinismo), e o que só a espécie tem (tronco 2×2, trepadeiras da selva, copa larga do carvalho escuro).
import { pathToFileURL } from 'url';
const root = process.argv[2];
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
try {
  const T = await server.ssrLoadModule('/src/game/trees.js');
  const { JRandom } = await server.ssrLoadModule('/src/game/jrandom.js');
  const st = (id, meta = 0) => ((id & 0xfff) << 4) | (meta & 15);
  // mundo de teste: chão de grama em y=63 (y < 64), ar em cima; guarda tudo num Map
  const mk = () => {
    const m = new Map();
    const get = (x, y, z) => (y < 64 ? st(y === 63 ? 2 : 1) : (m.get(`${x},${y},${z}`) ?? 0));
    return { m, get, id: (x, y, z) => (get(x, y, z) >> 4) & 0xfff, isAir: (x, y, z) => get(x, y, z) === 0, set: (x, y, z, s) => { if (y >= 64) m.set(`${x},${y},${z}`, s); else if (y >= 0) m.set(`${x},${y},${z}`, s); } };
  };
  const kinds = {
    carvalho: (R, r) => T.genTrees(R, r, 0, 64, 0),
    carvalhoGrande: (R, r) => T.genBigTree(R, r, 0, 64, 0, 5),
    betula: (R, r) => T.genBirch(R, r, 0, 64, 0, false),
    betulaAlta: (R, r) => T.genBirch(R, r, 0, 64, 0, true),
    pinheiro1: (R, r) => T.genTaiga1(R, r, 0, 64, 0),
    pinheiro2: (R, r) => T.genTaiga2(R, r, 0, 64, 0),
    pinheiroGigante: (R, r) => T.genMegaPine(R, r, 0, 64, 0, false),
    selvaPequena: (R, r) => T.genTrees(R, r, 0, 64, 0, { minHeight: 4 + r.nextInt(7), wood: 3, leaf: 3, vines: true }),
    selvaGigante: (R, r) => T.genMegaJungle(R, r, 0, 64, 0),
    arbusto: (R, r) => T.genShrub(R, r, 0, 64, 0),
    acacia: (R, r) => T.genSavannaTree(R, r, 0, 64, 0),
    carvalhoEscuro: (R, r) => T.genCanopy(R, r, 0, 64, 0),
    pantano: (R, r) => T.genSwamp(R, r, 0, 64, 0),
  };
  // (id do tronco, variante) e (id da folha, variante) esperados em cada espécie
  const wood = { carvalho: [17, 0], carvalhoGrande: [17, 0], betula: [17, 2], betulaAlta: [17, 2], pinheiro1: [17, 1], pinheiro2: [17, 1], pinheiroGigante: [17, 1], selvaPequena: [17, 3], selvaGigante: [17, 3], arbusto: [17, 3], acacia: [162, 0], carvalhoEscuro: [162, 1], pantano: [17, 0] };
  const leaf = { carvalho: [18, 0], carvalhoGrande: [18, 0], betula: [18, 2], betulaAlta: [18, 2], pinheiro1: [18, 1], pinheiro2: [18, 1], pinheiroGigante: [18, 1], selvaPequena: [18, 3], selvaGigante: [18, 3], arbusto: [18, 0], acacia: [161, 0], carvalhoEscuro: [161, 1], pantano: [18, 0] };
  const stats = {};
  for (const [name, gen] of Object.entries(kinds)) {
    const heights = [], widths = []; let planted = 0, badWood = 0, badLeaf = 0, vines = 0, logs2x2 = 0, tries = 60, logsTotal = 0, leavesTotal = 0;
    for (let seed = 1; seed <= tries; seed++) {
      const R = mk(); const r = new JRandom(BigInt(seed * 7919));
      let did = false;
      try { did = gen(R, r) !== false; } catch (e) { out.push(`FALHA ${name}: erro ${e.message}`); break; }
      let hasLog = false, top = 0, minX = 99, maxX = -99, bx = 0;
      const col = new Map();
      for (const [k, s] of R.m) {
        const [x, y, z] = k.split(',').map(Number); const id = (s >> 4) & 0xfff, meta = s & 15;
        if (id === 17 || id === 162) { hasLog = true; logsTotal++; top = Math.max(top, y - 63); const v = (id === 17 ? meta & 3 : 4 + (meta & 3)); const [wid, wv] = wood[name]; if (!(id === wid && (meta & 3) === wv)) badWood++; col.set(`${x},${z}`, (col.get(`${x},${z}`) || 0) + 1); }
        else if (id === 18 || id === 161) { leavesTotal++; const [lid, lv] = leaf[name]; if (!(id === lid && (meta & 3) === lv)) badLeaf++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
        else if (id === 106) vines++;
      }
      if (hasLog) { planted++; heights.push(top); widths.push(maxX - minX + 1); }
      // tronco 2×2: quatro colunas vizinhas com tronco
      const full = [...col.keys()].filter((k) => col.get(k) >= 3);
      if (full.length >= 4) logs2x2++;
    }
    stats[name] = { planted, heights, widths, badWood, badLeaf, vines, logs2x2, logsTotal, leavesTotal };
    const hs = heights.length ? `${Math.min(...heights)}..${Math.max(...heights)}` : '-';
    const ws = widths.length ? `${Math.min(...widths)}..${Math.max(...widths)}` : '-';
    out.push(`INFO ${name}: plantou ${planted}/${tries}, altura do tronco ${hs}, largura da copa ${ws}, troncos ${logsTotal}, folhas ${leavesTotal}${vines ? `, trepadeiras ${vines}` : ''}`);
    ok(planted >= tries * 0.9, `${name} planta em chão plano (${planted}/${tries})`);
    ok(badWood === 0 && badLeaf === 0, `${name} usa o tronco e a folha da variante certa (tronco errado ${badWood}, folha errada ${badLeaf})`);
  }
  const rng = (n) => [Math.min(...stats[n].heights), Math.max(...stats[n].heights)];
  const within = (n, lo, hi) => { const [a, b] = rng(n); return a >= lo && b <= hi; };
  ok(within('carvalho', 4, 6), `carvalho: tronco de 4 a 6 (${rng('carvalho')})`);
  ok(within('betula', 5, 7), `bétula comum: tronco de 5 a 7 (${rng('betula')})`);
  ok(within('pantano', 5, 8), `carvalho do pântano: tronco de 5 a 8 (${rng('pantano')})`);
  ok(within('acacia', 5, 9), `acácia: tronco de 5 a 9 (${rng('acacia')})`);
  ok(within('pinheiro2', 4, 9), `pinheiro (taiga 2): tronco de 4 a 9 (altura 6–9 menos 0–2 do topo sem tronco; ${rng('pinheiro2')})`);
  ok(within('pinheiro1', 6, 10), `pinheiro (taiga 1): tronco de 6 a 10 (${rng('pinheiro1')})`);
  ok(stats.selvaPequena.vines > 0, `selva: tem trepadeiras (${stats.selvaPequena.vines})`);
  ok(stats.carvalho.vines === 0, 'carvalho comum não tem trepadeiras');
  ok(stats.selvaGigante.logs2x2 >= stats.selvaGigante.planted * 0.8, `selva gigante: tronco 2×2 (${stats.selvaGigante.logs2x2}/${stats.selvaGigante.planted})`);
  ok(stats.carvalhoEscuro.logs2x2 >= stats.carvalhoEscuro.planted * 0.8, `carvalho escuro: tronco 2×2 (${stats.carvalhoEscuro.logs2x2}/${stats.carvalhoEscuro.planted})`);
  ok(stats.carvalhoEscuro.widths.every((w) => w >= 7), `carvalho escuro: copa larga (mín. ${Math.min(...stats.carvalhoEscuro.widths)} blocos)`);
  // determinismo: mesma semente, mesma árvore
  for (const name of ['carvalho', 'betula', 'pinheiro2', 'selvaGigante', 'acacia', 'carvalhoEscuro']) {
    const snap = () => { const R = mk(); kinds[name](R, new JRandom(123456789n)); return JSON.stringify([...R.m.entries()].sort()); };
    ok(snap() === snap(), `${name}: a mesma semente gera a mesma árvore`);
  }
} catch (e) { out.push('FALHA erro: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')); }
await server.close();
console.log(out.join('\n'));
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
