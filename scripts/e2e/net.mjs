// Comandos online: host + 2 convidados simulados (sem rede real): permissão, roteamento mundo/jogador, /fill, /clone, /time.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fail++; };
try {
  const { NetHost, NetClient } = await server.ssrLoadModule('/src/game/net/netManager.js');
  const { packState, stateId } = await server.ssrLoadModule('/src/game/chunk.js');
  const stone = packState(1, 0);

  const mkWorld = () => { const m = new Map(); return { m, setBlock(x, y, z, s) { m.set(`${x},${y},${z}`, s); }, getBlock(x, y, z) { return m.get(`${x},${y},${z}`) || 0; } }; };
  const parseCoord = (str, rel) => (!str ? rel : str.startsWith('~') ? rel + (parseFloat(str.slice(1)) || 0) : parseFloat(str));
  const mkEngine = () => ({ player: { pos: { x: 0, y: 70, z: 0 }, hotbar: new Array(9).fill(null), selectedSlot: 0, gameMode: 'survival', effects: [] }, world: mkWorld(), parseCoord, onBlockChange() {}, emitHud() {}, gameRules: {}, onChatMessage() {}, worldTime: 100, inventory: { hotbar: new Array(9).fill(null), main: new Array(27).fill(null), crafting: new Array(4).fill(null) } });

  // ---- host com 2 convidados ----
  const hostEngine = mkEngine();
  const sent = { g1: [], g2: [] };
  const host = Object.create(NetHost.prototype);
  Object.assign(host, { engine: hostEngine, room: { ops: [], allowCommands: true }, peers: new Map(), remotePlayers: new Map(), playerNames: ['Host', 'Ana', 'Bia'], onChatMessage() {}, flood: { check: () => ({ allowed: true }) } });
  for (const id of ['g1', 'g2']) host.peers.set(id, { name: id === 'g1' ? 'Ana' : 'Bia', conn: { send: (m) => sent[id].push(m) } });
  host.remotePlayers.set('g1', { x: 100.5, y: 64, z: 100.5 });
  hostEngine.netManager = host;
  const cmd = (id, text) => host._handleGuestMessage(id, id === 'g1' ? 'Ana' : 'Bia', { t: 'cmd', cmd: text });
  const last = (id) => sent[id][sent[id].length - 1];

  // convidado com mundo próprio (cópia vazia) para receber as mensagens
  const mkClient = () => { const eng = mkEngine(); const c = Object.create(NetClient.prototype); Object.assign(c, { engine: eng, onChatMessage() {}, onPlayerUpdate() {}, ignored: new Set() }); return c; };
  const c1 = mkClient(), c2 = mkClient();
  const deliver = (id, client) => { for (const m of sent[id].splice(0)) client._handleHostMessage(m); };

  // 1) /fill com coordenadas relativas à posição do CONVIDADO (não do host)
  cmd('g1', '/fill ~ ~ ~ ~2 ~ ~2 stone');
  const around = (x, y, z) => stateId(hostEngine.world.getBlock(x, y, z));
  ok(around(100, 64, 100) === 1 && around(102, 64, 102) === 1, 'fill do convidado usa a posição dele (~ = 100,64,100)');
  ok(around(0, 70, 0) === 0, 'e não a do host');
  ok(sent.g1.some(m => m.t === 'chat' && /fill: 9 blocos/.test(m.text)), 'a resposta do comando volta para o convidado que o digitou');
  ok(sent.g1.some(m => m.t === 'FILL') && sent.g2.some(m => m.t === 'FILL'), 'host difunde UMA mensagem FILL para todos os convidados');
  ok(hostEngine._cmdReply === null || hostEngine._cmdReply === undefined, 'resposta do host volta ao normal depois');
  ok(hostEngine.player.pos.x === 0 && hostEngine.player.pos.z === 0, 'posição do host restaurada após o comando');
  deliver('g1', c1); deliver('g2', c2);
  ok(stateId(c1.engine.world.getBlock(101, 64, 101)) === 1 && stateId(c2.engine.world.getBlock(102, 64, 100)) === 1, 'os dois convidados recebem a região preenchida (9 blocos)');
  ok(c2.engine.world.m.size === 9, `e só ela: ${c2.engine.world.m.size} blocos`);

  // 2) /fill keep e limite de volume
  cmd('g1', '/fill 100 64 100 101 65 101 stone 0 keep');
  deliver('g1', c1);
  ok(c1.engine.world.m.size === 9 + 4, 'modo keep preenche só onde havia ar (as 4 células de cima)');
  sent.g1.length = 0;
  cmd('g1', '/fill 0 0 0 100 100 100 stone');
  ok(last('g1') && /muito grande/.test(last('g1').text) && !sent.g1.some(m => m.t === 'FILL'), 'região acima de 32768 blocos é recusada e não é difundida');

  // 3) /clone
  sent.g1.length = 0; sent.g2.length = 0;
  cmd('g1', '/clone 100 64 100 102 64 102 200 64 200');
  ok(around(201, 64, 201) === 1, 'clone executado no host');
  deliver('g2', c2);
  ok(stateId(c2.engine.world.getBlock(201, 64, 201)) === 1 && stateId(c2.engine.world.getBlock(202, 64, 202)) === 1, 'convidado repete o clone');

  // 4) comando de JOGADOR volta para o convidado e roda no jogador dele
  sent.g1.length = 0;
  cmd('g1', '/give diamond 3');
  const run = sent.g1.find(m => m.t === 'runcmd');
  ok(!!run && run.cmd === '/give diamond 3', 'comando de jogador é devolvido ao convidado (runcmd)');
  ok(hostEngine.inventory.hotbar.every(i => !i) && hostEngine.inventory.main.every(i => !i), 'e NÃO altera o inventário do host');
  deliver('g1', c1);
  const items = [...c1.engine.inventory.hotbar, ...c1.engine.inventory.main].filter(Boolean);
  ok(items.length === 1 && items[0].count === 3, `o convidado recebe os 3 diamantes (${JSON.stringify(items[0])})`);
  // runcmd malicioso (comando de mundo) é ignorado pelo cliente
  c1.engine.world.m.clear();
  c1._handleHostMessage({ t: 'runcmd', cmd: '/fill 0 0 0 5 5 5 stone' });
  ok(c1.engine.world.m.size === 0, 'cliente ignora runcmd que não seja comando de jogador');

  // 5) /time sincroniza
  sent.g1.length = 0; sent.g2.length = 0;
  cmd('g2', '/time set 5000');
  ok(hostEngine.worldTime === 5000 && sent.g1.some(m => m.t === 'time' && m.worldTime === 5000), '/time do convidado muda o host e é difundido');

  // 6) permissão e desconhecido
  host.room.allowCommands = false; sent.g1.length = 0;
  cmd('g1', '/fill ~ ~ ~ ~ ~ ~ stone');
  ok(/permissão/.test(last('g1').text), 'sem permissão: recusado');
  host.room.ops = ['g1'];
  cmd('g1', '/fill 300 64 300 300 64 300 stone');
  ok(around(300, 64, 300) === 1, 'op (mesmo com allowCommands desligado) pode usar comandos');
  host.room.allowCommands = true; sent.g1.length = 0;
  cmd('g1', '/foobar');
  ok(/desconhecido/.test(last('g1').text), 'comando desconhecido: avisa');

  // 7) mensagens FILL/CLONE malformadas ou enormes são ignoradas no cliente
  const before = c2.engine.world.m.size;
  c2._handleHostMessage({ t: 'FILL', x1: 0, y1: 0, z1: 0, x2: 999, y2: 999, z2: 999, blockState: stone });
  c2._handleHostMessage({ t: 'FILL', x1: 'a', y1: 0, z1: 0, x2: 1, y2: 1, z2: 1, blockState: stone });
  c2._handleHostMessage({ t: 'CLONE', x1: 0, y1: 0, z1: 0, x2: 1, y2: 1, z2: 1 });
  ok(c2.engine.world.m.size === before, 'FILL/CLONE inválidos ou gigantes são ignorados pelo convidado');
} catch (e) { console.log('ERRO', e.message, (e.stack || '').split(String.fromCharCode(10)).slice(0, 5).join(' | ')); fail++; }
await server.close();
process.exit(fail ? 1 : 0);
