// Entrar numa partida de ponta a ponta com WebRTC de verdade: duas páginas do Chrome (host e convidado) e a sinalização trocada por um barramento
// falso no Node (no lugar do banco). Confere: a conexão abre (e em quanto tempo), host e convidado se listam no TAB, nomes iguais dos dois lados,
// o convidado aparece no mundo do host e vice-versa com o nome certo, e os mobs do host aparecem no convidado.
import { pathToFileURL } from 'url';
const root = process.argv[2], port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-features=WebRtcHideLocalIpsWithMdns'] });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
const errors = [];

// ---- barramento de sinais (a tabela signals) no Node
const signals = []; let seq = 0;
const pages = [];
const deliver = (ev) => { for (const pg of pages) pg.evaluate((e) => window.__deliver && window.__deliver(e), ev).catch(() => {}); };
const match = (s, q) => Object.entries(q).every(([k, v]) => s[k] === v);

async function novaPagina(nome) {
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 360 });
  page.on('pageerror', (e) => errors.push(nome + ': ' + e.message));
  await page.exposeFunction('busCreate', (o) => { const s = { ...o, id: 'sig' + (++seq), created_date: new Date().toISOString() }; signals.push(s); deliver({ type: 'create', data: s }); return s; });
  await page.exposeFunction('busFilter', (q) => signals.filter((s) => match(s, q)).slice(-20));
  await page.exposeFunction('busUpdate', (id, patch) => { const s = signals.find((x) => x.id === id); if (s) { Object.assign(s, patch); deliver({ type: 'update', data: s }); } return s || {}; });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/')) {
      if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      else r.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
    } else r.continue();
  });
  await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  pages.push(page);
  return page;
}

// monta motor + liga a tabela de sinais falsa; devolve o nome do papel
const preparar = async (papel, nome, userId, x) => {
  const { ClientWorld } = await import('/src/game/world.js');
  const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js');
  const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
  const { packState } = await import('/src/game/chunk.js');
  const { mindcaveApi } = await import('/src/api/supabaseClient.js');
  const S = mindcaveApi.entities.Signal;
  const cbs = [];
  window.__deliver = (ev) => cbs.forEach((f) => f(ev));
  S.create = async (o) => window.busCreate(o);
  S.filter = async (q) => window.busFilter(q);
  S.update = async (id, p) => window.busUpdate(id, p);
  S.subscribe = (fn) => { cbs.push(fn); return () => { const i = cbs.indexOf(fn); if (i >= 0) cbs.splice(i, 1); }; };
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: x + 0.5, y: 110, z: 8.5 };
  const ps = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: false, sneaking: false, sprinting: false, gameMode: 'survival', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: nome, hunger: 20, saturation: 5 };
  const eng = new GameEngine(canvas, { world: cw, player: ps, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {} });
  await eng.start(); eng.paused = false;
  for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise((r) => setTimeout(r, 250));
  for (let xx = -6; xx <= 40; xx++) for (let z = -6; z <= 40; z++) { for (let y = 100; y <= 112; y++) cw.setBlock(xx, y, z, 0); cw.setBlock(xx, 99, z, packState(1, 0)); cw.setBlock(xx, 98, z, packState(1, 0)); }
  ps.pos = { x: x + 0.5, y: 100, z: 8.5 };
  window.__eng = eng; window.__papel = papel; window.__userId = userId;
  return true;
};

const host = await novaPagina('host');
const guest = await novaPagina('convidado');
await Promise.all([host.evaluate(preparar, 'host', 'Sunni', 'u-host', 8), guest.evaluate(preparar, 'guest', 'Miguel', 'u-guest', 12)]);

// ---- host abre o mundo (sala falsa) e o convidado entra
await host.evaluate(async () => {
  const { NetHost } = await import('/src/game/net/netManager.js');
  const { roomManager } = await import('/src/game/net/roomManager.js');
  const room = { id: 'sala1', code: 'ABC123', worldId: 'w', worldName: 'Teste', hostId: 'u-host', hostName: 'Sunni', maxPlayers: 8, playerCount: 1, playerNames: ['Sunni'], status: 'open', ops: ['u-host'], banned: '[]', whitelist: [], whitelistEnabled: false, motd: '', guestGameMode: 'survival', allowCommands: false, pvp: true, passwordHash: '', buildVersion: '' };
  roomManager.openRoom = async () => room; roomManager.heartbeat = async () => {}; roomManager.updatePlayerList = async () => {};
  const h = new NetHost({ engine: window.__eng, world: { id: 'w' }, user: { id: 'u-host', full_name: 'Sunni' }, onChatMessage: () => {} });
  await h.start({});
  window.__hostChat = []; h.onChatMessage = (m) => window.__hostChat.push(m);
  window.__eng.netManager = h; window.__host = h;
});
const t0 = Date.now();
const gstate = await guest.evaluate(async () => {
  const { NetClient } = await import('/src/game/net/netManager.js');
  const room = { id: 'sala1', hostId: 'u-host', hostName: 'Sunni', worldName: 'Teste', passwordHash: '', buildVersion: '', playerNames: ['Sunni'], maxPlayers: 8 };
  const states = [];
  const c = new NetClient({ engine: window.__eng, world: {}, user: { id: 'u-guest', full_name: 'Miguel' }, room, onStateChange: (s) => states.push(s), onChatMessage: () => {} });
  window.__guestChat = []; c.onChatMessage = (m) => window.__guestChat.push(m);
  window.__eng.netManager = c; window.__client = c; window.__states = states;
  await c.connect('');
  for (let i = 0; i < 300 && !states.includes('connected'); i++) await new Promise((r) => setTimeout(r, 100));
  return states;
});
const msConexao = Date.now() - t0;
const traceG = await guest.evaluate(() => window.__client.conn.trace), traceH = await host.evaluate(() => [...window.__host.peers.values()].map((p) => p.conn.trace)[0] || []);
out.push('INFO convidado: ' + traceG.map((x) => x[0] + '@' + x[1]).join(' '));
out.push('INFO host: ' + traceH.map((x) => x[0] + '@' + x[1]).join(' '));
ok(gstate.includes('connected'), `o convidado conecta ao host por WebRTC de verdade (estados: ${gstate.join(' → ')}) em ${msConexao} ms`);

// ---- deixa os dois jogarem alguns ticks e o host mandar a lista (a cada 2 s)
await Promise.all([host, guest].map((p) => p.evaluate(async () => { for (let i = 0; i < 90; i++) { window.__eng.tick(); await new Promise((r) => setTimeout(r, 40)); } window.__eng.emitHud(); })));
await new Promise((r) => setTimeout(r, 2500));
await Promise.all([host, guest].map((p) => p.evaluate(() => { for (let i = 0; i < 5; i++) window.__eng.tick(); window.__eng._lastHudSig = null; window.__eng.emitHud(); })));
const H = await host.evaluate(() => ({ peers: window.__host.peers.size, nomesPeers: [...window.__host.peers.values()].map((p) => p.name), tab: (window.__eng._lastHud.pings || []).map((p) => p.name), eu: window.__eng._lastHud.selfName, remotos: [...(window.__host.remotePlayers || new Map()).values()].map((p) => p.name) }));
const G = await guest.evaluate(() => ({ tab: (window.__eng._lastHud.pings || []).map((p) => p.name), eu: window.__eng._lastHud.selfName, remotos: [...(window.__client.remotePlayers || new Map()).values()].map((p) => p.name), estado: window.__states.slice(-1)[0] }));
ok(H.peers === 1 && H.nomesPeers[0] === 'Miguel', `o host tem 1 convidado conectado (${H.nomesPeers.join(',')})`);
ok(H.tab.includes('Sunni') && H.tab.includes('Miguel'), `TAB do HOST lista os dois: ${H.tab.join(', ')} (eu = ${H.eu})`);
ok(G.tab.includes('Sunni') && G.tab.includes('Miguel'), `TAB do CONVIDADO lista os dois: ${G.tab.join(', ')} (eu = ${G.eu})`);
ok(H.remotos.includes('Miguel') && G.remotos.includes('Sunni'), `cada um vê o outro no mundo com o nome certo (host vê: ${H.remotos.join(',')}; convidado vê: ${G.remotos.join(',')})`);

// ---- skin escolhida chega ao outro navegador (a do convidado é Alex, a do host é Steve) e a pose vai na hora: agachar, item na mão, golpe
await guest.evaluate(async () => {
  const SS = await import('/src/game/skinStore.js');
  SS.setSkinChoice({ kind: 'alex' });          // dispara o reenvio da skin
  const e = window.__eng; e.isAction = (a) => a === 'sneak'; e.player.hotbar[0] = { id: 276, count: 1, meta: 0 }; e.player.selectedSlot = 0; e._swing();
});
await Promise.all([host, guest].map((p) => p.evaluate(async () => { for (let i = 0; i < 30; i++) { window.__eng.tick(); await new Promise((r) => setTimeout(r, 40)); } })));
await new Promise((r) => setTimeout(r, 1500));
await host.bringToFront(); await new Promise((r) => setTimeout(r, 900));   // aba em segundo plano não desenha: o modelo só recebe a skin ao ser desenhado
const SK = {
  host: await host.evaluate(() => { const e = window.__eng, m = e._remoteSkinById && e._remoteSkinById.get('u-guest'), rp = window.__host.remotePlayers.get('u-guest'), en = e._remoteMeshes && e._remoteMeshes.get('u-guest'); return { skin: m ? { slim: m.slim, tem: !!m.tex } : null, aplicada: !!(en && en._skinApplied), sneaking: rp.sneaking, held: rp.held, swing: rp.swingCount, swingVisto: en ? en.swingCount : null }; }),
  guest: await (async () => { await guest.bringToFront(); await new Promise((r) => setTimeout(r, 900)); return guest; })().then((g) => g.evaluate(() => { const e = window.__eng, m = e._remoteSkinById && e._remoteSkinById.get('u-host'), en = e._remoteMeshes && e._remoteMeshes.get('u-host'); return { skin: m ? { slim: m.slim, tem: !!m.tex } : null, aplicada: !!(en && en._skinApplied) }; })),
};
ok(SK.host.skin && SK.host.skin.tem && SK.host.skin.slim === true && SK.host.aplicada, `o host vê a skin Alex do convidado, aplicada no modelo (${JSON.stringify(SK.host.skin)}, aplicada: ${SK.host.aplicada})`);
ok(SK.guest.skin && SK.guest.skin.tem && SK.guest.skin.slim === false && SK.guest.aplicada, `o convidado vê a skin Steve do host, aplicada no modelo (${JSON.stringify(SK.guest.skin)}, aplicada: ${SK.guest.aplicada})`);
ok(SK.host.sneaking === true && SK.host.held === 276 && SK.host.swing >= 1, `pose do convidado chega ao host: agachado (${SK.host.sneaking}), espada na mão (${SK.host.held}), golpes contados (${SK.host.swing})`);

// ---- a rachadura do bloco que o convidado quebra aparece no mundo do host, no mesmo bloco e estágio
await guest.evaluate(() => { const e = window.__eng; e.tickMining = () => {}; e.isAction = (a) => a === 'sneak' || a === 'attack'; e.miningTarget = { x: 10, y: 99, z: 10 }; e.miningProgress = 0.47; });
await Promise.all([host, guest].map((p) => p.evaluate(async () => { for (let i = 0; i < 12; i++) { window.__eng.tick(); await new Promise((r) => setTimeout(r, 40)); } })));
await host.bringToFront(); await new Promise((r) => setTimeout(r, 1500));
const DG = await host.evaluate(() => { const e = window.__eng, rp = window.__host.remotePlayers.get('u-guest'), m = e._remoteDestroy && e._remoteDestroy.get('u-guest'); return { dig: rp.dig, mesh: m ? { x: m.position.x, y: m.position.y, z: m.position.z, visivel: m.visible, textura: !!m.material.map } : null }; });
ok(DG.dig && DG.dig.x === 10 && DG.dig.y === 99 && DG.dig.stage === 4 && DG.mesh && DG.mesh.visivel && DG.mesh.textura && DG.mesh.x === 10.5, `o host vê a rachadura do convidado no bloco certo (${JSON.stringify(DG.dig)}), estágio 4, com a textura de destroy_stage (malha visível: ${DG.mesh && DG.mesh.visivel})`);
await guest.evaluate(() => { const e = window.__eng; e.miningTarget = null; e.miningProgress = 0; });
await Promise.all([host, guest].map((p) => p.evaluate(async () => { for (let i = 0; i < 12; i++) { window.__eng.tick(); await new Promise((r) => setTimeout(r, 40)); } })));
await new Promise((r) => setTimeout(r, 800));
const DG2 = await host.evaluate(() => { const e = window.__eng, m = e._remoteDestroy && e._remoteDestroy.get('u-guest'); return { dig: window.__host.remotePlayers.get('u-guest').dig, visivel: m ? m.visible : null }; });
ok(DG2.dig === null && DG2.visivel === false, 'quando ele para de quebrar, a rachadura some dos outros');

// ---- chat nos dois sentidos, com o nome de quem escreveu (o ChatUI chama sendChat(nome, texto))
await guest.evaluate(() => window.__client.sendChat('Miguel', 'olá host, estou aqui'));
await host.evaluate(() => window.__host.sendChat('Sunni', 'bem-vindo, convidado'));
await new Promise((r) => setTimeout(r, 600));
const CH = { host: await host.evaluate(() => window.__hostChat), guest: await guest.evaluate(() => window.__guestChat) };
ok(CH.host.some((m) => m.user === 'Miguel' && m.text === 'olá host, estou aqui'), `o host recebe o texto do convidado, com o nome dele (${JSON.stringify(CH.host.map((m) => m.user + ': ' + m.text))})`);
ok(CH.guest.some((m) => m.user === 'Sunni' && m.text === 'bem-vindo, convidado'), `o convidado recebe o texto do host, com o nome dele (${JSON.stringify(CH.guest.map((m) => m.user + ': ' + m.text))})`);

// ---- mobs do host aparecem no convidado
await host.evaluate(() => { const e = window.__eng; e.mobs.mobs.length = 0; e.mobs.spawnSystem.tick = () => {}; e.mobs._populateNear = () => {}; e.mobs.spawn('cow', { x: 14.5, y: 100, z: 10.5 }); });
await Promise.all([host, guest].map((p) => p.evaluate(async () => { for (let i = 0; i < 40; i++) { window.__eng.tick(); await new Promise((r) => setTimeout(r, 40)); } })));
const M = await guest.evaluate(() => [...window.__eng.mobs.ghostMap.values()].map((g) => g.typeId));
ok(M.includes('cow'), `a vaca do host aparece no mundo do convidado pela conexão real (${M.join(',') || 'nenhuma'})`);

ok(errors.length === 0, `sem erro de página (${errors[0] || ''})`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
