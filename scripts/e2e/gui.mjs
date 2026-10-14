// GUI com a fonte e o desenho do jogo original: larguras reais da fonte (ascii.png), "&" preservado, item na mão sem braço e item 2D com espessura.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname)) r.abort(); else r.continue(); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const res = await page.evaluate(async () => {
  const out = [];
  const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
  const font = await import('/src/game/gui/font.js');
  await font.loadMcFont();
  // larguras do FontRenderer da 1.8.9 calculadas do ascii.png oficial (cada glifo: lado direito do desenho + 1, espaço = 4)
  const widths = { '[Sprinting (Toggled)]': 105, 'Pronto': 34, 'Done': 24, 'Modo Otimizado': 72, 'Configurations': 73 };
  for (const [s, w] of Object.entries(widths)) ok(font.measureMcText(s, '#fff', 8) === w, `largura de "${s}" = ${w} px de GUI (deu ${font.measureMcText(s, '#fff', 8)})`);
  ok(font.measureMcText('[Sprinting (Toggled)]', '#fff', 24) === 315, 'na escala 3 o texto do sprint tem 315 px de largura');
  ok(font.measureMcText('Bugs & Ideias', '#fff', 8) > font.measureMcText('Bugs  Ideias', '#fff', 8), 'o "&" fica no texto (não é código de cor)');
  ok(font.parseColorCodes('§aOlá §rmundo')[0].color === '#55FF55', 'código § de cor continua valendo');
  ok(font.measureMcText('ção', '#fff', 8) > 10, 'letras fora do ascii.png (ã) vêm da página unicode e têm largura');

  // braço só de mão vazia
  const { buildHandRig, poseHand } = await import('/src/game/firstPersonHand.js');
  const rig = buildHandRig();
  const anim = { isSwinging: false, equipProgress: 1, prevEquipProgress: 1, handRotX: 0, handRotY: 0, speed: 0, swingProgress: 0 };
  poseHand(rig, anim, null, null, true, 0, 0, 'sprite');
  ok(rig.arm.visible === false && rig.itemRoot.visible === true, 'com item na mão só o item aparece (braço oculto)');
  poseHand(rig, anim, null, null, false, 0, 0, 'sprite');
  ok(rig.arm.visible === true && rig.itemRoot.visible === false, 'de mão vazia só o braço aparece');

  // item 2D com espessura: frente, verso e uma lateral por borda de pixel opaco
  const { buildExtrudedGeometry } = await import('/src/game/itemExtrude.js');
  const mk = (paint) => { const c = document.createElement('canvas'); c.width = c.height = 16; paint(c.getContext('2d')); return c; };
  const quads = (g) => g.index.count / 6;
  ok(quads(buildExtrudedGeometry(mk((x) => { x.fillStyle = '#f00'; x.fillRect(5, 5, 1, 1); }), 1)) === 6, 'um pixel opaco = frente + verso + 4 laterais (6 faces)');
  ok(quads(buildExtrudedGeometry(mk((x) => { x.fillStyle = '#f00'; x.fillRect(0, 0, 16, 16); }), 1)) === 2 + 4 * 16, 'imagem cheia = frente + verso + só as laterais da borda (66 faces)');
  const g = buildExtrudedGeometry(mk((x) => { x.fillStyle = '#f00'; x.fillRect(0, 0, 16, 16); }), 1);
  const nz = g.attributes.normal;
  let outward = 0;
  const pos = g.attributes.position, idx = g.index;
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    const ab = [pos.getX(b) - pos.getX(a), pos.getY(b) - pos.getY(a), pos.getZ(b) - pos.getZ(a)];
    const ac = [pos.getX(c) - pos.getX(a), pos.getY(c) - pos.getY(a), pos.getZ(c) - pos.getZ(a)];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (n[0] * nz.getX(a) + n[1] * nz.getY(a) + n[2] * nz.getZ(a) > 0) outward++;
  }
  ok(outward === idx.count / 3, `todas as faces têm a ordem dos vértices coerente com a normal (${outward}/${idx.count / 3})`);
  return out;
});
console.log(res.join('\n'));
console.log('--- erros:', errors.length);
await browser.close();
process.exit(res.some((l) => l.startsWith('FALHA')) ? 1 : 0);
