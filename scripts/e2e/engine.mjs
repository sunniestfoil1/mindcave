// Teste de fumaça do motor REAL no Chrome headless. Rede do Supabase bloqueada (nada é gravado no banco do jogo).
import { pathToFileURL } from 'url';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
const errors = [];
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname)) r.abort(); else r.continue(); });
page.on('requestfailed', (r) => { if (r.url().includes('localhost')) errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|ERR_FAILED|net::/.test(t)) errors.push('console: ' + t.slice(0, 300)); } });

await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

const result = await page.evaluate(async () => {
  const out = [];
  const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
  try {
    const { ClientWorld } = await import('/src/game/world.js');
    const { GameEngine } = await import('/src/game/engine.js');
    const { seedFromString } = await import('/src/game/prng.js');
    const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
    const { packState, stateId, stateMeta } = await import('/src/game/chunk.js');
    const { getBlock } = await import('/src/game/blocks.js');
    const Surv = await import('/src/game/survival.js');

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:800px;height:450px;position:fixed;left:0;top:0';
    document.body.appendChild(canvas);
    const seed = seedFromString('88888');
    const cw = new ClientWorld(seed, new Map(), { generatorId: 'open_world', params: { structures: true } });
    // chão plano de teste em volta do spawn, para não depender do relevo
    const spawn = { x: 8.5, y: 100, z: 8.5 };
    const msgs = [];
    const deaths = [];
    const pState = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: false, sneaking: false, sprinting: false, gameMode: 'survival', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'Tester' };
    const engine = new GameEngine(canvas, { world: cw, player: pState, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: (m) => msgs.push(m), onDeath: (d) => deaths.push(d), onAutosave: async () => {} });
    await engine.start();
    engine.paused = false;
    for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250)); // deixa o loop carregar chunks (espera até 60 s: o primeiro teste da suíte roda com o Vite ainda frio)
    await new Promise(r => setTimeout(r, 1500));
    ok(cw.chunks.size > 0, `chunks carregados: ${cw.chunks.size}`);

    // plataforma de pedra 21×21 em y=99 e ar acima
    const B0 = 99;
    for (let x = -2; x <= 18; x++) for (let z = -2; z <= 18; z++) { for (let y = B0 + 1; y <= B0 + 6; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, B0, z, packState(1, 0)); }
    pState.pos = { x: 8.5, y: B0 + 1, z: 8.5 }; pState.vel = { x: 0, y: 0, z: 0 };
    const tickN = (n) => { for (let i = 0; i < n; i++) engine.tick(); };
    const settleDim = async () => { for (let i = 0; i < 400 && engine._switching; i++) await new Promise((r) => setTimeout(r, 50)); };   // a travessia do portal é por etapas, com tela de carregamento
    tickN(3);

    // ---- 1) tecla A com o F3 ligado ----
    const ev = (code, repeat = false) => ({ code, repeat, preventDefault() {}, target: document.body });
    engine.onKey(ev('F3'), true); engine.onKey(ev('F3'), false); // toque no F3: liga o painel
    ok(engine.f3 === true, 'F3 (toque) liga o painel');
    const chunksBefore = [...cw.chunks.values()].reduce((a, c) => a + c.secVer.reduce((s, v) => s + v, 0), 0);
    engine.onKey(ev('KeyA'), true);
    ok(engine.isAction('left') === true, 'com o F3 ligado, apertar A registra "esquerda"');
    const chunksAfter = [...cw.chunks.values()].reduce((a, c) => a + c.secVer.reduce((s, v) => s + v, 0), 0);
    ok(chunksBefore === chunksAfter, 'A com o F3 ligado NÃO recarrega chunks');
    const x0 = pState.pos.x; tickN(10);
    ok(Math.abs(pState.pos.x - x0) > 0.2 || Math.abs(pState.pos.z - 8.5) > 0.2, `jogador anda com A (dx=${(pState.pos.x - x0).toFixed(2)})`);
    engine.onKey(ev('KeyA'), false);
    ok(engine.isAction('left') === false, 'soltar A limpa a tecla');
    engine.f3 = false;
    // keyup durante o chat não gruda
    engine.onKey(ev('KeyD'), true); engine.chatOpen = true; engine.onKey(ev('KeyD'), false); engine.chatOpen = false;
    ok(engine.isAction('right') === false, 'soltar D com o chat aberto não deixa a tecla grudada');
    tickN(20);

    // ---- 2) quebrar flor/grama alta e terra à mão ----
    const aimAt = (bx, by, bz) => { const e = engine.eyePos(); const dx = bx + 0.5 - e.x, dy = by + 0.5 - e.y, dz = bz + 0.5 - e.z; pState.yaw = Math.atan2(-dx, dz); pState.pitch = -Math.atan2(dy, Math.hypot(dx, dz)); engine._cachedRaycastFrame = -1; };
    pState.pos = { x: 8.5, y: B0 + 1, z: 8.5 }; pState.vel = { x: 0, y: 0, z: 0 }; tickN(3);
    cw.setBlock(8, B0 + 1, 11, packState(38, 0)); // papoula
    aimAt(8, B0 + 1, 11);
    const dropsBefore = engine.itemEntities.items.length;
    engine.mouseBtn[0] = true;
    let t = 0; while (t < 30 && stateId(cw.getBlock(8, B0 + 1, 11)) !== 0) { engine.tick(); t++; }
    engine.mouseBtn[0] = false; tickN(8);
    ok(stateId(cw.getBlock(8, B0 + 1, 11)) === 0 && t <= 3, `flor quebra em ${t} tick(s)`);
    cw.setBlock(8, B0 + 1, 11, packState(3, 0)); // terra
    aimAt(8, B0 + 1, 11);
    engine.mouseBtn[0] = true; t = 0; while (t < 80 && stateId(cw.getBlock(8, B0 + 1, 11)) !== 0) { engine.tick(); t++; }
    engine.mouseBtn[0] = false;
    ok(t >= 12 && t <= 20, `terra à mão quebra em ${t} ticks (oficial: 15)`);
    const afterBreak = engine.itemEntities.items.length;
    ok(afterBreak > dropsBefore, `bloco quebrado gera item no chão (${dropsBefore} → ${afterBreak})`);
    // coleta: o jogador está a ~2,5 blocos; o item atrai e entra no inventário em segundos
    let picked = false; const invCount = () => [...engine.inventory.hotbar, ...engine.inventory.main].reduce((s, i) => s + (i && i.id === 3 ? i.count : 0), 0);
    const dirtBefore = invCount();
    const it0 = engine.itemEntities.items.find(i => i.id === 3);
    if (it0) { pState.pos.x = it0.pos.x; pState.pos.z = it0.pos.z; }
    for (let i = 0; i < 100 && !picked; i++) { engine.tick(); await new Promise(r => requestAnimationFrame(r)); picked = invCount() > dirtBefore; }
    ok(picked, 'o drop é coletado em poucos segundos');

    // ---- 3) escada e laje: colocação pelo motor ----
    const slotSet = (id, meta = 0, n = 64) => { engine.player.hotbar[0] = { id, count: n, meta }; engine.player.selectedSlot = 0; };
    pState.pos = { x: 8.5, y: B0 + 1, z: 8.5 }; pState.yaw = 0; tickN(2);
    slotSet(53); aimAt(8, B0, 11); // olha para o chão à frente
    engine._cachedRaycastFrame = -1; engine.placeBlock();
    const hitSt = [...Array(5).keys()].map(i => cw.getBlock(8, B0 + 1, 10 + i)).find(s => stateId(s) === 53);
    ok(!!hitSt, `escada colocada pelo motor (meta=${hitSt ? stateMeta(hitSt) : 'n/a'})`);
    slotSet(44, 3); engine.placeCd = 0; aimAt(12, B0, 8); engine._cachedRaycastFrame = -1; engine.placeBlock();
    const slabSt = [...Array(5).keys()].map(i => cw.getBlock(10 + i, B0 + 1, 8)).find(s => stateId(s) === 44);
    ok(!!slabSt && stateMeta(slabSt) === 3, 'laje de pedregulho colocada (meta 3)');

    // ---- 4) morte: mensagem, inventário, chat ----
    engine.inventory.hotbar[1] = { id: 1, count: 10, meta: 0 };
    msgs.length = 0; const itemsBefore = engine.itemEntities.items.length;
    pState.pos = { x: 8.5, y: B0 + 1, z: 8.5 };
    Surv.applyDamage(pState, 100, 'fall');
    tickN(3);
    const deathMsg = msgs.map(m => m.text).find(t => /Tester/.test(t));
    ok(!!deathMsg && /caiu de um lugar alto/.test(deathMsg), `chat recebe a morte: "${deathMsg}"`);
    ok(engine.itemEntities.items.length > itemsBefore, 'itens caem no chão na morte');
    ok(deaths.length === 1 && deaths[0].itemsLost.length > 0, `onDeath chamado uma vez com itens perdidos (${deaths[0]?.itemsLost.length})`);
    ok(engine.inventory.hotbar.every(i => !i || !i.id), 'inventário esvaziado');
    engine.respawn();
    ok(!pState.isDead && pState.health === 20, 'renascer restaura a vida');
    // /kill
    msgs.length = 0; const { processCommand } = await import('/src/game/commands.js');
    processCommand(engine, '/kill'); tickN(3);
    ok(msgs.some(m => /caiu para fora do mundo/.test(m.text)), '/kill: "caiu para fora do mundo"');
    engine.respawn();

    // ---- 5) TAB offline ----
    engine.playerListOpen = true; engine.emitHud();
    ok(engine._lastHud && engine._lastHud.pings.length === 1 && engine._lastHud.pings[0].name === 'Tester', 'TAB offline lista o próprio jogador');

    // ---- 6) esqueleto: arco e flecha atinge o jogador ----
    pState.pos = { x: 8.5, y: B0 + 1, z: 8.5 }; pState.health = 20; pState.isDead = false; pState.hurtResistantTime = 0; tickN(2);
    engine.difficulty = 'normal'; engine.worldTime = 15000; // noite: de dia o esqueleto foge do sol
    const sk = engine.mobs.summon('skeleton', { x: 8.5, y: B0 + 1, z: 14.5 });
    ok(!!sk, 'esqueleto invocado');
    let arrows = 0, hurt = false;
    for (let i = 0; i < 1200 && !hurt; i++) { engine.tick(); arrows = Math.max(arrows, engine.projectiles.projectiles.filter(p => p.type === 'arrow').length); if (pState.health < 20) hurt = true; }
    ok(arrows > 0, `esqueleto disparou flechas (máx ${arrows} no ar)`);
    ok(hurt, `flecha do esqueleto feriu o jogador (vida ${pState.health})`);
    // morte por flecha: o nome do esqueleto aparece na mensagem
    msgs.length = 0; pState.health = 1; pState.hurtResistantTime = 0;
    for (let i = 0; i < 400 && !pState.isDead; i++) engine.tick();
    tickN(2);
    const arrowMsg = msgs.map(m => m.text).find(t => /Tester/.test(t));
    ok(pState.isDead && /alvejado por Esqueleto/.test(arrowMsg || ''), `morte por flecha no chat: "${arrowMsg}"`);
    const bowChild = sk._model && (() => { let f = false; sk._model.traverse(o => { if (o.name === 'bow') f = true; }); return f; })();
    ok(!!bowChild, 'modelo do esqueleto tem o arco');

    // ======== RODADA 3: itens, cama, agachar ========
    const reset = () => { engine.paused = false; /* a morte solta o ponteiro e pausa o motor */ for (let x = -2; x <= 18; x++) for (let z = -2; z <= 18; z++) for (const yy of [B0 + 1, B0 + 2]) { const f = stateId(cw.getBlock(x, yy, z)); if (f >= 8 && f <= 11) cw.setBlock(x, yy, z, 0); } /* água do teste do balde */ engine.mobs.mobs.length = 0; engine.projectiles.projectiles.length = 0; pState.hunger = 20; pState.pos = { x: 8.5, y: B0 + 1, z: 8.5 }; pState.vel = { x: 0, y: 0, z: 0 }; pState.yaw = 0; pState.health = 20; pState.isDead = false; pState.sleeping = false; engine.worldTime = 15000; engine.placeCd = 0; tickN(3); };
    reset();
    const held = (id, meta = 0, n = 5) => { pState.hotbar[0] = { id, count: n, meta, ...(id >= 259 && id <= 294 ? { durability: 0 } : {}) }; pState.selectedSlot = 0; return pState.hotbar[0]; };
    const floorAim = (x, z) => { aimTop(x, B0, z); };
    const aimTop = (bx, by, bz) => { const e = engine.eyePos(); const dx = bx + 0.5 - e.x, dy = by + 1 - e.y, dz = bz + 0.5 - e.z; pState.yaw = Math.atan2(-dx, dz); pState.pitch = -Math.atan2(dy, Math.hypot(dx, dz)); engine._cachedRaycastFrame = -1; };
    const st = (x, y, z) => stateId(cw.getBlock(x, y, z));
    // graveto não vira bloco
    held(280, 0, 5); floorAim(8, 11); engine.placeBlock();
    ok([...Array(5).keys()].every(i => st(8, B0 + 1, 10 + i) === 0 || st(8, B0 + 1, 10 + i) === 53), 'item que não é bloco (graveto) NÃO é colocado no mundo');
    // enxada
    cw.setBlock(9, B0 + 1, 11, packState(2, 0)); aimTop(9, B0 + 1, 11);
    let h = held(290); const usedHoe = engine.useHeldItem(h);
    ok(usedHoe && st(9, B0 + 1, 11) === 60, 'enxada transforma grama em terra arada');
    // sementes
    h = held(295, 0, 5); aimTop(9, B0 + 1, 11); engine.useHeldItem(h);
    ok(st(9, B0 + 2, 11) === 59 && h.count === 4, 'sementes plantam trigo na terra arada e gastam 1');
    // farinha de osso
    h = held(351, 15, 5); aimAt(9, B0 + 2, 11); engine._cachedRaycastFrame = -1; engine.useHeldItem(h);
    ok(stateMeta(cw.getBlock(9, B0 + 2, 11)) > 0, `farinha de osso acelera o trigo (meta=${stateMeta(cw.getBlock(9, B0 + 2, 11))})`);
    // baldes e pederneira (área livre ao norte)
    pState.pos = { x: 8.5, y: B0 + 1, z: 2.5 }; pState.vel = { x: 0, y: 0, z: 0 }; tickN(2);
    cw.setBlock(7, B0 + 1, 5, packState(9, 0)); aimAt(7, B0 + 1, 5); engine._cachedRaycastFrame = -1;
    h = held(325, 0, 3); engine.useHeldItem(h);
    const hasWaterBucket = [...pState.hotbar, ...engine.inventory.main].some(i => i && i.id === 326);
    ok(st(7, B0 + 1, 5) === 0 && hasWaterBucket, 'balde vazio recolhe a fonte de água e vira balde de água');
    h = held(326, 0, 1); floorAim(10, 5); engine.useHeldItem(h);
    ok(st(10, B0 + 1, 5) === 9 && pState.hotbar[0] && pState.hotbar[0].id === 325, 'balde de água derrama uma fonte e volta a ser balde vazio');
    h = held(259, 0, 1); floorAim(6, 5); engine.useHeldItem(h);
    ok(st(6, B0 + 1, 5) === 51, 'pederneira e aço acende fogo');
    // cama
    reset(); held(355, 0, 2); pState.yaw = 0; floorAim(6, 8); engine.placeBlock();
    const beds = []; for (let x = 3; x <= 9; x++) for (let z = 5; z <= 11; z++) { const stt = cw.getBlock(x, B0 + 1, z); if (stateId(stt) === 26) beds.push({ x, z, meta: stateMeta(stt) }); }
    const foot = beds.find(b => !(b.meta & 8)), head = beds.find(b => (b.meta & 8));
    const dirs = [[0, 1], [-1, 0], [0, -1], [1, 0]]; const dd = foot ? dirs[foot.meta & 3] : [9, 9];
    ok(beds.length === 2 && foot && head && head.x === foot.x + dd[0] && head.z === foot.z + dd[1] && (head.meta & 3) === (foot.meta & 3), `cama ocupa 2 blocos alinhados (pé ${JSON.stringify(foot)}, cabeceira ${JSON.stringify(head)})`);
    ok(pState.hotbar[0].count === 1, 'cama gasta 1 item');
    // quebrar uma metade remove a outra
    pState.gameMode = 'creative'; aimAt(foot.x, B0 + 1, foot.z); engine._cachedRaycastFrame = -1; engine.breakBlock(); pState.gameMode = 'survival';
    ok(st(foot.x, B0 + 1, foot.z) === 0 && st(head.x, B0 + 1, head.z) === 0, 'quebrar uma metade da cama remove a outra');
    // dormir define o spawn e renascer usa a cama
    held(355, 0, 1); floorAim(6, 8); engine.placeBlock();
    const bed2 = []; for (let x = 3; x <= 9; x++) for (let z = 5; z <= 11; z++) if (st(x, B0 + 1, z) === 26) bed2.push({ x, z });
    pState.pos = { x: 6.5, y: B0 + 1, z: 4.5 }; pState.health = 20; engine.worldTime = 15000;
    engine.trySleep(bed2[0].x, B0 + 1, bed2[0].z);
    ok(pState.hasBedSpawn === true && pState.spawnX === bed2[0].x, 'dormir define o ponto de renascimento na cama');
    engine.wakeUp();
    Surv.applyDamage(pState, 100, 'fall'); tickN(2); engine.respawn();
    ok(Math.hypot(pState.pos.x - (bed2[0].x + 0.5), pState.pos.z - (bed2[0].z + 0.5)) < 2.5, `renasce ao lado da cama (${pState.pos.x.toFixed(1)}, ${pState.pos.z.toFixed(1)})`);
    // cama destruída: volta ao spawn do mundo
    for (const b of bed2) cw.setBlock(b.x, B0 + 1, b.z, 0);
    msgs.length = 0; Surv.applyDamage(pState, 100, 'fall'); tickN(2); engine.respawn();
    ok(pState.hasBedSpawn === false && msgs.some(m => /cama estava ausente/.test(m.text)), 'cama destruída: aviso e volta ao spawn do mundo');

    // ======== PORTAS, CERCAS, PORTÃO ======== (alvos a até ~3 blocos do jogador: o alcance é 4,5)
    reset(); pState.pos = { x: 8.5, y: B0 + 1, z: 1.5 }; tickN(2);
    h = held(324, 0, 3); pState.yaw = 0; floorAim(8, 3); engine.placeBlock();
    const dl = cw.getBlock(8, B0 + 1, 3), du = cw.getBlock(8, B0 + 2, 3);
    ok(stateId(dl) === 64 && stateId(du) === 64 && (stateMeta(du) & 8) === 8, `porta ocupa 2 blocos (meta baixo ${stateMeta(dl)}, cima ${stateMeta(du)})`);
    ok(pState.hotbar[0].count === 2, 'porta gasta 1 item');
    pState.sneaking = false; aimAt(8, B0 + 2, 3); engine._cachedRaycastFrame = -1;
    const openBefore = (stateMeta(cw.getBlock(8, B0 + 1, 3)) & 4) !== 0;
    engine.interactBlock(pState);
    ok(!openBefore && (stateMeta(cw.getBlock(8, B0 + 1, 3)) & 4) !== 0, 'botão direito (mirando a metade de cima) abre a porta pela de baixo');
    // aberta, a placa sai da frente e a mira passa pelo vão (como no jogo): fechar pelo método, sem raio
    engine.toggleOpenable(8, B0 + 1, 3);
    ok((stateMeta(cw.getBlock(8, B0 + 1, 3)) & 4) === 0, 'e fecha de novo');
    pState.gameMode = 'survival'; const itemsBeforeDoor = engine.itemEntities.items.length;
    aimAt(8, B0 + 2, 3); engine._cachedRaycastFrame = -1; engine.mouseBtn[0] = true; for (let i = 0; i < 160 && st(8, B0 + 2, 3) === 64; i++) engine.tick(); engine.mouseBtn[0] = false; // porta à mão: dureza 3 → ~90 ticks
    ok(st(8, B0 + 1, 3) === 0 && st(8, B0 + 2, 3) === 0, 'quebrar uma metade remove a porta inteira');
    const newItems = engine.itemEntities.items.slice(itemsBeforeDoor);
    ok(newItems.length === 1 && newItems[0].id === 324, `e dropa exatamente 1 porta (${newItems.length} item(ns))`);
    held(330, 0, 1); pState.yaw = 0; floorAim(11, 3); engine.placeBlock();
    aimAt(11, B0 + 1, 3); engine._cachedRaycastFrame = -1; engine.interactBlock(pState);
    ok(st(11, B0 + 1, 3) === 71 && (stateMeta(cw.getBlock(11, B0 + 1, 3)) & 4) === 0, 'porta de ferro não abre com o botão direito');
    held(85, 0, 4); engine.placeCd = 0; floorAim(6, 3); engine.placeBlock();
    ok(st(6, B0 + 1, 3) === 85, 'cerca colocada');
    held(85, 0, 3); engine.placeCd = 0; floorAim(7, 3); engine.placeBlock();
    ok(st(7, B0 + 1, 3) === 85, 'segunda cerca ao lado (a conexão é automática pela vizinhança)');
    held(107, 0, 2); engine.placeCd = 0; floorAim(9, 3); engine.placeBlock();
    ok(st(9, B0 + 1, 3) === 107, 'portão colocado');
    const gateBefore = stateMeta(cw.getBlock(9, B0 + 1, 3));
    aimAt(9, B0 + 1, 3); engine._cachedRaycastFrame = -1; engine.interactBlock(pState);
    ok(((stateMeta(cw.getBlock(9, B0 + 1, 3)) ^ gateBefore) & 4) === 4, 'botão direito abre o portão');
    ok(st(6, B0 + 1, 3) === 85 && st(7, B0 + 1, 3) === 85, 'as cercas continuam de pé');

    // ======== MOBS: criativo é ignorado; sem ataque pelo teto/piso ========
    reset(); engine.difficulty = 'normal'; engine.worldTime = 15000;
    for (let x = 6; x <= 11; x++) for (let z = 6; z <= 11; z++) for (let y = B0 + 1; y <= B0 + 7; y++) cw.setBlock(x, y, z, 0);
    const hp = () => pState.health;
    const nearby = (kind, x, y, z) => engine.mobs.summon(kind, { x, y, z });
    // 1) criativo: zumbi colado no jogador não o ataca nem o escolhe como alvo
    pState.gameMode = 'creative'; pState.pos = { x: 8.5, y: B0 + 1, z: 8.5 }; pState.health = 20; tickN(2);
    const z1 = nearby('zombie', 9.5, B0 + 1, 8.5);
    tickN(120);
    ok(hp() === 20 && !z1.target, `criativo: zumbi ao lado não ataca nem mira o jogador (vida ${hp()}, alvo ${z1.target ? 'sim' : 'não'})`);
    // 2) sobrevivência: o mesmo zumbi passa a atacar
    pState.gameMode = 'survival'; pState.hurtResistantTime = 0;
    for (let i = 0; i < 200 && hp() >= 20; i++) engine.tick();
    ok(hp() < 20, `sobrevivência: o mesmo zumbi ataca (vida ${hp()})`);
    pState.isDead = false; pState.deathPending = false; pState.health = 20;
    // 3) voltou ao criativo: larga o alvo e para de bater
    pState.gameMode = 'creative'; pState.health = 20; tickN(60);
    const afterCreative = hp(); tickN(80);
    ok(hp() === 20 && afterCreative === 20 && !z1.target, 'virou criativo no meio da luta: o mob larga o alvo e para de ferir');
    engine.mobs.mobs.length = 0;
    // 4) teto: zumbi em cima de um piso (3 blocos acima), jogador embaixo; sem bloco no meio não existiria ataque, com o piso nao pode haver
    pState.gameMode = 'survival'; pState.health = 20; pState.hurtResistantTime = 0; pState.pos = { x: 8.5, y: B0 + 1, z: 8.5 }; tickN(2);
    for (let x = 7; x <= 10; x++) for (let z = 7; z <= 10; z++) cw.setBlock(x, B0 + 4, z, packState(1, 0)); // piso do andar de cima
    const zUp = nearby('zombie', 8.5, B0 + 5, 8.5); zUp.target = pState;
    tickN(200);
    ok(hp() === 20, `zumbi no andar de cima (sobre o teto) NÃO fere o jogador embaixo (vida ${hp()})`);
    // 5) controle: sem o piso e no mesmo nível, o ataque acontece
    engine.mobs.mobs.length = 0; for (let x = 7; x <= 10; x++) for (let z = 7; z <= 10; z++) cw.setBlock(x, B0 + 4, z, 0);
    pState.health = 20; pState.hurtResistantTime = 0; tickN(2);
    pState.isDead = false; const zSame = nearby('zombie', 9.5, B0 + 1, 8.5);
    for (let i = 0; i < 200 && hp() >= 20; i++) engine.tick();
    ok(hp() < 20, `controle: zumbi no mesmo nível ainda ataca (vida ${hp()})`);
    // 6) esqueleto não atira no criativo
    engine.mobs.mobs.length = 0; engine.projectiles.projectiles.length = 0; pState.gameMode = 'creative'; pState.health = 20;
    const sk2 = nearby('skeleton', 8.5, B0 + 1, 14.5); engine.worldTime = 15000;
    let shot = 0; for (let i = 0; i < 200; i++) { engine.tick(); shot = Math.max(shot, engine.projectiles.projectiles.filter(q => q.type === 'arrow').length); }
    ok(shot === 0 && hp() === 20, `esqueleto não atira no criativo (flechas no ar: ${shot})`);
    pState.gameMode = 'survival'; void zSame; void sk2;

    // ======== BAÚ, ESCADA DE MÃO, ALÇAPÃO ========
    reset(); pState.pos = { x: 8.5, y: B0 + 1, z: 1.5 }; pState.gameMode = 'survival'; tickN(2);
    let openedChest = 0; engine.onOpenChest = () => { openedChest++; };
    held(54, 0, 3); pState.yaw = 0; floorAim(8, 3); engine.placeBlock();
    ok(st(8, B0 + 1, 3) === 54, `baú colocado como bloco real (meta ${stateMeta(cw.getBlock(8, B0 + 1, 3))})`);
    pState.sneaking = false; aimAt(8, B0 + 1, 3); engine._cachedRaycastFrame = -1; engine.interactBlock(pState);
    ok(openedChest === 1, 'botão direito abre o baú');
    // conteúdo + quebrar: itens caem
    // o Vite serve módulos editados com ?t=…: importar pela MESMA URL do motor, senão são duas instâncias (e dois mapas de baús)
    const cUrl = performance.getEntriesByType('resource').map(r => r.name).find(n => n.includes('/src/game/containers.js')) || '/src/game/containers.js';
    const { getOrCreateContainer } = await import(cUrl);
    getOrCreateContainer(cw, 8, B0 + 1, 3).slots[0] = { id: 264, count: 5, meta: 0 };
    const itemsBeforeChest = engine.itemEntities.items.length;
    pState.gameMode = 'creative'; aimAt(8, B0 + 1, 3); engine._cachedRaycastFrame = -1; engine.breakBlock(); pState.gameMode = 'survival';
    const spilled = engine.itemEntities.items.slice(itemsBeforeChest);
    ok(st(8, B0 + 1, 3) === 0 && spilled.some(i => i.id === 264 && i.count === 5), 'quebrar o baú derrama o conteúdo no chão');
    // escada de mão: coloca na parede, escala segurando andar contra a parede
    for (let y = B0 + 1; y <= B0 + 8; y++) cw.setBlock(11, y, 3, packState(1, 0)); // coluna de pedra
    pState.pos = { x: 9.5, y: B0 + 1, z: 3.5 }; pState.vel = { x: 0, y: 0, z: 0 }; tickN(2);
    held(65, 0, 8); engine.placeCd = 0; pState.yaw = -Math.PI / 2; // olhando para leste (+x) em direção à coluna
    { const e = engine.eyePos(); const dxx = 11.0 - e.x, dyy = (B0 + 1.5) - e.y, dzz = 3.5 - e.z; pState.yaw = Math.atan2(-dxx, dzz); pState.pitch = -Math.atan2(dyy, Math.hypot(dxx, dzz)); engine._cachedRaycastFrame = -1; }
    engine.placeBlock();
    ok(st(10, B0 + 1, 3) === 65, `escada de mão colocada na parede (meta ${stateMeta(cw.getBlock(10, B0 + 1, 3))})`);
    for (let y = B0 + 2; y <= B0 + 6; y++) cw.setBlock(10, y, 3, packState(65, 2));
    pState.pos = { x: 10.5, y: B0 + 1, z: 3.5 }; pState.vel = { x: 0, y: 0, z: 0 }; pState.yaw = -Math.PI / 2; pState.pitch = 0; engine.keys = {}; tickN(2);
    engine.onKey(ev('KeyW'), true); tickN(40); engine.onKey(ev('KeyW'), false);
    ok(pState.pos.y > B0 + 4, `segurando andar contra a escada de mão o jogador sobe (y=${(pState.pos.y - B0).toFixed(2)})`);
    // cair com a escada: não leva dano e desce devagar
    pState.pos = { x: 10.5, y: B0 + 6.5, z: 3.5 }; pState.vel = { x: 0, y: 0, z: 0 }; pState.health = 20; pState.fallDistance = 0; tickN(1);
    engine.onKey(ev('ShiftLeft'), true); tickN(15); engine.onKey(ev('ShiftLeft'), false);
    ok(pState.pos.y > B0 + 5.5, `agachado na escada de mão o jogador fica preso (y=${(pState.pos.y - B0).toFixed(2)})`);
    tickN(60);
    ok(pState.health === 20, 'descendo pela escada de mão não há dano de queda');
    // alçapão
    pState.pos = { x: 8.5, y: B0 + 1, z: 1.5 }; pState.vel = { x: 0, y: 0, z: 0 }; tickN(2);
    held(96, 0, 2); engine.placeCd = 0; floorAim(5, 2); engine.placeBlock();
    const tdm0 = stateMeta(cw.getBlock(5, B0 + 1, 2));
    ok(st(5, B0 + 1, 2) === 96, `alçapão colocado (meta ${tdm0})`);
    engine.toggleOpenable(5, B0 + 1, 2);
    ok((stateMeta(cw.getBlock(5, B0 + 1, 2)) & 4) !== 0, 'alçapão abre');
    engine.toggleOpenable(5, B0 + 1, 2);
    ok((stateMeta(cw.getBlock(5, B0 + 1, 2)) & 4) === 0, 'e fecha');
    engine.onOpenChest = null;

    // ======== ARCO E FLECHAS, TESOURA ========
    reset(); pState.gameMode = 'survival'; pState.pos = { x: 8.5, y: B0 + 1, z: 1.5 }; pState.yaw = 0; pState.pitch = 0; tickN(2);
    const arrowsInAir = () => engine.projectiles.projectiles.filter(q => q.type === 'arrow').length;
    const arrowCount = () => [...engine.inventory.hotbar, ...engine.inventory.main].reduce((n, i) => n + (i && i.id === 262 ? i.count : 0), 0);
    const drawBow = (ticks) => { engine.mouseBtn[2] = true; tickN(ticks); engine.mouseBtn[2] = false; tickN(2); };
    engine.inventory.main.fill(null); pState.hotbar[0] = { id: 261, count: 1, meta: 0 }; pState.selectedSlot = 0;
    engine.projectiles.projectiles.length = 0;
    drawBow(25);
    ok(arrowsInAir() === 0, 'arco sem flechas (sobrevivência) não atira');
    engine.inventory.main[0] = { id: 262, count: 5, meta: 0 };
    drawBow(25);
    ok(arrowsInAir() === 1 && arrowCount() === 4, `com flechas: atira 1 e gasta 1 (no ar ${arrowsInAir()}, restam ${arrowCount()})`);
    ok((engine.getHeldItem().data?.durability || 0) === 1, 'e o arco se desgasta (durabilidade 1)');
    pState.gameMode = 'creative'; engine.inventory.main[0] = null; engine.projectiles.projectiles.length = 0;
    drawBow(25);
    ok(arrowsInAir() === 1, 'no criativo atira sem flechas');
    pState.gameMode = 'survival';
    // tesoura em ovelha
    reset(); pState.pos = { x: 8.5, y: B0 + 1, z: 1.5 }; tickN(2);
    pState.hotbar[0] = { id: 359, count: 1, meta: 0 }; pState.selectedSlot = 0;
    const sheep = engine.mobs.summon('sheep', { x: 8.5, y: B0 + 1, z: 3.5 }); sheep.vel.x = 0; sheep.vel.z = 0; tickN(2);
    { const e = engine.eyePos(); const dx = sheep.pos.x - e.x, dy = sheep.pos.y + 0.6 - e.y, dz = sheep.pos.z - e.z; pState.yaw = Math.atan2(-dx, dz); pState.pitch = -Math.atan2(dy, Math.hypot(dx, dz)); }
    const woolBefore = engine.itemEntities.items.length;
    const used = engine.useOnEntity(engine.getHeldItem());
    const wool = engine.itemEntities.items.slice(woolBefore).find(i => i.id === 35);
    ok(used && sheep.sheared === true && wool && wool.count >= 1 && wool.count <= 3, `tesoura tosquia a ovelha e dropa lã (${wool ? wool.count : 0})`);
    ok(engine.useOnEntity(engine.getHeldItem()) === false, 'ovelha já tosquiada não dá lã de novo');

    // ======== COMER TODAS AS COMIDAS (pelo motor: segurar botão direito) ========
    reset(); pState.gameMode = 'survival'; pState.pos = { x: 8.5, y: B0 + 1, z: 1.5 }; pState.yaw = 0; pState.pitch = 0; tickN(2);
    const foodIds = Object.keys(Surv.FOODS).map(Number);
    const notEaten = [];
    for (const fid of foodIds) {
      pState.hunger = 8; pState.saturation = 0; pState.exhaustion = 0; pState.health = 20; pState.hurtResistantTime = 0; pState.effects = [];
      pState.hotbar[0] = { id: fid, count: 2, meta: 0 }; pState.selectedSlot = 0; engine.paused = false;
      engine.mouseBtn[2] = true; tickN(50); engine.mouseBtn[2] = false; tickN(3);
      const left = pState.hotbar[0] ? pState.hotbar[0].count : 0;
      if (!(pState.hunger > 8 && left === 1)) notEaten.push(`${fid} (fome ${pState.hunger}, restam ${left})`);
    }
    ok(notEaten.length === 0, `as ${foodIds.length} comidas podem ser comidas pelo botão direito: aumentam a fome e gastam 1${notEaten.length ? ' — FALHARAM: ' + notEaten.join(', ') : ''}`);

    // ======== NETHER: moldura de obsidiana, pederneira, travessia ida e volta ========
    reset(); pState.gameMode = 'survival'; pState.pos = { x: 8.5, y: B0 + 1, z: 1.5 }; tickN(2);
    const FX = 6, FZ = 12;                                   // moldura 4×5 no plano X, base em y=B0+1
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
      if (i === 0 || i === 3 || j === 0 || j === 4) cw.setBlock(FX + i, B0 + 1 + j, FZ, packState(49, 0));
    }
    pState.hotbar[0] = { id: 259, count: 1, meta: 0 }; pState.selectedSlot = 0;
    pState.pos = { x: FX + 1.5, y: B0 + 1, z: FZ - 2.5 }; tickN(2); aimTop(FX + 1, B0 + 1, FZ);
    const lit = engine.useHeldItem(pState.hotbar[0]);
    ok(stateId(cw.getBlock(FX + 1, B0 + 2, FZ)) === 90 && stateId(cw.getBlock(FX + 2, B0 + 4, FZ)) === 90, `pederneira na obsidiana acende o portal 2×3 (retorno ${lit})`);
    pState.pos = { x: FX + 1.5, y: B0 + 2, z: FZ + 0.5 }; pState.gameMode = 'creative'; pState.vel = { x: 0, y: 0, z: 0 };
    tickN(5); await settleDim();
    ok(engine.dimension === 'nether', `entrar no portal leva ao Nether (dimensão: ${engine.dimension})`);
    const nw = engine.world;
    ok(nw !== cw && nw.generatorOpts.generatorId === 'nether', 'o mundo ativo passa a ser o do Nether');
    const feetId = stateId(nw.getBlock(Math.floor(pState.pos.x), Math.floor(pState.pos.y), Math.floor(pState.pos.z)));
    ok(feetId === 90 || feetId === 0, `jogador chega dentro/ao lado do portal do Nether (bloco ${feetId})`);
    let net = 0; for (let x = -16; x < 16; x++) for (let y = 1; y < 127; y += 3) if (stateId(nw.getBlock(Math.floor(pState.pos.x) + x, y, Math.floor(pState.pos.z))) === 87) net++;
    ok(net > 10, `o Nether tem netherrack em volta (${net} amostras)`);
    ok(engine.sky.dome ? engine.sky.dome.visible === false : true, 'céu escondido no Nether');
    tickN(80);
    pState.pos.x += 3; tickN(70);                              // sai do portal e espera o cooldown
    const ppos = pState.pos;
    const inside = stateId(engine.world.getBlock(Math.floor(ppos.x), Math.floor(ppos.y), Math.floor(ppos.z)));
    ok(engine.dimension === 'nether' && inside !== 90, 'sair do portal não volta sozinho');
    // volta: entra no portal de chegada
    let pp = null; for (let x = -6; x <= 6 && !pp; x++) for (let z = -6; z <= 6 && !pp; z++) for (let y = 1; y < 127; y++) if (stateId(nw.getBlock(Math.floor(ppos.x) + x, y, Math.floor(ppos.z) + z)) === 90) { pp = { x: Math.floor(ppos.x) + x, y, z: Math.floor(ppos.z) + z }; break; }
    ok(!!pp, 'o portal de chegada existe no Nether');
    if (pp) { pState.pos = { x: pp.x + 0.5, y: pp.y, z: pp.z + 0.5 }; tickN(5); await settleDim(); }
    ok(engine.dimension === 'overworld' && engine.world === cw, 'voltar pelo portal retorna ao mundo normal');
    ok(engine.sky.dome ? engine.sky.dome.visible === true : true, 'céu volta no mundo normal');
    // quebrar obsidiana apaga o portal
    reset(); pState.gameMode = 'survival';
    engine.breakBedPartner(FX, B0 + 3, FZ, packState(49, 0)); cw.setBlock(FX, B0 + 3, FZ, 0); engine.breakBedPartner(FX, B0 + 3, FZ, packState(49, 0));
    ok(stateId(cw.getBlock(FX + 1, B0 + 2, FZ)) !== 90, 'quebrar a moldura apaga o portal');

    // ======== AETHER: moldura de glowstone + balde de água, travessia ida e volta, queda devolve ao mundo normal sem dano ========
    reset(); pState.gameMode = 'survival'; pState.pos = { x: 8.5, y: B0 + 1, z: 1.5 }; tickN(2);
    const AX = 6, AZ = 24;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
      if (i === 0 || i === 3 || j === 0 || j === 4) cw.setBlock(AX + i, B0 + 1 + j, AZ, packState(89, 0));
    }
    pState.hotbar[0] = { id: 259, count: 1, meta: 0 }; pState.selectedSlot = 0;
    pState.pos = { x: AX + 1.5, y: B0 + 1, z: AZ - 2.5 }; tickN(2); aimTop(AX + 1, B0 + 1, AZ);
    engine.useHeldItem(pState.hotbar[0]);
    ok(stateId(cw.getBlock(AX + 1, B0 + 2, AZ)) !== 215 && stateId(cw.getBlock(AX + 1, B0 + 2, AZ)) !== 90, 'pederneira na moldura de glowstone NÃO acende portal nenhum');
    pState.hotbar[0] = { id: 326, count: 1, meta: 0 }; aimTop(AX + 1, B0 + 1, AZ);
    const wet = engine.useHeldItem(pState.hotbar[0]);
    ok(stateId(cw.getBlock(AX + 1, B0 + 2, AZ)) === 215 && stateId(cw.getBlock(AX + 2, B0 + 4, AZ)) === 215 && pState.hotbar[0].id === 325, `balde de água dentro da moldura de glowstone acende o portal do Aether 2×3 e o balde fica vazio (retorno ${wet})`);
    pState.pos = { x: AX + 1.5, y: B0 + 2, z: AZ + 0.5 }; pState.gameMode = 'creative'; pState.vel = { x: 0, y: 0, z: 0 }; engine._portalCooldown = 0;
    tickN(5); await settleDim();
    ok(engine.dimension === 'aether' && engine.world.generatorOpts.generatorId === 'aether', `entrar no portal leva ao Aether (dimensão: ${engine.dimension})`);
    const aw = engine.world;
    let aeGrass = 0, aeStone = 0; for (let x = -24; x < 24; x += 2) for (let z = -24; z < 24; z += 2) for (let y = 40; y < 150; y += 1) { const b = stateId(aw.getBlock(Math.floor(pState.pos.x) + x, y, Math.floor(pState.pos.z) + z)); if (b === 210) aeGrass++; else if (b === 211) aeStone++; }
    ok(aeGrass > 20 && aeStone > 20, `o Aether tem grama (${aeGrass}) e pedra sagrada (${aeStone}) em volta do jogador`);
    tickN(60);
    ok(pState.pos.y > 30 && pState.onGround, `o jogador fica em pé no chão do Aether (y ${pState.pos.y.toFixed(1)}, no chão: ${pState.onGround})`);
    let ap = null; { const bx = Math.floor(pState.pos.x), bz = Math.floor(pState.pos.z); for (let x = -8; x <= 8 && !ap; x++) for (let z = -8; z <= 8 && !ap; z++) for (let y = 20; y < 200; y++) if (stateId(aw.getBlock(bx + x, y, bz + z)) === 215) { ap = { x: bx + x, y, z: bz + z }; break; } }
    ok(!!ap, 'o portal de chegada (azul) existe no Aether');
    // sair e voltar pelo portal de chegada
    pState.pos.x += 4; tickN(70);
    if (ap) { pState.pos = { x: ap.x + 0.5, y: ap.y, z: ap.z + 0.5 }; tickN(5); await settleDim(); }
    ok(engine.dimension === 'overworld' && engine.world === cw, 'voltar pelo portal retorna ao mundo normal');
    // de novo para o Aether e cair no vazio: volta ao mundo normal, vindo do céu, sem dano
    pState.pos = { x: AX + 1.5, y: B0 + 2, z: AZ + 0.5 }; pState.vel = { x: 0, y: 0, z: 0 }; engine._portalCooldown = 0; tickN(5); await settleDim();
    pState.gameMode = 'survival'; pState.health = 20; pState.pos = { x: pState.pos.x, y: -30, z: pState.pos.z }; pState.vel = { x: 0, y: -1, z: 0 };
    tickN(3); await settleDim();
    ok(engine.dimension === 'overworld' && pState.pos.y > 200, `cair do Aether devolve ao mundo normal, vindo do alto (y ${pState.pos.y.toFixed(0)})`);
    for (let i = 0; i < 600 && !(pState.onGround && i > 5); i++) tickN(1);
    ok(pState.health === 20, `a queda do Aether não machuca (vida ${pState.health})`);
    // quebrar um bloco da moldura de glowstone apaga o portal inteiro de uma vez
    reset(); pState.gameMode = 'survival';
    engine.breakBedPartner(AX, B0 + 3, AZ, packState(89, 0)); cw.setBlock(AX, B0 + 3, AZ, 0); engine.breakBedPartner(AX, B0 + 3, AZ, packState(89, 0));
    let left = 0; for (let i = 1; i <= 2; i++) for (let j = 1; j <= 3; j++) if (stateId(cw.getBlock(AX + i, B0 + 1 + j, AZ)) === 215) left++;
    ok(left === 0, `quebrar a moldura de glowstone apaga o portal do Aether inteiro (sobraram ${left} blocos)`);

    // ======== ESC: pausar e retomar rápido, em software (o navegador não aceita Esc como gesto para travar o mouse) ========
    reset(); engine.paused = true; engine.guiOpenFn = () => false;
    engine.onKey({ code: 'Escape', repeat: false, preventDefault() {}, target: document.body }, true);
    ok(engine.paused === false, 'Esc com o jogo pausado retoma na hora');
    engine.onKey({ code: 'Escape', repeat: false, preventDefault() {}, target: document.body }, true);
    ok(engine.paused === true, 'Esc de novo (mouse não travado) pausa na hora');
    engine.onKey({ code: 'Escape', repeat: false, preventDefault() {}, target: document.body }, true);
    ok(engine.paused === false, 'Esc, Esc, Esc: terceiro Esc retoma');
    engine.guiOpenFn = () => true; engine.paused = true;
    engine.onKey({ code: 'Escape', repeat: false, preventDefault() {}, target: document.body }, true);
    ok(engine.paused === true, 'com inventário/opções abertos, Esc não retoma o jogo por baixo');
    engine.guiOpenFn = () => false; engine.paused = false;

    // ======== SKIN: sem Steve antes da skin personalizada (cache síncrono + modelo só com a skin certa) ========
    {
      const SS = await import('/src/game/skinStore.js');
      const PM = await import('/src/game/playerModel.js');
      const old = SS.getSkinChoice();
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const cx = c.getContext('2d'); cx.fillStyle = '#ff0000'; cx.fillRect(0, 0, 64, 64);
      SS.setSkinChoice({ kind: 'custom', png: c.toDataURL('image/png'), slim: false });
      ok(SS.getSkinCanvasSync() === null, 'antes de decodificar não há skin em cache (o modelo fica oculto, não mostra Steve)');
      await SS.preloadLocalSkin();
      const cached = SS.getSkinCanvasSync();
      ok(!!cached, 'depois de preloadLocalSkin a skin personalizada está em cache síncrono');
      const pm = PM.buildPlayerModel();
      const applied = await PM.applyPackSkin(pm, null);
      const px = pm.userData.playerObject.skin.map?.image?.getContext?.('2d')?.getImageData(10, 10, 1, 1).data;
      ok(applied && px && px[0] === 255 && px[1] === 0, 'o modelo recebe a skin personalizada (pixel vermelho), não o Steve');
      SS.setSkinChoice(old);
    }

    // ======== MOBS: galinha acertada volta ao chão, empurrão entre entidades, movimento interpolado ========
    reset(); pState.gameMode = 'survival'; pState.pos = { x: 8.5, y: B0 + 1, z: 1.5 }; engine.difficulty = 'peaceful'; tickN(2);
    {
      const hen = engine.mobs.spawn('chicken', { x: 8.5, y: B0 + 1, z: 12.5 });
      tickN(5);
      hen.applyDamage(1, 'attack', { pos: { x: 8.5, y: B0 + 1, z: 10.5 } });
      let maxY = hen.pos.y;
      for (let i = 0; i < 80; i++) { tickN(1); maxY = Math.max(maxY, hen.pos.y); }
      ok(maxY - (B0 + 1) < 4, `galinha acertada sobe pouco (pico +${(maxY - B0 - 1).toFixed(1)} blocos) e não fica no ar`);
      ok(hen.onGround && Math.abs(hen.pos.y - (B0 + 1)) < 0.2, `galinha volta ao chão (y=${hen.pos.y.toFixed(2)})`);
      const cow = engine.mobs.spawn('cow', { x: 4.5, y: B0 + 1, z: 6.5 });
      const cow2 = engine.mobs.spawn('cow', { x: 4.7, y: B0 + 1, z: 6.5 });
      tickN(2); const x0 = cow.pos.x, x1 = cow2.pos.x;
      for (const m of [cow, cow2]) m.ai.tick = () => {}; // sem IA: só o empurrão
      tickN(25);
      ok(Math.abs(cow2.pos.x - cow.pos.x) > Math.abs(x1 - x0) + 0.3, `duas vacas sobrepostas se empurram para longe (distância ${(Math.abs(x1 - x0)).toFixed(2)} → ${Math.abs(cow2.pos.x - cow.pos.x).toFixed(2)})`);
      const cow3 = engine.mobs.spawn('cow', { x: 12.5, y: B0 + 1, z: 6.5 }); cow3.ai.tick = () => {};
      pState.pos = { x: 12.0, y: B0 + 1, z: 6.5 }; tickN(25);
      ok(Math.abs(cow3.pos.x - 12.5) > 0.3 || Math.abs(cow3.pos.z - 6.5) > 0.3, 'o jogador empurra a vaca ao encostar');
      const z0 = hen.pos.z; hen.vel.z = 0.2; hen.vel.x = 0;
      tickN(1); engine.updateMobsForTest?.();
      engine.mobs.renderUpdate(0, pState.pos, null, 0.5);
      const mid = hen._model.position.z, last = hen.pos.z, prev = hen._prevZ;
      ok(prev === undefined || (mid >= Math.min(prev, last) - 1e-6 && mid <= Math.max(prev, last) + 1e-6), 'o modelo é desenhado entre a posição do tick anterior e a atual (interpolação)');
    }

    // ======== FOV AO CORRER: transição suave do EntityRenderer 1.8.9 (metade do caminho a cada tick, interpolada entre ticks) ========
    {
      reset(); engine._fovMod = engine._fovModPrev = 1; pState.sprinting = false; pState.flying = false; pState.gameMode = 'survival';
      const baseFov = 70; const SS = (await import('/src/game/settingsStore.js')).settingsStore; const savedFov = SS.get('user.fov'); SS.set('user.fov', baseFov);
      pState.sprinting = true;
      const seq = [];
      for (let i = 0; i < 6; i++) { engine._tickFovModifier(); seq.push(engine._fovMod); }
      ok(Math.abs(seq[0] - 1.075) < 1e-9, `1º tick correndo: modificador anda metade do caminho até 1,15 (${seq[0].toFixed(4)})`);
      ok(seq.every((v, i) => i === 0 || v > seq[i - 1]) && seq[5] > 1.14 && seq[5] < 1.15, `converge sem salto para 1,15 (${seq.map(v => v.toFixed(3)).join(' → ')})`);
      // meio de um tick: o FOV da câmera fica entre o valor anterior e o atual
      engine._fovMod = engine._fovModPrev = 1; engine._tickFovModifier(); engine.tickAcc = 25; // TICK_MS = 50 → metade
      engine.updateCamera();
      ok(Math.abs(engine.camera.fov - baseFov * (1 + 0.075 * 0.5)) < 0.01, `FOV interpolado entre ticks (${engine.camera.fov.toFixed(3)})`);
      pState.sprinting = false;
      for (let i = 0; i < 12; i++) engine._tickFovModifier();
      ok(Math.abs(engine._fovMod - 1) < 0.001, 'ao parar de correr volta a 1,0 suavemente');
      pState.flying = true; for (let i = 0; i < 12; i++) engine._tickFovModifier();
      ok(Math.abs(engine._fovMod - 1.1) < 0.002, 'voando: alvo 1,1');
      pState.flying = false; engine.tickAcc = 0; for (let i = 0; i < 12; i++) engine._tickFovModifier();
      SS.set('user.fov', savedFov ?? 70);
    }
    engine.stop?.();
  } catch (e) { out.push('ERRO ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')); }
  return out;
});
console.log(result.join('\n'));
console.log('--- erros de console/página:', errors.length);
errors.slice(0, 12).forEach(e => console.log('  ' + e));
await browser.close();
process.exit(result.some(l => l.startsWith('FALHA') || l.startsWith('ERRO')) ? 1 : 0);
