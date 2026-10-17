// Fogos de artifício no motor real (Chrome): botão direito no chão solta o foguete na posição clicada, ele sobe com o rastro branco, explode no formato
// do preset com o número certo de faíscas e as cores do preset, o item é gasto no sobrevivência, e os dados dos presets são coerentes.
import { pathToFileURL } from 'url';
const root = process.argv[2], port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setRequestInterception(true);
page.on('request', (r) => {
  const u = new URL(r.url());
  if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/')) {
    if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    else r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
  } else r.continue();
});
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
const r = await page.evaluate(async () => {
  const { ClientWorld } = await import('/src/game/world.js');
  const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js');
  const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
  const { packState } = await import('/src/game/chunk.js');
  const D = await import('/src/game/fireworkData.js');
  const { ITEMS } = await import('/src/game/items.js');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:640px;height:360px;position:fixed;left:0;top:0';
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 110, z: 8.5 };
  const ps = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: 'creative', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'T', hunger: 20, saturation: 5 };
  const eng = new GameEngine(canvas, { world: cw, player: ps, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {} });
  await eng.start();
  eng.paused = false;
  for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise((r) => setTimeout(r, 250));
  eng.tick = () => {};
  const G = 99, P = packState, res = {};
  for (let x = -6; x <= 40; x++) for (let z = -6; z <= 40; z++) { for (let y = G + 1; y <= G + 40; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, G, z, P(1, 0)); cw.setBlock(x, G - 1, z, P(1, 0)); }
  const hold = (id, meta = 0, count = 64) => { ps.hotbar[0] = { id, count, meta }; ps.selectedSlot = 0; };
  const look = (x, y, z, tx, ty, tz) => { ps.pos = { x, y: y - 1.62, z }; ps.vel = { x: 0, y: 0, z: 0 }; const dx = tx - x, dy = ty - y, dz = tz - z; ps.yaw = Math.atan2(-dx, dz); ps.pitch = -Math.atan2(dy, Math.hypot(dx, dz)); eng._cachedRaycastFrame = -1; };

  // dados: todo preset tem nome e, quando tem explosão, ao menos uma cor RGB válida; estrela existe só para quem explode
  res.presets = D.FIREWORK_PRESETS.length;
  res.dadosOk = D.FIREWORK_PRESETS.every((p) => p.name && p.flight >= 1 && (!p.ex || (p.ex.colors.length > 0 && p.ex.colors.every((c) => Number.isInteger(c) && c >= 0 && c <= 0xffffff))));
  res.itens = { f: ITEMS[401] && Object.keys(ITEMS[401].variantNames || {}).length, s: ITEMS[402] && Object.keys(ITEMS[402].variantNames || {}).length, maxStack: ITEMS[401] && ITEMS[401].maxStack };
  res.estrelas = D.FIREWORK_PRESETS.filter((p) => p.ex).length;

  // botão direito no chão: o foguete nasce no ponto clicado
  hold(401, 1, 5);
  look(12.5, G + 2.6, 15.5, 12.5, G + 1, 12.5); eng.useHeldItem(ps.hotbar[0]);
  const fw = eng.fireworks;
  res.lancou = { n: fw.rockets.length, x: fw.rockets[0] && fw.rockets[0].x, z: fw.rockets[0] && fw.rockets[0].z, y: fw.rockets[0] && fw.rockets[0].y, resta: ps.hotbar[0] && ps.hotbar[0].count };
  // sobe: acelera e deixa o rastro branco
  const p0 = eng.particles.liveCount();
  let y0 = fw.rockets[0].y, subiu = 0;
  const rocket = fw.rockets[0];
  for (let t = 0; t < 8; t++) { fw.tick(); eng.particles.tick(cw); }
  subiu = rocket.y - y0;
  res.sobe = { subiu: +subiu.toFixed(2), vy: +rocket.vy.toFixed(3), rastro: eng.particles.liveCount() - p0 };
  // explode: conta as faíscas criadas no tick da explosão
  let antes = eng.particles.liveCount(), faiscas = 0, tickExplodiu = -1;
  for (let t = 0; t < 80 && fw.rockets.length; t++) { const a = eng.particles.liveCount(); fw.tick(); if (!fw.rockets.length) { tickExplodiu = t; faiscas = eng.particles.liveCount() - a; } eng.particles.tick(cw); }
  res.explodiu = { n: fw.rockets.length, faiscas, tickExplodiu, antes };
  // cada formato
  const forma = {};
  for (const [nome, idx] of [['bolaPequena', 0], ['bolaGrande', 1], ['estrela', 2], ['creeper', 3], ['explosao', 4]]) {
    eng.particles.alive.fill(0);
    const r2 = fw.launch(20, G + 10, 20, idx);
    r2.age = r2.life; const a = eng.particles.liveCount(); fw.tick();
    forma[nome] = eng.particles.liveCount() - a - 1;   // menos o rastro do próprio tick
  }
  res.forma = forma;
  // o foguete sem explosão some sem faíscas de explosão
  eng.particles.alive.fill(0); const r3 = fw.launch(20, G + 10, 20, 7); r3.age = r3.life; fw.tick(); res.semExplosao = { foguetes: fw.rockets.length, particulas: eng.particles.liveCount() };
  // sobrevivência: gasta 1 foguete por uso
  ps.gameMode = 'survival'; hold(401, 0, 3); fw.dispose();
  for (let i = 0; i < 2; i++) { look(12.5, G + 2.6, 15.5, 12.5, G + 1, 12.5); eng.useHeldItem(ps.hotbar[0]); }
  res.gasta = { foguetes: fw.rockets.length, resta: ps.hotbar[0] && ps.hotbar[0].count };
  // mirando o ar (sem bloco): nada acontece e o item não é gasto
  fw.dispose(); look(12.5, G + 20, 12.5, 12.5, G + 40, 12.5); eng._cachedRaycastFrame = -1; const antes2 = ps.hotbar[0].count; eng.useHeldItem(ps.hotbar[0]);
  res.ar = { foguetes: fw.rockets.length, resta: ps.hotbar[0].count, antes: antes2 };
  return res;
});
ok(r.presets === 8 && r.dadosOk, `${r.presets} presets de fogos, todos com nome, voo e cores válidas`);
ok(r.itens.f === 8 && r.itens.s === r.estrelas && r.itens.maxStack === 64, `catálogo: ${r.itens.f} fogos, ${r.itens.s} estrelas (só as que explodem) e pilha de 64 (${r.itens.maxStack})`);
ok(r.lancou.n === 1 && Math.abs(r.lancou.x - 12.5) < 0.6 && Math.abs(r.lancou.z - 12.5) < 0.6 && r.lancou.resta === 5, `botão direito no chão solta 1 foguete no ponto clicado (${r.lancou.x?.toFixed(1)}, ${r.lancou.z?.toFixed(1)}) e o criativo não gasta o item (${r.lancou.resta})`);
ok(r.sobe.subiu > 0.8 && r.sobe.vy > 0.3 && r.sobe.rastro >= 7, `o foguete sobe acelerando (subiu ${r.sobe.subiu} blocos em 8 ticks, vy ${r.sobe.vy}) e solta o rastro branco (${r.sobe.rastro} faíscas)`);
ok(r.explodiu.n === 0 && r.explodiu.faiscas > 30 && r.explodiu.tickExplodiu > 5, `explode no fim do voo (tick ${r.explodiu.tickExplodiu}) soltando ${r.explodiu.faiscas} faíscas`);
ok(r.forma.bolaPequena > 30 && r.forma.bolaGrande > r.forma.bolaPequena * 3 && r.forma.estrela > 50 && r.forma.creeper > 50 && r.forma.explosao === 70, `formatos: bola pequena ${r.forma.bolaPequena}, bola grande ${r.forma.bolaGrande}, estrela ${r.forma.estrela}, creeper ${r.forma.creeper}, explosão ${r.forma.explosao} faíscas`);
ok(r.semExplosao.foguetes === 0 && r.semExplosao.particulas <= 2, `foguete sem estrela não explode: só o rastro (${r.semExplosao.particulas} faíscas)`);
ok(r.gasta.foguetes === 2 && r.gasta.resta === 1, `sobrevivência: cada uso gasta 1 foguete (2 soltos, restou ${r.gasta.resta})`);
ok(r.ar.foguetes === 0 && r.ar.resta === r.ar.antes, 'mirando o ar o foguete não sai e o item não é gasto (1.8.9 exige mirar um bloco)');
ok(errors.length === 0, `sem erro de página (${errors[0] || ''})`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
