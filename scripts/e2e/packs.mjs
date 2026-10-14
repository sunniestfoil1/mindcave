// Pacotes de recursos: botão liberado em Opções, escolher o SunniFPSBOOST baixa e salva no cache, "Pronto" recarrega com o pacote ligado
// (widgets do pacote na GUI e atlas de blocos diferente), e a recarga NÃO baixa o zip de novo (HEAD de tamanho confere o cache).
// Rede: só o Storage público do Supabase é liberado (leitura do pacote); o resto do Supabase segue bloqueado.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1024, height: 768 });
const errors = [];
const packGets = [];
await page.setRequestInterception(true);
page.on('request', (r) => {
  const u = new URL(r.url());
  const storage = u.pathname.startsWith('/storage/v1/object/public/game-assets/');
  if (u.pathname.endsWith('SunniFPSBOOST.zip') && r.method() === 'GET') packGets.push(r.url());
  if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !storage) r.abort(); else r.continue();
});
page.on('pageerror', (e) => errors.push(e.message));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
const btn = (label) => `[aria-label="${label}"]`;

await page.goto(`http://localhost:${port}/options`, { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForSelector(btn('Pacotes de recursos...'), { timeout: 60000 });
ok(await page.$eval(btn('Pacotes de recursos...'), (e) => e.getAttribute('aria-disabled') !== 'true'), 'botão Pacotes de recursos... está liberado em Opções');
await page.click(btn('Pacotes de recursos...'));
await sleep(1500);

// primeira entrada da lista da esquerda (ícone 32×32 em GUI): clicar no ícone move para os selecionados
const panel = await page.evaluate(() => {
  const ps = [...document.querySelectorAll('div')].filter((d) => /overflow: hidden/.test(d.getAttribute('style') || '') && /rgba\(0, 0, 0, 0\.5\)/.test(d.getAttribute('style') || ''));
  const r = ps[0].getBoundingClientRect();
  return { x: r.left, y: r.top };
});
const S = 3; // 1024×768 => GUI 3×
await page.mouse.click(panel.x + (2 + 16) * S, panel.y + (17 + 16) * S);
for (let i = 0; i < 60; i++) {
  await sleep(500);
  if (packGets.length && await page.evaluate(async () => (await (await caches.open('mc-resourcepacks-v1')).keys()).length > 0)) break;
}
const cached = await page.evaluate(async () => {
  const c = await caches.open('mc-resourcepacks-v1');
  const res = await c.match((await c.keys())[0]);
  return res ? Number(res.headers.get('x-pack-size')) : 0;
});
ok(cached === 2261841, `zip salvo no cache com o tamanho real (${cached} bytes)`);

const nav = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 });
await page.click(btn('Pronto'));
await nav;
await sleep(1500);
ok(await page.evaluate(() => localStorage.getItem('mc.resourcePacks.v1')) === '["SunniFPSBOOST.zip"]', 'escolha gravada e página recarregada');
const blobs = await page.evaluate(() => [...document.querySelectorAll('div')].filter((d) => d.style.backgroundImage.includes('blob:')).length);
ok(blobs > 0, `botões da GUI usam o widgets.png do pacote (${blobs} elementos)`);
ok(packGets.length === 1, `a recarga não baixou o zip de novo (${packGets.length} download no total)`);

const atlas = () => page.evaluate(async () => {
  const tex = await import('/src/game/textures.js');
  await tex.loadRealTextures();
  const sum = (name) => {
    const cv = tex.getAtlasTileCanvas(name);
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) >>> 0;
    return h;
  };
  return { stone: sum('stone'), coal: sum('coal_ore') };
});
const withPack = await atlas();
await page.evaluate(() => localStorage.setItem('mc.resourcePacks.v1', '[]'));
await page.reload({ waitUntil: 'networkidle2' });
const without = await atlas();
ok(withPack.stone !== without.stone && withPack.coal !== without.coal, 'o atlas de blocos muda com o pacote ligado (pedra e minério de carvão)');
ok(errors.length === 0, `sem erro de página (${errors.length}${errors[0] ? ': ' + errors[0] : ''})`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some(l => l.startsWith('FALHA')) ? 1 : 0);
