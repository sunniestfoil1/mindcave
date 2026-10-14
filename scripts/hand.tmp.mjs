import { pathToFileURL } from 'url';
const root = process.argv[2], port = process.argv[3], out = process.argv[4];
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
await page.setRequestInterception(true);
page.on('request', r => { const u = new URL(r.url()); /(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) ? r.abort() : r.continue(); });
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(async () => {
  const { ClientWorld } = await import('/src/game/world.js'); const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js'); const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
  const canvas = document.createElement('canvas'); canvas.style.cssText='width:1280px;height:720px;position:fixed;left:0;top:0'; document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('1'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 150, z: 8.5 };
  const p = { pos: { ...spawn }, vel:{x:0,y:0,z:0}, yaw:0, pitch:0.0, onGround:false, flying:true, sneaking:false, sprinting:false, gameMode:'creative', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot:0, nomeJogador:'T' };
  const e = new GameEngine(canvas, { world: cw, player: p, spawn, worldTime: 6000, gameRules: {}, difficulty: 'peaceful', onHud(){}, onProgress(){}, onChatMessage(){}, onDeath(){}, onAutosave: async()=>{} });
  await e.start(); e.paused = false; window.__e = e; window.__p = p; await new Promise(r=>setTimeout(r,3000));
});
const shots = [['block', { id: 2, count: 1, meta: 0 }], ['sword', { id: 267, count: 1, meta: 0 }], ['glint', { id: 267, count: 1, meta: 0, enchants: { sharpness: 1 } }], ['apple', { id: 260, count: 1, meta: 0 }], ['pick', { id: 257, count: 1, meta: 0 }]];
for (const [name, it] of shots) {
  await page.evaluate(async (it) => { window.__p.hotbar[0] = it; window.__p.selectedSlot = 0; window.__e.paused = false; const a = window.__e.anim; a.targetEquip = 1; a.equipProgress = 1; a.prevEquipProgress = 1; for (let i = 0; i < 15; i++) window.__e.tick(); a.equipProgress = a.prevEquipProgress = 1; await new Promise(r => setTimeout(r, 5000)); }, it);
  console.log(name, JSON.stringify(await page.evaluate(() => { const e = window.__e; return { paused: e.paused, persp: e.perspective, held: e.getHeldItem()?.id, vis: e.handRig.itemRoot.visible, fpsItem: !!e.fpsItem, m: e.handRig.itemRoot.matrix.elements.slice(12,15), anim: { ep: e.anim.equipProgress, pe: e.anim.prevEquipProgress, te: e.anim.targetEquip, sw: e.anim.isSwinging, sp: e.anim.speed } }; })));
  await page.evaluate(() => { const a = window.__e.anim; a.equipProgress = a.prevEquipProgress = 1; });
  await page.screenshot({ path: `${out}/${name}.png` });
}
await browser.close();
