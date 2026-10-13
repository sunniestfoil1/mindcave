import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

interface DeathPayload {
  worldId: string;
  userId: string;
  playerName: string;
  message: string;
  cause?: string;
  killer?: string;
  x?: number;
  y?: number;
  z?: number;
  itemsLost?: unknown[];
  xpLevel?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getAdminClient();
    const body: DeathPayload = await req.json();
    const {
      worldId,
      userId,
      playerName,
      message,
      cause = 'unknown',
      killer = null,
      x = 0,
      y = 0,
      z = 0,
      itemsLost = [],
      xpLevel = 0,
    } = body;

    if (!worldId || !userId || !playerName || !message) {
      return new Response(
        JSON.stringify({ error: 'worldId, userId, playerName e message são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 1. Insere o registro de morte
    const { data: deathRecord, error: insertError } = await supabase
      .from('player_deaths')
      .insert({
        world_id: worldId,
        user_id: userId,
        player_name: playerName,
        message,
        cause,
        killer,
        x,
        y,
        z,
        items_lost: itemsLost,
        xp_level: xpLevel,
      })
      .select()
      .single();

    if (insertError) {
      console.warn('[player-death-logger] Erro ao registrar na player_deaths:', insertError);
    }

    // 2. Incrementa mortes no perfil se existir
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_deaths')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        await supabase
          .from('profiles')
          .update({
            total_deaths: (profile.total_deaths || 0) + 1,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', userId);
      }
    } catch {}

    // 3. Atualiza estado de morte na tabela players
    try {
      const playerId = `${worldId}_${userId}`;
      const { data: playerRow } = await supabase
        .from('players')
        .select('deaths')
        .eq('id', playerId)
        .maybeSingle();

      if (playerRow) {
        await supabase
          .from('players')
          .update({
            deaths: (playerRow.deaths || 0) + 1,
            is_dead: true,
            last_death_at: new Date().toISOString(),
          })
          .eq('id', playerId);
      }
    } catch {}

    return new Response(
      JSON.stringify({
        success: true,
        deathId: deathRecord?.id ?? null,
        message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
