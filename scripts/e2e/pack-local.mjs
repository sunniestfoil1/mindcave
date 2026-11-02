// O pacote de texturas vem do próprio projeto: com TODA a rede externa bloqueada (Supabase fora do ar) o jogo ainda carrega as texturas oficiais,
// sem nenhuma chamada ao Storage, e o zip está no git (senão a Vercel não o recebe — o .gitignore já escondeu esse arquivo uma vez).
import { pathToFileURL } from 'url';
import { execFileSync } from 'child_process';
const root = process.argv[2], port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);

const tracked = execFileSync('git', ['ls-files', 'public/assets/Old_Default_1.8.9.zip'], { cwd: root }).toString().trim();
ok(tracked === 'public/assets/Old_Default_1.8.9.zip', 'o zip de texturas está no controle de versão (vai para a Vercel)');

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
const externos = [];
await page.setRequestInterception(true);
page.on('request', (r) => {
  const u = new URL(r.url());
  if (u.hostname !== 'localhost') { externos.push(u.hostname + u.pathname); r.abort(); } else r.continue();
});
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const r = await page.evaluate(async () => {
  const P = await import('/src/game/pack.js');
  const pronto = await P.loadPack();
  return { pronto, arquivos: P.packFileCount(), stone: P.hasPackFile('assets/minecraft/textures/blocks/stone.png'), modelo: P.hasPackFile('assets/minecraft/models/block/stone.json') };
});
ok(r.pronto && r.arquivos > 3000, `pacote carregado só com rede local (${r.arquivos} arquivos)`);
ok(r.stone && r.modelo, 'textura de pedra e modelo de bloco do pacote existem');
ok(!externos.some((h) => /supabase\.co\/storage/.test(h)), `nenhuma chamada ao Supabase Storage para o pacote (externas: ${externos.length})`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
