// O jogador usando o jogo (pedidos de teste de uso): Esc com tela aberta, soltar a pilha clicando fora, botão do meio no criativo, plantas só
// em terra boa, vaso de flor, cacto, cabeças, água que corre (e some no Nether), caldeirão, armadura com o botão direito e só porcos-zumbis
// no Nether. Motor real no Chrome, chamando o mesmo caminho do clique (placeBlock, interactBlock, useHeldItem, pickBlock).
import { pathToFileURL } from 'url';
const root = process.argv[2], port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 640, height: 360 });
page.on('dialog', (d) => d.accept());
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
const G_ = 99;
const r = await page.evaluate(async () => {
  const { ClientWorld } = await import('/src/game/world.js');
  const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js');
  const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
  const { packState } = await import('/src/game/chunk.js');
  const ops = await import('/src/game/slotOps.js');
  const { tickFluids } = await import('/src/game/fluids.js');
  const { MobSpawnSystem } = await import('/src/game/mobSpawn.js');
  const { getDrops } = await import('/src/game/mining.js');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:640px;height:360px;position:fixed;left:0;top:0';
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 110, z: 8.5 };
  const ps = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: 'creative', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'T', hunger: 20, saturation: 5 };
  const opened = [];
  const eng = new GameEngine(canvas, { world: cw, player: ps, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {}, onAutosave: async () => {}, onOpenSign: (x, y, z) => opened.push([x, y, z]) });
  await eng.start();
  eng.paused = false;
  for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise((r) => setTimeout(r, 250));
  eng.tick = () => {};
  const G = 99, P = packState, res = {};
  for (let x = -6; x <= 40; x++) for (let z = -6; z <= 40; z++) {
    for (let y = G + 1; y <= G + 12; y++) cw.setBlock(x, y, z, 0);
    cw.setBlock(x, G, z, P(1, 0)); cw.setBlock(x, G - 1, z, P(1, 0));
  }
  const hold = (id, meta = 0, count = 64) => { ps.hotbar[0] = { id, count, meta }; ps.selectedSlot = 0; };
  const look = (x, y, z, tx, ty, tz) => {
    ps.pos = { x, y: y - 1.62, z }; ps.vel = { x: 0, y: 0, z: 0 };
    const dx = tx - x, dy = ty - y, dz = tz - z;
    ps.yaw = Math.atan2(-dx, dz); ps.pitch = -Math.atan2(dy, Math.hypot(dx, dz));
    eng._cachedRaycastFrame = -1;
  };
  const put = (x, y, z, id, meta = 0) => cw.setBlock(x, G + y, z, P(id, meta));
  const get = (x, y, z) => cw.getBlock(x, G + y, z);
  const placeOn = (id, meta, x, z) => { hold(id, meta); look(x + 0.5, G + 2.62, z + 2.5, x + 0.5, G + 1, z + 0.5); eng.placeBlock(); };

  // Esc: com tela aberta, o mouse solto não pausa
  eng.guiOpenFn = () => true; eng.paused = false;
  document.dispatchEvent(new Event('pointerlockchange'));
  res.escGui = eng.paused;
  eng.guiOpenFn = () => false;
  document.dispatchEvent(new Event('pointerlockchange'));
  res.semGui = eng.paused;
  eng.paused = false;

  // soltar a pilha do cursor clicando fora
  const inv = eng.inventory;
  const n0 = eng.itemEntities.items.length;
  inv.cursor = { id: 4, count: 37, meta: 0 };
  ops.dropCursorOutside(inv, 2);
  const left1 = inv.cursor && inv.cursor.count;
  ops.dropCursorOutside(inv, 0);
  res.drop = { left1, cursor: inv.cursor, soltou: eng.itemEntities.items.slice(n0).map((e) => e.count) };

  // botão do meio no criativo
  put(2, 0, 20, 1);
  look(2.5, G + 2.62, 22.5, 2.5, G + 1.5, 20.5);
  ps.hotbar.fill(null); ps.hotbar[3] = { id: 1, count: 5, meta: 0 };
  eng.pickBlock(); res.pickExistente = ps.selectedSlot;
  ps.hotbar.fill(null); inv.main.fill(null); inv.main[4] = { id: 1, count: 9, meta: 0 }; ps.selectedSlot = 0;
  eng.pickBlock(); res.pickInventario = { slot0: ps.hotbar[0] && ps.hotbar[0].count, main4: inv.main[4] };
  ps.hotbar.fill(null); inv.main.fill(null); ps.selectedSlot = 2;
  eng.pickBlock(); res.pickCria = ps.hotbar[2];
  ps.gameMode = 'survival'; ps.hotbar.fill(null); ps.selectedSlot = 1;
  eng.pickBlock(); res.pickSurv = ps.hotbar[1];
  ps.gameMode = 'creative';

  // plantas só em terra boa
  const planta = (id, base, bmeta = 0) => { put(10, 0, 10, base, bmeta); put(10, 1, 10, 0); placeOn(id, 0, 10, 10); return get(10, 1, 10) >> 4; };
  res.florPedra = planta(38, 1); res.florGrama = planta(38, 2); res.florTerra = planta(37, 3);
  res.trigoTerra = planta(59, 3); res.trigoArada = planta(59, 60);
  res.cactoTerra = planta(81, 3); res.cactoAreia = planta(81, 12);
  put(14, 0, 10, 12); put(14, 1, 10, 0); put(15, 1, 10, 1); placeOn(81, 0, 14, 10); res.cactoColado = get(14, 1, 10) >> 4;
  put(20, 0, 10, 2); put(20, 1, 10, 0); put(21, 0, 10, 9); placeOn(83, 0, 20, 10); res.canaAgua = get(20, 1, 10) >> 4;
  put(28, 0, 10, 2); put(28, 1, 10, 0); placeOn(83, 0, 28, 10); res.canaSeca = get(28, 1, 10) >> 4;

  // vaso de flor: planta, dropa as duas coisas e a mão vazia devolve
  put(24, 0, 10, 1); put(24, 1, 10, 140, 0);
  hold(38, 0, 5); look(24.5, G + 3.2, 12.5, 24.5, G + 1.3, 10.5); eng.interactBlock(ps);
  res.vasoPlantou = get(24, 1, 10) & 15;
  res.vasoDrops = getDrops(140, null, get(24, 1, 10) & 15).map((d) => d.id + ':' + (d.meta || 0));
  ps.hotbar[0] = null; eng._cachedRaycastFrame = -1; eng.interactBlock(ps);
  res.vasoVazio = get(24, 1, 10) & 15;

  // cabeças
  put(26, 0, 10, 1); put(26, 1, 10, 0); placeOn(397, 3, 26, 10);
  res.cabeca = get(26, 1, 10) >> 4;
  res.cabecaDrop = getDrops(200, null, 0).map((d) => d.id + ':' + d.meta);

  // água colocada corre; no Nether evapora; caldeirão enche com o balde
  put(30, 0, 30, 1); put(30, 1, 30, 0); hold(9); look(30.5, G + 3.2, 33.5, 30.5, G + 1, 30.5); eng.placeBlock();
  ps.pos = { x: 30.5, y: G + 3, z: 33.5 };
  for (let t = 0; t < 200; t++) tickFluids(cw, t, ps.pos);
  let agua = 0;
  for (let x = 25; x < 36; x++) for (let z = 25; z < 36; z++) { const id = get(x, 1, z) >> 4; if (id === 8 || id === 9) agua++; }
  res.agua = agua;
  eng.dimension = 'nether'; put(33, 1, 30, 0); hold(9); look(33.5, G + 3.2, 33.5, 33.5, G + 1, 30.5); eng.placeBlock();
  res.aguaNether = get(33, 1, 30) >> 4;
  eng.dimension = 'overworld';
  ps.gameMode = 'survival';
  put(34, 1, 34, 118, 0); hold(326, 0, 1); look(34.5, G + 3.2, 36.5, 34.5, G + 1.4, 34.5); eng.useHeldItem(ps.hotbar[0]);
  res.caldeirao = { meta: get(34, 1, 34) & 15, balde: ps.hotbar[0] && ps.hotbar[0].id };
  ps.gameMode = 'creative';

  // armadura com o botão direito: veste; com peça no slot, troca
  ps.gameMode = 'survival'; inv.armor.fill(null);
  ps.hotbar[0] = { id: 309, count: 1, meta: 0, data: null };
  eng.useHeldItem(ps.hotbar[0]); res.vestiu = inv.armor[3] && inv.armor[3].id;
  ps.hotbar[0] = { id: 313, count: 1, meta: 0 };
  eng.useHeldItem(ps.hotbar[0]); res.trocou = { armor: inv.armor[3] && inv.armor[3].id, mao: ps.hotbar[0] && ps.hotbar[0].id };
  ps.gameMode = 'creative';

  // placa: colocar abre a edição; o texto é salvo e volta do salvamento; a malha do texto aparece; quebrar apaga o texto
  const C = await import('/src/game/containers.js');
  put(36, 0, 10, 1); put(36, 1, 10, 0); opened.length = 0; placeOn(323, 0, 36, 10);
  res.placa = { id: get(36, 1, 10) >> 4, abriu: opened.length };
  C.setSign(36, G + 1, 10, ['Ola', 'Mundo', '', 'x'.repeat(30)]);
  const ser = JSON.parse(JSON.stringify(C.serializeContainers()));
  C.clearContainers(); C.deserializeContainers(ser);
  res.placaTexto = C.getSign(36, G + 1, 10);
  look(36.5, G + 3.2, 13.5, 36.5, G + 1.5, 10.5); opened.length = 0; hold(1, 0, 1); eng._cachedRaycastFrame = -1; eng.interactBlock(ps);
  res.placaClique = opened.length;
  eng.signs.tick = 9; eng.signs.update(cw, { x: 36, y: G + 1, z: 10 });
  res.placaMalha = eng.signs.meshes.size;
  eng.breakBedPartner(36, G + 1, 10, cw.getBlock(36, G + 1, 10)); cw.setBlock(36, G + 1, 10, 0);
  res.placaApagou = C.getSign(36, G + 1, 10);

  // ovo de spawn: cada clique solta um mob na posição clicada, várias vezes seguidas; sobrevivência gasta o ovo; o ovo é persistente
  put(20, 0, 20, 1); put(20, 1, 20, 0);
  eng.mobs.mobs.length = 0;
  hold(383, 54, 64);
  for (let i = 0; i < 3; i++) { look(20.5, G + 3.2, 23.5, 20.5, G + 1, 20.5); eng._cachedRaycastFrame = -1; eng.useHeldItem(ps.hotbar[0]); }
  res.ovo = { n: eng.mobs.mobs.length, tipo: eng.mobs.mobs[0] && eng.mobs.mobs[0].typeId, persistente: eng.mobs.mobs.every((m) => m.persistent), x: eng.mobs.mobs[0] && eng.mobs.mobs[0].pos.x, y: eng.mobs.mobs[0] && eng.mobs.mobs[0].pos.y, z: eng.mobs.mobs[0] && eng.mobs.mobs[0].pos.z, restam: ps.hotbar[0].count };
  ps.gameMode = 'survival'; hold(383, 92, 2); eng.mobs.mobs.length = 0;
  for (let i = 0; i < 3; i++) { look(20.5, G + 3.2, 23.5, 20.5, G + 1, 20.5); eng._cachedRaycastFrame = -1; eng.useHeldItem(ps.hotbar[0] || { id: 0 }); }
  res.ovoSurv = { mobs: eng.mobs.mobs.length, tipo: eng.mobs.mobs[0] && eng.mobs.mobs[0].typeId, sobrou: ps.hotbar[0] };
  ps.gameMode = 'creative'; eng.mobs.mobs.length = 0;

  // jukebox: o disco da mão entra (meta do bloco = disco, toca), o clique seguinte devolve o disco ao chão e para a música
  put(30, 0, 10, 1); put(30, 1, 10, 84); hold(2257, 0, 1);
  look(30.5, G + 3.2, 13.5, 30.5, G + 1.5, 10.5); eng._cachedRaycastFrame = -1; eng.interactBlock(ps);
  res.jukeDentro = { meta: get(30, 1, 10) & 15, tocando: eng.jukebox.playing.size };
  const antes = eng.itemEntities.items.length; hold(1, 0, 1); eng._cachedRaycastFrame = -1; eng.interactBlock(ps);
  res.jukeFora = { meta: get(30, 1, 10) & 15, tocando: eng.jukebox.playing.size, disco: eng.itemEntities.items.slice(antes).map((e) => e.id).join() };
  hold(2268, 0, 1); eng._cachedRaycastFrame = -1; eng.interactBlock(ps);
  res.jukeNovo = get(30, 1, 10) & 15;
  eng.breakBedPartner(30, G + 1, 10, cw.getBlock(30, G + 1, 10)); cw.setBlock(30, G + 1, 10, 0);
  res.jukeQuebrou = { tocando: eng.jukebox.playing.size, disco: eng.itemEntities.items.slice(antes).map((e) => e.id).join() };

  // Nether: só porcos-zumbis
  const spawnSys = new MobSpawnSystem(); const mobs = [];
  const nw = eng._worldFor('nether');
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) nw.ensureChunk(dx, dz);
  nw._lastLoadingRadius = 4;
  const fake = { pos: { x: 8, y: 64, z: 8 } };
  for (let i = 0; i < 4000; i++) spawnSys.tick(nw, fake, mobs, { difficulty: 'normal', dimension: 'nether', worldTime: 1000 });
  res.nether = { total: mobs.length, tipos: [...new Set(mobs.map((m) => m.typeId))] };
  return res;
});
ok(r.escGui === false && r.semGui === true, `Esc: com inventário/bancada aberta soltar o mouse NÃO pausa (${r.escGui}); sem tela aberta pausa (${r.semGui})`);
ok(r.drop.left1 === 36 && r.drop.cursor === null && r.drop.soltou.join() === '1,36', `clicar fora: direito solta 1, esquerdo solta o resto (itens no chão: ${r.drop.soltou})`);
ok(r.pickExistente === 3, `botão do meio com o bloco já na hotbar só seleciona o slot (${r.pickExistente})`);
ok(r.pickInventario.slot0 === 9 && r.pickInventario.main4 === null, 'botão do meio com o bloco no inventário de cima troca com o slot selecionado');
ok(r.pickCria && r.pickCria.id === 4 || (r.pickCria && r.pickCria.count === 64), `criativo sem o bloco: cria a pilha cheia no slot (${JSON.stringify(r.pickCria)})`);
ok(!r.pickSurv, 'sobrevivência sem o bloco: não cria nada');
ok(r.florPedra === 0 && r.florGrama === 38 && r.florTerra === 37, `flor: não na pedra (${r.florPedra}), sim na grama (${r.florGrama}) e na terra (${r.florTerra})`);
ok(r.trigoTerra === 0 && r.trigoArada === 59, `trigo: só em terra arada (terra comum ${r.trigoTerra}, arada ${r.trigoArada})`);
ok(r.cactoTerra === 0 && r.cactoAreia === 81 && r.cactoColado === 0, `cacto: só na areia (terra ${r.cactoTerra}, areia ${r.cactoAreia}) e nunca colado em bloco (${r.cactoColado})`);
ok(r.canaAgua === 83 && r.canaSeca === 0, `cana: ao lado de água (${r.canaAgua}), longe dela não (${r.canaSeca})`);
ok(r.vasoPlantou === 1 && r.vasoDrops.join() === '390:0,38:0' && r.vasoVazio === 0, `vaso de flor: planta a papoula (meta ${r.vasoPlantou}), dropa vaso + papoula (${r.vasoDrops}) e a mão vazia tira a planta (meta ${r.vasoVazio})`);
ok(r.cabeca === 200 && r.cabecaDrop.join() === '397:3', `item da cabeça de Steve (397:3) vira o bloco ${r.cabeca} e dropa 397:3`);
ok(r.agua > 5, `água colocada corre (${r.agua} células depois de 200 ticks)`);
ok(r.aguaNether === 0, 'no Nether a água colocada evapora');
ok(r.caldeirao.meta === 3 && r.caldeirao.balde === 325, `balde de água enche o caldeirão (nível ${r.caldeirao.meta}) e fica vazio`);
ok(r.vestiu === 309 && r.trocou.armor === 313 && r.trocou.mao === 309, `botão direito veste a bota de ferro (${r.vestiu}); com a de ouro troca e a de ferro vai para a mão (${r.trocou.mao})`);
ok(r.placa.id === 63 && r.placa.abriu === 1, `placa: colocar abre o editor de texto (bloco ${r.placa.id}, editor abriu ${r.placa.abriu}×)`);
ok(r.placaTexto && r.placaTexto[0] === 'Ola' && r.placaTexto[1] === 'Mundo' && r.placaTexto[3].length === 15, `texto da placa volta do salvamento (linha longa cortada em ${r.placaTexto && r.placaTexto[3].length} letras)`);
ok(r.placaClique === 1 && r.placaMalha === 1, `botão direito na placa abre a edição (${r.placaClique}×) e o texto vira malha na placa (${r.placaMalha})`);
ok(r.placaApagou === null, 'quebrar a placa apaga o texto');
ok(r.ovo.n === 3 && r.ovo.tipo === 'zombie' && r.ovo.persistente && Math.abs(r.ovo.x - 20.5) < 0.01 && Math.abs(r.ovo.z - 20.5) < 0.01 && Math.abs(r.ovo.y - (G_ + 1)) < 0.01, `ovo de zumbi: 3 cliques no mesmo chão = 3 zumbis na posição clicada (${r.ovo.n}, em ${r.ovo.x},${r.ovo.y},${r.ovo.z}), persistentes, e no criativo o ovo não acaba (${r.ovo.restam})`);
ok(r.ovoSurv.mobs === 2 && r.ovoSurv.tipo === 'cow' && r.ovoSurv.sobrou === null, `sobrevivência: 2 ovos de vaca = 2 vacas e o ovo some da mão no fim (${r.ovoSurv.mobs} vacas, mão ${JSON.stringify(r.ovoSurv.sobrou)})`);
ok(r.jukeDentro.meta === 2 && r.jukeDentro.tocando === 1, `jukebox: o disco cat entra (meta do bloco ${r.jukeDentro.meta}) e começa a tocar (${r.jukeDentro.tocando})`);
ok(r.jukeFora.meta === 0 && r.jukeFora.tocando === 0 && r.jukeFora.disco === '2257', `jukebox: novo clique tira o disco (item ${r.jukeFora.disco}) e a música para (${r.jukeFora.tocando})`);
ok(r.jukeNovo === 13 && r.jukeQuebrou.tocando === 0 && r.jukeQuebrou.disco === '2257,2268', `jukebox: disco 5 entra na meta 13 (${r.jukeNovo}); quebrar o bloco solta o disco (${r.jukeQuebrou.disco}) e para a música`);
ok(r.nether.total > 5 && r.nether.tipos.length === 1 && r.nether.tipos[0] === 'zombie_pigman', `no Nether só nasce porco-zumbi: ${r.nether.total} mobs, tipos ${r.nether.tipos}`);
ok(errors.length === 0, `sem erro de página (${errors[0] || ''})`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
