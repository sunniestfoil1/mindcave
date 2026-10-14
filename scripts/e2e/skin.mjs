// Menu principal > Personalizar jogador (mesma tela do menu de opções): liga/desliga a capa várias vezes sem erro de WebGL e salva o nome
import { pathToFileURL } from 'url';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 700 });
const errors = [];
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname)) r.abort(); else r.continue(); });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && /precision|Context Lost|WebGL/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const clickText = (txt) => page.evaluate((txt) => { const el = [...document.querySelectorAll('[role=button]')].find(e => (e.getAttribute('aria-label') || '').startsWith(txt)); if (el) { el.click(); return true; } return false; }, txt);
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(7000);
ok(await clickText('Personalizar'), 'botão Personalizar existe no menu principal');
await sleep(1200);
ok(await page.evaluate(() => [...document.querySelectorAll('[role=button]')].some(e => (e.getAttribute('aria-label') || '').startsWith('Salvar nome'))), 'abre a tela de personalização com o campo de nome');
for (let i = 0; i < 4; i++) { await clickText('Capa'); await sleep(500); }
ok(errors.length === 0, `ligar/desligar a capa 4× não gera erro de WebGL (${errors.length} erros${errors[0] ? ': ' + errors[0] : ''})`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some(l => l.startsWith('FALHA')) ? 1 : 0);
