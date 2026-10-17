// Usuário de verdade com CADA bloco: põe o item na mão, mira o chão e coloca pelo mesmo caminho do clique (engine.placeBlock), confere o que
// ficou no mundo, desenha uma folha de contato (scripts/e2e/out/blocos-N.png) e depois quebra cada um (engine.breakBlock) e confere o drop.
// Uso: node scripts/e2e/blocks.mjs <raiz> <porta> [--folha]   (--folha só gera as imagens e a lista, sem falhar)
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.setRequestInterception(true);
page.on('request', (r) => {
  const u = new URL(r.url());
  if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/')) {
    if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    else r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
  } else r.continue();
});
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|net::|MeshWorker/.test(t)) errors.push(t.slice(0, 200)); } });
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
fs.mkdirSync(path.join(root, 'scripts', 'e2e', 'out'), { recursive: true });

// ---- monta o mundo e a lista de (bloco, meta) ----
const plan = await page.evaluate(async () => {
  const { ClientWorld } = await import('/src/game/world.js');
  const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js');
  const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
  const { packState } = await import('/src/game/chunk.js');
  const { BLOCKS } = await import('/src/game/blocks.js');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:1280px;height:720px;position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 110, z: 8.5 };
  const pState = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: 'creative', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'Tester' };
  const engine = new GameEngine(canvas, { world: cw, player: pState, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {}, onAutosave: async () => {} });
  await engine.start();
  engine.paused = false;
  for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250));
  engine.tick = () => {};          // mundo parado: nada cai, nada se mexe, a lista de blocos é só o que o jogador colocou
  engine.hideHud = true;
  window.__eng = engine; window.__ps = pState; window.__cw = cw; window.__pack = packState;
  // lista: um item por (bloco, meta); portas e cama entram pelo item
  const list = [];
  const FLOOR_FOR = { 6: 2, 31: 2, 37: 2, 38: 2, 175: 2, 32: 12, 59: 60, 141: 60, 142: 60, 104: 60, 105: 60, 81: 12, 83: 2, 111: 9 };   // id → bloco do chão
  const metasOf = (b) => {
    if (b.model === 'slab') return [0, 1, 2, 3, 4, 5, 6, 7].slice(0, b.variants?.length || 1);
    if (b.variants) return Array.from({ length: Math.min(b.variants.length, 16) }, (_, i) => i).filter((m) => m <= (b.variantMask ?? 7));
    if (b.metaColors) return [0, 1, 4, 14];
    return [0];
  };
  for (const id of Object.keys(BLOCKS).map(Number).sort((a, b) => a - b)) {
    const b = BLOCKS[id];
    if (id === 0) continue;
    const DOOR_ITEM = { 64: 324, 71: 330, 193: 427, 194: 428, 195: 429, 196: 430, 197: 431 };
    if (DOOR_ITEM[id]) { list.push({ id, item: DOOR_ITEM[id], name: b.name, meta: 0, kind: 'porta' }); continue; }
    if (id === 26) { list.push({ id, item: 355, name: b.name, meta: 0, kind: 'cama' }); continue; }
    if (id === 68 || id === 131 || id === 65 || id === 106) { list.push({ id, item: id === 68 ? 323 : id, name: b.name, meta: 0, kind: b.model, wall: true }); continue; }
    if (id === 115) { list.push({ id, item: id, name: b.name, meta: 0, kind: b.model, floor: 88 }); continue; }
    for (const meta of metasOf(b)) list.push({ id, item: id, name: b.name, meta, kind: b.model || 'cube', floor: FLOOR_FOR[id] });   // plantas só nascem na terra delas (o jogador pisa no que o jogo exige)
    // preso na parede: o jogador mira a lateral de um bloco (tocha, alavanca e botão também têm esse jeito de colocar)
    if ([50, 75, 76, 69, 77, 143].includes(id)) list.push({ id, item: id, name: b.name + ' (parede)', meta: 0, kind: b.model, wall: true });
  }
  return { n: list.length, list };
});
const COLS = 10, GAP_X = 2, GAP_Z = 3, X0 = -4, Z0 = -4, G = 99;
const list = plan.list;
console.log(`${plan.n} (bloco, meta) a testar`);

// ---- chão plano e limpo ----
await page.evaluate(async (list, COLS, GAP_X, GAP_Z, X0, Z0, G) => {
  const cw = window.__cw, P = window.__pack;
  const rows = Math.ceil(list.length / COLS);
  for (let x = X0 - 3; x <= X0 + COLS * GAP_X + 3; x++) for (let z = Z0 - 3; z <= Z0 + rows * GAP_Z + 3; z++) {
    for (let y = G + 1; y <= G + 14; y++) cw.setBlock(x, y, z, 0);
    cw.setBlock(x, G, z, P(1, 0));
    cw.setBlock(x, G - 1, z, P(1, 0));
  }
}, list, COLS, GAP_X, GAP_Z, X0, Z0, G);

// ---- coloca cada bloco como o jogador: item na mão, mira o chão de cima, botão direito ----
const placed = await page.evaluate(async (list, COLS, GAP_X, GAP_Z, X0, Z0, G) => {
  const eng = window.__eng, ps = window.__ps, cw = window.__cw;
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const cx = X0 + (i % COLS) * GAP_X, cz = Z0 + Math.floor(i / COLS) * GAP_Z;
    ps.pos = { x: cx + 0.5, y: G + 4, z: cz + 0.5 }; ps.vel = { x: 0, y: 0, z: 0 };
    ps.yaw = 0; ps.pitch = Math.PI / 2 - 0.0005;
    if (it.floor) cw.setBlock(cx, G, cz, window.__pack(it.floor, 0));
    if (it.id === 83) { cw.setBlock(cx + 1, G, cz, window.__pack(9, 0)); }   // cana: água ao lado do chão
    if (it.wall) { cw.setBlock(cx, G + 1, cz - 1, window.__pack(1, 0)); ps.pos = { x: cx + 0.5, y: G + 0.1, z: cz + 2.5 }; ps.yaw = Math.PI; ps.pitch = 0; }
    ps.hotbar[0] = { id: it.item, count: 64, meta: it.meta };
    ps.selectedSlot = 0;
    eng._cachedRaycastFrame = -1; eng._cachedRaycast = null;
    let threw = null;
    try { eng.placeBlock(); } catch (e) { threw = String(e && e.message || e).slice(0, 120); }
    const s = cw.getBlock(cx, G + 1, cz);
    out.push({ i, cx, cz, state: s, id: s >> 4, meta: s & 15, threw });
  }
  return out;
}, list, COLS, GAP_X, GAP_Z, X0, Z0, G);

const report = [];
for (const it of list) {
  const p = placed[list.indexOf(it)];
  const ok = p.id === it.id || (it.kind === 'slab' && false);
  report.push({ ...it, got: p.id, gotMeta: p.meta, ok, threw: p.threw });
}
fs.writeFileSync(path.join(root, 'scripts', 'e2e', 'out', 'blocos-lista.json'), JSON.stringify(report, null, 1));

// espera as malhas de toda a área ficarem prontas (milhares de blocos mudaram; sem isso a foto sai com o terreno velho)
await page.evaluate(async () => {
  const cw = window.__cw;
  const t0 = performance.now();
  while (performance.now() - t0 < 150000) {
    if (cw.isIdle && cw.isIdle() && (!cw.pendingMeshCount || cw.pendingMeshCount() === 0)) { await new Promise((r) => setTimeout(r, 1500)); if (cw.isIdle() && cw.pendingMeshCount() === 0) break; }
    await new Promise((r) => setTimeout(r, 300));
  }
});
// ---- folhas de contato: 3 linhas × 10 colunas por imagem ----
const close = process.argv.includes('--perto');   // --perto: câmera quase de cima, de perto (para ver o detalhe de cada bloco)
const rowsPerShot = 3;
const rows = Math.ceil(list.length / COLS);
let shots = 0;
for (let r0 = 0; r0 < rows; r0 += rowsPerShot) {
  const zMid = Z0 + (r0 + (Math.min(rowsPerShot, rows - r0) - 1) / 2) * GAP_Z;
  await page.evaluate((zMid, X0, COLS, GAP_X, G, close) => {
    const ps = window.__ps;
    ps.pos = { x: X0 + (COLS - 1) * GAP_X / 2 + 0.5, y: close ? G + 8 : G + 9.5, z: zMid + (close ? 3.4 : 9.5) };
    ps.vel = { x: 0, y: 0, z: 0 }; ps.yaw = Math.PI; ps.pitch = close ? 1.1 : 0.78;
  }, zMid, X0, COLS, GAP_X, G, close);
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(async () => { const cw = window.__cw; const t0 = performance.now(); while (performance.now() - t0 < 20000) { if (cw.isIdle() && cw.pendingMeshCount() === 0) break; await new Promise((r) => setTimeout(r, 200)); } await new Promise((r) => setTimeout(r, 800)); });
  if (shots === 0) console.log('camera:', JSON.stringify(await page.evaluate(() => { const e = window.__eng; return { pos: e.camera.position.toArray(), rot: [e.camera.rotation.x, e.camera.rotation.y], ps: window.__ps.pos, pitch: window.__ps.pitch, yaw: window.__ps.yaw, persp: e.perspective, chunks: window.__cw.chunks.size }; })));
  await page.screenshot({ path: path.join(root, 'scripts', 'e2e', 'out', `blocos-${shots}.png`) });
  const names = list.slice(r0 * COLS, (r0 + rowsPerShot) * COLS).map((x) => `${x.name}${x.meta ? ':' + x.meta : ''}`);
  console.log(`blocos-${shots}.png: ` + names.join(' | '));
  shots++;
}

// ---- quebra cada um e confere: some do mundo e o drop é um item que existe ----
const broken = await page.evaluate(async (list, COLS, GAP_X, GAP_Z, X0, Z0, G) => {
  const eng = window.__eng, ps = window.__ps, cw = window.__cw;
  const { ITEMS } = await import('/src/game/items.js');
  const { BLOCKS } = await import('/src/game/blocks.js');
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const cx = X0 + (i % COLS) * GAP_X, cz = Z0 + Math.floor(i / COLS) * GAP_Z;
    const before = cw.getBlock(cx, G + 1, cz);
    if (before === 0) { out.push({ i, skipped: true }); continue; }
    ps.pos = { x: cx + 0.5, y: G + 4, z: cz + 0.5 }; ps.yaw = 0; ps.pitch = Math.PI / 2 - 0.0005;
    if (it.wall) { ps.pos = { x: cx + 0.5, y: G + 0.1, z: cz + 2.5 }; ps.yaw = Math.PI; ps.pitch = 0; }
    eng._cachedRaycastFrame = -1; eng._cachedRaycast = null;
    const n0 = eng.itemEntities.items.length;
    let threw = null;
    try { eng.breakBlock(); } catch (e) { threw = String(e && e.message || e).slice(0, 120); }
    const after = cw.getBlock(cx, G + 1, cz);
    const drops = eng.itemEntities.items.slice(n0).map((e) => ({ id: e.id, meta: e.meta || 0 }));   // a entidade guarda id/count/meta direto
    const upperGone = it.id !== 175 || cw.getBlock(cx, G + 2, cz) === 0;
    out.push({ i, before, after, gone: after === 0 && upperGone, drops, dropOk: drops.every((d) => !!(ITEMS[d.id] || BLOCKS[d.id])), threw });
  }
  return out;
}, list, COLS, GAP_X, GAP_Z, X0, Z0, G);

const lines = [];
let falhas = 0;
for (let i = 0; i < list.length; i++) {
  const it = list[i], p = placed[i], b = broken[i];
  const probs = [];
  if (p.threw) probs.push(`erro ao colocar: ${p.threw}`);
  else if (p.id === 0) probs.push('não colocou (nada no mundo)');
  else if (p.id !== it.id) probs.push(`colocou outro bloco (id ${p.id})`);
  if (b && !b.skipped) {
    if (b.threw) probs.push(`erro ao quebrar: ${b.threw}`);
    else if (!b.gone) probs.push('quebrar não removeu o bloco');
    else if (!b.dropOk) probs.push('drop é um item que não existe');
  }
  if (probs.length) { falhas++; lines.push(`${it.name}${it.meta ? ':' + it.meta : ''} (id ${it.id}, ${it.kind}): ${probs.join('; ')}`); }
}
fs.writeFileSync(path.join(root, 'scripts', 'e2e', 'out', 'blocos-problemas.txt'), lines.join('\n'));
console.log(`\n${list.length} testados, ${falhas} com problema${falhas ? ':' : ''}`);
for (const l of lines) console.log('FALHA ' + l);
console.log('erros de console/página:', errors.length, errors[0] || '');
await browser.close();
process.exit(process.argv.includes('--folha') ? 0 : (falhas ? 1 : 0));
