// Voo do criativo como no 1.8.9: acelera e escorrega (atrito 0,91), ~10,1 blocos/s voando e ~20,2 correndo; sobe/desce a 7,5 blocos/s
// e para quase na hora ao soltar; pousar no chão encerra o voo. Motor real no Chrome, com as teclas simuladas.
import { pathToFileURL } from 'url';
const root = process.argv[2], port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
page.on('dialog', (d) => d.accept());
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/')) { if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } }); else r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); } else r.continue(); });
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const r = await page.evaluate(async () => {
  const { ClientWorld } = await import('/src/game/world.js'); const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js'); const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js'); const { packState } = await import('/src/game/chunk.js');
  const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:640px;height:360px;position:fixed;left:0;top:0'; document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 110, z: 8.5 };
  const ps = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: 'creative', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'T' };
  const eng = new GameEngine(canvas, { world: cw, player: ps, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {}, onAutosave: async () => {} });
  await eng.start(); eng.paused = false; for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250));
  const G = 99;
  for (let x = -40; x <= 60; x++) for (let z = -40; z <= 120; z++) { for (let y = G + 1; y <= G + 80; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, G, z, packState(1, 0)); }
  const tick = (n) => { for (let i = 0; i < n; i++) eng.tick(); };
  const sp = () => Math.hypot(ps.vel.x, ps.vel.z) * 20;
  const res = {};
  eng.sprintToggled = false; eng.wTapCount = 0;
  ps.pos = { x: 8.5, y: G + 30, z: 0.5 }; ps.vel = { x: 0, y: 0, z: 0 }; ps.flying = true; ps.yaw = 0; tick(2);
  eng.keys.KeyW = true; tick(5); res.v5 = sp(); tick(60); res.vFly = sp();
  eng.keys.KeyW = false; tick(1); res.vSolta1 = sp(); tick(30); res.vSolta30 = sp();
  eng.keys.KeyW = true; eng.sprintToggled = true; tick(60); res.vSprint = sp(); eng.sprintToggled = false; eng.keys.KeyW = false; tick(40);
  ps.vel = { x: 0, y: 0, z: 0 };
  eng.keys.Space = true; const y0 = ps.pos.y; tick(60); res.vUp = (ps.pos.y - y0) / 60 * 20; res.vUpInst = ps.vel.y * 20; eng.keys.Space = false; tick(1); res.vUpSolta1 = ps.vel.y * 20; tick(20);
  // pousar: desce segurando Shift até o chão
  eng.keys.ShiftLeft = true; for (let i = 0; i < 400 && ps.flying; i++) tick(1); eng.keys.ShiftLeft = false;
  res.pousou = { flying: ps.flying, y: +ps.pos.y.toFixed(2) };
  return res;
});
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
ok(r.v5 < r.vFly * 0.8, `voando acelera, não pula para a velocidade final: ${r.v5.toFixed(1)} b/s no 5º tick → ${r.vFly.toFixed(1)} b/s`);
ok(Math.abs(r.vFly - 10.1) < 0.4, `velocidade de cruzeiro voando: ${r.vFly.toFixed(2)} blocos/s (vanilla ≈ 10,1)`);
ok(r.vSolta1 > r.vFly * 0.8 && r.vSolta30 < 0.8, `ao soltar o W ele escorrega (${r.vSolta1.toFixed(1)} b/s no 1º tick; 0,91^30 → ~0,6) e quase para em 30 ticks (${r.vSolta30.toFixed(2)} b/s)`);
ok(Math.abs(r.vSprint - 20.2) < 0.8, `correndo voando: ${r.vSprint.toFixed(2)} blocos/s (vanilla ≈ 20,2)`);
ok(Math.abs(r.vUp - 7.5) < 0.4, `subida com espaço: ${r.vUp.toFixed(2)} blocos/s (vanilla 7,5)`);
ok(Math.abs(r.vUpSolta1) < 0.6 * Math.abs(r.vUpInst) + 0.01, `ao soltar o espaço a subida perde 40% por tick (${r.vUpInst.toFixed(1)} → ${r.vUpSolta1.toFixed(1)} b/s)`);
ok(!r.pousou.flying, `pousar no chão encerra o voo (y = ${r.pousou.y})`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
