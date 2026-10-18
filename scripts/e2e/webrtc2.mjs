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
  window.__eng.netManager = h; window.__host = h;
});
const t0 = Date.now();
const gstate = await guest.evaluate(async () => {
  const { NetClient } = await import('/src/game/net/netManager.js');
  const room = { id: 'sala1', hostId: 'u-host', hostName: 'Sunni', worldName: 'Teste', passwordHash: '', buildVersion: '', playerNames: ['Sunni'], maxPlayers: 8 };
  const states = [];
  const c = new NetClient({ engine: window.__eng, world: {}, user: { id: 'u-guest', full_name: 'Miguel' }, room, onStateChange: (s) => states.push(s), onChatMessage: () => {} });
  window.__eng.netManager = c; window.__client = c; window.__states = states;
  await c.connect('');
  for (let i = 0; i < 300 && !states.includes('connected'); i++) await new Promise((r) => setTimeout(r, 100));
  return states;
});
const msConexao = Date.now() - t0;
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

// ---- mobs do host aparecem no convidado
await host.evaluate(() => { const e = window.__eng; e.mobs.mobs.length = 0; e.mobs.spawnSystem.tick = () => {}; e.mobs._populateNear = () => {}; e.mobs.spawn('cow', { x: 14.5, y: 100, z: 10.5 }); });
await Promise.all([host, guest].map((p) => p.evaluate(async () => { for (let i = 0; i < 40; i++) { window.__eng.tick(); await new Promise((r) => setTimeout(r, 40)); } })));
const M = await guest.evaluate(() => [...window.__eng.mobs.ghostMap.values()].map((g) => g.typeId));
ok(M.includes('cow'), `a vaca do host aparece no mundo do convidado pela conexão real (${M.join(',') || 'nenhuma'})`);

ok(errors.length === 0, `sem erro de página (${errors[0] || ''})`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
