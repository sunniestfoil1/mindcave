// Tela de carregamento do mundo: estilo do 1.8.9, progresso real (sobe só com trabalho feito, nunca volta), etapas na ordem e sem
// aviso de texturas quando nada foi baixado; na recarga o pacote vem do cache local e as chamadas ao banco saem em paralelo.
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 500 });
page.on('dialog', (d) => d.accept());   // o jogo pede confirmação ao sair da página (autosave)
await page.setRequestInterception(true);
let inflight = 0, maxInflight = 0, packNet = 0;
const apiStarts = [];
page.on('request', (r) => {
  const u = new URL(r.url());
  if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/game-assets/')) {
    const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (r.method() === 'OPTIONS') { r.respond({ status: 204, headers: h }); return; }
    inflight++; maxInflight = Math.max(maxInflight, inflight); apiStarts.push(Date.now());
    // 250 ms de "rede": se as chamadas estivessem em fila, uma esperaria a outra
    setTimeout(() => { inflight--; r.respond({ status: 200, headers: h, contentType: 'application/json', body: '[]' }); }, 250);
  } else {
    if (/\/storage\/v1\/object\/public\/game-assets\/.*\.zip/.test(u.pathname)) packNet++;
    r.continue();
  }
});
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
const wid = await page.evaluate(async () => { const { createWorld } = await import('/src/game/save.js'); return (await createWorld({ name: 'Carga', seed: '123', gameMode: 'survival', mapType: 'open_world' })).id; });
fs.mkdirSync(path.join(root, 'scripts', 'e2e', 'out'), { recursive: true });

async function visit(label, shotName) {
  inflight = 0; maxInflight = 0; packNet = 0; apiStarts.length = 0;
  await page.goto(`http://localhost:${port}/play/${wid}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  // amostra a tela de carregamento a cada 40 ms até sumir
  const samples = await page.evaluate(async () => {
    const rows = []; const t0 = performance.now(); let shot = false;
    for (;;) {
      const el = document.querySelector('[data-loading-screen]');
      const bar = document.querySelector('[data-loading-bar]');
      if (el && bar) rows.push({ t: Math.round(performance.now() - t0), w: parseFloat(bar.style.width) || 0, txt: el.getAttribute('data-status') || '' });
      else if (rows.length && !el) break;
      if (performance.now() - t0 > 120000) break;
      await new Promise((r) => setTimeout(r, 40));
    }
    return rows;
  });
  await page.waitForFunction(() => window.__mindcave && window.__mindcave.engine && !document.querySelector('[data-loading-screen]'), { timeout: 120000, polling: 200 });
  const widths = samples.map((s) => s.w);
  const dedup = []; for (const s of samples) { const k = `${s.w}%`; if (dedup.at(-1) !== k) dedup.push(k); }
  out.push(`INFO ${label}: barra = ${dedup.join(' ')}`);
  const mono = widths.every((w, i) => i === 0 || w >= widths[i - 1]);
  ok(samples.length > 3, `${label}: a tela de carregamento apareceu (${samples.length} amostras em ${samples.at(-1)?.t} ms)`);
  ok(widths[0] <= 5, `${label}: a barra começa perto de zero (${widths[0]}%), sem mínimo fixo`);
  ok(mono && widths.at(-1) >= 85, `${label}: a barra só sobe e termina em ${widths.at(-1)}% (nunca volta)`);
  const stages = ['Preparando área de spawn', 'Compilando shaders'];
  const seen = stages.map((s) => samples.findIndex((x) => x.txt.includes(s)));
  ok(seen[0] >= 0 && (seen[1] < 0 || seen[0] < seen[1]), `${label}: a etapa dos chunks aparece (@${seen[0]}) e, quando a amostra pega, vem antes dos shaders (@${seen[1]})`);
  const info = await page.evaluate(() => {
    const m = Object.fromEntries(performance.getEntriesByType('mark').filter((x) => x.name.startsWith('mc:')).map((x) => [x.name.slice(3), Math.round(x.startTime)]));
    return { marks: m, note: window.__mindcave.engine.emitHud && null };
  });
  const order = ['renderer', 'pack', 'chunks', 'gpu'];
  ok(order.every((k) => info.marks[k] !== undefined) && order.every((k, i) => i === 0 || info.marks[k] >= info.marks[order[i - 1]]), `${label}: marcas de tempo em ordem ${order.map((k) => `${k} ${info.marks[k]}ms`).join(' → ')}${info.marks.textures !== undefined ? `, texturas ${info.marks.textures}ms` : ''}`);
  await new Promise((r) => setTimeout(r, 1200));
  const note = await page.evaluate(() => { const e = window.__mindcave.engine; return { realTextures: !!document.querySelector('canvas'), txt: document.body.innerText }; });
  ok(!/Carregando texturas/.test(note.txt), `${label}: sem aviso "Carregando texturas..." na tela do jogo depois de carregar`);
  if (shotName) await page.screenshot({ path: path.join(root, 'scripts', 'e2e', 'out', shotName) });
  return { samples };
}

// captura um quadro da tela de carregamento no meio do caminho (antes de visitar de novo, para ver o visual)
await page.evaluate(() => { /* nada: o print abaixo é pego na própria tela */ });
const first = await visit('1ª visita');
const mid = first.samples[Math.floor(first.samples.length / 2)];
ok(!!mid && /spawn|texturas|shaders|pacote|Baixando|Lendo/i.test(mid.txt), `a mensagem do meio da carga é de uma etapa real: "${(mid?.txt || '').replace(/\n/g, ' ').slice(0, 70)}"`);
const second = await visit('recarga');
ok(packNet === 0, `recarga: o pacote de recursos (.zip) NÃO é baixado de novo (${packNet} downloads; vem do cache local)`);
ok(maxInflight >= 2, `recarga: chamadas ao banco saem em paralelo (até ${maxInflight} ao mesmo tempo; em fila seria 1)`);
const span = apiStarts.length ? apiStarts.at(-1) - apiStarts[0] : 0;
ok(apiStarts.length >= 3 && span < 1200, `recarga: as ${apiStarts.length} chamadas começaram dentro de ${span} ms (com 250 ms de rede cada, em fila passaria de 1 s)`);

// visual da tela de carregamento (pausa a carga numa página nova só para fotografar)
const shotPage = await browser.newPage();
await shotPage.setViewport({ width: 900, height: 500 });
await shotPage.setRequestInterception(true);
shotPage.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname)) { /* nunca responde: a carga fica parada na tela */ } else r.continue(); });
shotPage.on('dialog', (d) => d.accept());
await shotPage.goto(`http://localhost:${port}/play/${wid}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await new Promise((r) => setTimeout(r, 2500));
await shotPage.screenshot({ path: path.join(root, 'scripts', 'e2e', 'out', 'carregando-mundo.png') });
const css = await shotPage.evaluate(() => { const e = document.querySelector('[data-loading-screen]'); return e ? getComputedStyle(e).backgroundImage : ''; });
ok(/dirt\.png/.test(css), 'a tela de carregamento usa o fundo de terra do jogo (dirt.png)');
await shotPage.close();
console.log(out.join('\n'));
await browser.close();
process.exit(out.some(l => l.startsWith('FALHA')) ? 1 : 0);
