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
// Supabase "vazio": responde na hora com [] (abortar fazia o jogo repetir cada chamada por minutos e o mundo demorar a abrir)
page.on('request', (r) => {
  const u = new URL(r.url());
  if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/game-assets/')) {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: h });
    else r.respond({ status: 200, headers: h, contentType: 'application/json', body: '[]' });
  } else r.continue();
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|ERR_FAILED|net::|MeshWorker|World\]/.test(t)) errors.push('console: ' + t.slice(0, 250)); } });
const out = [];
process.on('uncaughtException', (e) => { console.log(out.join('\n')); console.log('ERRO:', e && e.message); process.exit(1); });
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
const worldId = await page.evaluate(async () => {
  const { createWorld } = await import('/src/game/save.js');
  const w = await createWorld({ name: 'Teste', seed: '123', gameMode: 'survival', mapType: 'open_world' });
  return w.id;
});
await page.goto(`http://localhost:${port}/play/${worldId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
// espera o motor existir e a tela de carregamento (que tem "NN%") sumir: checar só o texto falhava antes de a tela aparecer
await page.waitForFunction(() => window.__mindcave && window.__mindcave.engine && !document.querySelector('[data-loading-screen]'), { timeout: 240000, polling: 500 });
await sleep(2500);
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
const inputVisible = await page.evaluate(() => !!document.querySelector('input[data-chat-input]'));
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
await page.keyboard.press('Slash');
await page.waitForFunction(() => document.querySelector('input[data-chat-input]')?.value === '/', { timeout: 5000 }).catch(() => {});
await sleep(200);
ok(await page.evaluate(() => document.querySelector('input[data-chat-input]')?.value === '/'), 'a tecla "/" abre o chat já com a barra digitada');
ok(await page.evaluate(() => { const i = document.querySelector('input[data-chat-input]'); return !!i && i.selectionStart === 1 && !i.placeholder; }), 'o cursor fica depois da barra e o campo não tem texto de aviso');
await page.keyboard.type('time set day'); await page.keyboard.press('Enter'); await sleep(500);
ok(!(await hasPauseMenu()), 'após comando "/..." o menu de pausa não aparece');

// ---- Shift direito: menu do Mind Client (o mundo continua rodando; Esc fecha sem abrir a pausa) ----
{
  await page.evaluate(() => window.localStorage.removeItem('mc.client.v1'));
  await page.keyboard.press('ShiftRight'); await sleep(900);
  const menuOpen = await page.evaluate(() => !!document.querySelector('[data-client-menu]'));
  ok(menuOpen, 'Shift direito abre o menu do Mind Client');
  if (!menuOpen) out.push('INFO estado do motor: ' + JSON.stringify(await page.evaluate(() => { const e = window.__mindcave.engine; return { paused: e.paused, chat: e.chatOpen, lock: !!document.pointerLockElement, gui: !!e.guiOpenFn?.() }; })));
  ok(!(await hasPauseMenu()), 'com o menu do Mind Client aberto o menu de pausa não aparece');
  if (menuOpen) {
  const t0 = await page.evaluate(() => window.__mindcave.engine.worldTime); await sleep(1500);
  const t1 = await page.evaluate(() => window.__mindcave.engine.worldTime);
  ok(t1 - t0 >= 10, `com o menu aberto o mundo continua rodando (relógio +${t1 - t0} ticks em 1,5 s)`);
  const cards = await page.evaluate(() => [...document.querySelectorAll('[data-module]')].map((c) => c.getAttribute('data-module')));
  ok(['fps', 'cps', 'coordinates', 'keystrokes', 'armorhud', 'fullbright', 'perspective', 'hitcolor'].every((m) => cards.includes(m)), `os módulos aparecem no menu (${cards.length} cartões)`);
  ok(!['bossbar', 'combodisplay', 'playtime', 'potioncounter', 'potioneffects', 'reachdisplay', 'oldanimations', 'timechanger', 'tnttimer', 'waveycapes'].some((m) => cards.includes(m)), 'módulos removidos a pedido não aparecem');
  await page.click('[data-module="fps"]'); await sleep(300);
  ok(await page.$eval('[data-module="fps"]', (c) => c.getAttribute('aria-pressed') === 'true'), 'clicar no cartão liga o módulo FPS');
  ok(await page.evaluate(() => document.querySelectorAll('[data-client-hud] canvas').length > 0), 'o widget de FPS é desenhado no HUD');
  await page.click('[data-module="fps"]'); await sleep(300);
  await page.keyboard.press('Escape'); await sleep(700);
  ok(!(await page.evaluate(() => !!document.querySelector('[data-client-menu]'))), 'Esc fecha o menu do Mind Client');
  ok(!(await hasPauseMenu()), 'e não abre o menu de pausa');
  }
  await page.keyboard.press('ShiftRight'); await sleep(500);
  await page.keyboard.press('ShiftRight'); await sleep(500);
  ok(!(await page.evaluate(() => !!document.querySelector('[data-client-menu]'))), 'Shift direito de novo fecha o menu');
}

// ---- Modo de edição do HUD: lápis do menu, arrastar o widget, posição salva e restauração ----
{
  const rect = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, pe: getComputedStyle(e).pointerEvents }; }, sel);
  await page.keyboard.press('ShiftRight'); await sleep(800);
  await page.click('[data-module="fps"]'); await sleep(300);            // FPS ligado
  const antes = await rect('[data-hud-widget="fps"]');
  await page.click('[aria-label="Editar posição do HUD"]'); await sleep(400);
  ok(await page.evaluate(() => !!document.querySelector('[data-hud-edit]') && !document.querySelector('[data-module]')), 'o lápis esconde o painel e deixa só a barra de edição');
  const ed = await rect('[data-hud-widget="fps"]');
  ok(ed && ed.pe === 'auto', 'no modo de edição o widget de FPS recebe o mouse');
  await page.mouse.move(ed.x + ed.w / 2, ed.y + ed.h / 2);
  await page.mouse.down();
  await page.mouse.move(ed.x + ed.w / 2 - 200, ed.y + ed.h / 2 + 150, { steps: 8 });
  await page.mouse.up(); await sleep(300);
  const dep = await rect('[data-hud-widget="fps"]');
  ok(dep && Math.abs(dep.x - (ed.x - 200)) <= 2 && Math.abs(dep.y - (ed.y + 150)) <= 2, `arrastar move o widget (${Math.round(dep.x - ed.x)}, ${Math.round(dep.y - ed.y)} px)`);
  const salvo = await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('mc.client.v1') || '{}').__layout?.fps; return l && { x: l.x * innerWidth, y: l.y * innerHeight }; });
  ok(salvo && Math.abs(salvo.x + 200) < 2 && Math.abs(salvo.y - 150) < 2, 'a posição fica salva como fração da janela');
  // arrastar para fora da tela é limitado à janela
  await page.mouse.move(dep.x + dep.w / 2, dep.y + dep.h / 2);
  await page.mouse.down(); await page.mouse.move(-500, -500, { steps: 6 }); await page.mouse.up(); await sleep(200);
  const canto = await rect('[data-hud-widget="fps"]');
  ok(canto && canto.x >= -1 && canto.y >= -1, `o widget não sai da janela (${Math.round(canto.x)}, ${Math.round(canto.y)})`);
  await page.keyboard.press('Escape'); await sleep(400);
  ok(await page.evaluate(() => !!document.querySelector('[data-module]')), 'Esc na edição volta ao menu');
  await page.keyboard.press('Escape'); await sleep(500);
  const fora = await rect('[data-hud-widget="fps"]');
  ok(fora && fora.pe === 'none' && Math.abs(fora.x - canto.x) <= 1, 'fora da edição o widget fica na posição nova e não recebe o mouse');
  await page.keyboard.press('ShiftRight'); await sleep(600);
  await page.click('[aria-label="Editar posição do HUD"]'); await sleep(300);
  await page.evaluate(() => [...document.querySelectorAll('[data-hud-edit] button')].find((b) => /Restaurar/.test(b.textContent)).click()); await sleep(300);
  const rest = await rect('[data-hud-widget="fps"]');
  ok(rest && Math.abs(rest.x - antes.x) <= 1 && Math.abs(rest.y - antes.y) <= 1, 'Restaurar posições devolve o widget ao lugar padrão');
  await page.evaluate(() => [...document.querySelectorAll('[data-hud-edit] button')].find((b) => /Concluir/.test(b.textContent)).click()); await sleep(300);
  await page.click('[data-module="fps"]'); await sleep(300);           // FPS desligado de novo
  await page.keyboard.press('Escape'); await sleep(500);
}

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
// ---- inventário com mouse de verdade: shift-click, armadura, duplo clique, arrastar, bancada ----
await page.evaluate(() => {
  const inv = window.__mindcave.engine.inventory;
  for (const a of [inv.main, inv.hotbar, inv.crafting]) a.fill(null);
  inv.armor.fill(null); inv.cursor = null; inv.craftResult = null;
  inv.main[0] = { id: 5, count: 8, meta: 0 }; inv.main[1] = { id: 1, count: 20, meta: 0 };
  inv.main[4] = { id: 4, count: 10, meta: 0 }; inv.main[9] = { id: 4, count: 20, meta: 0 }; inv.hotbar[3] = { id: 4, count: 30, meta: 0 };
});
await page.keyboard.press('KeyE'); await sleep(700);
const slotXY = (sel) => page.evaluate((sel) => { const el = document.querySelector(`[data-slot="${sel}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
const clickSlot = async (sel, opts = {}) => { const p = await slotXY(sel); if (!p) throw new Error('slot ' + sel); await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y, opts); await sleep(80); };
const shiftClickSlot = async (sel) => { await page.keyboard.down('Shift'); await clickSlot(sel); await page.keyboard.up('Shift'); };
const invState = () => page.evaluate(() => { const i = window.__mindcave.engine.inventory; return JSON.parse(JSON.stringify({ main: i.main, hotbar: i.hotbar, armor: i.armor, crafting: i.crafting, cursor: i.cursor })); });
{
  await clickSlot('main:0'); await clickSlot('grid:0');
  let st = await invState();
  ok(st.crafting[0]?.id === 5 && st.crafting[0].count === 8 && !st.cursor, 'clique: tábuas vão do inventário para a grade de fabricação');
  await shiftClickSlot('grid:0'); st = await invState();
  ok(st.hotbar[0]?.id === 5 && st.hotbar[0].count === 8 && !st.crafting[0], 'shift-click em item da grade de fabricação leva para a hotbar');
  await clickSlot('main:1'); await clickSlot('armor:0'); st = await invState();
  ok(!st.armor[0] && st.cursor?.id === 1, 'pedra NÃO entra no slot de armadura (fica no cursor)');
  await clickSlot('main:1'); st = await invState();
  // duplo clique de verdade (dois pares down/up seguidos dentro da página, sem o atraso do Puppeteer)
  await page.evaluate(() => { const el = document.querySelector('[data-slot="main:4"]'); for (let i = 0; i < 2; i++) for (const t of ['mousedown', 'mouseup']) el.dispatchEvent(new MouseEvent(t, { bubbles: true, button: 0 })); });
  await sleep(150);
  st = await invState();
  const total4 = [...st.main, ...st.hotbar].filter(Boolean).filter(x => x.id === 4).reduce((a, x) => a + x.count, 0) + (st.cursor?.id === 4 ? st.cursor.count : 0);
  ok(st.cursor?.id === 4 && st.cursor.count === total4 && total4 === 60, `duplo clique junta todo o pedregulho no cursor (${st.cursor?.count}/60)`);
  await clickSlot('main:20'); st = await invState();
  ok(!st.cursor && st.main[20]?.count === 60, 'soltar o cursor num slot vazio guarda a pilha');
  // fabricação: 4 tábuas na grade → shift-click no resultado fabrica as bancadas na hotbar
  await page.evaluate(() => { const i = window.__mindcave.engine.inventory; i.crafting[0] = { id: 5, count: 3, meta: 0 }; i.crafting[1] = { id: 5, count: 3, meta: 0 }; i.crafting[2] = { id: 5, count: 3, meta: 0 }; i.crafting[3] = { id: 5, count: 3, meta: 0 }; });
  await clickSlot('grid:0'); await sleep(450); await clickSlot('grid:0'); // força recálculo do resultado (espera >300 ms: não é duplo clique)
  await shiftClickSlot('result:result'); st = await invState();
  const tables = [...st.hotbar, ...st.main].filter(Boolean).filter(x => x.id === 58).reduce((a, x) => a + x.count, 0);
  ok(tables === 3, `shift-click no resultado fabrica até esgotar os ingredientes (${tables} bancadas)`);
}
{
  // o jogo NÃO pausa com o inventário aberto: o relógio do mundo segue andando
  const t0 = await page.evaluate(() => window.__mindcave.engine.worldTime); await sleep(1500);
  const t1 = await page.evaluate(() => window.__mindcave.engine.worldTime);
  ok(t1 - t0 >= 10, `com o inventário aberto o mundo continua rodando (relógio +${t1 - t0} ticks em 1,5 s)`);
}
await page.keyboard.press('KeyE'); await sleep(500);
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
