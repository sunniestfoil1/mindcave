import { corsHeaders } from '../_shared/cors.ts';

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const iceServers: IceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: 'stun:stun.services.mozilla.com' },
    ];

    // Se variáveis de ambiente de TURN estiverem configuradas nos Secrets do Supabase:
    const customTurnUrl = Deno.env.get('TURN_URL');
    const customTurnUser = Deno.env.get('TURN_USERNAME');
    const customTurnCred = Deno.env.get('TURN_CREDENTIAL');

    if (customTurnUrl) {
      const turnUrls = customTurnUrl.split(',').map((u) => u.trim());
      const turnEntry: IceServer = { urls: turnUrls };
      if (customTurnUser) turnEntry.username = customTurnUser;
      if (customTurnCred) turnEntry.credential = customTurnCred;
      iceServers.unshift(turnEntry);
    }

    // Suporte a Coturn com credenciais efêmeras baseadas em timestamp (TURN_SECRET)
    const turnSecret = Deno.env.get('TURN_SECRET');
    const turnHost = Deno.env.get('TURN_HOST'); // ex: turn:meuserver.com:3478
    if (turnSecret && turnHost) {
      const ttl = 86400; // 24 horas
      const expiry = Math.floor(Date.now() / 1000) + ttl;
      const username = `${expiry}:mindcave_player`;

      // HMAC-SHA1
      const keyBuf = new TextEncoder().encode(turnSecret);
      const dataBuf = new TextEncoder().encode(username);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuf,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuf);
      const credential = btoa(String.fromCharCode(...new Uint8Array(signature)));

      iceServers.unshift({
        urls: [turnHost, turnHost.replace('turn:', 'turns:').replace('3478', '5349')],
        username,
        credential,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        iceServers,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
        status: 200,
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
