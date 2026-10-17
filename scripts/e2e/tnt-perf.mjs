// Quem causa o lag quando muita TNT explode? Monta N TNT empilhadas, acende uma (cadeia) e mede, em quadros reais do motor:
// o custo de cada parte (tick das TNT, explode(), partículas, itens caídos, malhas de chunk, desenho) e os piores quadros.
// Uso: node scripts/e2e/tnt-perf.mjs <raiz> <porta> [N=150] [--limite=ms]  → imprime o ranking do culpado; com --limite falha se o pior quadro passar do limite
import { pathToFileURL } from 'url';
const root = process.argv[2], port = process.argv[3] || '5181';
const N = parseInt((process.argv[4] || '150').replace(/\D/g, ''), 10) || 150;
const lim = (process.argv.find((a) => a.startsWith('--limite=')) || '').split('=')[1];
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
page.on('dialog', (d) => d.accept());
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/')) { if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); else r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); } else r.continue(); });
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const res = await page.evaluate(async (N) => {
  const { ClientWorld } = await import('/src/game/world.js'); const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js'); const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js'); const { packState } = await import('/src/game/chunk.js');
  const { perfMonitor } = await import('/src/game/perfMonitor.js');
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:640px;height:360px;position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 110, z: 8.5 };
  const ps = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: 'creative', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'T' };
  const eng = new GameEngine(canvas, { world: cw, player: ps, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {}, onAutosave: async () => {} });
  await eng.start(); eng.paused = false; for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250));
  const G = 99;
  // piso de pedra e um bloco de TNT N (10 por camada, quadrado √ )
  for (let x = -4; x <= 30; x++) for (let z = -4; z <= 30; z++) { for (let y = G + 1; y <= G + 30; y++) cw.setBlock(x, y, z, 0); for (let y = G - 6; y <= G; y++) cw.setBlock(x, y, z, packState(1, 0)); }
  const side = Math.ceil(Math.sqrt(N / 3));
  let placed = 0;
  for (let y = 0; y < 3 && placed < N; y++) for (let x = 0; x < side && placed < N; x++) for (let z = 0; z < side && placed < N; z++) { cw.setBlock(8 + x, G + 1 + y, 8 + z, packState(46, 0)); placed++; }
  ps.pos = { x: 8 + side / 2, y: G + 12, z: 8 + side / 2 + 14 }; ps.yaw = Math.PI; ps.pitch = 0.6;
  await new Promise(r => setTimeout(r, 6000));
  // medidores (somam o tempo gasto em cada função)
  const T = {}; const wrap = (obj, name, label) => { const f = obj[name]; if (!f) return; obj[name] = function (...a) { const t = performance.now(); const r = f.apply(this, a); T[label] = (T[label] || 0) + performance.now() - t; return r; }; };
  wrap(eng, 'tickTntEntities', 'tick das TNT (movimento+cadeia)'); wrap(eng, 'detonate', 'detonate() total'); wrap(eng, 'spawnTNT', 'spawnTNT (criar malha)');
  if (eng.particles) { wrap(eng.particles, 'spawnNamed', 'partículas'); wrap(eng.particles, 'spawnBlockBreak', 'partículas de bloco'); }
  if (eng.itemEntities) wrap(eng.itemEntities, 'spawnItem', 'spawnItem (drops)');
  for (const n of ['_patchImmediateLight', 'flushImmediateRebuilds', '_markSectionDirty', '_enqueue', 'ensureChunk', '_queueImmediateSection', 'endBatch']) wrap(cw, n, '  world.' + n);
  const fl = []; const ff = cw.flushImmediateRebuilds.bind(cw); cw.flushImmediateRebuilds = function () { const n = this._immediateDirtySecs ? this._immediateDirtySecs.size : 0; const t = performance.now(); const r = ff(); if (n) fl.push([n, Math.round(performance.now() - t), this._batchDepth]); return r; };
  const calls = { setBlock: 0 }; const who = {}; const sb = cw.setBlock.bind(cw); cw.setBlock = (...a) => { calls.setBlock++; if (!cw._batchDepth) { const st = (new Error().stack || '').split(String.fromCharCode(10)).slice(2, 5).map((l) => (l.match(/at (\S+)/) || [])[1]).join('<'); who[st] = (who[st] || 0) + 1; } const t = performance.now(); const r = sb(...a); T['world.setBlock'] = (T['world.setBlock'] || 0) + performance.now() - t; return r; };
  perfMonitor.reset();
  const frames = []; let tntMax = 0, tntSeen = 0;
  // acende a primeira
  eng.spawnTNT(8.5, G + 1.5, 8.5); cw.setBlock(8, G + 1, 8, 0);
  const t0 = performance.now(); let last = t0, maxFrame = 0;
  const worst = [];
  while (performance.now() - t0 < 25000) {
    await new Promise((r) => requestAnimationFrame(r));
    const now = performance.now(); const dt = now - last; last = now; frames.push(dt); if (dt > maxFrame) maxFrame = dt;
    tntMax = Math.max(tntMax, eng.tntEntities.length); tntSeen = Math.max(tntSeen, eng.pendingTnt.length);
    if (dt > 60) worst.push({ dt: Math.round(dt), stages: Object.fromEntries(Object.entries(perfMonitor.stages).filter(([, v]) => v > 5).map(([k, v]) => [k, Math.round(v)])), tnt: eng.tntEntities.length, meshQ: perfMonitor.info.meshQ });
    if (eng.tntEntities.length === 0 && eng.pendingTnt.length === 0 && now - t0 > 6000) break;
  }
  frames.sort((a, b) => a - b);
  return { N: placed, frames: frames.length, mediana: Math.round(frames[frames.length >> 1]), p95: Math.round(frames[Math.floor(frames.length * 0.95)]), max: Math.round(maxFrame), tntSimultaneas: tntMax, T: Object.fromEntries(Object.entries(T).map(([k, v]) => [k, Math.round(v)])), setBlocks: calls.setBlock, quemChamaSetBlockForaDeLote: who, nFlush: fl.length, worst: worst.slice(0, 3), gpuSoftware: perfMonitor.isSoftwareRenderer };
}, N);
console.log(JSON.stringify(res, null, 1));
await browser.close();
if (lim && res.max > Number(lim)) { console.log(`FALHA: pior quadro ${res.max} ms > ${lim} ms`); process.exit(1); }
