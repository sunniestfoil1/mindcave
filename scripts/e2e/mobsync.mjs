// Mobs no online, ponta a ponta sem rede de verdade: um motor HOST real (com NetHost e um convidado falso) e um MobManager de CONVIDADO que só
// recebe os pacotes do host (passando por JSON, como na conexão). Confere: cópias dos mobs, movimento suave, bebê/tosquia/morte, mob ausente some,
// outro mundo não mostra cópia, golpe do convidado vale no host (com conferência de alcance e dano), drops e XP vão para a rede, o mob escolhe o
// convidado como alvo e o ataque volta como dano nele, criativo é ignorado, ovo e tesoura do convidado, flecha de esqueleto e explosão na rede.
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
  const { NetHost, NetClient } = await import('/src/game/net/netManager.js');
  const { MobManager } = await import('/src/game/mobManager.js');
  const { MobEntity } = await import('/src/game/mobEntity.js');
  const { createSurvivalState } = await import('/src/game/survival.js');
  const S = await import('/src/game/net/mobSync.js');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:640px;height:360px;position:fixed;left:0;top:0';
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 110, z: 8.5 };
  const ps = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: true, sneaking: false, sprinting: false, gameMode: 'survival', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'Host', hunger: 20, saturation: 5 };
  const eng = new GameEngine(canvas, { world: cw, player: ps, spawn, worldTime: 15000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {} });
  await eng.start();
  eng.paused = false;
  for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise((r) => setTimeout(r, 250));
  eng.tick = () => {};
  const G = 99, res = {};
  for (let x = -6; x <= 60; x++) for (let z = -6; z <= 60; z++) { for (let y = G + 1; y <= G + 12; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, G, z, packState(1, 0)); cw.setBlock(x, G - 1, z, packState(1, 0)); }
  ps.pos = { x: 8.5, y: G + 1, z: 8.5 }; ps.flying = false; ps.vel = { x: 0, y: 0, z: 0 }; ps.health = 20; ps.isDead = false;
  eng.mobs.mobs.length = 0; eng.mobs.spawnSystem.tick = () => {}; eng.mobs._populateNear = () => {};
  eng.difficulty = 'normal'; eng.worldTime = 15000;

  // ---- ligações falsas
  const toGuest = [];   // o que o host manda ao convidado (passa por JSON como na conexão)
  const host = new NetHost({ engine: eng, world: {}, user: { id: 'host', full_name: 'Host' } });
  host.peers.set('g1', { conn: { send: (m) => toGuest.push(JSON.parse(JSON.stringify(m))) }, name: 'Convidado' });
  const guestAt = (x, z, gm = 'survival', dead = false) => { host.remotePlayers = new Map([['g1', { id: 'g1', name: 'Convidado', x, y: G + 1, z, yaw: 0, pitch: 0, gameMode: gm, isDead: dead }]]); };
  guestAt(24.5, 24.5);
  eng.netManager = host;
  const scene2 = new eng.scene.constructor();
  const guest = new MobManager(scene2, cw);
  guest.remoteFn = () => true;
  const sendSnap = () => { toGuest.length = 0; host.broadcastMobs(eng.mobs, 'overworld'); const pk = toGuest.filter((m) => m.t === 'mobs'); for (const m of pk) guest.applySnapshot(m, 'overworld'); return pk; };
  const ticksG = (n) => { for (let i = 0; i < n; i++) guest.tick(ps, { particles: eng.particles }); };

  // ---- 1) cópia criada com o mesmo tipo, lugar e id
  const z = eng.mobs.spawn('zombie', { x: 20.5, y: G + 1, z: 20.5 });
  let pk = sendSnap();
  const g0 = [...guest.ghostMap.values()][0];
  res.copia = { pacotes: pk.length, n: guest.ghostMap.size, tipo: g0 && g0.typeId, ghost: g0 && g0.ghost, x: g0 && g0.pos.x, netId: g0 && g0.netId === z.netId, naCena: !!(g0 && g0._model && g0._model.parent === scene2), bytes: JSON.stringify(pk[0]).length };
  // ---- 2) movimento: o host anda, a cópia alcança suave e balança as pernas
  z.pos.x = 24.5; z.pos.z = 20.5; sendSnap(); ticksG(6);
  res.mover = { dx: Math.abs(g0.pos.x - 24.5), limb: g0._limbSwing > 0.5 };
  // ---- 3) bebê, tosquia, vida e morte
  const sh = eng.mobs.spawn('sheep', { x: 30.5, y: G + 1, z: 30.5 }); sh.isBaby = false; sh.sheared = true;
  sendSnap(); const gs = guest.ghostMap.get(sh.netId);
  res.tosquia = !!(gs && gs.sheared);
  z.health = 7.5; sendSnap(); res.vida = g0.health;
  z.isDead = true; z.deathTime = 3; sendSnap(); res.morte = { morto: g0.isDead }; ticksG(20); res.morteSome = !guest.ghostMap.has(z.netId);
  eng.mobs.mobs = eng.mobs.mobs.filter((m) => m !== z);
  // ---- 4) mob que sai do alcance/da lista some depois de ausências seguidas
  eng.mobs.mobs = eng.mobs.mobs.filter((m) => m !== sh);
  for (let i = 0; i < 3; i++) sendSnap();
  res.ausente3 = guest.ghostMap.size;
  for (let i = 0; i < 8; i++) { guest.applySnapshot({ t: 'mobs', dim: 'overworld', m: [] }, 'overworld'); ticksG(1); }
  res.ausente = guest.ghostMap.size;
  // ---- 5) mundo diferente
  const z2 = eng.mobs.spawn('zombie', { x: 22.5, y: G + 1, z: 22.5 }); sendSnap();
  const antes = guest.ghostMap.size;
  guest.applySnapshot({ t: 'mobs', dim: 'nether', m: [] }, 'overworld'); res.dim = { antes, depois: 0 };
  guest.applySnapshot({ t: 'mobs', dim: 'nether', m: toGuest.length ? [] : [] }, 'overworld');
  res.dim.depois = guest.ghostMap.size;
  // ---- 6) raio e limite do pacote
  const far = eng.mobs.spawn('cow', { x: 400, y: G + 1, z: 400 });
  toGuest.length = 0; host.broadcastMobs(eng.mobs, 'overworld');
  res.raio = toGuest[0].m.map((a) => a[1]).sort().join();
  eng.mobs.mobs = eng.mobs.mobs.filter((m) => m !== far);
  const muitos = []; for (let i = 0; i < 90; i++) muitos.push(eng.mobs.spawn('chicken', { x: 12 + (i % 10), y: G + 1, z: 12 + Math.floor(i / 10) }));
  toGuest.length = 0; host.broadcastMobs(eng.mobs, 'overworld'); res.limite = toGuest[0].m.length;
  eng.mobs.mobs = eng.mobs.mobs.filter((m) => !muitos.includes(m));
  // sem mobs: avisa uma vez e depois cala
  eng.mobs.mobs.length = 0; toGuest.length = 0; host.broadcastMobs(eng.mobs, 'overworld'); host.broadcastMobs(eng.mobs, 'overworld'); host.broadcastMobs(eng.mobs, 'overworld');
  res.vazio = toGuest.length;

  // ---- 7) golpe do convidado: vira 'mobhit', o host confere e aplica; fora de alcance ou dano absurdo é recusado
  guest.clearGhosts(); eng.mobs.mobs.length = 0;
  const cow = eng.mobs.spawn('cow', { x: 25.5, y: G + 1, z: 24.5 }); const cowHp = cow.health;
  sendSnap(); const gc = guest.ghostMap.get(cow.netId);
  const hits = []; MobEntity.onGhostDamage = (mob, dmg, src, att, opts) => hits.push({ id: mob.netId, dmg, src, kb: !opts || opts.knockback !== false });
  const a1 = gc.applyDamage(5, 'attack', { pos: { x: 24.5, y: G + 1, z: 24.5 } }, { knockback: false });
  const a2 = gc.applyDamage(3, 'attack', { pos: { x: 24.5, y: G + 1, z: 24.5 } }, { knockback: false });   // dentro da janela de 10 ticks e menor: ignorado
  res.golpeLocal = { a1, a2, enviados: hits.length, hurt: gc.hurtTime };
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobhit', ...hits[0] });
  res.golpeHost = { dano: +(cowHp - cow.health).toFixed(2), alvo: cow.target && cow.target.id };
  cow.health = 10; cow.hurtResistantTime = 0; cow.lastDamage = 0;
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobhit', id: cow.netId, dmg: 1e6, src: 'attack' });
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobhit', id: cow.netId, dmg: -5, src: 'attack' });
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobhit', id: 99999, dmg: 3, src: 'attack' });
  res.golpeRecusado = { vida: cow.health };
  guestAt(200, 200); host._handleGuestMessage('g1', 'Convidado', { t: 'mobhit', id: cow.netId, dmg: 3, src: 'attack' }); res.golpeLonge = { vida: cow.health };
  guestAt(24.5, 24.5);

  // ---- 8) a morte no host solta o drop e o XP também na rede
  const sentNet = [];
  const ctxFor = (extra = {}) => ({ world: eng.world, difficulty: 'normal', worldTime: 15000, dimension: 'overworld', weather: null, gameRules: {}, projectiles: eng.projectiles, inventory: eng.inventory, getHeldItem: () => null, itemEntities: eng.itemEntities, particles: eng.particles, noiseSystem: eng.noiseSystem, onGunshot() {}, onExplode() {},
    remotePlayers: eng._remoteProxies(), onNetDrop: (item, pos, vel) => sentNet.push({ t: 'item_drop', item, pos, vel }), onNetXp: (amount, pos) => sentNet.push({ t: 'xp_drop', amount, pos }), onNetArrow: (a) => sentNet.push({ t: 'marrow', ...a }), ...extra });
  cow.health = 0; cow.isDead = true; cow.hurtResistantTime = 0;
  eng.mobs.tick(ps, ctxFor());
  res.drops = { itens: sentNet.filter((m) => m.t === 'item_drop').map((m) => m.item.id), xp: sentNet.filter((m) => m.t === 'xp_drop').length };
  eng.mobs.mobs.length = 0;

  // ---- 9) o mob escolhe o convidado (mais perto) como alvo e o ataque volta como dano nele; criativo é ignorado
  const attacks = [];
  eng.mobs.onRemoteAttack = (id, mob, dmg) => attacks.push({ id, dmg, who: mob.type.namePt });
  const zz = eng.mobs.spawn('zombie', { x: 23.5, y: G + 1, z: 24.5 });
  for (let i = 0; i < 200 && !attacks.length; i++) eng.mobs.tick(ps, ctxFor());
  res.alvo = { ehConvidado: !!(zz.target && zz.target.isRemote), id: zz.target && zz.target.id, ataques: attacks.length, dano: attacks[0] && attacks[0].dmg, quem: attacks[0] && attacks[0].who, dbg: { alvo: zz.target && (zz.target.id || 'host'), x: zz.pos.x, z: zz.pos.z, vida: zz.health, morto: zz.isDead, ticks: zz.ticksAlive, cd: zz.attackCooldown, prox: eng._remoteProxies().length } };
  eng.mobs.mobs.length = 0; attacks.length = 0;
  guestAt(24.5, 24.5, 'creative');
  const zc = eng.mobs.spawn('zombie', { x: 23.5, y: G + 1, z: 24.5 });
  for (let i = 0; i < 200; i++) eng.mobs.tick(ps, ctxFor());
  res.criativo = { alvoConvidado: !!(zc.target && zc.target.isRemote), ataques: attacks.length };
  eng.mobs.mobs.length = 0; guestAt(24.5, 24.5);

  // ---- 10) ovo e tesoura do convidado
  const nBefore = eng.mobs.mobs.length;
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobspawn', mob: 'zombie', x: 26.5, y: G + 1, z: 24.5 });
  const spawned = eng.mobs.mobs[0];
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobspawn', mob: 'zombie', x: 26.5, y: G + 1, z: 24.5 });   // rápido demais
  host.peers.get('g1').lastEgg = 0;
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobspawn', mob: 'ender_dragon', x: 26.5, y: G + 1, z: 24.5 });   // mob que não é de ovo
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobspawn', mob: 'zombie', x: 300, y: G + 1, z: 300 });   // longe do convidado
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobspawn', mob: 'zombie', x: NaN, y: G + 1, z: 24 });
  res.ovo = { criados: eng.mobs.mobs.length - nBefore, persistente: !!(spawned && spawned.persistent), tipo: spawned && spawned.typeId };
  eng.mobs.mobs.length = 0;
  const ov = eng.mobs.spawn('sheep', { x: 25.5, y: G + 1, z: 24.5 }); ov.isBaby = false; ov.sheared = false; sendSnap();
  toGuest.length = 0;
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobuse', id: ov.netId, act: 'shear' });
  const lan = toGuest.filter((m) => m.t === 'item_drop').length;
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobuse', id: ov.netId, act: 'shear' });   // já tosquiada
  const ov2 = eng.mobs.spawn('sheep', { x: 55.5, y: G + 1, z: 55.5 }); ov2.isBaby = false;
  host._handleGuestMessage('g1', 'Convidado', { t: 'mobuse', id: eng.mobs.netIdOf(ov2), act: 'shear' });   // longe
  res.tesoura = { tosquiou: ov.sheared, lanDrops: lan, longe: ov2.sheared, drops2: toGuest.filter((m) => m.t === 'item_drop').length };
  eng.mobs.mobs.length = 0;

  // ---- 11) o convidado recebe, pela NetClient, mobs/ataque/flecha/XP e a explosão
  const gp = createSurvivalState(); gp.pos = { x: 24.5, y: G + 1, z: 24.5 }; gp.vel = { x: 0, y: 0, z: 0 }; gp.gameMode = 'survival'; gp.health = 20;
  const arrowsBefore = eng.projectiles.projectiles.length;
  const fake = { mobs: guest, dimension: 'overworld', projectiles: eng.projectiles, itemEntities: eng.itemEntities, player: gp, emitHud() {}, world: cw, particles: null,
    hurtByMob: (...a) => GameEngine.prototype.hurtByMob.apply(fake, a), applyRemoteBlast: (m) => GameEngine.prototype.applyRemoteBlast.call(fake, m), entities: [], netManager: null, _cachedRaycastFrame: 0 };
  const client = new NetClient({ engine: fake, world: cw, user: { id: 'g1', full_name: 'Convidado' }, room: { playerNames: [] } });
  const m1 = eng.mobs.spawn('creeper', { x: 28.5, y: G + 1, z: 24.5 });
  toGuest.length = 0; host.broadcastMobs(eng.mobs, 'overworld');
  guest.clearGhosts(); client._handleHostMessage(toGuest[0]);
  res.cliente = { cópias: guest.ghostMap.size };
  client._handleHostMessage({ t: 'mobatk', dmg: 3, who: 'Zumbi' });
  res.cliente.vida = gp.health;
  client._handleHostMessage({ t: 'marrow', eye: { x: 30, y: G + 2, z: 24.5 }, dir: { x: -1, y: 0, z: 0 }, speed: 0.53, name: 'Esqueleto' });
  res.cliente.flecha = eng.projectiles.projectiles.length - arrowsBefore;
  gp.gameMode = 'creative'; client._handleHostMessage({ t: 'mobatk', dmg: 5, who: 'Zumbi' }); res.cliente.criativoVida = gp.health; gp.gameMode = 'survival';
  // explosão: blocos somem e o dano é calculado em quem recebe
  cw.setBlock(25, G + 1, 24, packState(1, 0)); cw.setBlock(26, G + 1, 24, packState(1, 0));
  client._handleHostMessage({ t: 'blast', x: 25.5, y: G + 1.5, z: 24.5, power: 4, blocks: [[25, G + 1, 24], [26, G + 1, 24]] });
  res.cliente.blocos = [cw.getBlock(25, G + 1, 24) >> 4, cw.getBlock(26, G + 1, 24) >> 4];
  res.cliente.vidaExplosao = gp.health;
  gp.pos = { x: 200, y: G + 1, z: 200 }; const h0 = gp.health; client._handleHostMessage({ t: 'blast', x: 25.5, y: G + 1.5, z: 24.5, power: 4, blocks: [] }); res.cliente.longe = gp.health === h0;
  // o host envia 'blast' pela rede quando detona (blocos + drops)
  toGuest.length = 0; for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [-1, 0]]) cw.setBlock(40 + dx, G + 1, 40 + dz, packState(3, 0)); eng.detonate({ x: 40.5, y: G + 1.5, z: 40.5 }, 3);
  const bl = toGuest.find((m) => m.t === 'blast');
  res.hostBlast = { enviou: !!bl, blocos: bl ? bl.blocks.length : 0 };
  return res;
});
ok(r.copia.pacotes === 1 && r.copia.n === 1 && r.copia.tipo === 'zombie' && r.copia.ghost === true && Math.abs(r.copia.x - 20.5) < 0.01 && r.copia.netId && r.copia.naCena, `o convidado recebe 1 pacote e cria 1 cópia do zumbi (tipo ${r.copia.tipo}, no mesmo lugar, na cena, mesmo id); pacote de ${r.copia.bytes} bytes`);
ok(r.mover.dx < 0.4 && r.mover.limb, `quando o host anda 4 blocos a cópia alcança em 6 ticks (falta ${r.mover.dx.toFixed(2)}) e balança as pernas`);
ok(r.tosquia === true && r.vida === 7.5, `ovelha tosquiada e vida do mob (${r.vida}) chegam na cópia`);
ok(r.morte.morto === true && r.morteSome === true, 'mob morto no host morre na cópia e some depois da animação (20 ticks)');
ok(r.ausente3 >= 1 && r.ausente === 0, `cópia sem aparecer no pacote some depois de ${6} ausências (aos 3: ${r.ausente3}, depois: ${r.ausente})`);
ok(r.dim.antes === 1 && r.dim.depois === 0, 'convidado em outro mundo (Nether/Aether) não mostra cópia nenhuma');
ok(r.raio === 'zombie' || r.raio === 'zombie,zombie' || !r.raio.includes('cow'), `mob a 400 blocos não entra no pacote (tipos enviados: ${r.raio})`);
ok(r.limite === 64, `no máximo 64 mobs por pacote (${r.limite} de 90)`);
ok(r.vazio === 1, `sem mobs o host avisa uma vez e depois não manda mais nada (${r.vazio} pacote)`);
ok(r.golpeLocal.a1 === true && r.golpeLocal.a2 === false && r.golpeLocal.enviados === 1 && r.golpeLocal.hurt === 10, `golpe na cópia: mostra o tranco na hora, manda 1 pedido ao host e ignora o segundo dentro da janela de 10 ticks (${r.golpeLocal.enviados} enviado)`);
ok(Math.abs(r.golpeHost.dano - 5) < 0.01 && r.golpeHost.alvo === 'g1', `o host aplica o golpe no mob de verdade (${r.golpeHost.dano} de dano) e o mob passa a mirar o convidado`);
ok(r.golpeRecusado.vida === 10 && r.golpeLonge.vida === 10, `dano de 1.000.000, dano negativo, mob inexistente e convidado a 200 blocos: recusados (vida ${r.golpeRecusado.vida}/${r.golpeLonge.vida})`);
ok(r.drops.itens.length >= 1 && r.drops.itens.every((i) => i === 334 || i === 363) && r.drops.xp === 1, `a vaca morta no host manda os drops (${r.drops.itens}) e o XP para os convidados`);
ok(r.alvo.ehConvidado && r.alvo.id === 'g1' && r.alvo.ataques >= 1 && r.alvo.dano > 0 && r.alvo.quem === 'Zumbi', `zumbi mira o convidado (mais perto que o host), bate e o host avisa o convidado do dano (${r.alvo.dano}) de "${r.alvo.quem}" ${JSON.stringify(r.alvo.dbg)}`);
ok(r.criativo.alvoConvidado === false && r.criativo.ataques === 0, 'convidado em modo criativo não é alvo de mob');
ok(r.ovo.criados === 1 && r.ovo.persistente && r.ovo.tipo === 'zombie', `ovo do convidado: o host cria 1 zumbi persistente; recusa o segundo seguido, mob fora de ovo, longe do convidado e coordenada inválida (${r.ovo.criados} criado)`);
ok(r.tesoura.tosquiou && r.tesoura.lanDrops === 1 && !r.tesoura.longe && r.tesoura.drops2 === 1, `tesoura do convidado: o host tosquia e manda a lã (${r.tesoura.lanDrops}); ovelha já tosquiada e ovelha longe são recusadas`);
ok(r.cliente['cópias'] === 1, 'a NetClient recebe o pacote de mobs e cria a cópia');
ok(r.cliente.vida === 17, `ataque de mob no convidado tira a vida dele (20 → ${r.cliente.vida})`);
ok(r.cliente.flecha === 1, `flecha de esqueleto do host é simulada também no convidado (${r.cliente.flecha})`);
ok(r.cliente.criativoVida === 17, 'ataque de mob não machuca convidado em criativo');
ok(r.cliente.blocos[0] === 0 && r.cliente.blocos[1] === 0 && r.cliente.vidaExplosao < 17, `explosão da rede quebra os blocos avisados e machuca quem está perto (vida ${r.cliente.vidaExplosao})`);
ok(r.cliente.longe === true, 'explosão longe do convidado não machuca');
ok(r.hostBlast.enviou && r.hostBlast.blocos >= 1, `o host que detona manda a explosão para a rede (${r.hostBlast.blocos} blocos)`);
ok(errors.length === 0, `sem erro de página (${errors[0] || ''})`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
