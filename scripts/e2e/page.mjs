// Página /play/:id completa no Chrome headless (Supabase bloqueado). Testa chat, tecla E e tempo de volta do HUD.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 600 });
const errors = [];
await page.evaluateOnNewDocument(() => {
  // pointer lock simulado: eventos assíncronos como no navegador (o headless não tem pointer lock)
  let lockEl = null;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { get() { return lockEl; } });
  Element.prototype.requestPointerLock = function () { setTimeout(() => { lockEl = this; document.dispatchEvent(new Event('pointerlockchange')); }, 5); return Promise.resolve(); };
  Document.prototype.exitPointerLock = function () { setTimeout(() => { if (lockEl) { lockEl = null; document.dispatchEvent(new Event('pointerlockchange')); } }, 5); };
});
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname)) r.abort(); else r.continue(); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|ERR_FAILED|net::|MeshWorker|World\]/.test(t)) errors.push('console: ' + t.slice(0, 250)); } });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
const worldId = await page.evaluate(async () => {
  const { createWorld } = await import('/src/game/save.js');
  const w = await createWorld({ name: 'Teste', seed: '123', gameMode: 'survival', mapType: 'open_world' });
  return w.id;
});
await page.goto(`http://localhost:${port}/play/${worldId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
// espera o carregamento sumir
for (let i = 0; i < 60; i++) { const loading = await page.evaluate(() => /Carregando|MIND-CAVE/.test(document.body.innerText) && !!document.querySelector('canvas') && /%/.test(document.body.innerText)); if (!loading) break; await sleep(1000); }
await sleep(3000);
const text = () => page.evaluate(() => document.body.innerText);
const hasPauseMenu = async () => /Menu do jogo/.test(await text());
ok(!!(await page.$('canvas')), 'canvas do jogo presente');

// trava o ponteiro com um clique (gesto de usuário)
await page.evaluate(() => document.querySelector('canvas').click());
await sleep(500);
const locked = await page.evaluate(() => !!document.pointerLockElement);
out.push(`INFO pointer lock disponível no headless: ${locked}`);
ok(!(await hasPauseMenu()) || !locked, 'jogando (sem menu de pausa) depois do clique');

// ---- chat: T, digita, Enter ----
await page.keyboard.press('KeyT');
await sleep(300);
const inputVisible = await page.evaluate(() => !!document.querySelector('input[placeholder*="chat"]'));
ok(inputVisible, 'T abre o campo do chat');
await page.keyboard.type('ola mundo');
await page.keyboard.press('Enter');
await sleep(600);
const afterChatPause = await hasPauseMenu();
const lockedAfter = await page.evaluate(() => !!document.pointerLockElement);
ok(!afterChatPause, `após Enter no chat o menu de pausa NÃO aparece (pausa=${afterChatPause}, lock=${lockedAfter})`);
const chatSent = await page.evaluate(() => /ola mundo/.test(document.body.innerText));
ok(chatSent, 'mensagem aparece no chat');
// comando
await page.keyboard.press('Slash'); await sleep(200);
await page.keyboard.type('time set day'); await page.keyboard.press('Enter'); await sleep(500);
ok(!(await hasPauseMenu()), 'após comando "/..." o menu de pausa não aparece');

// ---- E: abre e fecha inventário; medir volta do HUD ----
const hudVisible = () => page.evaluate(() => { const el = [...document.querySelectorAll('div')].find(d => d.className && typeof d.className === 'string' && d.className.includes('transition-opacity') && d.className.includes('duration-150')); return el ? !el.className.includes('opacity-0') : null; });
ok((await hudVisible()) === true, 'HUD visível jogando');
await page.keyboard.press('KeyE'); await sleep(700);
const invOpen = await page.evaluate(() => !!document.querySelector('.fixed.inset-0.z-50') || /Criação/.test(document.body.innerText));
ok(invOpen, 'E abre o inventário');
ok((await hudVisible()) === false, 'HUD some com o inventário aberto');
// mede DENTRO da página: do keydown do E até a classe do HUD voltar a "visível" (sem overhead do Puppeteer)
await page.evaluate(() => {
  window.__m = { t0: 0, t1: 0, frames: [] };
  window.addEventListener('keydown', (e) => { if (e.code === 'KeyE') window.__m.t0 = performance.now(); }, true);
  const el = [...document.querySelectorAll('div')].find(d => typeof d.className === 'string' && d.className.includes('transition-opacity') && d.className.includes('duration-150'));
  new MutationObserver(() => { if (window.__m.t0 && !window.__m.t1 && !el.className.includes('opacity-0')) window.__m.t1 = performance.now(); }).observe(el, { attributes: true, attributeFilter: ['class'] });
  let last = performance.now(); const loop = () => { const n = performance.now(); window.__m.frames.push(n - last); last = n; if (window.__m.frames.length < 600) requestAnimationFrame(loop); }; requestAnimationFrame(loop);
});
await page.keyboard.press('KeyE');
await sleep(1500);
const m = await page.evaluate(() => ({ ms: window.__m.t1 - window.__m.t0, avgFrame: window.__m.frames.reduce((a, b) => a + b, 0) / window.__m.frames.length }));
out.push(`INFO frame médio no headless: ${m.avgFrame.toFixed(0)} ms (render por software)`);
ok(m.ms >= 0 && m.ms < 250, `HUD volta ${m.ms.toFixed(0)} ms depois do E (dentro da página)`);
// ---- E no menu de pausa / opções não fecha nada ----
await page.keyboard.press('Escape'); await sleep(500);
const pausedNow = await hasPauseMenu();
out.push(`INFO Esc abre pausa: ${pausedNow} (lock real: ${locked})`);
if (pausedNow) {
  await page.keyboard.press('KeyE'); await sleep(500);
  ok(await hasPauseMenu(), 'E no menu de pausa NÃO fecha o menu e não abre o inventário');
}
console.log(out.join('\n'));
console.log('--- erros:', errors.length); errors.slice(0, 10).forEach(e => console.log('  ' + e));
await browser.close();
process.exit(out.some(l => l.startsWith('FALHA')) ? 1 : 0);
