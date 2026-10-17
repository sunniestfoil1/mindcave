// Entrar numa partida online e pausar: (1) Esc pausa também online (menu aberto, mundo rodando) e o chat/inventário continuam sem pausar; (2) a oferta de
// um convidado só abre UMA conexão e recebe UMA resposta; nova tentativa do mesmo jogador substitui a que nunca conectou; (3) a mensagem de falha
// diz a causa (sem relay/TURN) e a conexão só desiste aos 30 s, não aos 12 s.
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
  const { NetHost } = await import('/src/game/net/netManager.js');
  const RTC = await import('/src/game/net/webrtc.js');
  const { mindcaveApi } = await import('/src/api/supabaseClient.js');
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 110, z: 8.5 };
  const ps = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: false, sneaking: false, sprinting: false, gameMode: 'survival', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'Host', hunger: 20, saturation: 5 };
  const eng = new GameEngine(canvas, { world: cw, player: ps, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {} });
  await eng.start();
  eng.paused = false;
  for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise((r) => setTimeout(r, 250));
  eng.tick = () => {};
  const res = {};
  const esc = () => eng.onKey({ code: 'Escape', repeat: false, preventDefault() {}, target: document.body }, true);

  // ---- 1) pausa online: o jogo está aberto para a rede (netManager de host) e o Esc abre o menu
  eng.netManager = { broadcast() {}, getAllPings: () => [], user: { id: 'host' }, room: { id: 'r' } };
  esc(); res.escOnline = eng.paused;
  eng.emitHud(); res.hudPausado = !!(eng._lastHud && eng._lastHud.paused);
  esc(); res.escRetoma = eng.paused;
  eng.paused = false; eng.chatOpen = true; eng._onPLChange(); res.chatNaoPausa = eng.paused; eng.chatOpen = false;
  eng.paused = false; eng.guiOpenFn = () => true; eng._onPLChange(); res.guiNaoPausa = eng.paused; eng.guiOpenFn = () => false;
  eng._onPLChange(); res.soltarMouseOnline = eng.paused;   // o navegador devolveu o mouse (Esc com mouse travado): vira pausa
  eng.paused = false;
  eng.netManager = null; esc(); res.escSolo = eng.paused; eng.paused = false;

  // ---- 2) resposta única à oferta, no WebRTCConnection do host
  const sentSignals = [];
  const mk = () => {
    const c = new RTC.WebRTCConnection({ isHost: true, roomId: 'r1', userId: 'host', userName: 'Host', peerUserId: 'g9', peerName: 'G' });
    c._sendSignal = async (to, type) => { sentSignals.push(type); };
    let st = 'stable';
    c.pc = { get signalingState() { return st; }, async setRemoteDescription() { st = 'have-remote-offer'; }, async createAnswer() { return { sdp: 'a' }; }, async setLocalDescription() { st = 'stable'; }, remoteDescription: { type: 'offer' }, close() {}, addIceCandidate: async () => {} };
    return c;
  };
  const conn = mk();
  await conn.handleOffer('g9', 'v=0');                                   // o host responde ao abrir a conexão...
  await conn._handleSignal({ id: 'sig1', type: 'offer', data: 'v=0', fromUserId: 'g9' });   // ...e o mesmo sinal chega de novo pelo canal em tempo real
  res.respostas = sentSignals.filter((t) => t === 'answer').length;

  // ---- 3) NetHost: a mesma oferta duas vezes abre 1 conexão; nova tentativa do mesmo jogador troca a que não conectou
  const updates = [];
  const origUpdate = mindcaveApi.entities.Signal.update;
  mindcaveApi.entities.Signal.update = async (id, patch) => { updates.push(id); return {}; };
  const host = new NetHost({ engine: eng, world: {}, user: { id: 'host', full_name: 'Host' } });
  host.room = { id: 'r1', maxPlayers: 8, banned: '[]', whitelistEnabled: false, whitelist: [], ops: [] };
  const sigA = { id: 'sA', fromUserId: 'g9', fromName: 'Miguel', type: 'offer', data: 'v=0', consumed: false };
  await Promise.all([host._handleNewPeer(sigA), host._handleNewPeer({ ...sigA })]);
  res.aberturas = updates.filter((i) => i === 'sA').length;
  const first = host.peers.get('g9') && host.peers.get('g9').conn;
  await host._handleNewPeer({ id: 'sB', fromUserId: 'g9', fromName: 'Miguel', type: 'offer', data: 'v=0', consumed: false });
  const second = host.peers.get('g9') && host.peers.get('g9').conn;
  res.troca = { temPrimeira: !!first, temSegunda: !!second, diferentes: !!first && !!second && first !== second, primeiraFechada: !!first && first._closed === true, peers: host.peers.size };
  mindcaveApi.entities.Signal.update = origUpdate;
  for (const p of host.peers.values()) { try { p.conn.close(); } catch { /* ok */ } }

  // ---- 4) mensagem de falha e limite de tempo
  res.msgSemRelay = RTC.explainFailure({ hasRelay: false, types: ['host', 'srflx'], srflx: 2 });
  res.msgComRelay = RTC.explainFailure({ hasRelay: true, types: ['host', 'srflx', 'relay'], srflx: 1 });
  res.msgVazia = RTC.explainFailure(null);
  const c2 = new RTC.WebRTCConnection({ isHost: false, roomId: 'r', userId: 'g', userName: 'g', peerUserId: 'h', peerName: 'h' });
  c2._noteCandidate({ type: 'srflx', address: '203.0.113.5', port: 5000 }); c2._noteCandidate({ type: 'srflx', address: '203.0.113.5', port: 5001 }); c2._noteCandidate({ type: 'host', address: 'x.local', port: 1 });
  res.diag = c2.failureInfo();
  const t0 = Date.now(); let fired = null; c2.onStateChange = (s) => { if (s === 'failed') fired = Date.now() - t0; };
  c2.state = 'connecting'; c2.pc = { close() {} }; c2._listenSignals();
  await new Promise((r) => setTimeout(r, 13500));   // passou dos 12 s antigos: ainda tem de estar tentando
  res.aos13s = { estado: c2.state, falhou: fired !== null };
  c2._closed = true; c2._stopSignalListeners();
  return res;
});
ok(r.escOnline === true && r.hudPausado === true, `online: Esc abre o menu de pausa (${r.escOnline}) e o HUD mostra a pausa (${r.hudPausado})`);
ok(r.escRetoma === false, 'online: o segundo Esc volta ao jogo');
ok(r.chatNaoPausa === false && r.guiNaoPausa === false, 'online: chat e inventário abertos soltam o mouse sem pausar');
ok(r.soltarMouseOnline === true, 'online: o navegador devolvendo o mouse (Esc com o mouse travado) vira pausa');
ok(r.escSolo === true, 'um jogador: o Esc continua pausando como antes');
ok(r.respostas === 1, `a oferta do convidado recebe 1 resposta só, mesmo chegando duas vezes (${r.respostas})`);
ok(r.aberturas === 1, `a mesma oferta duas vezes ao mesmo tempo abre 1 conexão (${r.aberturas})`);
ok(r.troca.diferentes && r.troca.primeiraFechada && r.troca.peers === 1, `nova tentativa do mesmo jogador troca a conexão que nunca conectou e fecha a antiga (peers: ${r.troca.peers})`);
ok(/relay \(TURN\)/.test(r.msgSemRelay) && !/relay \(TURN\)/.test(r.msgComRelay) && /esgotado/.test(r.msgVazia), 'a falha explica a causa: sem TURN fala de CGNAT e relay; com TURN fala de tempo esgotado');
ok(r.diag.srflx === 2 && r.diag.types.includes('srflx') && r.diag.types.includes('host'), `o diagnóstico guarda os tipos de candidata e os 2 endereços públicos IPv4 distintos (${r.diag.srflx})`);
ok(r.aos13s.estado === 'connecting' && !r.aos13s.falhou, 'aos 13 s a conexão ainda está tentando (o limite antigo de 12 s foi trocado por 30 s)');
ok(errors.length === 0, `sem erro de página (${errors[0] || ''})`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
