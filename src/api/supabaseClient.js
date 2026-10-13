import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ddwdgwaliywymcatdekg.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkd2Rnd2FsaXl3eW1jYXRkZWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTUyMjAsImV4cCI6MjEwNjk3MTIyMH0.z-05nXHR43lehL86jV6CD3fQ1aF2NHIkz0LRrHlMZMk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});

function normalizeRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    worldId: row.worldid || row.worldId || row.world_id,
    worldName: row.worldname || row.worldName || row.world_name,
    hostId: row.hostid || row.hostId || row.host_id,
    hostName: row.hostname || row.hostName || row.host_name,
    visibility: row.visibility || 'public',
    code: row.code,
    passwordHash: row.passwordhash || row.passwordHash || '',
    motd: row.motd || '',
    guestGameMode: row.guestgamemode || row.guestGameMode || 'survival',
    allowCommands: row.allowcommands ?? row.allowCommands ?? false,
    pvp: row.pvp ?? true,
    maxPlayers: row.maxplayers ?? row.maxPlayers ?? 8,
    playerCount: row.playercount ?? row.playerCount ?? 1,
    playerNames: row.playernames || row.playerNames || [],
    buildVersion: row.buildversion || row.buildVersion || '',
    lastHeartbeat: row.lastheartbeat || row.lastHeartbeat || row.created_at,
    status: row.status || 'open',
    ops: row.ops || [],
    banned: typeof row.banned === 'string' ? row.banned : JSON.stringify(row.banned || []),
    whitelist: row.whitelist || [],
    whitelistEnabled: row.whitelistenabled ?? row.whitelistEnabled ?? false,
    created_at: row.created_at || row.created_date,
  };
}

function toRoomPayload(item) {
  const payload = {};
  if (item.worldId !== undefined || item.worldid !== undefined) payload.worldid = item.worldId || item.worldid;
  if (item.worldName !== undefined || item.worldname !== undefined) payload.worldname = item.worldName || item.worldname;
  if (item.hostId !== undefined || item.hostid !== undefined) payload.hostid = item.hostId || item.hostid;
  if (item.hostName !== undefined || item.hostname !== undefined) payload.hostname = item.hostName || item.hostname;
  if (item.visibility !== undefined) payload.visibility = item.visibility;
  if (item.code !== undefined) payload.code = item.code;
  if (item.passwordHash !== undefined || item.passwordhash !== undefined) payload.passwordhash = item.passwordHash || item.passwordhash;
  if (item.motd !== undefined) payload.motd = item.motd;
  if (item.guestGameMode !== undefined || item.guestgamemode !== undefined) payload.guestgamemode = item.guestGameMode || item.guestgamemode;
  if (item.allowCommands !== undefined || item.allowcommands !== undefined) payload.allowcommands = item.allowCommands ?? item.allowcommands;
  if (item.pvp !== undefined) payload.pvp = item.pvp;
  if (item.maxPlayers !== undefined || item.maxplayers !== undefined) payload.maxplayers = item.maxPlayers ?? item.maxplayers;
  if (item.playerCount !== undefined || item.playercount !== undefined) payload.playercount = item.playerCount ?? item.playercount;
  if (item.playerNames !== undefined || item.playernames !== undefined) payload.playernames = item.playerNames || item.playernames;
  if (item.buildVersion !== undefined || item.buildversion !== undefined) payload.buildversion = item.buildVersion || item.buildversion;
  if (item.lastHeartbeat !== undefined || item.lastheartbeat !== undefined) payload.lastheartbeat = item.lastHeartbeat || item.lastheartbeat;
  if (item.status !== undefined) payload.status = item.status;
  if (item.ops !== undefined) payload.ops = item.ops;
  if (item.banned !== undefined) payload.banned = typeof item.banned === 'string' ? item.banned : JSON.stringify(item.banned);
  if (item.whitelist !== undefined) payload.whitelist = item.whitelist;
  if (item.whitelistEnabled !== undefined || item.whitelistenabled !== undefined) payload.whitelistenabled = item.whitelistEnabled ?? item.whitelistenabled;
  return payload;
}

export const mindcaveApi = {
  auth: {
    me: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Jogador',
      };
    },
    login: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    },
    signUp: async (email, password, full_name) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name } }
      });
      if (error) throw error;
      return data;
    },
    logout: async () => {
      await supabase.auth.signOut();
    }
  },
  entities: {
    Room: {
      get: async (id) => {
        const { data, error } = await supabase.from('rooms').select('*').eq('id', id).maybeSingle();
        if (error || !data) return null;
        return normalizeRoom(data);
      },
      filter: async (query, opts) => {
        let q = supabase.from('rooms').select('*');
        for (const [k, v] of Object.entries(query)) {
          const col = k === 'lastHeartbeat' ? 'lastheartbeat' : (k === 'worldId' ? 'worldid' : k);
          if (v && typeof v === 'object' && '$gte' in v) {
            q = q.gte(col, v.$gte);
          } else {
            q = q.eq(col, v);
          }
        }
        if (opts?.sort) {
          const desc = opts.sort.startsWith('-');
          let field = desc ? opts.sort.slice(1) : opts.sort;
          if (field === 'lastHeartbeat') field = 'lastheartbeat';
          q = q.order(field, { ascending: !desc });
        }
        if (opts?.limit) q = q.limit(opts.limit);
        const { data, error } = await q;
        if (error) return [];
        return (data || []).map(normalizeRoom);
      },
      create: async (item) => {
        const payload = toRoomPayload(item);
        const { data, error } = await supabase.from('rooms').insert(payload).select().single();
        if (error) throw error;
        return normalizeRoom(data);
      },
      update: async (id, item) => {
        const payload = toRoomPayload(item);
        const { data, error } = await supabase.from('rooms').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return normalizeRoom(data);
      },
      delete: async (id) => {
        const { error } = await supabase.from('rooms').delete().eq('id', id);
        if (error) throw error;
      },
      subscribe: (callback) => {
        try {
          const channel = supabase.channel('rooms_channel_' + Math.random().toString(36).slice(2));
          const sub = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, (payload) => {
            const raw = payload.new || payload.old;
            callback({ type: payload.eventType.toLowerCase(), data: raw ? normalizeRoom(raw) : null });
          });
          sub.subscribe();
          return () => {
            try { supabase.removeChannel(channel); } catch {}
          };
        } catch (e) {
          console.warn('[Supabase] Channel subscribe error:', e);
          return () => {};
        }
      }
    },
    Signal: {
      get: async (id) => {
        const { data } = await supabase.from('signals').select('*').eq('id', id).maybeSingle();
        if (!data) return null;
        let rawData = data.data;
        if (rawData && typeof rawData === 'object' && 'sdp' in rawData && Object.keys(rawData).length === 1) {
          rawData = rawData.sdp;
        }
        return {
          id: data.id,
          roomId: data.roomid,
          fromUserId: data.fromuserid,
          fromName: data.fromname,
          toUserId: data.touserid,
          type: data.type,
          data: rawData,
          consumed: data.consumed,
          created_date: data.created_date,
        };
      },
      filter: async (query, opts) => {
        let q = supabase.from('signals').select('*');
        if (query.roomId) q = q.eq('roomid', query.roomId);
        if (query.toUserId) q = q.eq('touserid', query.toUserId);
        if (query.fromUserId) q = q.eq('fromuserid', query.fromUserId);
        if (query.type) q = q.eq('type', query.type);
        if (typeof query.consumed === 'boolean') q = q.eq('consumed', query.consumed);
        if (opts?.limit) q = q.limit(opts.limit);
        const { data, error } = await q;
        if (error) return [];
        return (data || []).map(d => {
          let rawData = d.data;
          if (rawData && typeof rawData === 'object' && 'sdp' in rawData && Object.keys(rawData).length === 1) {
            rawData = rawData.sdp;
          }
          return {
            id: d.id,
            roomId: d.roomid,
            fromUserId: d.fromuserid,
            fromName: d.fromname,
            toUserId: d.touserid,
            type: d.type,
            data: rawData,
            consumed: d.consumed,
            created_date: d.created_date,
          };
        });
      },
      create: async (item) => {
        let jsonbData = item.data;
        if (typeof item.data === 'string') {
          try {
            jsonbData = JSON.parse(item.data);
          } catch {
            jsonbData = { sdp: item.data };
          }
        }
        const payload = {
          roomid: item.roomId || item.roomid,
          fromuserid: item.fromUserId || item.fromuserid,
          fromname: item.fromName || item.fromname,
          touserid: item.toUserId || item.touserid,
          type: item.type,
          data: jsonbData,
          consumed: item.consumed ?? false,
        };
        const { data, error } = await supabase.from('signals').insert(payload).select().single();
        if (error) {
          console.error('[Supabase Signal Create Error]', error);
          throw error;
        }
        let rawData = data.data;
        if (rawData && typeof rawData === 'object' && 'sdp' in rawData && Object.keys(rawData).length === 1) {
          rawData = rawData.sdp;
        }
        return {
          id: data.id,
          roomId: data.roomid,
          fromUserId: data.fromuserid,
          fromName: data.fromname,
          toUserId: data.touserid,
          type: data.type,
          data: rawData,
          consumed: data.consumed,
          created_date: data.created_date,
        };
      },
      update: async (id, item) => {
        const payload = {};
        if (item.consumed !== undefined) payload.consumed = item.consumed;
        const { data, error } = await supabase.from('signals').update(payload).eq('id', id).select().single();
        if (error) return item;
        let rawData = data.data;
        if (rawData && typeof rawData === 'object' && 'sdp' in rawData && Object.keys(rawData).length === 1) {
          rawData = rawData.sdp;
        }
        return {
          id: data.id,
          roomId: data.roomid,
          fromUserId: data.fromuserid,
          fromName: data.fromname,
          toUserId: data.touserid,
          type: data.type,
          data: rawData,
          consumed: data.consumed,
          created_date: data.created_date,
        };
      },
      delete: async (id) => {
        await supabase.from('signals').delete().eq('id', id);
      },
      subscribe: (callback) => {
        try {
          const channel = supabase.channel('signals_channel_' + Math.random().toString(36).slice(2));
          const sub = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'signals' }, (payload) => {
            const row = payload.new || payload.old;
            if (!row) return;
            let rawData = row.data;
            if (rawData && typeof rawData === 'object' && 'sdp' in rawData && Object.keys(rawData).length === 1) {
              rawData = rawData.sdp;
            }
            const mapped = {
              id: row.id,
              roomId: row.roomid,
              fromUserId: row.fromuserid,
              fromName: row.fromname,
              toUserId: row.touserid,
              type: row.type,
              data: rawData,
              consumed: row.consumed,
              created_date: row.created_date,
            };
            callback({ type: payload.eventType.toLowerCase(), data: mapped });
          });
          sub.subscribe();
          return () => {
            try { supabase.removeChannel(channel); } catch {}
          };
        } catch {
          return () => {};
        }
      }
    },
    GameSettings: {
      get: async (id) => null,
      filter: async (query) => [],
      create: async (item) => item,
      update: async (id, item) => item,
      delete: async (id) => {},
      subscribe: (callback) => () => {}
    },
    PlayerStats: {
      filter: async (query) => {
        let q = supabase.from('player_stats').select('*');
        for (const [k, v] of Object.entries(query)) {
          q = q.eq(k, v);
        }
        const { data, error } = await q;
        if (error) return [];
        return data || [];
      },
      create: async (item) => {
        const { data, error } = await supabase.from('player_stats').insert(item).select().single();
        if (error) throw error;
        return data;
      },
      update: async (id, item) => {
        const { data, error } = await supabase.from('player_stats').update(item).eq('id', id).select().single();
        if (error) throw error;
        return data;
      },
      subscribe: (callback) => () => {}
    },
    LobbyMessage: {
      get: async (id) => {
        const { data } = await supabase.from('lobby_messages').select('*').eq('id', id).maybeSingle();
        if (!data) return null;
        return {
          id: data.id,
          userId: data.userid,
          userName: data.username,
          text: data.message,
          created_at: data.created_date,
        };
      },
      filter: async (query, opts) => {
        try {
          let q = supabase.from('lobby_messages').select('*');
          if (opts?.sort) {
            q = q.order('created_date', { ascending: false });
          }
          if (opts?.limit) q = q.limit(opts.limit);
          const { data, error } = await q;
          if (error) return [];
          return (data || []).map(d => ({
            id: d.id,
            userId: d.userid,
            userName: d.username,
            text: d.message,
            created_at: d.created_date,
          }));
        } catch {
          return [];
        }
      },
      create: async (item) => {
        try {
          const payload = {
            userid: item.userId || item.userid,
            username: item.userName || item.username || 'Player',
            message: item.text || item.message || '',
          };
          const { data, error } = await supabase.from('lobby_messages').insert(payload).select().single();
          if (error) return item;
          return {
            id: data.id,
            userId: data.userid,
            userName: data.username,
            text: data.message,
            created_at: data.created_date,
          };
        } catch {
          return item;
        }
      },
      update: async (id, item) => item,
      delete: async (id) => {},
      subscribe: (callback) => {
        try {
          const channel = supabase.channel('lobby_messages_channel_' + Math.random().toString(36).slice(2));
          const sub = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_messages' }, (payload) => {
            const row = payload.new || payload.old;
            if (!row) return;
            const mapped = {
              id: row.id,
              userId: row.userid,
              userName: row.username,
              text: row.message,
              created_at: row.created_date,
            };
            callback({ type: payload.eventType.toLowerCase(), data: mapped });
          });
          sub.subscribe();
          return () => {
            try { supabase.removeChannel(channel); } catch {}
          };
        } catch (e) {
          return () => {};
        }
      }
    },
    CommunityFeedback: {
      list: async () => {
        try {
          const { data, error } = await supabase
            .from('community_feedback')
            .select('*')
            .order('created_at', { ascending: false });
          if (!error && data) {
            try { localStorage.setItem('mindcave_feedback_cache', JSON.stringify(data)); } catch {}
            return data;
          }
        } catch {}
        // Fallback do localStorage
        try {
          const cached = localStorage.getItem('mindcave_feedback_cache');
          if (cached) return JSON.parse(cached);
        } catch {}
        return [];
      },
      create: async (item) => {
        const payload = {
          user_id: item.userId || item.user_id || 'anon',
          user_name: item.userName || item.user_name || 'Jogador',
          type: item.type || 'bug',
          title: item.title,
          description: item.description,
          status: 'open',
          votes: 1,
        };
        try {
          const { data, error } = await supabase
            .from('community_feedback')
            .insert(payload)
            .select()
            .single();
          if (!error && data) return data;
        } catch {}
        // Fallback local
        const localItem = {
          id: 'local_' + Math.random().toString(36).slice(2),
          ...payload,
          created_at: new Date().toISOString(),
        };
        try {
          const existing = JSON.parse(localStorage.getItem('mindcave_feedback_cache') || '[]');
          existing.unshift(localItem);
          localStorage.setItem('mindcave_feedback_cache', JSON.stringify(existing));
        } catch {}
        return localItem;
      },
      upvote: async (id) => {
        try {
          const { data: cur } = await supabase
            .from('community_feedback')
            .select('votes')
            .eq('id', id)
            .maybeSingle();
          if (cur) {
            await supabase
              .from('community_feedback')
              .update({ votes: (cur.votes || 0) + 1 })
              .eq('id', id);
          }
        } catch {}
      },
    },
    World: {
      filter: async (query, opts) => {
        let q = supabase.from('worlds').select('*');
        for (const [k, v] of Object.entries(query)) {
          q = q.eq(k, v);
        }
        if (opts?.sort) {
          const desc = opts.sort.startsWith('-');
          const field = desc ? opts.sort.slice(1) : opts.sort;
          q = q.order(field, { ascending: !desc });
        }
        if (opts?.limit) q = q.limit(opts.limit);
        const { data, error } = await q;
        if (error) return [];
        return data || [];
      },
      create: async (item) => {
        const { sharedWith, ...cleanItem } = item;
        const { data, error } = await supabase.from('worlds').insert(cleanItem).select().single();
        if (error) throw error;
        return data;
      },
      update: async (id, item) => {
        const { sharedWith, ...cleanItem } = item;
        const { data, error } = await supabase.from('worlds').update(cleanItem).eq('id', id).select().single();
        if (error) throw error;
        return data;
      },
      delete: async (id) => {
        const { error } = await supabase.from('worlds').delete().eq('id', id);
        if (error) throw error;
      },
      subscribe: (callback) => () => {}
    },
    Player: {
      get: async (id) => {
        const { data, error } = await supabase.from('players').select('*').eq('id', id).maybeSingle();
        if (error || !data) return null;
        return {
          id: data.id,
          worldId: data.world_id,
          userId: data.user_id,
          nomeJogador: data.nomejogador,
          posX: data.posx,
          posY: data.posy,
          posZ: data.posz,
          yaw: data.yaw,
          pitch: data.pitch,
          gameMode: data.gamemode,
          hotbar: typeof data.hotbar === 'string' ? JSON.parse(data.hotbar) : data.hotbar,
          selectedSlot: data.selectedslot,
          survivalData: data.survivaldata,
          inventoryData: data.inventorydata,
          extra: data.extra,
          updated_at: data.updated_at,
        };
      },
      filter: async (query) => {
        let q = supabase.from('players').select('*');
        if (query.worldId) q = q.eq('world_id', query.worldId);
        if (query.userId) q = q.eq('user_id', query.userId);
        if (query.id) q = q.eq('id', query.id);
        const { data, error } = await q;
        if (error) return [];
        return (data || []).map(d => ({
          id: d.id,
          worldId: d.world_id,
          userId: d.user_id,
          nomeJogador: d.nomejogador,
          posX: d.posx,
          posY: d.posy,
          posZ: d.posz,
          yaw: d.yaw,
          pitch: d.pitch,
          gameMode: d.gamemode,
          hotbar: typeof d.hotbar === 'string' ? JSON.parse(d.hotbar) : d.hotbar,
          selectedSlot: d.selectedslot,
          survivalData: d.survivaldata,
          inventoryData: d.inventorydata,
          extra: d.extra,
          updated_at: d.updated_at,
        }));
      },
      create: async (item) => {
        const payload = {
          id: item.id || `${item.worldId}_${item.userId}`,
          world_id: item.worldId || item.world_id,
          user_id: item.userId || item.user_id,
          nomejogador: item.nomeJogador || item.nomejogador || 'Player',
          posx: item.posX ?? item.posx ?? 0,
          posy: item.posY ?? item.posy ?? 70,
          posz: item.posZ ?? item.posz ?? 0,
          yaw: item.yaw ?? 0,
          pitch: item.pitch ?? 0,
          gamemode: item.gameMode || item.gamemode || 'survival',
          hotbar: typeof item.hotbar === 'string' ? item.hotbar : JSON.stringify(item.hotbar || []),
          selectedslot: item.selectedSlot ?? item.selectedslot ?? 0,
          survivaldata: typeof item.survivalData === 'object' ? item.survivalData : (item.survivalData ? JSON.parse(item.survivalData) : {}),
          inventorydata: typeof item.inventoryData === 'object' ? item.inventoryData : (item.inventoryData ? JSON.parse(item.inventoryData) : {}),
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('players').insert(payload).select().single();
        if (error) throw error;
        return data;
      },
      update: async (id, item) => {
        const payload = {};
        if (item.posX !== undefined) payload.posx = item.posX;
        if (item.posY !== undefined) payload.posy = item.posY;
        if (item.posZ !== undefined) payload.posz = item.posZ;
        if (item.yaw !== undefined) payload.yaw = item.yaw;
        if (item.pitch !== undefined) payload.pitch = item.pitch;
        if (item.gameMode !== undefined) payload.gamemode = item.gameMode;
        if (item.hotbar !== undefined) payload.hotbar = typeof item.hotbar === 'string' ? item.hotbar : JSON.stringify(item.hotbar);
        if (item.selectedSlot !== undefined) payload.selectedslot = item.selectedSlot;
        if (item.survivalData !== undefined) payload.survivaldata = typeof item.survivalData === 'object' ? item.survivalData : JSON.parse(item.survivalData);
        if (item.inventoryData !== undefined) payload.inventorydata = typeof item.inventoryData === 'object' ? item.inventoryData : JSON.parse(item.inventoryData);
        payload.updated_at = new Date().toISOString();

        const { data, error } = await supabase.from('players').update(payload).eq('id', id).select().single();
        if (error) throw error;
        return data;
      },
      upsert: async (item) => {
        const payload = {
          id: item.id || `${item.worldId}_${item.userId}`,
          world_id: item.worldId || item.world_id,
          user_id: item.userId || item.user_id,
          nomejogador: item.nomeJogador || item.nomejogador || 'Player',
          posx: item.posX ?? item.posx ?? 0,
          posy: item.posY ?? item.posy ?? 70,
          posz: item.posZ ?? item.posz ?? 0,
          yaw: item.yaw ?? 0,
          pitch: item.pitch ?? 0,
          gamemode: item.gameMode || item.gamemode || 'survival',
          hotbar: typeof item.hotbar === 'string' ? item.hotbar : JSON.stringify(item.hotbar || []),
          selectedslot: item.selectedSlot ?? item.selectedslot ?? 0,
          survivaldata: typeof item.survivalData === 'object' ? item.survivalData : (item.survivalData ? JSON.parse(item.survivalData) : {}),
          inventorydata: typeof item.inventoryData === 'object' ? item.inventoryData : (item.inventoryData ? JSON.parse(item.inventoryData) : {}),
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('players').upsert(payload, { onConflict: 'id' }).select().single();
        if (error) throw error;
        return data;
      }
    }
  }
};
