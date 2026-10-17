// Blocos em uso de verdade (o que a folha de contato não mostra): peças que se ligam aos vizinhos (trilho, vidraça, grade, muro, cerca),
// blocos presos na parede, estados (alavanca, botão, bolo, caldeirão, portas abertas...), cliques do jogador (alavanca liga, botão solta sozinho,
// bolo some em fatias, baú do Ender é um só), quebra no criativo e colheita por ferramenta. Fotos em scripts/e2e/out/cena-*.png.
// Uso: node scripts/e2e/blocks-cenas.mjs <raiz> <porta>
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('dialog', (d) => d.accept());
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
const outDir = path.join(root, 'scripts', 'e2e', 'out');
fs.mkdirSync(outDir, { recursive: true });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);

await page.evaluate(async () => {
  const { ClientWorld } = await import('/src/game/world.js');
  const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js');
  const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
  const { packState } = await import('/src/game/chunk.js');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:1280px;height:720px;position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 110, z: 8.5 };
  const pState = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: 'creative', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'Tester', hunger: 10, saturation: 0 };
  const chat = [];
  const opened = [];
  const engine = new GameEngine(canvas, { world: cw, player: pState, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: (m) => chat.push(m), onDeath: () => {}, onAutosave: async () => {}, onOpenChest: (x, y, z, shared) => opened.push({ x, y, z, shared: !!shared }) });
  await engine.start();
  engine.paused = false;
  for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250));
  engine.tick = () => {};
  engine.hideHud = true;
  Object.assign(window, { __eng: engine, __ps: pState, __cw: cw, __pack: packState, __chat: chat, __opened: opened });
  // chão plano de pedra grande
  const G = 99;
  for (let x = -6; x <= 40; x++) for (let z = -6; z <= 30; z++) {
    for (let y = G + 1; y <= G + 12; y++) cw.setBlock(x, y, z, 0);
    cw.setBlock(x, G, z, packState(1, 0)); cw.setBlock(x, G - 1, z, packState(1, 0));
  }
});

const G = 99;
const set = (x, y, z, id, meta = 0) => page.evaluate((x, y, z, id, meta) => window.__cw.setBlock(x, y, z, window.__pack(id, meta)), x, y, z, id, meta);
const get = (x, y, z) => page.evaluate((x, y, z) => window.__cw.getBlock(x, y, z), x, y, z);
async function build(blocks) { await page.evaluate((blocks, G) => { for (const [x, y, z, id, meta] of blocks) window.__cw.setBlock(x, G + y, z, window.__pack(id, meta || 0)); }, blocks, G); }
async function settle() {
  await page.evaluate(async () => { const cw = window.__cw; await new Promise((r) => setTimeout(r, 1500)); const t0 = performance.now(); while (performance.now() - t0 < 25000) { if (cw.isIdle() && cw.pendingMeshCount() === 0) break; await new Promise((r) => setTimeout(r, 200)); } await new Promise((r) => setTimeout(r, 900)); });
}
async function cam(x, y, z, yaw, pitch) { await page.evaluate((x, y, z, yaw, pitch) => { const ps = window.__ps; ps.pos = { x, y, z }; ps.vel = { x: 0, y: 0, z: 0 }; ps.yaw = yaw; ps.pitch = pitch; }, x, y, z, yaw, pitch); }
async function shot(name) { await page.evaluate(() => { window.__eng.worldTime = 1000; }); await settle(); await page.evaluate(() => { window.__eng.worldTime = 1000; }); await new Promise((r) => setTimeout(r, 600)); await page.screenshot({ path: path.join(outDir, name) }); }
// o jogador olha para (x, y, z) (centro do ponto) de (px, py, pz) e age: place | break | interact
async function aim(px, py, pz, tx, ty, tz) {
  await page.evaluate((px, py, pz, tx, ty, tz) => {
    const ps = window.__ps, eng = window.__eng;
    const eyeH = 1.62;
    ps.pos = { x: px, y: py - eyeH, z: pz }; ps.vel = { x: 0, y: 0, z: 0 };
    const dx = tx - px, dy = ty - py, dz = tz - pz;
    ps.yaw = Math.atan2(-dx, dz); ps.pitch = -Math.atan2(dy, Math.hypot(dx, dz));
    eng._cachedRaycastFrame = -1; eng._cachedRaycast = null;
  }, px, py, pz, tx, ty, tz);
}
const hold = (id, meta = 0, count = 64) => page.evaluate((id, meta, count) => { window.__ps.hotbar[0] = { id, count, meta }; window.__ps.selectedSlot = 0; }, id, meta, count);
const act = (fn) => page.evaluate((fn) => { const e = window.__eng; e._cachedRaycastFrame = -1; return e[fn](window.__ps); }, fn);

// ===== Cena 1: trilhos que se ligam (reta, curva, subida) =====
{
  const b = [];
  // retângulo de trilho comum 6×4 (cantos viram curva) + trilho elétrico no meio de um lado
  for (let x = 0; x <= 5; x++) { b.push([x, 1, 0, 66, 0], [x, 1, 3, 66, 0]); }
  for (let z = 1; z <= 2; z++) { b.push([0, 1, z, 66, 0], [5, 1, z, 66, 0]); }
  b.push([2, 1, 0, 27, 0], [3, 1, 0, 28, 0]);
  // rampa: degrau de pedra e trilhos subindo para leste
  b.push([8, 1, 1, 1, 0], [9, 1, 1, 1, 0], [9, 2, 1, 1, 0]);
  b.push([7, 1, 1, 66, 0], [8, 2, 1, 66, 0], [9, 3, 1, 66, 0], [10, 3, 1, 66, 0]);
  b.push([8, 1, 3, 157, 0]);
  await build(b);
  await cam(5.5, G + 7.5, 7.5, Math.PI, 0.85);
  await shot('cena-trilhos.png');
}

// ===== Cena 2: vidraça, grade, muro e cerca ligando nos vizinhos =====
{
  const b = [];
  // parede de pedra com vidraças saindo dela e uma grade em cruz
  for (let y = 1; y <= 3; y++) for (let x = 14; x <= 16; x++) b.push([x, y, 0, 1, 0]);
  b.push([15, 2, 1, 102, 0], [15, 2, 2, 102, 0], [14, 2, 2, 102, 0], [16, 2, 2, 102, 0], [15, 2, 3, 102, 0]);
  b.push([20, 1, 1, 101, 0], [20, 1, 2, 101, 0], [20, 1, 3, 101, 0], [19, 1, 2, 101, 0], [21, 1, 2, 101, 0]);
  b.push([24, 1, 1, 160, 1], [24, 1, 2, 160, 1], [24, 1, 3, 160, 1], [25, 1, 2, 160, 14]);
  // muros: fileira de muros ligada a um bloco de pedra, com um muro musgoso
  b.push([14, 1, 6, 1, 0], [15, 1, 6, 139, 0], [16, 1, 6, 139, 0], [17, 1, 6, 139, 1], [17, 1, 7, 139, 0], [18, 1, 6, 1, 0]);
  // cercas: carvalho + pinheiro ligadas, portão no meio, cerca do Nether separada
  b.push([14, 1, 10, 85, 0], [15, 1, 10, 188, 0], [16, 1, 10, 107, 0], [17, 1, 10, 189, 0], [18, 1, 10, 85, 0], [18, 1, 11, 85, 0], [20, 1, 10, 113, 0], [21, 1, 10, 85, 0]);
  await build(b);
  await cam(19.5, G + 8.5, 12, Math.PI, 0.95);
  await shot('cena-ligacoes.png');
}

// ===== Cena 3: presos na parede: tocha, alavanca, botão, placa =====
{
  const b = [];
  // cubo de pedra no centro e um item preso em cada lado
  b.push([30, 1, 4, 1, 0], [30, 2, 4, 1, 0]);
  // tochas nos 4 lados (meta 1 = parede -X, 2 = +X, 3 = -Z, 4 = +Z) e no chão
  b.push([29, 2, 4, 50, 2], [31, 2, 4, 50, 1], [30, 2, 3, 50, 4], [30, 2, 5, 50, 3], [30, 3, 4, 50, 5]);
  // tochas de redstone, alavancas desligada e ligada, botões solto e apertado
  b.push([29, 1, 4, 76, 2], [31, 1, 4, 75, 1], [30, 1, 3, 69, 4], [30, 1, 5, 69, 3 | 8]);
  b.push([33, 1, 4, 1, 0], [33, 2, 4, 1, 0]);
  b.push([32, 2, 4, 77, 2], [34, 2, 4, 143, 1], [33, 2, 3, 77, 4 | 8], [33, 2, 5, 143, 3]);
  b.push([32, 1, 4, 69, 2], [34, 1, 4, 69, 1 | 8], [33, 1, 3, 68, 4], [33, 1, 5, 68, 3]);
  // alavanca no chão e no teto, botão no chão
  b.push([36, 1, 4, 69, 0], [37, 1, 4, 69, 8], [38, 1, 4, 77, 0], [39, 1, 4, 1, 0], [39, 0, 4, 1, 0]);
  b.push([36, 3, 4, 1, 0], [36, 2, 4, 69, 5], [37, 3, 4, 1, 0], [37, 2, 4, 69, 5 | 8], [38, 3, 4, 1, 0], [38, 2, 4, 143, 5]);
  b.push([30, 1, 8, 63, 0], [32, 1, 8, 63, 4], [34, 1, 8, 131, 4], [36, 1, 8, 1, 0], [36, 1, 9, 131, 4]);
  await build(b);
  await aim(31, G + 5, 9.5, 31, G + 2, 4.5); await shot('cena-parede-tochas.png');
  await aim(33.5, G + 4.4, 9.5, 33.5, G + 1.8, 4.5); await shot('cena-parede-alavancas.png');
  await aim(37.5, G + 4.6, 8.5, 37.5, G + 1.8, 4.5); await shot('cena-parede-chao-teto.png');
  await aim(33.5, G + 4.4, 12.5, 33.5, G + 1.4, 8.6); await shot('cena-parede-placas.png');
}

// ===== Cena 4: estados =====
{
  const b = [];
  for (let m = 0; m <= 6; m++) b.push([m * 2, 1, 14, 92, m]);            // bolo com 0..6 fatias comidas
  for (let m = 0; m <= 3; m++) b.push([m * 2, 1, 17, 118, m]);           // caldeirão vazio, 1/3, 2/3, cheio
  for (const [i, m] of [0, 1, 4, 5, 8, 9].entries()) b.push([i * 2, 1, 20, 145, m]); // bigornas: eixos e danos
  for (let m = 0; m < 4; m++) { b.push([m * 2, 1, 23, 93, m | (m << 2)], [m * 2 + 9, 1, 23, 149, m]); b.push([m * 2, 1, 24, 94, m]); }  // repetidores e comparadores nos 4 lados
  b.push([0, 1, 26, 120, 0], [2, 1, 26, 120, 4], [4, 1, 26, 117, 0], [6, 1, 26, 116, 0], [8, 1, 26, 122, 0], [10, 1, 26, 138, 0], [12, 1, 26, 144, 1], [14, 1, 26, 140, 0]);
  // cogumelos gigantes: poros, cantos do chapéu, lados, tudo, caule
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 15].forEach((m, i) => b.push([i * 2, 1, 29, 99, m]));
  await build(b);
  await aim(6.5, G + 5, 19.5, 6.5, G + 1, 15.8); await shot('cena-estados-bolo-caldeirao.png');
  await aim(6.5, G + 5, 24.5, 6.5, G + 1, 21.5); await shot('cena-estados-bigorna-repetidor.png');
  await aim(7.5, G + 4.4, 27.2, 7.5, G + 1, 23.6); await shot('cena-diodos.png');
  await aim(7.5, G + 5, 28.5, 7.5, G + 1, 25.6); await shot('cena-estados-especiais.png');
  await aim(12.5, G + 5, 33.5, 12.5, G + 1, 29.5); await shot('cena-estados-cogumelos.png');
  await build([[0, 1, 14, 0], [2, 1, 14, 0]].map(([x, y, z]) => [x, y, z, 0, 0]));
}

// ===== Cena 5: o jogador usa =====
{
  // alavanca: liga e desliga
  await build([[20, 1, 15, 1, 0], [20, 2, 15, 1, 0]]);
  await set(20, G + 1, 16, 0);
  await build([[20, 2, 16, 69, 3]]);   // meta 3 = presa em -Z (o bloco de pedra em z=15)
  await aim(20.5, G + 2.62, 18.5, 20.5, G + 2.5, 16.5);
  const hit = await page.evaluate(() => { const h = window.__eng.raycast(true); return h && { id: h.id, x: h.x, y: h.y, z: h.z, meta: h.meta }; });
  ok(hit && hit.id === 69, `mira na alavanca: ${JSON.stringify(hit)}`);
  await act('interactBlock');
  ok(((await get(20, G + 2, 16)) & 8) === 8, 'botão direito na alavanca LIGA (meta & 8)');
  await act('interactBlock');
  ok(((await get(20, G + 2, 16)) & 8) === 0, 'de novo, DESLIGA');

  // botão: aperta e solta sozinho depois de 1 s (20 ticks)
  await build([[22, 1, 15, 1, 0], [22, 2, 15, 1, 0], [22, 2, 16, 77, 3]]);
  await aim(22.5, G + 2.62, 18.5, 22.5, G + 2.5, 16.5);
  await act('interactBlock');
  ok(((await get(22, G + 2, 16)) & 8) === 8, 'botão de pedra apertado (meta & 8)');
  await page.evaluate(() => { const e = window.__eng; e.worldTime += 10; e._tickScheduled(); });
  ok(((await get(22, G + 2, 16)) & 8) === 8, 'meio segundo depois ainda está apertado');
  await page.evaluate(() => { const e = window.__eng; e.worldTime += 15; e._tickScheduled(); });
  ok(((await get(22, G + 2, 16)) & 8) === 0, 'passado 1 s ele solta sozinho');

  // bolo: cada clique come uma fatia e dá fome
  await build([[24, 1, 16, 92, 0]]);
  await aim(24.9, G + 2.62, 18.5, 24.9, G + 1.3, 16.5);   // as fatias comidas saem do lado -x: mira no lado +x
  await page.evaluate(() => { window.__ps.hunger = 10; });
  const h0 = await page.evaluate(() => window.__ps.hunger);
  await act('interactBlock');
  const h1 = await page.evaluate(() => window.__ps.hunger);
  ok(((await get(24, G + 1, 16)) & 15) === 1 && h1 === h0 + 2, `bolo: 1ª fatia (meta 1, fome ${h0} → ${h1})`);
  for (let i = 0; i < 6; i++) await act('interactBlock');
  ok((await get(24, G + 1, 16)) === 0, 'depois de 7 cliques o bolo some');

  // porta de pinheiro: coloca pelo item, abre e fecha com o botão direito
  await set(26, G + 1, 16, 0); await set(26, G + 2, 16, 0);
  await hold(427, 0, 5);
  await aim(26.5, G + 2.62, 18.5, 26.5, G + 1, 16.5);
  await page.evaluate(() => { window.__eng._cachedRaycastFrame = -1; window.__eng.placeBlock(); });
  ok(((await get(26, G + 1, 16)) >> 4) === 193 && ((await get(26, G + 2, 16)) >> 4) === 193, 'porta de pinheiro (item 427) vira bloco 193 nas duas metades');
  // mira em qualquer ponto da porta (aberta ou fechada a placa fica em lados diferentes do bloco)
  const aimDoor = async () => {
    for (const [fx, fz] of [[0.5, 0.5], [0.5, 0.06], [0.5, 0.94], [0.06, 0.5], [0.94, 0.5], [0.15, 0.1], [0.85, 0.9]]) {
      await aim(26.5, G + 2.62, 18.5, 26 + fx, G + 1.5, 16 + fz);
      const h = await page.evaluate(() => { const r = window.__eng.raycast(true); return r && r.id; });
      if (h === 193) return true;
    }
    return false;
  };
  await aimDoor();
  await act('interactBlock');
  ok(((await get(26, G + 1, 16)) & 4) === 4, 'botão direito ABRE a porta de pinheiro');
  ok(await aimDoor(), 'com a porta aberta ela continua mirável');
  await act('interactBlock');
  ok(((await get(26, G + 1, 16)) & 4) === 0, 'e FECHA');

  // baús: o do Ender abre o mesmo conteúdo em qualquer lugar; o armadilhado abre como baú
  await build([[28, 1, 16, 130, 0], [30, 1, 16, 146, 0], [32, 1, 16, 54, 0]]);
  await page.evaluate(() => { window.__opened.length = 0; });
  for (const x of [28, 30, 32]) { await aim(x + 0.5, G + 2.62, 18.5, x + 0.5, G + 1.4, 16.5); await act('interactBlock'); }
  const op = await page.evaluate(() => window.__opened);
  ok(op.length === 3 && op[0].shared === true && !op[1].shared && !op[2].shared, `baú do Ender abre o conteúdo compartilhado; armadilhado e comum, o próprio: ${JSON.stringify(op.map((o) => o.shared))}`);

  // placa de pressão: liga enquanto o jogador está em cima, desliga quando sai
  await build([[40, 1, 20, 70, 0], [42, 1, 20, 72, 0]]);
  for (const [x, id] of [[40, 70], [42, 72]]) {
    await page.evaluate((x, G) => { window.__ps.pos = { x: x + 0.5, y: G + 1, z: 20.5 }; window.__eng._tickPlates(); }, x, G);
    const on = ((await get(x, G + 1, 20)) & 1) === 1;
    await page.evaluate((x, G) => { window.__ps.pos = { x: x + 0.5, y: G + 1, z: 23.5 }; window.__eng._tickPlates(); }, x, G);
    const off = ((await get(x, G + 1, 20)) & 1) === 0;
    ok(on && off, `placa de pressão ${id === 70 ? 'de pedra' : 'de madeira'}: liga com o jogador em cima e desliga quando ele sai`);
  }

  // criativo quebra bedrock e bloco de comando
  await build([[34, 1, 16, 7, 0], [36, 1, 16, 137, 0]]);
  for (const x of [34, 36]) { await aim(x + 0.5, G + 2.62, 18.5, x + 0.5, G + 1.4, 16.5); await page.evaluate(() => window.__eng.breakBlock()); }
  ok((await get(34, G + 1, 16)) === 0 && (await get(36, G + 1, 16)) === 0, 'no criativo, bedrock e bloco de comando quebram');

  // sem tela: bancada de encantamento avisa em vez de colocar bloco ao lado
  await build([[38, 1, 16, 116, 0]]);
  await hold(1, 0, 5);
  await page.evaluate(() => { window.__chat.length = 0; });
  await aim(38.5, G + 2.62, 18.5, 38.5, G + 1.4, 16.5);
  await act('interactBlock');
  const chat = await page.evaluate(() => window.__chat.map((m) => m.text));
  ok(chat.some((t) => /mesa|Mesa|Encantamento/.test(t) && /tela/.test(t)), `mesa de encantamento avisa que a tela não existe: ${JSON.stringify(chat)}`);
}

// ===== Cena 5b: a alavanca liga a redstone de verdade (fio e lâmpada) =====
{
  await page.evaluate((G) => { const cw = window.__cw, P = window.__pack; for (let x = 46; x <= 56; x++) for (let z = 18; z <= 22; z++) { for (let y = G + 1; y <= G + 4; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, G, z, P(1, 0)); } }, G);
  await build([[49, 1, 20, 69, 0], [50, 1, 20, 55, 0], [51, 1, 20, 55, 0], [52, 1, 20, 55, 0], [53, 1, 20, 123, 0]]);
  const rs = () => page.evaluate(() => { for (let i = 0; i < 40; i++) window.__eng.redstone.tick(); });
  await rs();
  ok(((await get(53, G + 1, 20)) >> 4) === 123, 'lâmpada de redstone apagada com a alavanca desligada');
  await aim(49.5, G + 3.2, 22.0, 49.5, G + 1.15, 20.5);
  await act('interactBlock'); await rs();
  ok(((await get(49, G + 1, 20)) & 8) === 8 && ((await get(53, G + 1, 20)) >> 4) === 124, 'ligar a alavanca acende a lâmpada pelo fio');
  await act('interactBlock'); await rs();
  ok(((await get(49, G + 1, 20)) & 8) === 0 && ((await get(53, G + 1, 20)) >> 4) === 123, 'desligar a alavanca apaga a lâmpada');
}

// ===== Cena 6: suporte — quebrar o que segura derruba o que estava preso =====
{
  await build([[2, 1, 0, 1, 0], [2, 2, 0, 50, 5], [4, 1, 0, 1, 0], [4, 1, 1, 69, 3 | 8], [6, 1, 0, 1, 0], [6, 2, 0, 66, 0], [8, 1, 0, 1, 0], [8, 2, 0, 63, 0], [10, 1, 0, 1, 0], [10, 2, 0, 131, 3]]);
  await build([[10, 1, 0, 1, 0]]);
  const res = await page.evaluate(async (G) => {
    const eng = window.__eng, cw = window.__cw, P = window.__pack;
    const { handleBlockBreakPhysics } = await import('/src/game/fallingBlocks.js');
    const drops = [];
    const out = {};
    // tocha no chão sobre pedra: quebra a pedra → tocha cai
    cw.setBlock(2, G + 1, 0, 0); handleBlockBreakPhysics(cw, 2, G + 1, 0, (d) => drops.push(d.id));
    out.tochaChao = cw.getBlock(2, G + 2, 0) >> 4;
    // alavanca na célula (4, G+1, 1), meta 3 = presa em -Z: o suporte é a pedra em (4, G+1, 0)
    cw.setBlock(4, G + 1, 0, 0); handleBlockBreakPhysics(cw, 4, G + 1, 0, (d) => drops.push(d.id));
    out.alavancaParede = cw.getBlock(4, G + 1, 1) >> 4;
    cw.setBlock(6, G + 1, 0, 0); handleBlockBreakPhysics(cw, 6, G + 1, 0, (d) => drops.push(d.id));
    out.trilho = cw.getBlock(6, G + 2, 0) >> 4;
    cw.setBlock(8, G + 1, 0, 0); handleBlockBreakPhysics(cw, 8, G + 1, 0, (d) => drops.push(d.id));
    out.placa = cw.getBlock(8, G + 2, 0) >> 4;
    out.drops = drops;
    return out;
  }, G);
  ok(res.tochaChao === 0, 'tocha no chão cai quando o chão é quebrado');
  ok(res.alavancaParede === 0, 'alavanca presa na parede cai quando a parede é quebrada');
  ok(res.trilho === 0, 'trilho cai quando o chão é quebrado');
  ok(res.placa === 0, 'placa em pé cai quando o chão é quebrado');
  ok(res.drops.includes(50) && res.drops.includes(69) && res.drops.includes(66) && res.drops.includes(323), `drops: ${JSON.stringify(res.drops)} (tocha 50, alavanca 69, trilho 66, placa 323)`);
}

// ===== Cena 6b: o jogador coloca bloco que depende de onde clica =====
{
  // laboratório limpo em x 0..14, z 36..40 (fora das outras cenas): uma parede de pedra em z=38 e chão de pedra
  await page.evaluate((G) => { const cw = window.__cw, P = window.__pack; for (let x = -2; x <= 16; x++) for (let z = 34; z <= 44; z++) { for (let y = G + 1; y <= G + 6; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, G, z, P(1, 0)); } }, G);
  // clica na face SUL (z=38) de uma parede de pedra em (x, G+1..G+2, 38): o bloco novo cai em z=39
  const wallAt = async (x) => { await build([[x, 1, 38, 1, 0], [x, 2, 38, 1, 0]]); };
  // o jogador está em (x+.5, ., 41.5) olhando para o norte, mirando a face sul da parede
  const place = async (item, meta, x, ty, side) => {
    await hold(item, meta, 9);
    await aim(x + 0.5, G + 1 + 1.62, 41.5, x + 0.5, G + ty, 38.5 + (side === 'wall' ? 0.5 : 0));
    await page.evaluate(() => { window.__eng._cachedRaycastFrame = -1; window.__eng.placeBlock(); });
  };
  const read = async (x, y, z) => { const s = await get(x, G + y, z); return { id: s >> 4, meta: s & 15 }; };
  // tocha na parede (face sul) → meta 4 (presa em +Z? o bloco está a norte do ponto, então presa em -Z → meta 3)
  await wallAt(0); await place(50, 0, 0, 1.5, 'wall');
  let r = await read(0, 1, 39);
  ok(r.id === 50 && r.meta === 3, `tocha na face sul da parede: presa na parede norte (meta 3): ${JSON.stringify(r)}`);
  // alavanca na parede
  await wallAt(2); await place(69, 0, 2, 1.5, 'wall'); r = await read(2, 1, 39);
  ok(r.id === 69 && r.meta === 3, `alavanca na parede (meta 3): ${JSON.stringify(r)}`);
  // botão de madeira na parede
  await wallAt(4); await place(143, 0, 4, 1.5, 'wall'); r = await read(4, 1, 39);
  ok(r.id === 143 && r.meta === 3, `botão de madeira na parede (meta 3): ${JSON.stringify(r)}`);
  // item da placa clicado na parede vira placa de parede (68); clicado no chão vira placa em pé (63)
  await wallAt(6); await place(323, 0, 6, 1.5, 'wall'); r = await read(6, 1, 39);
  ok(r.id === 68, `item da placa na parede vira bloco 68: ${JSON.stringify(r)}`);
  await hold(323, 0, 9); await aim(8.5, G + 2.62, 42.2, 8.5, G + 1, 41.5); await page.evaluate(() => { window.__eng._cachedRaycastFrame = -1; window.__eng.placeBlock(); });
  r = await read(8, 1, 41);
  ok(r.id === 63, `item da placa no chão vira bloco 63: ${JSON.stringify(r)}`);
  // trepadeira na parede: bit do lado
  await wallAt(10); await place(106, 0, 10, 1.5, 'wall'); r = await read(10, 1, 39);
  ok(r.id === 106 && r.meta === 4, `trepadeira na face sul de uma parede: bit 4 (parede ao norte): ${JSON.stringify(r)}`);
  // quebrar a parede derruba a trepadeira (e a tocha, a alavanca, o botão, a placa de parede)
  const gone = await page.evaluate(async (G) => {
    const { handleBlockBreakPhysics } = await import('/src/game/fallingBlocks.js');
    const cw = window.__cw, o = {};
    for (const x of [0, 2, 4, 6, 10]) { cw.setBlock(x, G + 1, 38, 0); handleBlockBreakPhysics(cw, x, G + 1, 38, () => {}); o[x] = cw.getBlock(x, G + 1, 39) >> 4; }
    return o;
  }, G);
  ok(Object.values(gone).every((v) => v === 0), `quebrar a parede derruba tocha, alavanca, botão, placa e trepadeira presas nela: ${JSON.stringify(gone)}`);
  // inválidos: tocha na face de baixo de um bloco; trilho em vidro; verruga do Nether em terra; placa em pé no ar
  await build([[12, 1, 38, 1, 0], [12, 3, 38, 1, 0]]);
  await hold(50, 0, 9); await aim(12.5, G + 1.4, 40.5, 12.5, G + 3, 38.5); await page.evaluate(() => { window.__eng._cachedRaycastFrame = -1; window.__eng.placeBlock(); });
  ok(((await get(12, G + 2, 38)) >> 4) === 0, 'tocha na face de baixo de um bloco: não coloca');
  await build([[14, 0, 40, 20, 0]]);
  await hold(66, 0, 9); await aim(14.5, G + 2.62, 42.5, 14.5, G + 1, 40.5); await page.evaluate(() => { window.__eng._cachedRaycastFrame = -1; window.__eng.placeBlock(); });
  ok(((await get(14, G + 1, 40)) >> 4) === 0, 'trilho em cima de vidro: não coloca');
  await build([[16, 0, 40, 3, 0]]);
  await hold(372, 0, 9); await aim(16.5, G + 2.62, 42.5, 16.5, G + 1, 40.5); await page.evaluate(() => { window.__eng._cachedRaycastFrame = -1; window.__eng.placeBlock(); });
  ok(((await get(16, G + 1, 40)) >> 4) === 0, 'verruga do Nether em terra comum: não planta');
  await build([[18, 0, 40, 88, 0]]);
  await hold(372, 0, 9); await aim(18.5, G + 2.62, 42.5, 18.5, G + 1, 40.5); await page.evaluate(() => { window.__eng._cachedRaycastFrame = -1; window.__eng.placeBlock(); });
  ok(((await get(18, G + 1, 40)) >> 4) === 115, 'verruga do Nether em areia das almas: planta (item 372 → bloco 115)');
  // repetidor: a saída aponta para onde o jogador olha (norte → meta 2)
  await hold(356, 0, 9); await aim(0.5, G + 2.62, 36.5, 0.5, G + 1, 34.5);
  await page.evaluate(() => { window.__eng._cachedRaycastFrame = -1; window.__eng.placeBlock(); });
  r = await read(0, 1, 34);
  ok(r.id === 93 && r.meta === 2, `repetidor colocado olhando para o norte: saída para o norte (meta 2): ${JSON.stringify(r)}`);
  // tronco deitado: eixo pela face clicada
  await build([[2, 1, 34, 1, 0]]);
  await hold(17, 2, 9); await aim(2.5, G + 2.62, 36.5, 2.5, G + 1.5, 34.5); await page.evaluate(() => { window.__eng._cachedRaycastFrame = -1; window.__eng.placeBlock(); });
  r = await read(2, 1, 35); const r2 = r;
  ok(r.id === 17, `tronco de bétula colocado na face sul de um bloco: ${JSON.stringify(r)}`);
  ok((r.meta & 3) === 2 && ((r.meta >> 2) & 3) === 2, `a variante (bétula = 2) e o eixo norte-sul (bits 2-3 = 2) ficam na meta: ${r.meta}`);
}

// ===== Cena 7: colheita por ferramenta e drops =====
{
  const res = await page.evaluate(async () => {
    const { getDrops } = await import('/src/game/mining.js');
    const tool = (id) => ({ id, count: 1 });
    const ids = (d) => d.map((x) => `${x.id}${x.meta ? ':' + x.meta : ''}x${x.count}`).join(',') || '-';
    const r = {};
    r.pedraMao = ids(getDrops(1, null, 0));
    r.pedraMadeira = ids(getDrops(1, tool(270), 0));
    r.granito = ids(getDrops(1, tool(270), 1));
    r.lapisMadeira = ids(getDrops(22, tool(270), 0));
    r.lapisPedra = ids(getDrops(22, tool(274), 0));
    r.redstoneBlocoMadeira = ids(getDrops(152, tool(270), 0));
    r.obsidianaFerro = ids(getDrops(49, tool(257), 0));
    r.obsidianaDiamante = ids(getDrops(49, tool(278), 0));
    r.vidroTingido = ids(getDrops(95, null, 3));
    r.vidraca = ids(getDrops(102, null, 0));
    r.lã = ids(getDrops(35, null, 5));
    r.podzol = ids(getDrops(3, null, 2));
    r.terraGrossa = ids(getDrops(3, null, 1));
    r.bolo = ids(getDrops(92, null, 0));
    r.cogumeloGigante = ids(getDrops(99, null, 14));
    r.baulEnder = ids(getDrops(130, null, 0));
    r.baulEnderPicareta = ids(getDrops(130, tool(270), 0));
    r.bigorna = ids(getDrops(145, null, 0));
    r.bigornaPicareta = ids(getDrops(145, tool(270), 0));
    r.pistaoMao = ids(getDrops(33, null, 0));
    r.gelo = ids(getDrops(174, null, 0));
    r.cacau = ids(getDrops(127, null, 8));
    return r;
  });
  ok(res.pedraMao === '-', `pedra à mão não larga nada (${res.pedraMao})`);
  ok(res.pedraMadeira === '4x1', `pedra com picareta de madeira larga pedregulho (${res.pedraMadeira})`);
  ok(res.granito === '1:1x1', `granito larga granito (${res.granito})`);
  ok(res.lapisMadeira === '-' && res.lapisPedra === '22x1', `bloco de lápis exige picareta de pedra (madeira ${res.lapisMadeira}, pedra ${res.lapisPedra})`);
  ok(res.redstoneBlocoMadeira === '152x1', `bloco de redstone colhe com picareta de madeira (${res.redstoneBlocoMadeira})`);
  ok(res.obsidianaFerro === '-' && res.obsidianaDiamante === '49x1', `obsidiana só com diamante (ferro ${res.obsidianaFerro}, diamante ${res.obsidianaDiamante})`);
  ok(res.vidroTingido === '-' && res.vidraca === '-', `vidro tingido e vidraça não largam nada (${res.vidroTingido} / ${res.vidraca})`);
  ok(res.lã === '35:5x1', `lã larga a cor certa (${res.lã})`);
  ok(res.podzol === '3x1' && res.terraGrossa === '3:1x1', `podzol vira terra comum (${res.podzol}); terra grossa fica grossa (${res.terraGrossa})`);
  ok(res.bolo === '-' && res.gelo === '-', `bolo e gelo compactado não largam nada (${res.bolo} / ${res.gelo})`);
  ok(res.baulEnder === '-' && res.baulEnderPicareta === '130x1', `baú do Ender exige picareta (mão ${res.baulEnder}, madeira ${res.baulEnderPicareta})`);
  ok(res.bigorna === '-' && res.bigornaPicareta === '145x1', `bigorna exige picareta (mão ${res.bigorna}, madeira ${res.bigornaPicareta})`);
  ok(res.pistaoMao === '33x1', `pistão larga à mão (${res.pistaoMao})`);
  ok(/^351:3x/.test(res.cacau), `cacau larga sementes de cacau (${res.cacau})`);
}

console.log(out.join('\n'));
console.log('erros de console/página:', errors.length, errors[0] || '');
await browser.close();
process.exit(out.some((l) => l.startsWith('FALHA')) || errors.length ? 1 : 0);
