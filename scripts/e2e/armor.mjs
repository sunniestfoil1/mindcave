// Armadura vestida no modelo do jogador: peças aparecem em 3ª pessoa conforme o inventário, o código de rede é o certo
// e o modelo de um jogador remoto veste o mesmo código. Salva um print em scripts/e2e/out/armor.png para conferir a olho.
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
await page.setRequestInterception(true);
page.on('request', (r) => {
  const u = new URL(r.url());
  if (/(^|\.)supabase\.co$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/')) {
    if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    else r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
  } else if (/(^|\.)(crafthead\.net|vercel\.com)$/.test(u.hostname)) r.abort();
  else r.continue();
});
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const res = await page.evaluate(async () => {
  const { ClientWorld } = await import('/src/game/world.js');
  const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js');
  const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
  const { packState } = await import('/src/game/chunk.js');
  const PM = await import('/src/game/playerModel.js');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:800px;height:450px;position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 100, z: 8.5 };
  const pState = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: 'survival', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'Tester' };
  const engine = new GameEngine(canvas, { world: cw, player: pState, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {}, onAutosave: async () => {} });
  await engine.start();
  engine.paused = false;
  for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250));
  for (let x = -2; x <= 18; x++) for (let z = -2; z <= 18; z++) { for (let y = 100; y <= 105; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, 99, z, packState(2, 0)); }
  pState.pos = { x: 8.5, y: 100, z: 8.5 }; pState.vel = { x: 0, y: 0, z: 0 }; pState.yaw = 0; pState.pitch = 0.15;
  engine.tick = () => {};
  const out = {};
  // sem armadura: nenhuma peça
  engine.perspective = 2;
  await new Promise(r => setTimeout(r, 800));
  out.semArmadura = engine.playerModel.userData.armorState ? engine.playerModel.userData.armorState.pieces.filter(Boolean).length : 0;
  // ferro completo
  engine.inventory.armor = [{ id: 306, count: 1 }, { id: 307, count: 1 }, { id: 308, count: 1 }, { id: 309, count: 1 }];
  out.codigoFerro = PM.armorCodeFromSlots(engine.inventory.armor);
  await new Promise(r => setTimeout(r, 2500));
  const st = engine.playerModel.userData.armorState;
  out.pecasFerro = st.pieces.map((p) => (p ? p.length : 0));
  out.visiveisFerro = st.pieces.flat().filter(Boolean).filter((o) => o.mesh.visible).length;
  out.total = st.pieces.flat().filter(Boolean).length;
  // couro: 2 malhas por parte (cor + tintura)
  engine.inventory.armor = [{ id: 298, count: 1 }, null, null, null];
  await new Promise(r => setTimeout(r, 1500));
  out.pecasCouro = engine.playerModel.userData.armorState.pieces.map((p) => (p ? p.length : 0));
  out.corCouro = engine.playerModel.userData.armorState.pieces[0][0].mesh.material.color.getHex();
  // tirar tudo
  engine.inventory.armor = [null, null, null, null];
  await new Promise(r => setTimeout(r, 600));
  out.depoisDeTirar = engine.playerModel.userData.armorState.pieces.filter(Boolean).length;
  // diamante completo para o print + jogador remoto com o mesmo código
  engine.inventory.armor = [{ id: 310, count: 1 }, { id: 311, count: 1 }, { id: 312, count: 1 }, { id: 313, count: 1 }];
  const remote = PM.buildPlayerModel();
  PM.setModelArmor(remote, PM.armorCodeFromSlots(engine.inventory.armor));
  out.remotoPecas = remote.userData.armorState.pieces.filter(Boolean).length;
  await new Promise(r => setTimeout(r, 2500));
  out.codigosDistintos = new Set([306, 310, 298, 314, 302].map((id) => PM.armorCodeFromSlots([{ id }, null, null, null]))).size;
  return out;
});
fs.mkdirSync(path.join(root, 'scripts', 'e2e', 'out'), { recursive: true });
await page.screenshot({ path: path.join(root, 'scripts', 'e2e', 'out', 'armor.png') });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
ok(res.semArmadura === 0, 'sem armadura no inventário, nenhuma peça no modelo');
ok(res.codigoFerro === (3 | (3 << 3) | (3 << 6) | (3 << 9)), `código de rede do ferro completo = ${res.codigoFerro}`);
ok(JSON.stringify(res.pecasFerro) === '[1,3,3,2]', `ferro: capacete 1 malha, peitoral 3 (corpo + 2 braços), calça 3 (corpo + 2 pernas), botas 2 — veio ${JSON.stringify(res.pecasFerro)}`);
ok(res.visiveisFerro === res.total && res.total === 9, `as ${res.total} malhas do ferro ficaram visíveis depois da textura do pacote carregar (${res.visiveisFerro})`);
ok(JSON.stringify(res.pecasCouro) === '[2,0,0,0]', `couro usa 2 camadas (cor + tintura): ${JSON.stringify(res.pecasCouro)}`);
ok(res.corCouro === 0xa06540, 'couro sai na cor padrão do 1.8.9 (A06540)');
ok(res.depoisDeTirar === 0, 'tirar a armadura remove as peças do modelo');
ok(res.remotoPecas === 4, 'jogador remoto veste as 4 peças a partir do código recebido');
ok(res.codigosDistintos === 5, 'materiais diferentes geram códigos diferentes');
console.log(out.join('\n'));
await browser.close();
process.exit(out.some(l => l.startsWith('FALHA')) ? 1 : 0);
