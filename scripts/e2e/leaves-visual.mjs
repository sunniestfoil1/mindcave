// Print da copa de uma árvore (carvalho do 1.8.9) vista de lado e de baixo, para conferir a olho (ferramenta manual, não faz parte da suíte;
// a conferência numérica está em leaves.mjs).
// Salva scripts/e2e/out/folhas-lado.png e folhas-baixo.png.
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
const shot = async (name) => { await page.screenshot({ path: path.join(root, 'scripts', 'e2e', 'out', name) }); };
fs.mkdirSync(path.join(root, 'scripts', 'e2e', 'out'), { recursive: true });
const res = await page.evaluate(async () => {
  const { ClientWorld } = await import('/src/game/world.js');
  const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js');
  const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
  const { packState } = await import('/src/game/chunk.js');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:800px;height:450px;position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 100, z: 14.5 };
  const pState = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: Math.PI, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: 'survival', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'Tester' };
  const engine = new GameEngine(canvas, { world: cw, player: pState, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {}, onAutosave: async () => {} });
  await engine.start();
  engine.paused = false;
  for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250));
  for (let x = -6; x <= 22; x++) for (let z = -6; z <= 22; z++) { for (let y = 100; y <= 112; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, 99, z, packState(2, 0)); }
  // carvalho do 1.8.9 (WorldGenTrees): tronco de 5, copa em 4 camadas de raio 2,2,1,1; os cantos que o sorteio manteria entram aqui nos pares
  const X = 8, Z = 8, H = 5;
  for (let i = 0; i < H; i++) cw.setBlock(X, 100 + i, Z, packState(17, 0));
  for (let yy = 100 + H - 3; yy <= 100 + H; yy++) {
    const dy = yy - (100 + H), r = 1 - Math.trunc(dy / 2);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const corner = Math.abs(dx) === r && Math.abs(dz) === r;
      if (corner && (dy === 0 || (dx + dz) % 4 === 0)) continue;
      if (dx === 0 && dz === 0 && dy < 0) continue;
      cw.setBlock(X + dx, yy, Z + dz, packState(18, 0));
    }
  }
  engine.tick = () => {};
  engine.hideHud = true;
  window.__eng = engine; window.__ps = pState;
  return { camadas: 4 };
});
const aim = async (pos, yaw, pitch) => {
  await page.evaluate((p, y, pi) => { window.__ps.pos = { ...p }; window.__ps.vel = { x: 0, y: 0, z: 0 }; window.__ps.yaw = y; window.__ps.pitch = pi; }, pos, yaw, pitch);
  await new Promise((r) => setTimeout(r, 2500));
};
await aim({ x: 8.5, y: 103, z: 16.5 }, 0, 0.0);     // de lado, olhando para a árvore (yaw 0 = sul = +z; a árvore fica ao norte)
await page.evaluate(() => { window.__ps.yaw = Math.PI; });
await new Promise((r) => setTimeout(r, 1500));
await shot('folhas-lado.png');
await aim({ x: 8.5, y: 101, z: 10.5 }, Math.PI, -1.1); // embaixo da copa, olhando para cima
await shot('folhas-baixo.png');
await browser.close();
console.log('prints salvos em scripts/e2e/out (folhas-lado.png, folhas-baixo.png)');
