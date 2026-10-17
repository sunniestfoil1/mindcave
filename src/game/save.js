// Gerenciamento de persistência local (IndexedDB + localStorage) e cloud (Supabase)
import { supabase } from '@/api/supabaseClient';
import { BUILD_VERSION } from './constants';
import { encodeDelta, decodeDelta } from './world';

const DB_NAME = 'mindcave_saves_v1';
const STORE_WORLDS = 'worlds';
const STORE_CHUNKS = 'chunk_deltas';
const STORE_PLAYERS = 'players';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_WORLDS)) {
        db.createObjectStore(STORE_WORLDS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        db.createObjectStore(STORE_CHUNKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PLAYERS)) {
        db.createObjectStore(STORE_PLAYERS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function createWorld({ name, seed, mapType, gameMode, allowCommands, ownerId, genParams, generateStructures, bonusChest, difficulty, gameRules, worldTime }) {
  const id = 'world_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const now = new Date().toISOString();
  const world = {
    id,
    name,
    seed: String(seed),
    mapType: mapType || 'open_world',
    gameMode: gameMode || 'survival',
    allowCommands: !!allowCommands,
    ownerId: ownerId || 'guest',
    buildVersion: BUILD_VERSION,
    formatVersion: 1,
    sharedWith: [],
    worldTime: worldTime || 0,
    genParams: genParams || '{}',
    generateStructures: generateStructures !== false,
    bonusChest: !!bonusChest,
    difficulty: difficulty || 'normal',
    gameRules: gameRules || '{}',
    lastPlayedAt: now,
    created_date: now,
  };

  // Salva no IndexedDB local para carregamento instantâneo sem delay
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_WORLDS, 'readwrite');
    tx.objectStore(STORE_WORLDS).put(world);
  } catch (e) {
    console.warn('[Save] Falha ao salvar no IndexedDB:', e);
  }

  // Tenta sync com Supabase se online (sem travar a criação)
  const { sharedWith, ...cleanWorld } = world;
  supabase.from('worlds').insert(cleanWorld).then(({ error }) => {
    if (error) console.warn('[Supabase Sync] Aviso mundo cloud:', error.message);
  }).catch(() => {});

  return world;
}

export async function listWorlds(userId) {
  let localWorlds = [];
  try {
    const db = await openDB();
    localWorlds = await new Promise((resolve) => {
      const tx = db.transaction(STORE_WORLDS, 'readonly');
      const req = tx.objectStore(STORE_WORLDS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    console.warn('[Save] Erro ao ler mundos locais:', e);
  }

  // Filtra por dono ou exibe todos os mundos do dispositivo local
  return localWorlds.sort((a, b) => new Date(b.lastPlayedAt || 0) - new Date(a.lastPlayedAt || 0));
}

export async function getWorld(id) {
  try {
    const db = await openDB();
    const world = await new Promise((resolve) => {
      const tx = db.transaction(STORE_WORLDS, 'readonly');
      const req = tx.objectStore(STORE_WORLDS).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    if (world) return world;
  } catch {}

  // Fallback cloud
  const { data } = await supabase.from('worlds').select('*').eq('id', id).maybeSingle();
  return data || null;
}

// Atualiza campos do mundo: IndexedDB local é a fonte; Supabase no máximo espelho
// (mundo só-local pode não ter linha na nuvem — falha é só ruído, não é erro).
export async function updateWorld(id, patch) {
  let merged = null;
  try {
    const db = await openDB();
    merged = await new Promise((resolve) => {
      const tx = db.transaction(STORE_WORLDS, 'readonly');
      const req = tx.objectStore(STORE_WORLDS).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (merged) {
      merged = { ...merged, ...patch };
      const tx = db.transaction(STORE_WORLDS, 'readwrite');
      tx.objectStore(STORE_WORLDS).put(merged);
    }
  } catch (e) {
    console.warn('[Save] Falha ao gravar ajustes do mundo no IndexedDB:', e);
  }
  try {
    await supabase.from('worlds').update(patch).eq('id', id);
  } catch {}
  return merged;
}

export async function deleteWorld(id) {
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_WORLDS, STORE_CHUNKS, STORE_PLAYERS], 'readwrite');
    tx.objectStore(STORE_WORLDS).delete(id);
    tx.oncomplete = () => {};
  } catch {}

  // Sync Supabase
  supabase.from('worlds').delete().eq('id', id).then(() => {}).catch(() => {});
}

export async function touchWorld(world) {
  if (!world) return null;
  world.lastPlayedAt = new Date().toISOString();
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_WORLDS, 'readwrite');
    tx.objectStore(STORE_WORLDS).put(world);
  } catch {}
  return world;
}

export async function loadDeltas(worldId) {
  const map = new Map();
  // A nuvem sai junto com a leitura local (antes esperava a local terminar) e só as colunas usadas; rede lenta não segura o mundo por mais de
  // CLOUD_WAIT_MS: o local manda (a nuvem só completa o que falta) e o mundo abre com o que já chegou.
  const CLOUD_WAIT_MS = 2500;
  const cloudP = Promise.race([
    Promise.resolve(supabase.from('chunk_deltas').select('cx,cz,data').eq('world_id', worldId)).catch(() => ({ data: null, error: true })),
    new Promise((r) => setTimeout(() => r({ data: null, error: true }), CLOUD_WAIT_MS)),
  ]);
  // 1. IndexedDB Local
  try {
    const db = await openDB();
    const deltas = await new Promise((resolve) => {
      const tx = db.transaction(STORE_CHUNKS, 'readonly');
      const req = tx.objectStore(STORE_CHUNKS).getAll();
      req.onsuccess = () => resolve((req.result || []).filter(d => d.worldId === worldId || d.world_id === worldId));
      req.onerror = () => resolve([]);
    });
    for (const d of deltas) {
      map.set((d.cx + 32768) * 65536 + (d.cz + 32768), decodeDelta(d.data));
    }
  } catch (e) {
    console.warn('[Save] Falha ao ler deltas locais:', e);
  }

  // 2. Cloud Supabase Sync
  try {
    const { data, error } = await cloudP;
    if (!error && data && data.length > 0) {
      for (const d of data) {
        const key = (d.cx + 32768) * 65536 + (d.cz + 32768);
        if (!map.has(key)) {
          let rawData = d.data;
          if (typeof rawData === 'string' && rawData.startsWith('{')) {
            try { const parsed = JSON.parse(rawData); rawData = parsed.b64 || parsed; } catch {}
          } else if (rawData && typeof rawData === 'object' && rawData.b64) {
            rawData = rawData.b64;
          }
          if (rawData) map.set(key, decodeDelta(rawData));
        }
      }
    }
  } catch {}

  return map;
}

export async function saveDirtyChunks(worldId, chunks) {
  let saved = 0;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CHUNKS, 'readwrite');
    const store = tx.objectStore(STORE_CHUNKS);
    for (const c of chunks) {
      if (!c.changes || c.changes.size === 0) continue;
      const data = encodeDelta(c.changes);
      const id = `${worldId}_${c.cx}_${c.cz}`;
      store.put({ id, worldId, cx: c.cx, cz: c.cz, data });
      saved++;

      // Cloud Sync Supabase
      Promise.resolve(supabase.from('chunk_deltas').upsert({
        id,
        world_id: worldId,
        cx: c.cx,
        cz: c.cz,
        data: { b64: data },
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })).catch(() => {});
    }
  } catch (e) {
    console.warn('[Save] Falha ao salvar chunks:', e);
  }
  return saved;
}

export async function loadPlayer(worldId, userId) {
  const id = `${worldId}_${userId}`;

  // 1. IndexedDB Local
  try {
    const db = await openDB();
    const localPlayer = await new Promise((resolve) => {
      const tx = db.transaction(STORE_PLAYERS, 'readonly');
      const req = tx.objectStore(STORE_PLAYERS).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
    if (localPlayer) return localPlayer;
  } catch {}

  // 2. LocalStorage Emergency Cache
  try {
    const raw = localStorage.getItem(`mindcave_player_${id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) return parsed;
    }
  } catch {}

  // 3. Supabase Cloud Sync
  try {
    const { data } = await supabase.from('players').select('*').eq('id', id).maybeSingle();
    if (data) {
      const p = {
        id,
        worldId: data.world_id || worldId,
        userId: data.user_id || userId,
        nomeJogador: data.nomejogador || 'Player',
        posX: data.posx ?? 0,
        posY: data.posy ?? 70,
        posZ: data.posz ?? 0,
        yaw: data.yaw || 0,
        pitch: data.pitch || 0,
        gameMode: data.gamemode || 'survival',
        hotbar: typeof data.hotbar === 'string' ? JSON.parse(data.hotbar) : data.hotbar,
        selectedSlot: data.selectedslot ?? 0,
        survivalData: typeof data.survivaldata === 'string' ? JSON.parse(data.survivaldata) : (data.survivaldata || {}),
        inventoryData: typeof data.inventorydata === 'string' ? JSON.parse(data.inventorydata) : (data.inventorydata || {}),
      };
      await savePlayer(p);
      return p;
    }
  } catch (e) {
    console.warn('[Save] Erro ao carregar jogador da nuvem:', e);
  }

  return null;
}

export async function savePlayer(p) {
  if (!p) return null;
  const id = p.id || `${p.worldId}_${p.userId}`;
  const data = { ...p, id };

  // 1. IndexedDB Local
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PLAYERS, 'readwrite');
    tx.objectStore(STORE_PLAYERS).put(data);
  } catch (e) {
    console.warn('[Save] Falha no IndexedDB player:', e);
  }

  // 2. Emergency LocalStorage Cache
  try {
    localStorage.setItem(`mindcave_player_${id}`, JSON.stringify(data));
  } catch {}

  // 3. Cloud Supabase Sync
  try {
    const cloudPayload = {
      id,
      world_id: p.worldId,
      user_id: p.userId,
      nomejogador: p.nomeJogador,
      posx: p.posX,
      posy: p.posY,
      posz: p.posZ,
      yaw: p.yaw,
      pitch: p.pitch,
      gamemode: p.gameMode,
      hotbar: typeof p.hotbar === 'string' ? p.hotbar : JSON.stringify(p.hotbar || []),
      selectedslot: p.selectedSlot,
      survivaldata: typeof p.survivalData === 'object' ? p.survivalData : (p.survivalData ? JSON.parse(p.survivalData) : {}),
      inventorydata: typeof p.inventoryData === 'object' ? p.inventoryData : (p.inventoryData ? JSON.parse(p.inventoryData) : {}),
      updated_at: new Date().toISOString(),
    };
    Promise.resolve(supabase.from('players').upsert(cloudPayload, { onConflict: 'id' })).catch(() => {});
  } catch {}

  return data;
}