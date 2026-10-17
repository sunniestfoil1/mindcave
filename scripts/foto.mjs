// Foto rápida de uma cena montada na hora (ferramenta de conferência visual, não é teste).
// Uso: node scripts/foto.mjs <raiz> <porta> <cena.json>
// cena.json: { "blocos": [[x,y,z,id,meta]...], "itens": [[hotbar...]], "fotos": [{ "nome": "a.png", "de": [x,y,z], "para": [x,y,z] }], "js": "código opcional rodado depois de montar (window.__e, __cw, __ps, __P)" }
// y é relativo ao chão (y=0 é o primeiro bloco acima do chão de pedra). Saída em scripts/e2e/out/<nome>.
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const [root, port, sceneFile] = process.argv.slice(2);
const scene = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('dialog', (d) => d.accept());
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => { const t = m.text(); if (t.startsWith('>>') || m.type() === 'error') console.log(t.slice(0, 300)); });
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/')) { if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); else r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); } else r.continue(); });
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
fs.mkdirSync(path.join(root, 'scripts', 'e2e', 'out'), { recursive: true });
await page.evaluate(async (scene) => {
  const { ClientWorld } = await import('/src/game/world.js'); const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js'); const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js'); const { packState } = await import('/src/game/chunk.js');
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:1280px;height:720px;position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: scene.gerador || 'open_world', params: {} });
  const spawn = { x: 8.5, y: 110, z: 8.5 };
  const ps = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: scene.modo || 'creative', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'T', hunger: 20, saturation: 5 };
  const eng = new GameEngine(canvas, { world: cw, player: ps, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {}, onAutosave: async () => {} });
  await eng.start(); eng.paused = false; for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250));
  eng.tick = () => {}; eng.hideHud = !scene.hud; Object.assign(window, { __e: eng, __ps: ps, __cw: cw, __P: packState });
  const G = 99;
  for (let x = -8; x <= 40; x++) for (let z = -8; z <= 40; z++) { for (let y = G + 1; y <= G + 20; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, G, z, packState(scene.chao || 1, 0)); cw.setBlock(x, G - 1, z, packState(1, 0)); }
  for (const [x, y, z, id, meta] of scene.blocos || []) cw.setBlock(x, G + 1 + y, z, packState(id, meta || 0));
  if (scene.itens) scene.itens.forEach((it, i) => { ps.hotbar[i] = it; });
  if (scene.js) await (new Function('return (async()=>{' + scene.js + '})()'))();
}, scene);
for (const f of scene.fotos) {
  await page.evaluate((f) => { const ps = window.__ps, G = 99; const [x, y, z] = f.de, [tx, ty, tz] = f.para; ps.pos = { x, y: G + 1 + y - 1.62, z }; ps.vel = { x: 0, y: 0, z: 0 }; const dx = tx - x, dy = ty - y, dz = tz - z; ps.yaw = Math.atan2(-dx, dz); ps.pitch = -Math.atan2(dy, Math.hypot(dx, dz)); window.__e.worldTime = f.hora ?? 1000; }, f);
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(async (f) => { const cw = window.__cw; const t0 = performance.now(); while (performance.now() - t0 < 30000) { if (cw.isIdle() && cw.pendingMeshCount() === 0) break; await new Promise(r => setTimeout(r, 200)); } window.__e.worldTime = f.hora ?? 1000; if (f.js) await (new Function('return (async()=>{' + f.js + '})()'))(); await new Promise(r => setTimeout(r, 900)); }, f);
  await page.screenshot({ path: path.join(root, 'scripts', 'e2e', 'out', f.nome) });
}
await browser.close();
console.log('ok', scene.fotos.map((f) => f.nome).join(' '));
