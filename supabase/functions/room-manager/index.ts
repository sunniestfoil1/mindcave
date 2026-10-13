import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';

interface RoomPayload {
  action: 'create' | 'validate-join' | 'heartbeat' | 'close';
  roomId?: string;
  userId?: string;
  userName?: string;
  password?: string;
  roomData?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getAdminClient();
    const body: RoomPayload = await req.json().catch(() => ({ action: 'heartbeat' as const }));
    const { action, roomId, userId, userName, password, roomData } = body;

    switch (action) {
      case 'create': {
        if (!roomData) {
          return new Response(JSON.stringify({ error: 'roomData é obrigatório para criação' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
        const { data, error } = await supabase
          .from('rooms')
          .insert({
            ...roomData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, room: data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'validate-join': {
        if (!roomId || !userId) {
          return new Response(JSON.stringify({ error: 'roomId e userId são obrigatórios' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const { data: room, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .maybeSingle();

        if (error || !room) {
          return new Response(JSON.stringify({ allowed: false, reason: 'Sala não encontrada' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
          });
        }

        // 1. Checa se sala está cheia
        const currentPlayers = Array.isArray(room.players) ? room.players : [];
        const maxPlayers = room.maxPlayers || room.max_players || 8;
        if (currentPlayers.length >= maxPlayers && !currentPlayers.includes(userName)) {
          return new Response(JSON.stringify({ allowed: false, reason: 'Sala lotada' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }

        // 2. Checa senha
        if (room.password && room.password !== password) {
          return new Response(JSON.stringify({ allowed: false, reason: 'Senha incorreta' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }

        // 3. Checa banimento
        const banned = Array.isArray(room.banned) ? room.banned : [];
        if (banned.some((b: any) => b === userId || b?.userId === userId)) {
          return new Response(JSON.stringify({ allowed: false, reason: 'Você foi banido desta sala' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }

        // 4. Checa whitelist
        if (room.whitelistEnabled && Array.isArray(room.whitelist)) {
          if (!room.whitelist.includes(userId)) {
            return new Response(JSON.stringify({ allowed: false, reason: 'Você não está na lista de permissões' }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            });
          }
        }

        return new Response(JSON.stringify({ allowed: true, room }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'heartbeat': {
        if (!roomId) {
          return new Response(JSON.stringify({ error: 'roomId é obrigatório' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        const { error } = await supabase
          .from('rooms')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', roomId);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, timestamp: Date.now() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'close': {
        if (!roomId) {
          return new Response(JSON.stringify({ error: 'roomId é obrigatório' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }

        await supabase.from('rooms').delete().eq('id', roomId);
        await supabase.from('signals').delete().eq('roomid', roomId);

        return new Response(JSON.stringify({ success: true, closedRoomId: roomId }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Ação não suportada' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
