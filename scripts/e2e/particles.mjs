// Partículas de bloco quebrado: mostram pixels da textura do próprio bloco (não preto), e aguentam 300 blocos quebrados no mesmo segundo
// sem descartar nenhuma e com custo por quadro baixo. Prints em scripts/e2e/out/particulas-*.png.
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
await page.setRequestInterception(true);
page.on('request', (r) => {
  const u = new URL(r.url());
  if (/(^|\.)supabase\.co$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/')) {
    if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    else r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
  } else if (/(^|\.)(crafthead\.net|vercel\.com)$/.test(u.hostname)) r.abort();
  else r.continue();
});
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
fs.mkdirSync(path.join(root, 'scripts', 'e2e', 'out'), { recursive: true });
await page.evaluate(async () => {
  const { ClientWorld } = await import('/src/game/world.js');
  const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js');
  const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
  const { packState } = await import('/src/game/chunk.js');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:800px;height:450px;position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 100, z: 12.5 };
  const pState = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: Math.PI, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: 'survival', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'Tester' };
  const engine = new GameEngine(canvas, { world: cw, player: pState, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {}, onAutosave: async () => {} });
  await engine.start();
  engine.paused = false;
  for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250));
  for (let x = -6; x <= 22; x++) for (let z = -6; z <= 22; z++) { for (let y = 100; y <= 112; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, 99, z, packState(1, 0)); }
  engine.tick = () => {};
  engine.hideHud = true;
  window.__eng = engine; window.__ps = pState;
  await new Promise(r => setTimeout(r, 2500));
});
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
const shot = async (name) => { const p = path.join(root, 'scripts', 'e2e', 'out', name); const buf = await page.screenshot({ path: p }); return buf.toString('base64'); };
// dados da instância 0 e do buffer de GPU
const inst = () => page.evaluate(() => {
  const pm = window.__eng.particles; const b = pm.buffer.array;
  const rows = []; for (let i = 0; i < Math.min(pm.count, 40); i++) rows.push(Array.from(b.slice(i * 12, i * 12 + 12)));
  return { count: pm.count, rows, H: window.__eng.world.atlas.canvas.height, tiles: window.__eng.world.atlas.tiles };
});
const clear = () => page.evaluate(() => { const pm = window.__eng.particles; pm.alive.fill(0); pm.cursor = 0; });
const spawn = (id, meta = 0) => page.evaluate((id, meta) => { window.__eng.particles.spawnBlockBreak(8.5, 101.2, 8.5, id, meta); }, id, meta);
await page.evaluate(() => { window.__ps.pos = { x: 8.5, y: 100, z: 10.5 }; window.__ps.yaw = Math.PI; window.__ps.pitch = 0.12; });

// ---- textura do bloco: pedra, grama (usa terra), folhas, tronco de bétula ----
const cases = [['pedra', 1, 0, 'stone'], ['grama (solta terra)', 2, 0, 'dirt'], ['folhas', 18, 0, 'leaves'], ['areia', 12, 0, 'sand']];
for (const [nome, id, meta, tile] of cases) {
  await clear(); await spawn(id, meta); await new Promise(r => setTimeout(r, 600));
  const d = await inst();
  const t = d.tiles[tile];
  const x0 = Math.floor(t.u0 * 256 + 1e-3), y0 = Math.floor(t.v1 * d.H + 1e-3);
  const dentro = d.rows.every((r) => { const px = r[4] * 256, py = r[5] * d.H; return r[6] === 1 && px >= x0 - 1e-3 && px <= x0 + 12 + 1e-3 && py >= y0 - 1e-3 && py <= y0 + 12 + 1e-3; });
  if (!dentro) out.push('INFO linha0=' + JSON.stringify(d.rows[0]) + ' tile=' + JSON.stringify(t) + ' x0=' + x0 + ' y0=' + y0 + ' H=' + d.H);
  ok(d.count >= 10 && dentro, `${nome}: ${d.count} partículas, todas com recorte 4×4 de dentro do tile "${tile}" do atlas`);
  if (nome === 'folhas') {
    const verde = d.rows.every((r) => r[9] > r[8] && r[9] > r[10]);
    ok(verde, 'folhas: a tinta de folhagem (verde) vai junto, como no original');
  }
}

// ---- o que aparece na tela: pedaços de terra marrons, não preto ----
await clear(); await spawn(2, 0);
for (let i = 0; i < 3; i++) await spawn(2, 0);
await new Promise(r => setTimeout(r, 700));
const img = await shot('particulas-terra.png');
const { marrom, preto } = await page.evaluate(async (b64) => {
  const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
  const d = g.getImageData(300, 210, 200, 90).data;
  let marrom = 0, preto = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    if (r > gg && gg > b && r - b > 18 && r > 45 && r < 140) marrom++;
    if (r < 12 && gg < 12 && b < 12) preto++;
  }
  return { marrom, preto };
}, img);
ok(marrom >= 60 && preto < 10, `na tela: ${marrom} pixels marrons de terra e ${preto} pretos (antes era um borrão preto)`);

// ---- 300 blocos quebrados no mesmo segundo ----
await clear();
const perf = await page.evaluate(async () => {
  const eng = window.__eng, pm = eng.particles, t = (f) => { const a = performance.now(); f(); return performance.now() - a; };
  const ids = [1, 2, 3, 17, 18, 12, 13, 4];
  const spawnMs = t(() => { for (let i = 0; i < 300; i++) pm.spawnBlockBreak(2 + (i % 14), 101, 2 + ((i / 14) | 0) % 14, ids[i % ids.length], 0); });
  const live = pm.liveCount();
  const tick = []; const ren = [];
  for (let k = 0; k < 3; k++) { pm.tick(eng.world); pm.renderUpdate(); }   // aquecimento do JIT: não é o que o jogador sente
  for (let k = 0; k < 40; k++) { tick.push(t(() => pm.tick(eng.world))); ren.push(t(() => pm.renderUpdate())); }
  const max = (a) => Math.max(...a), avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  return { spawnMs, live, tickMax: max(tick), tickAvg: avg(tick), renMax: max(ren), renAvg: avg(ren), cap: 8192 };
});
ok(perf.live >= 3000 && perf.live < perf.cap, `300 blocos de uma vez: ${perf.live} partículas vivas, nenhuma descartada (capacidade ${perf.cap})`);
ok(perf.spawnMs < 25, `criar as ${perf.live} partículas custa ${perf.spawnMs.toFixed(1)} ms (limite 25 ms; um quadro a 60 fps = 16,7 ms)`);
ok(perf.tickMax < 16 && perf.renMax < 8, `por quadro com ${perf.live} vivas: física ${perf.tickAvg.toFixed(2)} ms (pico ${perf.tickMax.toFixed(2)}) e cópia para a GPU ${perf.renAvg.toFixed(2)} ms (pico ${perf.renMax.toFixed(2)})`);
await new Promise(r => setTimeout(r, 400));
await shot('particulas-300-blocos.png');
console.log(out.join('\n'));
await browser.close();
process.exit(out.some(l => l.startsWith('FALHA')) ? 1 : 0);
