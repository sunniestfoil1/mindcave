// Quem entra na partida de outra pessoa (?room=) ou abre pela URL um mundo que NÃO é dele não pode: salvar nada (nem blocos no navegador, nem blocos na nuvem,
// nem o registro do mundo) e nem abrir LAN. O dono salva normalmente e vê "Abrir para LAN". Página /play completa no Chrome headless.
import { pathToFileURL } from 'url';
const root = process.argv[2], port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];

async function abrir(nome, { mundoDeOutro = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 520 });
  const gravacoes = { chunks: 0, mundos: 0 };
  page.on('pageerror', (e) => errors.push(nome + ': ' + e.message));
  await page.evaluateOnNewDocument(() => {
    let lockEl = null;
    Object.defineProperty(Document.prototype, 'pointerLockElement', { get() { return lockEl; } });
    Element.prototype.requestPointerLock = function () { setTimeout(() => { lockEl = this; document.dispatchEvent(new Event('pointerlockchange')); }, 5); return Promise.resolve(); };
    Document.prototype.exitPointerLock = function () { setTimeout(() => { if (lockEl) { lockEl = null; document.dispatchEvent(new Event('pointerlockchange')); } }, 5); };
  });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/')) {
      if (r.method() !== 'GET' && r.method() !== 'OPTIONS' && u.pathname.includes('/chunk_deltas')) gravacoes.chunks++;
      if (r.method() !== 'GET' && r.method() !== 'OPTIONS' && u.pathname.includes('/rest/v1/worlds')) gravacoes.mundos++;
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      if (r.method() === 'OPTIONS') return r.respond({ status: 204, headers: h });
      return r.respond({ status: 200, headers: h, contentType: 'application/json', body: '[]' });
    }
    r.continue();
  });
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const worldId = await page.evaluate(async (outro) => {
    const { createWorld } = await import('/src/game/save.js');
    const w = await createWorld({ name: 'Teste', seed: '123', gameMode: 'survival', mapType: 'open_world', ownerId: outro ? 'OUTRA-PESSOA' : undefined });
    return w.id;
  }, mundoDeOutro);
  await page.goto(url(worldId), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__mindcave && window.__mindcave.engine && !document.querySelector('[data-loading-screen]'), { timeout: 240000, polling: 500 });
  await sleep(2500);
  gravacoes.chunks = 0; gravacoes.mundos = 0;   // só conta o que o jogo grava depois de abrir (criar o mundo de teste também grava)
  return { page, worldId, gravacoes };
}
let url = (id) => `http://localhost:${port}/play/${id}`;

async function autosaveEMenu(page, gravacoes) {
  await page.evaluate(() => { const e = window.__mindcave.engine; e.world.setBlock(3, 100, 3, 16); e.world.setBlock(4, 100, 3, 16); });
  const antes = { ...gravacoes };
  await page.evaluate(async () => { await window.__mindcave.engine.onAutosave(); });
  await sleep(500);
  const gravou = gravacoes.chunks - antes.chunks;
  await page.evaluate(() => { const e = window.__mindcave.engine; if (!e.paused) e.onKey({ code: 'Escape', repeat: false, preventDefault() {}, target: document.body }, true); });   // Esc: abre o menu de pausa
  await sleep(900);
  const botoes = await page.evaluate(() => [...document.querySelectorAll('[role=button]')].map((b) => b.getAttribute('aria-label')));   // o texto do menu é desenhado; os botões têm aria-label
  const texto = botoes.join('|');
  const dbg = await page.evaluate(() => { const e = window.__mindcave.engine; return { paused: e.paused, chat: e.chatOpen, lock: !!document.pointerLockElement, hudPaused: e._lastHud && e._lastHud.paused, onOpenToLAN: !!(e._lastHud && e._lastHud.onOpenToLAN) }; });
  if (process.env.DEBUG_TESTE) await page.screenshot({ path: root + '/scripts/e2e/out/debug-sl.png' });
  if (process.env.DEBUG_TESTE) console.log('DEBUG', JSON.stringify(dbg), JSON.stringify(texto.slice(0, 160)));
  return { gravou, temLan: /Abrir para LAN/.test(texto), menuAberto: /Voltar ao jogo/.test(texto) };
}

// 1) dono, mundo dele: salva e vê o botão de LAN
{
  const { page, gravacoes } = await abrir('dono');
  const r = await autosaveEMenu(page, gravacoes);
  ok(r.menuAberto && r.temLan, `dono: o menu de pausa mostra "Abrir para LAN" (menu: ${r.menuAberto}, LAN: ${r.temLan})`);
  ok(r.gravou > 0, `dono: o salvamento automático grava os blocos na nuvem (${r.gravou} gravações)`);
  await page.close();
}
// 2) entrou na partida de outro (?room=): nada é salvo e não há LAN
url = (id) => `http://localhost:${port}/play/${id}?room=sala-do-amigo`;
{
  const { page, gravacoes } = await abrir('convidado');
  const r = await autosaveEMenu(page, gravacoes);
  ok(r.menuAberto && !r.temLan, `convidado (?room=): o menu de pausa NÃO tem "Abrir para LAN" (menu: ${r.menuAberto}, LAN: ${r.temLan})`);
  ok(r.gravou === 0 && gravacoes.mundos === 0, `convidado (?room=): o salvamento automático não grava nada na nuvem (blocos: ${r.gravou}, mundo: ${gravacoes.mundos})`);
  await page.close();
}
console.log(out.join('\n') + (errors.length ? '\nERROS: ' + errors.slice(0, 2).join(' | ') : ''));
ok(errors.length === 0, 'sem erro de página');
await browser.close();
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
