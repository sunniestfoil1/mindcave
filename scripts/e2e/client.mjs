// Módulos do Mind Client no motor real: Perspective (ALT), Shift direito, Fullbright, Hit Color, Item Physics, Particles, Hitbox, Tab, Nametags.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname)) r.abort(); else r.continue(); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const res = await page.evaluate(async () => {
  const out = [];
  const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
  const { ClientWorld } = await import('/src/game/world.js');
  const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js');
  const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
  const { packState } = await import('/src/game/chunk.js');
  const { clientStore } = await import('/src/game/client/clientStore.js');
  clientStore.reset();
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:800px;height:450px;position:fixed;left:0;top:0';
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 100, z: 8.5 };
  const pState = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: false, sneaking: false, sprinting: false, gameMode: 'survival', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'Tester' };
  let menuToggles = 0;
  const engine = new GameEngine(canvas, { world: cw, player: pState, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {}, onAutosave: async () => {}, onToggleClientMenu: () => { menuToggles++; } });
  await engine.start();
  engine.paused = false;
  for (let i = 0; i < 60 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250));
  await new Promise(r => setTimeout(r, 1500));
  const B0 = 99;
  for (let x = -2; x <= 18; x++) for (let z = -2; z <= 18; z++) { for (let y = B0 + 1; y <= B0 + 6; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, B0, z, packState(1, 0)); }
  pState.pos = { x: 8.5, y: B0 + 1, z: 8.5 }; pState.vel = { x: 0, y: 0, z: 0 };
  const ev = (code, extra = {}) => ({ code, key: code, repeat: false, preventDefault() {}, target: document.body, ...extra });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Shift direito abre o menu
  engine.onKey(ev('ShiftRight'), true); engine.onKey(ev('ShiftRight'), false);
  ok(menuToggles === 1, 'Shift DIREITO chama o menu do Mind Client');
  engine.onKey(ev('ShiftLeft'), true); engine.onKey(ev('ShiftLeft'), false);
  ok(menuToggles === 1, 'Shift esquerdo continua só agachando (não abre o menu)');

  // Perspective: ALT olha em volta sem virar o corpo
  Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true });
  pState.yaw = 1.0; pState.pitch = 0.1;
  engine.perspective = 0;
  engine.onKey(ev('AltLeft'), true);
  ok(engine.freeLook.on && engine.perspective === 1, 'ALT segurado liga a visão livre em 3ª pessoa');
  engine.onMouseMove({ movementX: 100, movementY: 40 });
  ok(engine.freeLook.yaw !== 0 && pState.yaw === 1.0 && pState.pitch === 0.1, 'o mouse gira só a câmera: yaw e pitch do jogador não mudam');
  engine.onKey(ev('AltLeft'), false);
  ok(!engine.freeLook.on && engine.perspective === 0 && engine.freeLook.yaw === 0, 'soltar ALT volta à 1ª pessoa e zera o giro');
  clientStore.setOn('perspective', false);
  engine.onKey(ev('AltLeft'), true); engine.onKey(ev('AltLeft'), false);
  ok(!engine.freeLook.on, 'com o módulo desligado o ALT não faz nada');
  clientStore.setOn('perspective', true);

  // Fullbright: uniforme da luz
  await sleep(600);
  const u = engine.world.uniforms;
  ok(u.uFullbright && u.uFullbright.value === 0, 'Fullbright desligado: uniforme em 0');
  clientStore.setOn('fullbright', true); await sleep(900);
  ok(u.uFullbright.value === 1, 'Fullbright ligado: uniforme em 1 (luz máxima no shader)');
  clientStore.setOn('fullbright', false);

  // Hitbox pelo módulo
  clientStore.setOn('hitbox', true);
  ok(engine.showHitboxes === true, 'módulo Hitbox liga as caixas de colisão');
  clientStore.setOn('hitbox', false);
  ok(engine.showHitboxes === false, 'e desliga');

  // Tab
  clientStore.setOn('tab', false);
  engine.onKey(ev('Tab'), true); ok(!engine.playerListOpen, 'módulo Tab desligado: a lista de jogadores não abre'); engine.onKey(ev('Tab'), false);
  clientStore.setOn('tab', true);
  engine.onKey(ev('Tab'), true); ok(engine.playerListOpen === true, 'módulo Tab ligado: a lista abre'); engine.onKey(ev('Tab'), false);

  // Nametags: o próprio nome só em 3ª pessoa e se o ajuste permitir
  clientStore.set('nametags', 'own', true); engine.perspective = 1; await sleep(500);
  ok(engine.nametag.visible === true, 'Nametags: seu nome aparece na 3ª pessoa quando o ajuste está ligado');
  clientStore.set('nametags', 'own', false); await sleep(500);
  ok(engine.nametag.visible === false, 'e some com o ajuste desligado');
  engine.perspective = 0;

  // Hit Color: o mob machucado troca para o material colorido e volta ao normal
  const cow = engine.mobs.spawn('cow', { x: 8.5, y: B0 + 1, z: 11.5 });
  cow.ai.tick = () => {};
  await sleep(600);
  const mats = () => { const l = []; cow._model.traverse((o) => { if (o.isMesh) l.push(o.material); }); return l; };
  const base0 = mats()[0];
  cow.hurtTime = 10;
  await sleep(400);
  const during = mats()[0];
  ok(during !== base0 && during.emissive && during.emissive.r > 0.2 && during.emissive.g < 0.01, `mob machucado pisca em vermelho (emissivo r=${during.emissive?.r.toFixed(2)})`);
  clientStore.set('hitcolor', 'mode', 'custom'); clientStore.set('hitcolor', 'color', '#00ff00');
  cow.hurtTime = 10; await sleep(400);
  ok(mats()[0].emissive.g > 0.2 && mats()[0].emissive.r < 0.01, 'cor personalizada (verde) vale na hora');
  clientStore.set('hitcolor', 'mode', 'rgb');
  cow.hurtTime = 10; await sleep(300);
  const c1 = mats()[0].emissive.getHex(); await sleep(500); cow.hurtTime = 10; await sleep(100);
  const c2 = mats()[0].emissive.getHex();
  ok(c1 !== c2, 'modo RGB muda de cor com o tempo');
  cow.hurtTime = 0; await sleep(400);
  ok(mats()[0] === base0, 'sem dano o mob volta ao material normal');
  clientStore.set('hitcolor', 'mode', 'red');
  clientStore.setOn('hitcolor', false);
  cow.hurtTime = 10; await sleep(400);
  ok(mats()[0] === base0, 'Hit Color desligado: o mob não pisca');
  clientStore.setOn('hitcolor', true);

  // Item Physics: item no chão fica deitado (câmera olhando para o item: fora do campo de visão o item nem é atualizado)
  pState.yaw = 0; pState.pitch = 0.3; await sleep(400);
  clientStore.setOn('itemphysics', true);
  const ie = engine.itemEntities.spawnItem({ id: 280, count: 1, meta: 0 }, { x: 8.5, y: B0 + 1.2, z: 10.5 }, { x: 0, y: 0, z: 0 }, 99999); // sem recolher: o jogador está perto
  await sleep(2500);
  ok(Math.abs(ie.mesh.rotation.x + Math.PI / 2) < 1e-6, `Item Physics: o item (gravetos) fica deitado no chão (onGround=${ie.onGround}, y=${ie.pos.y.toFixed(2)}, rotX=${ie.mesh.rotation.x.toFixed(2)}, geo=${ie.mesh.children[0]?.geometry?.type}, vivo=${engine.itemEntities.items.includes(ie)}, visivel=${ie.mesh.visible}, modulo=${clientStore.isOn('itemphysics')}, noFrustum=${engine._cameraFrustum?.containsPoint(ie.pos)})`);
  clientStore.setOn('itemphysics', false); await sleep(600);
  ok(ie.mesh.rotation.x === 0, 'desligado: volta a girar em pé');

  // Particles: quantidade
  clientStore.set('particles', 'amount', 100);
  const live = () => engine.particles.particles.filter((p) => p.active).length;
  const before = live();
  engine.particles.spawnBlockBreak(8, B0 + 1, 8, 1);
  const full = live() - before;
  clientStore.setOn('particles', false);
  const before2 = live();
  engine.particles.spawnBlockBreak(8, B0 + 1, 8, 1);
  const off = live() - before2;
  ok(full >= 10 && off === 0, `Particles: ligado gera ${full} partículas e desligado gera ${off}`);
  clientStore.setOn('particles', true);
  clientStore.reset();
  return out;
});
console.log(res.join('\n'));
console.log('--- erros:', errors.length, errors[0] || '');
await browser.close();
process.exit(res.some((l) => l.startsWith('FALHA')) ? 1 : 0);
