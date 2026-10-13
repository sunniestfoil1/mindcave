import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

interface ChunkDeltaItem {
  cx: number;
  cz: number;
  data: string | { b64: string };
}

interface SyncDeltaPayload {
  worldId: string;
  deltas: ChunkDeltaItem[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getAdminClient();
    const body: SyncDeltaPayload = await req.json();
    const { worldId, deltas } = body;

    if (!worldId || !Array.isArray(deltas) || deltas.length === 0) {
      return new Response(JSON.stringify({ error: 'worldId e deltas são obrigatórios' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const rowsToUpsert = deltas.map((item) => {
      const b64Data = typeof item.data === 'string' ? item.data : item.data?.b64;
      return {
        id: `${worldId}_${item.cx}_${item.cz}`,
        world_id: worldId,
        cx: item.cx,
        cz: item.cz,
        data: { b64: b64Data },
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from('chunk_deltas')
      .upsert(rowsToUpsert, { onConflict: 'id' })
      .select('id');

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        savedCount: data?.length ?? rowsToUpsert.length,
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
