import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getAdminClient();
    const now = Date.now();
    const consumedCutoff = new Date(now - 60 * 1000).toISOString(); // 1 minuto
    const staleCutoff = new Date(now - 5 * 60 * 1000).toISOString(); // 5 minutos

    // 1. Limpa sinais consumidos com mais de 60 segundos
    const { count: consumedCount, error: err1 } = await supabase
      .from('signals')
      .delete({ count: 'exact' })
      .eq('consumed', true)
      .lt('created_date', consumedCutoff);

    if (err1) {
      console.warn('[clean-signals] Erro ao deletar sinais consumidos:', err1);
    }

    // 2. Limpa sinais não-consumidos antigos / abandonados (mais de 5 min)
    const { count: staleCount, error: err2 } = await supabase
      .from('signals')
      .delete({ count: 'exact' })
      .lt('created_date', staleCutoff);

    if (err2) {
      console.warn('[clean-signals] Erro ao deletar sinais abandonados:', err2);
    }

    return new Response(
      JSON.stringify({
        success: true,
        cleaned: {
          consumedSignals: consumedCount ?? 0,
          staleSignals: staleCount ?? 0,
          timestamp: new Date().toISOString(),
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
