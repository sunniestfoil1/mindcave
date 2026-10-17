// Foto das árvores portadas (uma de cada espécie, lado a lado) para conferir a forma e as texturas. Uso: node scripts/e2e/trees-visual.mjs <raiz> <porta>
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const root = process.argv[2], port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('dialog', (d) => d.accept());
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/')) { if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); else r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); } else r.continue(); });
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
fs.mkdirSync(path.join(root, 'scripts', 'e2e', 'out'), { recursive: true });
await page.evaluate(async () => {
  const { ClientWorld } = await import('/src/game/world.js'); const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js'); const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js'); const { packState } = await import('/src/game/chunk.js');
  const T = await import('/src/game/trees.js'); const { JRandom } = await import('/src/game/jrandom.js');
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:1280px;height:720px;position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 110, z: 8.5 };
  const ps = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: 'creative', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'T' };
  const eng = new GameEngine(canvas, { world: cw, player: ps, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {}, onAutosave: async () => {} });
  await eng.start(); eng.paused = false; for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250));
  eng.tick = () => {}; eng.hideHud = true; window.__e = eng; window.__ps = ps; window.__cw = cw;
  const G = 99;
  for (let x = -6; x <= 120; x++) for (let z = -30; z <= 30; z++) { for (let y = G + 1; y <= G + 40; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, G, z, packState(2, 0)); cw.setBlock(x, G - 1, z, packState(3, 0)); }
  const R = { get: (x, y, z) => cw.getBlock(x, y, z), id: (x, y, z) => (cw.getBlock(x, y, z) >> 4) & 0xfff, isAir: (x, y, z) => cw.getBlock(x, y, z) === 0, set: (x, y, z, s) => cw.setBlock(x, y, z, s) };
  const list = [
    ['carvalho', (r, x, z) => T.genTrees(R, r, x, G + 1, z)], ['carvalhoGrande', (r, x, z) => T.genBigTree(R, r, x, G + 1, z, 5)], ['betula', (r, x, z) => T.genBirch(R, r, x, G + 1, z, false)],
    ['betulaAlta', (r, x, z) => T.genBirch(R, r, x, G + 1, z, true)], ['pinheiro1', (r, x, z) => T.genTaiga1(R, r, x, G + 1, z)], ['pinheiro2', (r, x, z) => T.genTaiga2(R, r, x, G + 1, z)],
    ['selva', (r, x, z) => T.genTrees(R, r, x, G + 1, z, { minHeight: 8, wood: 3, leaf: 3, vines: true })], ['acacia', (r, x, z) => T.genSavannaTree(R, r, x, G + 1, z)],
    ['carvalhoEscuro', (r, x, z) => T.genCanopy(R, r, x, G + 1, z)], ['pantano', (r, x, z) => T.genSwamp(R, r, x, G + 1, z)],
  ];
  list.forEach(([n, f], i) => { for (let k = 0; k < 20; k++) { const ok = f(new JRandom(BigInt(1000 + i * 31 + k)), 6 + i * 12, 0); if (ok !== false) break; } });
  const big = [['pinheiroGigante', (r, x, z) => T.genMegaPine(R, r, x, G + 1, z, false)], ['selvaGigante', (r, x, z) => T.genMegaJungle(R, r, x, G + 1, z)]];
  big.forEach(([n, f], i) => { for (let k = 0; k < 20; k++) { const ok = f(new JRandom(BigInt(5000 + i * 31 + k)), 20 + i * 24, 24); if (ok !== false) break; } });
});
const shot = async (name, x, y, z, yaw, pitch) => {
  await page.evaluate((x, y, z, yaw, pitch) => { const ps = window.__ps; ps.pos = { x, y, z }; ps.vel = { x: 0, y: 0, z: 0 }; ps.yaw = yaw; ps.pitch = pitch; window.__e.worldTime = 1000; }, x, y, z, yaw, pitch);
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(async () => { const cw = window.__cw; const t0 = performance.now(); while (performance.now() - t0 < 40000) { if (cw.isIdle() && cw.pendingMeshCount() === 0) break; await new Promise(r => setTimeout(r, 200)); } window.__e.worldTime = 1000; await new Promise(r => setTimeout(r, 800)); });
  await page.screenshot({ path: path.join(root, 'scripts', 'e2e', 'out', name) });
};
const G = 99;
await shot('arvores-1.png', 30, G + 6, 26, Math.PI, 0.12);
await shot('arvores-2.png', 94, G + 6, 26, Math.PI, 0.12);
await shot('arvores-gigantes.png', 33, G + 12, 56, Math.PI, 0.05);
await browser.close();
console.log('fotos em scripts/e2e/out/arvores-*.png');
