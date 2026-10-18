// Servidores ICE do jogo online (lógica pura, a mesma que a função webrtc-turn da Supabase usa): sem Secrets só STUN (NAT simétrico/CGNAT não conecta);
// com Cloudflare, Metered, servidor fixo ou coturn o relay (TURN) entra na frente; falha de uma fonte não derruba as outras.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const I = await import(pathToFileURL(root + '/supabase/functions/_shared/ice.js').href);
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
const env = (o) => (k) => o[k];
const isTurn = (s) => [].concat(s.urls).some((u) => /^turns?:/.test(u));
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

{ const r = await I.buildIceServers(env({}), async () => { throw new Error('não devia chamar'); });
  ok(r.turn === null && r.iceServers.length === I.STUN_SERVERS.length && !r.iceServers.some(isTurn) && r.erros.length === 0, 'sem Secrets: só os 7 STUN, turn = null e nenhuma chamada de rede'); }

{ const calls = []; const r = await I.buildIceServers(env({ CF_TURN_KEY_ID: 'k1', CF_TURN_API_TOKEN: 't1' }), async (u, o) => { calls.push([u, o]); return resp(200, { iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }, { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:5349?transport=tcp'], username: 'u', credential: 'c' }] }); });
  ok(r.turn === 'cloudflare' && isTurn(r.iceServers[0]) && r.iceServers[0].username === 'u' && r.iceServers.length === 1 + I.STUN_SERVERS.length, 'Cloudflare: o relay entra na frente (resposta em lista, com o STUN da Cloudflare descartado) e os STUN seguem depois');
  ok(calls[0][0].endsWith('/v1/turn/keys/k1/credentials/generate-ice-servers') && calls[0][1].method === 'POST' && calls[0][1].headers.Authorization === 'Bearer t1' && JSON.parse(calls[0][1].body).ttl === 86400, 'Cloudflare: pede a credencial no endereço certo, com o token no cabeçalho e validade de 24 h'); }

{ const r = await I.buildIceServers(env({ CF_TURN_KEY_ID: 'k1', CF_TURN_API_TOKEN: 'ruim' }), async () => resp(401, {}));
  ok(r.turn === null && r.erros.length === 1 && /401/.test(r.erros[0]) && !r.iceServers.some(isTurn), 'Cloudflare recusou (401): cai para STUN e devolve o motivo em "erros", sem derrubar a função'); }

{ const r = await I.buildIceServers(env({ METERED_DOMAIN: 'meujogo', METERED_API_KEY: 'abc' }), async (u) => { ok(u === 'https://meujogo.metered.live/api/v1/turn/credentials?apiKey=abc', 'Metered: endereço montado com domínio e chave'); return resp(200, [{ urls: 'stun:stun.relay.metered.ca:80' }, { urls: 'turn:global.relay.metered.ca:80', username: 'a', credential: 'b' }, { urls: 'turn:sem-credencial.example:80' }]); });
  ok(r.turn === 'metered' && r.iceServers.filter(isTurn).length === 1, 'Metered: entra só o TURN com usuário e senha (o sem credencial é descartado)'); }

{ const r = await I.buildIceServers(env({ TURN_URL: 'turn:a.example:3478, turns:a.example:5349', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'p' }), async () => { throw new Error('x'); });
  ok(r.turn === 'fixo' && r.iceServers[0].urls.length === 2 && r.iceServers[0].username === 'u' && r.iceServers[0].credential === 'p', 'servidor fixo (TURN_URL): lista separada por vírgula vira 2 endereços com usuário e senha'); }

{ const r1 = await I.buildIceServers(env({ TURN_HOST: 'turn:t.example:3478', TURN_SECRET: 'segredo' }), null, 1_700_000_000_000);
  const r2 = await I.buildIceServers(env({ TURN_HOST: 'turn:t.example:3478', TURN_SECRET: 'segredo' }), null, 1_700_000_000_000);
  const e = r1.iceServers[0];
  ok(r1.turn === 'coturn' && e.username === '1700086400:mindcave_player' && e.credential === r2.iceServers[0].credential && e.credential.length === 28 && e.urls[1] === 'turns:t.example:5349', 'coturn com segredo: usuário = validade + nome, credencial HMAC-SHA1 de 28 letras, igual nas duas chamadas, e a versão turns na porta 5349'); }

{ const r = await I.buildIceServers(env({ CF_TURN_KEY_ID: 'k', CF_TURN_API_TOKEN: 't', TURN_URL: 'turn:b.example:3478' }), async () => resp(200, { iceServers: { urls: ['turn:cf.example:3478'], username: 'u', credential: 'c' } }));
  ok(r.turn === 'cloudflare' && r.iceServers[0].urls[0] === 'turn:cf.example:3478' && r.iceServers[1].urls[0] === 'turn:b.example:3478', 'com duas fontes, a primeira configurada (Cloudflare) vem na frente da segunda (fixo)'); }

ok(I.normalizeIceResponse(null).length === 0 && I.normalizeIceResponse({}).length === 0 && I.normalizeIceResponse({ iceServers: [{ urls: 'stun:x' }] }).length === 1, 'resposta vazia ou estranha não quebra: lista vazia');
console.log(out.join('\n'));
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
