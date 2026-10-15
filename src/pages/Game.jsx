import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mindcaveApi, supabase } from "@/api/supabaseClient";
import { resolveUser } from "@/game/guestIdentity";
import { ClientWorld } from "@/game/world";
import { GameEngine } from "@/game/engine";
import { getWorld, loadDeltas, loadPlayer, savePlayer, saveDirtyChunks, touchWorld } from "@/game/save";
import { seedFromString } from "@/game/prng";
import { preloadLocalSkin } from "@/game/skinStore";
import { DEFAULT_HOTBAR, CREATIVE_DEFAULT_HOTBAR } from "@/game/hotbar";
import { stateId, chunkCoord } from "@/game/chunk";
import { isWater, getBlock } from "@/game/blocks";
import GameHud from "@/components/game/GameHud";
import RadioWidget from "@/components/game/RadioWidget";
import Options from "@/pages/Options";
import { settingsStore } from "@/game/settingsStore";
import InventoryUI from "@/components/game/InventoryUI";
import CreativeUI from "@/components/game/CreativeUI";
import MindClientMenu from "@/components/client/MindClientMenu";
import ClientHud from "@/components/client/ClientHud";
import CraftingTableUI from "@/components/game/CraftingTableUI";
import FurnaceUI from "@/components/game/FurnaceUI";
import ChestUI from "@/components/game/ChestUI";
import { playChestOpenSound } from "@/game/sounds";
import DeathScreen from "@/components/game/DeathScreen";
import AchievementToast from "@/components/game/AchievementToast";
import StatsScreen from "@/components/game/StatsScreen";
import CrashScreen from "@/components/game/CrashScreen";
import PerformancePanel from "@/components/game/PerformancePanel";
import ChatUI from "@/components/game/ChatUI";
import ConnectionScreen from "@/components/game/ConnectionScreen";
import OpenToLANDialog from "@/components/game/OpenToLANDialog";
import FeedbackModal from "@/components/game/FeedbackModal";
import { roomManager } from "@/game/net/roomManager";
import { SaveQueue } from "@/game/saveQueue";
import { serializeStats } from "@/game/stats";
import { serializeAchievements } from "@/game/achievements";
import { serializeInventory } from "@/game/inventory";
import { serializeSurvival } from "@/game/survival";
import { createFurnaceState } from "@/game/furnace";
import { getOrCreateContainer, serializeContainers, deserializeContainers } from "@/game/containers";


function parseHotbar(s) {
  try { const h = JSON.parse(s); return Array.isArray(h) && h.length === 9 ? h : DEFAULT_HOTBAR.slice(); }
  catch { return DEFAULT_HOTBAR.slice(); }
}

function safePointerLock(canvas) {
  try {
    const p = canvas?.requestPointerLock?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) { /* pointer lock not available (iframe) */ }
}

function sanitizeName(s) {
  const base = (s || "").split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
  const n = (base || "Player").slice(0, 16);
  return n.length < 3 ? (n + "xxxx").slice(0, 6) : n;
}

import { getBiomeProvider } from "@/game/worldgen";
import { createTerrainGenerator } from "@/game/terrain";
import { SPAWN_BIOMES } from "@/game/biomes";

const SEA_LEVEL = 64;

// Spawn determinístico (sem aleatório): espiral a partir de (spawnX, spawnZ), como o WorldProvider da 1.8.9 só aceita bioma
// de spawn; aqui ainda exigimos terreno plano e seco (nenhuma das 9 amostras abaixo do mar ou com desnível > 3).
function findSpawn(seed, generatorOpts, sx = 0, sz = 0) {
  const getBiome = getBiomeProvider(seed, generatorOpts);
  const terrainGen = createTerrainGenerator(seed, { amplified: generatorOpts?.params?.worldType === 'amplified' });
  const OFFS = [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3], [3, 3], [-3, -3], [3, -3], [-3, 3]];
  const step = 4;
  for (let r = 0; r <= 384; r += step) {
    for (let dx = -r; dx <= r; dx += step) {
      for (let dz = -r; dz <= r; dz += step) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = sx + dx, z = sz + dz;
        const biome = getBiome(x, z);
        if (biome && (biome.water || !SPAWN_BIOMES.has(biome.id))) continue;
        const hs = OFFS.map(([ox, oz]) => terrainGen.columnHeight(x + ox, z + oz, getBiome(x + ox, z + oz)));
        const lo = Math.min(...hs), hi = Math.max(...hs);
        if (lo > SEA_LEVEL && hi < SEA_LEVEL + 45 && hi - lo <= 3) {
          return { x: x + 0.5, y: hs[0] + 1, z: z + 0.5, onGround: true };
        }
      }
    }
  }
  const biome = getBiome(sx, sz);
  const h = terrainGen.columnHeight(sx, sz, biome);
  return { x: sx + 0.5, y: Math.max(SEA_LEVEL + 2, h + 1), z: sz + 0.5, onGround: true };
}

export default function Game() {
  const { worldId } = useParams();
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [hud, setHud] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState({ percent: 0, status: 'Carregando mundo...' });
  const [error, setError] = useState(null);
  const [chatText, setChatText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const [showCreative, setShowCreative] = useState(false);
  const [showCraftingTable, setShowCraftingTable] = useState(false);
  const [showFurnace, setShowFurnace] = useState(false);
  const [showChest, setShowChest] = useState(false);
  const [furnaceState, setFurnaceState] = useState(null);
  const [chestContainer, setChestContainer] = useState(null);
  const [, setInvRev] = useState(0);
  const [crashError, setCrashError] = useState(null);
  const [achievementToast, setAchievementToast] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [savePending, setSavePending] = useState(0);
  const saveQueueRef = useRef(new SaveQueue());
  const navigate = useNavigate();
  const [netManager, setNetManager] = useState(null);
  const [showOpenToLAN, setShowOpenToLAN] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showClientMenu, setShowClientMenu] = useState(false);
  const [connecting, setConnecting] = useState(null); // room object when connecting
  const [playerNames, setPlayerNames] = useState([]);
  const [user, setUser] = useState(null);

  const showInventoryRef = useRef(false);
  const showCreativeRef = useRef(false);
  const showCraftingTableRef = useRef(false);
  const showFurnaceRef = useRef(false);
  const showChestRef = useRef(false);
  const showStatsRef = useRef(false);
  const showOptionsRef = useRef(false);
  const showOpenToLANRef = useRef(false);
  const showFeedbackRef = useRef(false);
  const showClientMenuRef = useRef(false);
  const worldRecRef = useRef(null); // registro do mundo (pvp/maxPlayers/ajustes da tela de opções)

  useEffect(() => { showInventoryRef.current = showInventory; }, [showInventory]);
  useEffect(() => { showCreativeRef.current = showCreative; }, [showCreative]);
  useEffect(() => { showCraftingTableRef.current = showCraftingTable; }, [showCraftingTable]);
  useEffect(() => { showFurnaceRef.current = showFurnace; }, [showFurnace]);
  useEffect(() => { showChestRef.current = showChest; }, [showChest]);
  useEffect(() => { showStatsRef.current = showStats; }, [showStats]);
  useEffect(() => { showOptionsRef.current = showOptions; }, [showOptions]);
  useEffect(() => { showOpenToLANRef.current = showOpenToLAN; }, [showOpenToLAN]);
  useEffect(() => { showFeedbackRef.current = showFeedback; }, [showFeedback]);
  useEffect(() => { showClientMenuRef.current = showClientMenu; }, [showClientMenu]);

  const closeAllGuis = useCallback(() => {
    setShowInventory(false);
    setShowCreative(false);
    setShowCraftingTable(false);
    setShowFurnace(false);
    setShowChest(false);
    setShowStats(false);
    setShowOpenToLAN(false);
    setShowFeedback(false);
    setShowClientMenu(false);
    setShowOptions(false);
    if (engineRef.current) {
      engineRef.current.paused = false;
      engineRef.current.emitHud();
    }
    safePointerLock(canvasRef.current);
  }, []);

  const closeAllGuisRef = useRef(closeAllGuis);
  useEffect(() => { closeAllGuisRef.current = closeAllGuis; }, [closeAllGuis]);

  // Ao fechar as opções, reaplica regras/dificuldade salvas no mundo ao motor que está rodando
  useEffect(() => {
    if (showOptions || !engineRef.current || !worldId) return undefined;
    let cancelled = false;
    getWorld(worldId).then((w) => {
      if (cancelled || !w || !engineRef.current) return;
      worldRecRef.current = w;
      let rules = {};
      try { rules = JSON.parse(w.gameRules || '{}'); } catch {}
      engineRef.current.applyWorldRules(rules, w.difficulty || 'normal');
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [showOptions, worldId]);

  useEffect(() => {
    let cancelled = false;
    let engine;
    (async () => {
      try {
        saveQueueRef.current.onUpdate = ({ pending }) => setSavePending(pending);
        const { user: u } = await resolveUser();
        setUser(u);
        await settingsStore.initCloud(u);
        const userId = u?.id;
        const world = await getWorld(worldId);
        if (!world || !world.seed) {
          setError("Mundo não encontrado ou corrompido");
          setLoading(false);
          return;
        }
        worldRecRef.current = world;
        const seed = seedFromString(world.seed);
        preloadLocalSkin(); // decodifica a skin já, em paralelo com o banco e os chunks
        const deltas = await loadDeltas(worldId);
        let genParams = {};
        try { genParams = JSON.parse(world.genParams || '{}'); } catch {}
        const generatorOpts = {
          generatorId: world.mapType === 'superflat' ? 'superflat'
            : (world.mapType === 'open_basic' ? 'open_legacy' : 'open_world'),
          params: { ...genParams, structures: world.generateStructures !== false },
        };
        const cw = new ClientWorld(seed, deltas, generatorOpts);
        let gameRules = {};
        try { gameRules = JSON.parse(world.gameRules || '{}'); } catch {}

        const spawn = findSpawn(seed, generatorOpts, world.spawnX || 0, world.spawnZ || 0);
        let player = await loadPlayer(worldId, userId);
        let playerStatsRec = null;
        try {
          const res = await mindcaveApi.entities.PlayerStats.filter({ worldId, userId: userId }, { limit: 1 });
          playerStatsRec = res.items?.[0] || res[0] || null;
        } catch {}
        const nome = sanitizeName(u.full_name || u.email);
        if (!player) {
          player = {
            worldId, userId: userId, nomeJogador: nome,
            posX: spawn.x, posY: spawn.y, posZ: spawn.z,
            yaw: 0, pitch: 0, gameMode: world.gameMode || "creative",
            hotbar: JSON.stringify((world.gameMode || "creative") === "creative" ? CREATIVE_DEFAULT_HOTBAR : DEFAULT_HOTBAR), selectedSlot: 0, extra: {},
          };
        }
        // Se a posição salva é inválida ou fora dos limites do mundo (0 a 256), usar spawn seguro em terra firme
        let useSpawn = false;
        if (player.posY === undefined || player.posY === null || isNaN(player.posY) || player.posY < 0 || player.posY > 256) {
          useSpawn = true;
        }
        if (useSpawn) {
          player.posX = spawn.x; player.posY = spawn.y; player.posZ = spawn.z;
        }
        // Verificar se o jogador está acima da água ou em posição inválida
        let startFlying = false;
        if (useSpawn && !spawn.onGround && (player.gameMode || 'creative') === 'creative') {
          startFlying = true;
        }
        // Se a posição atual é acima de água (pés em ar mas bloco abaixo é água)
        if (!useSpawn) {
          cw.ensureChunk(chunkCoord(Math.floor(player.posX)), chunkCoord(Math.floor(player.posZ)));
          const belowBlock = stateId(cw.getBlock(Math.floor(player.posX), Math.floor(player.posY - 1), Math.floor(player.posZ)));
          if (isWater(belowBlock) && (player.gameMode || 'creative') === 'creative') startFlying = true;
        }
        const pState = {
          pos: { x: player.posX, y: player.posY, z: player.posZ },
          vel: { x: 0, y: 0, z: 0 },
          yaw: player.yaw || 0, pitch: player.pitch || 0,
          onGround: false, flying: startFlying, sneaking: false, sprinting: false,
          gameMode: player.gameMode || "creative",
          hotbar: parseHotbar(player.hotbar), selectedSlot: player.selectedSlot || 0,
        };

        if (cancelled) return;
        deserializeContainers(world.containersData);
        engine = new GameEngine(canvasRef.current, {
          world: cw, player: pState, spawn, worldTime: world.worldTime || 0,
          gameRules,
          difficulty: world.difficulty || 'normal',
          savedSurvival: player.survivalData,
          savedStats: playerStatsRec?.stats,
          savedAchievements: playerStatsRec?.achievements,
          savedInventory: player.inventoryData,
          savedMobs: world.mobsData,
          savedItemEntities: world.itemEntitiesData,
          weatherState: world.weatherData,
          onHud: setHud,
          onDeath: async (d) => {
            try {
              await supabase.from('player_deaths').insert({
                world_id: worldId, user_id: String(userId), player_name: nome, message: d.message, cause: d.cause || null,
                killer: d.killer, x: d.pos.x, y: d.pos.y, z: d.pos.z, items_lost: d.itemsLost, xp_level: d.xpLevel,
              });
            } catch { /* tabela criada pela migração 20261011; sem ela a morte só aparece no chat */ }
          },
          onProgress: (pct, msg) => {
            if (!cancelled) setLoadingProgress({ percent: pct, status: msg });
          },
          onToggleInventory: () => {
            const p = engineRef.current?.player;
            if (p?.isDead) return;
            const containerOpen = showInventoryRef.current || showCreativeRef.current ||
              showCraftingTableRef.current || showFurnaceRef.current || showChestRef.current;
            // REGRA DA TECLA E (não mexer sem testar): ela só abre/fecha inventário e containers.
            // Em Opções, Estatísticas, LAN, Feedback e no menu de pausa a tecla E é IGNORADA (como no 1.8.9);
            // fechar essas telas é com Esc ou com os botões delas. Antes, qualquer tela aberta fechava com E.
            if (containerOpen) {
              closeAllGuisRef.current();
              return;
            }
            if (showStatsRef.current || showOpenToLANRef.current || showOptionsRef.current || showFeedbackRef.current) return;
            if (engineRef.current?.paused && !engineRef.current?.netManager) return; // menu de pausa (singleplayer)
            if (p?.gameMode === 'creative') setShowCreative(true);
            else setShowInventory(true);
            document.exitPointerLock?.();
          },
          // Shift direito: menu do Mind Client (o mundo continua rodando, como no inventário)
          onToggleClientMenu: () => {
            const eng = engineRef.current;
            if (!eng || eng.player?.isDead) return;
            if (showClientMenuRef.current) { closeAllGuisRef.current(); return; }
            if (showInventoryRef.current || showCreativeRef.current || showCraftingTableRef.current || showFurnaceRef.current || showChestRef.current ||
              showStatsRef.current || showOpenToLANRef.current || showOptionsRef.current || showFeedbackRef.current) return;
            if (eng.paused && !eng.netManager) return; // menu de pausa (singleplayer)
            setShowClientMenu(true);
            document.exitPointerLock?.();
          },
          onOpenCraftingTable: () => {
            setShowCraftingTable(true);
            document.exitPointerLock?.();
          },
          onOpenFurnace: (x, y, z) => {
            const fs = createFurnaceState(x, y, z);
            setFurnaceState(fs);
            setShowFurnace(true);
            document.exitPointerLock?.();
          },
          onOpenChest: (x, y, z) => {
            const c = getOrCreateContainer(cw, x, y, z);
            playChestOpenSound({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });
            setChestContainer(c);
            setShowChest(true);
            document.exitPointerLock?.();
          },
          onAutosave: async () => {
            try {
              const dirty = cw.dirtyChunks();
              await saveDirtyChunks(worldId, dirty);
              player.posX = pState.pos.x; player.posY = pState.pos.y; player.posZ = pState.pos.z;
              player.yaw = pState.yaw; player.pitch = pState.pitch; player.gameMode = pState.gameMode;
              player.hotbar = JSON.stringify(pState.hotbar); player.selectedSlot = pState.selectedSlot;
              player.survivalData = serializeSurvival(pState);
              if (engine.inventory) player.inventoryData = serializeInventory(engine.inventory);
              if (engine.weather) world.weatherData = engine.weather.serialize();
              world.containersData = serializeContainers();
              if (engine.mobs) world.mobsData = engine.mobs.serialize();
              if (engine.itemEntities) world.itemEntitiesData = engine.itemEntities.serialize();
              player.extra = player.extra || {};
              if (!player.id) { player.worldId = worldId; player.userId = userId; player.nomeJogador = nome; }
              await savePlayer(player);
              world.worldTime = engine.worldTime;
              world.gameRules = JSON.stringify(engine.gameRules || gameRules);
              // Mescla com o registro mais novo: ajustes da tela de opções não podem ser revertidos aqui
              const latest = worldRecRef.current || world;
              latest.worldTime = world.worldTime;
              latest.gameRules = world.gameRules;
              latest.containersData = world.containersData;
              latest.mobsData = world.mobsData;
              latest.itemEntitiesData = world.itemEntitiesData;
              if (world.weatherData) latest.weatherData = world.weatherData;
              await touchWorld(latest);
              try {
                const statsData = serializeStats(pState.stats);
                const achData = serializeAchievements(pState.achievements);
                if (playerStatsRec?.id) {
                  await mindcaveApi.entities.PlayerStats.update(playerStatsRec.id, { stats: statsData, achievements: achData, updatedEm: new Date().toISOString() });
                } else {
                  playerStatsRec = await mindcaveApi.entities.PlayerStats.create({ worldId, userId: userId, stats: statsData, achievements: achData });
                }
              } catch (e) { console.error('[Stats Save]', e); }
            } catch (e) { console.error("[Save]", e); }
          },
        });

        engineRef.current = engine;
        if (import.meta.env.DEV) window.__mindcave = { get engine() { return engineRef.current; } }; // ganchos só para os testes de navegador
        engine.containerOpenFn = () => showInventoryRef.current || showCreativeRef.current || showCraftingTableRef.current || showFurnaceRef.current || showChestRef.current || showClientMenuRef.current;
        engine.guiOpenFn = () => showInventoryRef.current || showCreativeRef.current || showCraftingTableRef.current || showFurnaceRef.current || showChestRef.current || showClientMenuRef.current || showStatsRef.current || showOpenToLANRef.current || showOptionsRef.current || showFeedbackRef.current;
        await engine.start();
        console.log('[Game] Spawn:', spawn, 'Player pos:', pState.pos, 'Flying:', pState.flying, 'GameMode:', pState.gameMode);
        console.log('[Game] Chunks loaded:', cw.chunks.size, 'Render distance:', engine.renderDistance);
        setLoading(false);

        // Multiplayer: check if joining a room
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
          const room = await roomManager.getRoom(roomParam);
          if (room && room.status === 'open') {
            setConnecting(room);
          }
        }
      } catch (e) {
        console.error(e);
        setError(e.message || "Erro ao carregar o mundo");
        setLoading(false);
      }
    })();
    return () => { cancelled = true; if (engine) engine.stop(); };
  }, [worldId]);

  // Crash handler (PRD 12 RF-043)
  useEffect(() => {
    const handler = (e) => {
      const err = e.error || e.reason;
      if (err) {
        console.error('[Crash]', err);
        setCrashError({ message: err.message || 'Erro desconhecido', stack: err.stack });
      }
    };
    window.addEventListener('error', handler);
    window.addEventListener('unhandledrejection', handler);
    return () => {
      window.removeEventListener('error', handler);
      window.removeEventListener('unhandledrejection', handler);
    };
  }, []);

  // Bloqueio de atalhos destrutivos do navegador (Ctrl+W de correr+andar, zoom com roda do mouse)
  useEffect(() => {
    const onWheel = (e) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const onKeyDown = (e) => {
      // Bloquear atalhos do navegador que interferem no jogo (F1 = ajuda Brave, F7 = caret browsing)
      if (e.code === 'F1' || e.key === 'F1' || e.code === 'F7' || e.key === 'F7') {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.code === 'F11' || e.key === 'F11') {
        e.preventDefault();
        e.stopPropagation();
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        } else {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      }
      if (e.ctrlKey) {
        if (e.key === 'w' || e.key === 'W' || e.code === 'KeyW') {
          e.preventDefault();
          e.stopPropagation();
        }
        if (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0') {
          e.preventDefault();
        }
      }
    };

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Deseja realmente sair? Seu mundo foi salvo.';
      return e.returnValue;
    };

    const onDragStart = (e) => e.preventDefault();

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('dragstart', onDragStart);
    window.addEventListener('beforeunload', onBeforeUnload);

    if (navigator.keyboard && typeof navigator.keyboard.lock === 'function') {
      navigator.keyboard.lock(['KeyW']).catch(() => {});
    }

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('dragstart', onDragStart);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (navigator.keyboard && typeof navigator.keyboard.unlock === 'function') {
        navigator.keyboard.unlock();
      }
    };
  }, []);

  // Achievement toast watcher (PRD 12 RF-030)
  useEffect(() => {
    if (hud?.achievements?.pendingToast) {
      setAchievementToast(hud.achievements.pendingToast);
    }
  }, [hud?.achievements?.pendingToast]);

  const handleExit = async () => {
    const e = engineRef.current;
    if (e) { await e.saveAndExit(); e.stop(); }
    navigate("/");
  };

  const handleResume = () => {
    safePointerLock(canvasRef.current);
  };

  const isAnyGuiOpen = showInventory || showCreative || showCraftingTable || showFurnace || showChest || showClientMenu || showStats || showOptions || showOpenToLAN || showFeedback;

  return (
    <div className="fixed inset-0 bg-black">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white z-50">
          <div className="text-center w-80 p-6 bg-slate-800/80 rounded-lg border border-slate-700 shadow-2xl backdrop-blur-sm">
            <h2 className="text-xl font-minecraft tracking-wider mb-2 text-yellow-400">MIND-CAVE</h2>
            <div className="text-sm font-sans mb-4 text-slate-300">{loadingProgress.status}</div>
            
            {/* Minecraft Style Progress Bar */}
            <div className="w-full bg-slate-950 h-5 rounded-full border border-slate-700 overflow-hidden p-0.5 relative">
              <div 
                className="h-full bg-gradient-to-r from-green-600 to-emerald-400 rounded-full transition-all duration-150 ease-out" 
                style={{ width: `${Math.max(5, loadingProgress.percent)}%` }} 
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                {loadingProgress.percent}%
              </span>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white p-6 text-center">
          <div>
            <p className="text-red-400 mb-3">Erro: {error}</p>
            <button onClick={() => navigate("/")} className="px-4 py-2 bg-white/10 rounded">Voltar ao menu</button>
          </div>
        </div>
      )}
      {hud && !showOptions && (
        <GameHud
          hud={{
            ...hud,
            hasGuiOpen: isAnyGuiOpen,
            onExit: handleExit,
            onOptions: () => { document.exitPointerLock?.(); setShowOptions(true); },
            onStats: () => { document.exitPointerLock?.(); setShowStats(true); },
            onOpenToLAN: () => { document.exitPointerLock?.(); setShowOpenToLAN(true); },
            onFeedback: () => { document.exitPointerLock?.(); setShowFeedback(true); }
          }}
          onPause={handleResume}
        />
      )}
      {/* Módulos de HUD do Mind Client (FPS, CPS, coordenadas, keystrokes, armadura...) */}
      {hud && !showOptions && !hud.isDead && <ClientHud hud={hud} engine={engineRef.current} />}
      {/* Só depois que hud existe: o engine já chamou musicManager.start() e o rádio toma a trilha. */}
      {hud && <RadioWidget visible={!!hud.paused && !isAnyGuiOpen && !hud.chatOpen && !hud.isDead} />}
      <PerformancePanel visible={!!hud?.f3} />


      {/* Tela de morte (PRD 05/07) */}
      {hud?.isDead && (
        <DeathScreen hud={hud} onRespawn={() => engineRef.current?.respawn()} onTitle={handleExit} />
      )}

      {/* Menu do Mind Client (Shift direito) */}
      {showClientMenu && !hud?.isDead && <MindClientMenu onClose={closeAllGuis} />}

      {/* Inventário sobrevivência (PRD 06) */}
      {showInventory && !hud?.isDead && engineRef.current?.inventory && (
        <InventoryUI inv={engineRef.current.inventory} onUpdate={() => setInvRev(r => r + 1)} onClose={closeAllGuis} onCraft={() => { const p = engineRef.current?.player; if (p?.stats) p.stats.crafts = (p.stats.crafts || 0) + 1; }} />
      )}
      {/* Inventário criativo (PRD 06) */}
      {showCreative && !hud?.isDead && engineRef.current?.inventory && (
        <CreativeUI inv={engineRef.current.inventory} onUpdate={() => setInvRev(r => r + 1)} onClose={closeAllGuis} />
      )}
      {/* Bancada de trabalho (PRD 06) */}
      {showCraftingTable && !hud?.isDead && engineRef.current?.inventory && (
        <CraftingTableUI inv={engineRef.current.inventory} onUpdate={() => setInvRev(r => r + 1)} onClose={closeAllGuis} onCraft={() => { const p = engineRef.current?.player; if (p?.stats) p.stats.crafts = (p.stats.crafts || 0) + 1; }} />
      )}
      {/* Fornalha (PRD 06) */}
      {showFurnace && furnaceState && !hud?.isDead && engineRef.current?.inventory && (
        <FurnaceUI furnace={furnaceState} inv={engineRef.current.inventory} onUpdate={() => setInvRev(r => r + 1)} onClose={closeAllGuis} />
      )}
      {/* Baú (PRD 06) */}
      {showChest && chestContainer && !hud?.isDead && engineRef.current?.inventory && (
        <ChestUI container={chestContainer} inv={engineRef.current.inventory} onUpdate={() => setInvRev(r => r + 1)} onClose={closeAllGuis} />
      )}

      {/* Toast de conquista */}
      {hud?.achievements?.pendingToast && (
        <AchievementToast
          toast={hud.achievements.pendingToast}
          onClose={() => {
            const ach = engineRef.current?.player?.achievements;
            if (ach) { ach.pendingToast = null; engineRef.current.emitHud(); }
          }}
        />
      )}

      {showOptions && (
        <div className="absolute inset-0 z-50">
          <Options onClose={closeAllGuis} worldId={worldId} />
        </div>
      )}

      {/* Conquistas (PRD 12 RF-030) */}
      {achievementToast && <AchievementToast toast={achievementToast} onClose={() => setAchievementToast(null)} />}

      {/* Estatísticas (PRD 12 RF-031) */}
      {showStats && <StatsScreen stats={hud?.stats} achievements={hud?.achievements} onClose={closeAllGuis} />}

      {/* Saves pendentes (PRD 12 RF-012) */}
      {savePending > 0 && (
        <div className="absolute top-10 left-2 text-xs text-yellow-400 bg-black/50 px-2 py-1 rounded z-40">
          💾 Saves pendentes: {savePending}
        </div>
      )}

      {/* Tela de crash (PRD 12 RF-043) */}
      {crashError && <CrashScreen error={crashError} onExit={() => navigate('/')} />}

      {/* Chat (PRD 15 MC15-RF-050) */}
      <ChatUI engine={engineRef.current} netManager={netManager} playerNames={playerNames} />

      {/* Abrir para LAN (PRD 15 MC15-RF-011) */}
      {showOpenToLAN && !hud?.isDead && (
        <OpenToLANDialog
          engine={engineRef.current}
          world={(() => {
            const rec = worldRecRef.current;
            return hud
              ? { id: worldId, name: hud.worldName || 'Mundo', gameMode: hud.gamemode, pvp: rec?.pvp ?? true, maxPlayers: rec?.maxPlayers ?? 8 }
              : { id: worldId, pvp: rec?.pvp ?? true, maxPlayers: rec?.maxPlayers ?? 8 };
          })()}
          user={{ id: user?.id || 'guest', full_name: user?.full_name || 'Player' }}
          netHost={netManager}
          onNetHostChange={(host) => { setNetManager(host); engineRef.current.netManager = host; }}
          onClose={closeAllGuis}
        />
      )}

      {/* Feedback / Caixa de Bugs e Melhorias */}
      {showFeedback && (
        <FeedbackModal user={user} onClose={closeAllGuis} />
      )}

      {/* Tela de conexão (PRD 15 MC15-RF-030) */}
      {connecting && (
        <ConnectionScreen
          room={connecting}
          user={user || { id: 'guest', full_name: 'Player' }}
          world={{ id: worldId }}
          engine={engineRef.current}
          onSuccess={(room, client) => {
            setNetManager(client);
            engineRef.current.netManager = client;
            engineRef.current.onChatSend = (text) => client.sendChat(text);
            setConnecting(null);
            safePointerLock(canvasRef.current);
          }}
          onCancel={() => { setConnecting(null); navigate('/multiplayer'); }}
        />
      )}
    </div>
  );
}