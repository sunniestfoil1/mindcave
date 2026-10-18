import { corsHeaders } from '../_shared/cors.ts';
// @ts-ignore: módulo JS puro, o mesmo que o teste de Node importa
import { buildIceServers } from '../_shared/ice.js';

// As credenciais valem 24 h: uma por instância da função a cada 5 min basta (cada jogador que abre a página pedia uma nova ao Twilio/Cloudflare)
let cache: { t: number; v: { iceServers: unknown[]; turn: string | null; erros: string[] } } | null = null;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Cloudflare / Metered / servidor fixo / coturn: o que estiver nos Secrets entra na frente do pool de STUN (ver _shared/ice.js)
    if (!cache || Date.now() - cache.t > 5 * 60 * 1000 || (cache.v.turn === null && Date.now() - cache.t > 20 * 1000)) {   // sem TURN (falha) tenta de novo em 20 s
      cache = { t: Date.now(), v: await buildIceServers((k: string) => Deno.env.get(k), fetch) };
    }
    const { iceServers, turn, erros } = cache.v;

    return new Response(
      JSON.stringify({
        success: true,
        iceServers,
        turn,          // null = só STUN (NAT simétrico/CGNAT não conecta); senão a fonte do relay
        erros,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          // credencial de TURN dura 24 h; 5 min de cache no navegador evita pedir a cada entrada
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
