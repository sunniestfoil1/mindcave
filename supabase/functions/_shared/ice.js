// Monta a lista de servidores ICE (STUN + TURN) para o jogo online. Funções puras (sem Deno nem rede), para o teste de Node importar igual à função da Supabase.
// TURN é o que faz o jogo conectar quando o jogador ou o host está atrás de NAT simétrico (CGNAT de operadora/provedor): só STUN não atravessa.
// Fontes de TURN, na ordem em que entram (a primeira que estiver configurada nos Secrets entra na frente das outras):
//   0) Twilio Network Traversal  → TWILIO_ACCOUNT_SID + TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (ou TWILIO_AUTH_TOKEN no lugar da chave)  (pago por GB, sem plano grátis)
//   1) Cloudflare Realtime TURN  → CF_TURN_KEY_ID + CF_TURN_API_TOKEN   (1 TB/mês grátis; cobra US$ 0,05/GB depois)
//   2) Metered                   → METERED_DOMAIN + METERED_API_KEY      (plano grátis sem cartão: só 500 MB/mês)
//   3) servidor próprio fixo     → TURN_URL (+ TURN_USERNAME, TURN_CREDENTIAL)
//   4) coturn com segredo HMAC   → TURN_HOST + TURN_SECRET
export const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.services.mozilla.com' },
];

const isTurn = (s) => [].concat(s && s.urls || []).some((u) => /^turns?:/i.test(u));

// A Cloudflare devolve { iceServers: { urls: [...], username, credential } } (objeto, não lista); a Metered devolve a lista direto
export function normalizeIceResponse(json) {
  const raw = json && (json.iceServers ?? json.ice_servers ?? json);   // Twilio devolve ice_servers (com url e urls em cada item)
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? [raw] : [];
  return list.filter((s) => s && s.urls && (isTurn(s) ? s.username && s.credential : true));
}

async function hmacSha1Base64(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// env(nome) → valor ou undefined; fetchFn = fetch. Devolve { iceServers, turn: 'cloudflare'|'metered'|'fixo'|'coturn'|null, erros: [] }
export async function buildIceServers(env, fetchFn, now = Date.now()) {
  const turnList = [];
  const erros = [];
  let fonte = null;

  const twSid = env('TWILIO_ACCOUNT_SID'), twPass = env('TWILIO_API_KEY_SECRET') || env('TWILIO_AUTH_TOKEN');
  if (twSid && twPass) {
    try {
      const user = env('TWILIO_API_KEY_SID') || twSid;   // com API Key o usuário é o SID da chave (SK...); com Auth Token, o da conta (AC...)
      const r = await fetchFn(`https://api.twilio.com/2010-04-01/Accounts/${twSid}/Tokens.json`, {
        method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${user}:${twPass}`), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'Ttl=86400',
      });
      if (!r.ok) throw new Error('Twilio HTTP ' + r.status);
      const l = normalizeIceResponse(await r.json()).filter(isTurn).map((s) => ({ urls: s.urls, username: s.username, credential: s.credential }));
      if (l.length) { turnList.push(...l); fonte = fonte || 'twilio'; } else erros.push('Twilio sem servidor TURN na resposta');
    } catch (e) { erros.push(String(e.message || e)); }
  }
  const cfKey = env('CF_TURN_KEY_ID'), cfTok = env('CF_TURN_API_TOKEN');
  if (cfKey && cfTok) {
    try {
      const r = await fetchFn(`https://rtc.live.cloudflare.com/v1/turn/keys/${cfKey}/credentials/generate-ice-servers`, {
        method: 'POST', headers: { Authorization: `Bearer ${cfTok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl: 86400 }),
      });
      if (!r.ok) throw new Error('Cloudflare HTTP ' + r.status);
      const l = normalizeIceResponse(await r.json()).filter(isTurn);
      if (l.length) { turnList.push(...l); fonte = fonte || 'cloudflare'; } else erros.push('Cloudflare sem servidor TURN na resposta');
    } catch (e) { erros.push(String(e.message || e)); }
  }
  const mDom = env('METERED_DOMAIN'), mKey = env('METERED_API_KEY');
  if (mDom && mKey) {
    try {
      const r = await fetchFn(`https://${mDom}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(mKey)}`);
      if (!r.ok) throw new Error('Metered HTTP ' + r.status);
      const l = normalizeIceResponse(await r.json()).filter(isTurn);
      if (l.length) { turnList.push(...l); fonte = fonte || 'metered'; } else erros.push('Metered sem servidor TURN na resposta');
    } catch (e) { erros.push(String(e.message || e)); }
  }
  const url = env('TURN_URL');
  if (url) {
    const entry = { urls: url.split(',').map((u) => u.trim()).filter(Boolean) };
    if (env('TURN_USERNAME')) entry.username = env('TURN_USERNAME');
    if (env('TURN_CREDENTIAL')) entry.credential = env('TURN_CREDENTIAL');
    turnList.push(entry); fonte = fonte || 'fixo';
  }
  const secret = env('TURN_SECRET'), host = env('TURN_HOST');
  if (secret && host) {
    const username = `${Math.floor(now / 1000) + 86400}:mindcave_player`;
    turnList.push({ urls: [host, host.replace('turn:', 'turns:').replace('3478', '5349')], username, credential: await hmacSha1Base64(secret, username) });
    fonte = fonte || 'coturn';
  }
  return { iceServers: [...turnList, ...STUN_SERVERS], turn: fonte, erros };
}
