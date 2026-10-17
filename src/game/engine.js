// Motor do jogo (imperativo, three.js). PRD 01 §3.3 + PRD 02 (céu, luz, fluidos, comandos)
import * as THREE from 'three';
import { TICK_MS, TPS, PLAYER, AUTOSAVE_TICKS } from './constants';
import { moveEntity, unstickPlayer, pushOutOfBlocks, collidesAt, chunkLoadedAt, getBlockSlipperiness } from './physics';
import { packState, stateId, stateMeta, chunkCoord } from './chunk';
import { getBlock, BLOCKS, isWater, isLava, isFluid, isReplaceable, isSolid, BLOCK_NAMES, getSelectionBox } from './blocks';
import { blockBoxes, rayBox, hasShape, isSlabBlock, isStairsBlock, computePlacement, bedPartner, BED_DIRS, DOOR_FACES, isDoorBlock } from './shapes';

import { POT_CONTENTS, potMetaFor, SKULL_BLOCKS } from './blocksMore';

// Itens que viram bloco ao colocar (o id do item é diferente do id do bloco)
const ITEM_TO_BLOCK = { 323: 63, 380: 118, 379: 117, 390: 140, 356: 93, 404: 149, 372: 115, 338: 83, 354: 92, 397: 144 };
// Itens de porta → bloco da porta (madeiras de 1.8: carvalho 324/64, ferro 330/71, pinheiro 427/193 … carvalho escuro 431/197)
const DOOR_ITEMS = { 324: 64, 330: 71, 427: 193, 428: 194, 429: 195, 430: 196, 431: 197 };
// Blocos que no 1.8.9 abrem uma tela e que ainda não têm tela aqui: o clique avisa em vez de colocar bloco
const SEM_TELA = new Set([116, 145, 117, 23, 158, 154, 138, 84]);
import { Sky } from './sky';
import { skyBrightnessFactor, sunsetFactor, sunBrightness } from './lighting';
import { tickFluids } from './fluids';
import { settingsStore } from './settingsStore';
import { createSurvivalState, applyDamage, tickSurvival, addXP, getXPProgress, respawn as respawnPlayer, serializeSurvival, deserializeSurvival, getDeathMessage, getDroppedXP, FOODS, canEat, eatFood, canSleep, isFood } from './survival';
import { tickEffects, getSpeedModifier, getMiningSpeedModifier, clearEffects, Effect } from './effects';
import { WeatherSystem } from './weather';
import { tickFire, igniteEntity } from './fire';
import { processCommand } from './commands';
import { getMiningTime, getDrops, damageTool, isToolBroken, getToolDamage, ORE_XP } from './mining';
import { addItem, createInventory, serializeInventory, deserializeInventory, stack } from './inventory';
import { getArmorPoints, getItem, ITEMS } from './items';
import { ProjectileManager } from './projectiles';
import { createAnimationState, tickAnimation, startSwing, applyThirdPersonPose } from './animation';
import { buildHandRig, poseHand } from './firstPersonHand';
import { isTouchDevice } from './touch';
import { attackEntity, isSword, isBow, isThrowable, computeBowCharge, createCpsTracker, recordClick, getCps, ATTACK_REACH } from './combat';
import { MobManager } from './mobManager';
import { hasGlint, buildGlintOverlay } from './glint';
import { ClientWorld } from './world';
import { tryCreatePortal, checkPortalIntegrity, findNearbyPortal, buildPortal } from './portal';
import { findNetherFloor } from './netherGen';
import { MobEntity } from './mobEntity';
import { GunController } from './guns/shooting';
import { NoiseSystem } from './guns/noiseSystem';
import { getGunDef, getGunState, createGunState, GUNS, isGunItem, isAccessoryItem } from './guns/registry';
import { DEFAULT_GAME_RULES } from './constants';
import { RedstoneSystem } from './redstone';
import { explode, getExplosionDamage, canPlayExplosionSound } from './explosions';
import { tickAgriculture, applyBonemeal, trampleFarmland, harvestCrop } from './agriculture';
import { createStats, serializeStats, deserializeStats, addStat, addStatByType } from './stats';
import { createAchievementState, serializeAchievements, deserializeAchievements, tryUnlock, checkStatAchievements } from './achievements';
import { TntRenderer } from './tntRender';
import { loadRealTextures, reloadRealTextures, isRealTexturesLoaded, tickTextureAnimations } from './textures';
import { lookDirFromAngles } from './viewMath';
import { buildPlayerModel, loadPlayerGlb, loadFirstPersonArmGlb, applyPackSkin, placePlayerModel, setModelHeldItem, setModelCape, setModelArmor, armorCodeFromSlots } from './playerModel';
import { interpolateRemotePlayer } from './net/netInterpolation';

let _activeEngine = null;
export function getActiveEngine() { return _activeEngine; }
import { onSkinChange, onCapeChange, getCapeChoice, preloadLocalSkin } from './skinStore';
import { fetchCraftheadCape, fetchCraftheadSkin } from './crafthead';
import { loadPack, ensurePack, isPackReady, isPackDownloading, getPackUrl, MC } from './pack';
import { createCrosshair } from './crosshair';
import { createMotionBlur } from './motionBlur';
import { clientStore } from './client/clientStore';
import { initBiomeTint } from './biomeTint';
import { playStepSound, playDigSound, playBlockBreakSound, playBlockPlaceSound, playHurtSound, playPlayerHurtSound, playHitSound, playMobSound, playSplashSound, playEvent, playEatSound, playBurpSound, playBowSound, startRainSound, stopRainSound, playExplodeSound, playFuseSound, playLevelUpSound, updateAudioListener, playPopSound, playArmorEquipSound } from './sounds';
import { createNametag } from './nametag';
import { ParticleManager } from './particles';
import { ItemEntityManager, createItemMesh, isItemSpriteReady } from './itemEntity';
import { perfMonitor } from './perfMonitor';
import { musicManager } from './musicManager';
import { voiceChat } from './net/voiceChat';
import { createVoiceIcon, setVoiceIconState, disposeVoiceIcon } from './voiceIcon';
import { getContainer, removeContainer } from './containers';
import { handleBlockBreakPhysics, tickNearbyFallingBlocks, FALLING_BLOCK_IDS, canFallThrough, triggerFallingColumn } from './fallingBlocks';

// MC24-RF-032: valores sRGB crus em tudo (texturas, cores, saída) — sem conversão dupla
THREE.ColorManagement.enabled = false;

const DEFAULT_HOTBAR = [
  { id: 2, meta: 0 }, { id: 3, meta: 0 }, { id: 1, meta: 0 }, { id: 4, meta: 0 },
  { id: 5, meta: 0 }, { id: 17, meta: 0 }, { id: 18, meta: 0 }, { id: 50, meta: 0 }, { id: 89, meta: 0 },
];

// Modelo do jogador e mão em 1ª pessoa: ver playerModel.js (GLB + procedural fallback)

// Ray-AABB intersection (slab method) — PRD 07 RF-003
function _rayAABB(origin, dir, box) {
  let tmin = 0, tmax = Infinity;
  const axes = [
    [origin.x, dir.x, box.minX, box.maxX],
    [origin.y, dir.y, box.minY, box.maxY],
    [origin.z, dir.z, box.minZ, box.maxZ],
  ];
  for (const [o, d, min, max] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return null;
    } else {
      let t1 = (min - o) / d, t2 = (max - o) / d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export class GameEngine {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.world = opts.world;
    this.dimension = 'overworld';
    this.worlds = { overworld: this.world, nether: null };
    this._netherDeltas = opts.netherDeltas || new Map();
    this._portalTicks = 0;
    this._portalCooldown = 0;
    this.player = opts.player;
    this.spawn = opts.spawn;
    this.onHud = opts.onHud || (() => {});
    this.onProgress = opts.onProgress || null;
    this.onAutosave = opts.onAutosave || (async () => {});
    this.renderDistance = opts.renderDistance || 6;
    this.keys = {};
    this.mouseBtn = {};
    this.touch = isTouchDevice();   // celular: sem trava de ponteiro; entrada vem dos controles de toque (touch*)
    this.lastSpaceTap = 0; this.spaceTapCount = 0;
    this.lastWTap = 0; this.wTapCount = 0;
    this.breakCd = 0; this.placeCd = 0;
    this.tickAcc = 0; this.lastTime = 0;
    this._fovMod = 1; this._fovModPrev = 1; // modificador de FOV da mão/corrida (EntityRenderer.fovModifierHand)
    this.worldTime = opts.worldTime || 0;
    this.gameRules = opts.gameRules || {};
    this.difficulty = opts.difficulty || 'normal';
    this.onToggleInventory = opts.onToggleInventory || (() => {});
    this.onToggleClientMenu = opts.onToggleClientMenu || (() => {});
    this.freeLook = { on: false, yaw: 0, pitch: 0, saved: 0 };   // módulo Perspective: segurar ALT
    this.onChatMessage = opts.onChatMessage || null;
    this.onChatSend = opts.onChatSend || null;
    this.onDeath = opts.onDeath || null;
    this.onBlockChange = opts.onBlockChange || null;
    this.onOpenCraftingTable = opts.onOpenCraftingTable || null;
    this.onOpenFurnace = opts.onOpenFurnace || null;
    this.onOpenChest = opts.onOpenChest || null;
    this.netManager = null;
    this.miningTarget = null;
    this.miningProgress = 0;
    this._savedSurvival = opts.savedSurvival;
    this._weatherState = opts.weatherState;
    this._savedStats = opts.savedStats;
    this._savedAchievements = opts.savedAchievements;
    this._savedMobs = opts.savedMobs;
    this._savedItemEntities = opts.savedItemEntities;
    this._lastPosX = null;
    this._lastPosZ = null;
    this.frame = 0;
    this.paused = true;
    this.perspective = 0; // 0 = 1st Person, 1 = 3rd Person Back, 2 = 3rd Person Front
    this.f3 = false;
    this.chatOpen = false;
    this.hideHud = false;
    this.inFluid = null;
    this.fps = 0; this.fpsFrames = 0; this.fpsTime = 0;
    this.disposed = false;
    this.anim = createAnimationState();
    this.cps = createCpsTracker();
    this.entities = [];
    this._prevAttack = false;
    this._prevUse = false;
    this.bowChargeTicks = 0;
    this.fpsScene = null;
    this.fpsCamera = null;
    this.fpsArm = null;
    this.fpsItem = null;
    this.fpsItemGroup = null;
    this.projectiles = null;
    this.tntEntities = [];
    this.pendingTnt = [];
    this.showHitboxes = false;
    this.showChunkBorders = false;
    this._perfCtx = { loadingRadius: 0, meshQ: 0 };
    this._awaitChunk = true;   // RF-021: parado até o chunk sob o jogador existir; depois tira de dentro de blocos
  }

  async start() {
    _activeEngine = this;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const resScale = (settingsStore.get('device.resolutionScale') || 100) / 100;
    // WebGL2 de alta performance perfeitamente sincronizado com o compositor DWM
    // antialias: false elimina artefatos de junção no Atlas e poupa GPU
    // powerPreference: 'high-performance' garante o uso da GPU dedicada (AMD Radeon RX 6600)
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(resScale);
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0xc0d8ff, 1);

    this.crosshair = createCrosshair(this.renderer);
    this.motionBlur = createMotionBlur(this.renderer);
    // módulo Hitbox do Mind Client liga/desliga as caixas de colisão (F3 + B continua valendo)
    this.showHitboxes = clientStore.isOn('hitbox') || this.showHitboxes;
    this._unsubClientStore = clientStore.subscribe(() => { this.showHitboxes = clientStore.isOn('hitbox'); });
    this._unsubSettingsStore = settingsStore.subscribe((k) => {
      if (k === 'device.resolutionScale' && this.renderer) this.onResize();
    });

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(PLAYER.fov, w / h, 0.05, 1000);
    // O tamanho da tela pode mudar sem evento de janela (barra do navegador do celular, página girada por CSS, teclado): o buffer do WebGL
    // acompanha o tamanho real do canvas, senão a imagem sai esticada/achatada
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObs = new ResizeObserver(() => this.onResize());
      this._resizeObs.observe(this.canvas);
    }

    this.sky = new Sky(this.scene, this.world.seed);

    // Estado de sobrevivência
    const surv = createSurvivalState(this.player.gameMode);
    Object.assign(this.player, surv);
    if (this._savedSurvival) deserializeSurvival(this.player, this._savedSurvival);

    // Stats e Conquistas (PRD 12 RF-030..031)
    this.player.stats = this._savedStats ? deserializeStats(this._savedStats) : createStats();
    this.player.achievements = this._savedAchievements ? deserializeAchievements(this._savedAchievements) : createAchievementState();

    // Clima
    this.weather = new WeatherSystem(this.scene, this.world.seed, this._weatherState);

    // Inventário (PRD 06) — sempre criado, mesmo sem dados salvos
    this.inventory = { main: new Array(27).fill(null), hotbar: this.player.hotbar, armor: new Array(4).fill(null), crafting: new Array(4).fill(null), craftResult: null, cursor: null };
    Object.defineProperty(this.inventory, 'dropOut', { value: (st) => this._throwItem(st), enumerable: false, configurable: true, writable: true });   // telas de inventário soltam o cursor por aqui
    // Título de tela (/title) — 60 ticks ≈ 3 s, como o stay padrão do vanilla
    this.titleText = null;
    this.subtitleText = null;
    this.titleTicks = 0;
    if (this._savedInventory) {
      deserializeInventory(this.inventory, this._savedInventory);
    }

    // Projéteis e combate (PRD 07)
    this.projectiles = new ProjectileManager(this.scene, this.world);
    // Recolher flecha cravada (1.8.9): disparada em sobrevivência (modo 1) o sobrevivente recolhe 1 flecha; disparada no criativo (modo 2) só
    // o criativo recolhe, sem ganhar item. probe = só pergunta se pode (a flecha ainda voa até o jogador antes de ser recolhida).
    this.projectiles.onPickup = (proj, probe = false) => {
      const creative = this.player.gameMode === 'creative';
      if (proj.pickupMode === 2) { if (!creative) return false; if (!probe) playPopSound(proj.pos); return true; }
      if (probe) return true;
      const left = addItem(this.inventory, { id: 262, count: 1, meta: 0 });
      if (left) return false;
      playPopSound(proj.pos);
      return true;
    };
    this._buildFirstPersonHand();

    // Mobs (PRD 08)
    this.mobs = new MobManager(this.scene, this.world);
    if (this._savedMobs) {
      this.mobs.deserialize(this._savedMobs);
    }
    MobEntity.onSound = (mob, kind) => {
      playMobSound(mob, kind);
      if (this.netManager) {
        const pkt = { t: 'sound', mobType: mob.typeId, kind, pos: { x: mob.pos.x, y: mob.pos.y, z: mob.pos.z } };
        if (this.netManager.broadcast) this.netManager.broadcast(pkt);
        else this.netManager.conn?.send(pkt);
      }
    };

    // Armas de fogo (PRD 09)
    this.gunController = new GunController(this);
    this.noiseSystem = new NoiseSystem();
    this._bulletDecals = [];

    // Partículas (blocos quebrados, respingos) — estilo 1.8.9
    this.particles = new ParticleManager(this.scene, this.world);
    this.itemEntities = new ItemEntityManager(this.scene, this.world);
    if (this._savedItemEntities) {
      this.itemEntities.deserialize(this._savedItemEntities);
    }
    this.itemEntities.onItemPickup = (item, pos) => {
      if (this.netManager) {
        const pkt = { t: 'item_pickup', id: item.id, pos };
        if (this.netManager.broadcast) this.netManager.broadcast(pkt);
        else this.netManager.conn?.send(pkt);
      }
    };
    this._wasInWater = false;

    // Frustum Culling e Otimizações de Renderização (Sodium / Patcher)
    this._projScreenMatrix = new THREE.Matrix4();
    this._cameraFrustum = new THREE.Frustum();
    this._cachedRaycast = null;
    this._cachedRaycastFrame = -1;
    this._cachedRaycastPosKey = '';

    // Redstone (PRD 11)
    this.redstone = new RedstoneSystem(this.world);
    this.redstone.onTNTActivate = (x, y, z) => this.spawnTNT(x, y, z);
    this.world.onBlockChange = (x, y, z) => { this.redstone?.markDirty(x, y, z); };

    // Merge default game rules
    this.gameRules = { ...DEFAULT_GAME_RULES, ...(this.gameRules || {}) };

    const boxGeo = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 })
    );
    this.outline.visible = false;
    this.scene.add(this.outline);
    // contornos extras para blocos de várias caixas (escadas)
    this._outlineExtra = [];
    for (let i = 0; i < 3; i++) {
      const o = new THREE.LineSegments(this.outline.geometry, this.outline.material);
      o.visible = false;
      this.scene.add(o);
      this._outlineExtra.push(o);
    }

    // Overlay de rachadura ao minerar bloco (destroy_stage_0 a 9)
    const destroyMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.destroyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), destroyMat);
    this.destroyMesh.visible = false;
    this.scene.add(this.destroyMesh);
    this._destroyStageTextures = new Map();

    // Luzes para materiais do GLB (blocos usam MeshBasicMaterial — não afetados)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const _dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    _dirLight.position.set(0.5, 1, 0.3);
    this.scene.add(_dirLight);

    this.playerModel = buildPlayerModel();
    this.scene.add(this.playerModel);

    // Capa do jogador local: textura salva (Crafthead) + reage a troca de skin/capa em tempo real
    this._capeSrc = getCapeChoice()?.png || null;
    this._unsubCape = [
      onSkinChange(() => { this._capeSrc = getCapeChoice()?.png || null; }),
      onCapeChange(() => { this._capeSrc = getCapeChoice()?.png || null; }),
    ];

    // Nickname acima da cabeça (invisível para o jogador local — só outros jogadores)
    this.nametag = createNametag(this.player.nomeJogador || 'Player');
    this.nametag.visible = false;
    this.playerModel.add(this.nametag);
    this.voiceIconLocal = createVoiceIcon();   // só aparece em 3ª pessoa (o modelo some em 1ª)
    this.playerModel.add(this.voiceIconLocal);

    // Modelo baseado em skin 64×64 (skinview3d) — já completo, sem GLB

    // Skin local: decodifica em paralelo com o pacote e os chunks e aplica ANTES do primeiro quadro (sem Steve piscando)
    const skinReady = preloadLocalSkin().then(() => applyPackSkin(this.playerModel, this.fpsArm));
    // Skins/capas dos jogadores da sala: todas em paralelo, enquanto o mundo carrega
    this._prefetchRemoteSkins([...(this.netManager?.room?.playerNames || [])].filter((n) => n && n !== this.player.nomeJogador));

    // ===== Carregamento com progresso real =====
    // Pesos (somam 100): pacote 30 · texturas 20 · chunks 42 · GPU 8. Cada etapa mede a própria fração (bytes baixados, texturas decodificadas,
    // chunks prontos, shaders compilados) e a barra é a soma ponderada: sobe só com trabalho de verdade, nunca por tempo. Texturas e chunks
    // andam juntos (não dependem um do outro); a GPU é aquecida por último, com tudo pronto.
    const WT = { pack: 30, tex: 20, chunks: 42, gpu: 8 };
    const fr = { pack: 0, tex: 0, chunks: 0, gpu: 0 };
    const mark = (n) => { try { performance.mark('mc:' + n); } catch { /* sem User Timing */ } };
    const report = (stage, f, msg) => {
      fr[stage] = Math.max(fr[stage], Math.min(1, f));
      const pct = WT.pack * fr.pack + WT.tex * fr.tex + WT.chunks * fr.chunks + WT.gpu * fr.gpu;
      this.onProgress?.(Math.min(100, Math.floor(pct)), msg);
    };
    mark('renderer');
    report('pack', 0, 'Carregando pacote de recursos...');
    await ensurePack((prog) => { if (prog) report('pack', prog.percent / 100, prog.status); });
    report('pack', 1, 'Pacote de recursos pronto');
    mark('pack');

    // PRD 21 RF-020: carregamento em fases — gerar só 5×5 chunks (radius 2) para a área inicial jogável.
    // O resto carrega progressivamente via growth do loadingRadius no loop (RF-021).
    const p = this.player.pos;
    this.loadingRadius = 2;
    this.targetRadius = settingsStore.get('device.renderDistance') || this.renderDistance;
    this.world._lastLoadingRadius = this.loadingRadius;
    // texturas reais do pacote (o atlas é compartilhado por todos os materiais: needsUpdate basta, sem refazer malhas)
    const texReady = isPackReady()
      ? loadRealTextures(false, (d, t) => report('tex', d / t, `Carregando texturas (${d}/${t})...`)).then(() => { report('tex', 1, 'Texturas prontas'); mark('textures'); })
      : Promise.resolve().then(() => report('tex', 1, 'Texturas prontas'));
    // PRD 23: as malhas chegam dos workers de forma assíncrona — espera curta pela área inicial
    const chunksReady = this.world.warmUp(this.scene, p.x, p.z, this.loadingRadius, p.y, 4000, (pct) => report('chunks', pct / 100, `Preparando área de spawn: ${pct}%`)).then(() => mark('chunks'));
    await Promise.all([texReady, chunksReady, skinReady]);
    if (this.disposed) return; // a tela foi fechada durante o carregamento
    perfMonitor.detectGpu(this.renderer.getContext());

    // Pacote: céu, skin e mapas de cor. Se o pacote chegou depois da geração, refaz a tinta e as malhas.
    const applyPackToScene = () => {
      this.sky.applyPack();
      applyPackSkin(this.playerModel, this.fpsArm);
    };
    if (isPackReady()) applyPackToScene();
    else {
      loadPack().then(async (ok) => {
        if (!ok || this.disposed) return;
        await initBiomeTint();
        this.world.refreshTints();
        applyPackToScene();
        loadRealTextures().then(() => { if (this.world?.atlas?.texture) this.world.atlas.texture.needsUpdate = true; });
      });
    }
    // Shaders e texturas na GPU antes de o jogador ver o jogo: sem engasgo no primeiro quadro, no primeiro bloco quebrado, na primeira mão
    report('gpu', 0, 'Compilando shaders...');
    await this._warmGpu();
    report('gpu', 1, 'Mundo pronto!');
    mark('gpu');

    this._onBeforeUnload = (e) => {
      if (this.onAutosave) {
        try { this.onAutosave(); } catch {}
      }
      if (this.world) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', this._onBeforeUnload);
    this.bindInput();
    musicManager.start();
    voiceChat._onVoiceStateChange = () => this.emitHud();
    this.lastTime = performance.now();
    this.fpsTime = this.lastTime;
    this.loop = this.loop.bind(this);
    this._scheduleNextFrame();
  }

  _scheduleNextFrame() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
  }

  _requestPointerLock() {
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* pointer lock not available (iframe) */ }
  }

  // O Chrome recusa travar o mouse de novo nos ~1,3 s depois de um Esc. "Voltar ao jogo" não espera isso: o jogo segue na hora e a captura é
  // tentada de 100 em 100 ms até pegar (o clique do botão vale como gesto por alguns segundos)
  resumeNow() {
    this.paused = false; this.mouseBtn = {}; this.keys = {}; this._wantLock = true;
    this.emitHud();
    if (this.touch || document.pointerLockElement === this.canvas) return;
    this._requestPointerLock();
    clearInterval(this._lockRetry);
    const t0 = performance.now();
    this._lockRetry = setInterval(() => {
      if (document.pointerLockElement === this.canvas || this.paused || this.disposed || performance.now() - t0 > 4000) { clearInterval(this._lockRetry); return; }
      this._requestPointerLock();
    }, 100);
  }

  // Retomou com Esc sem o mouse travado: o primeiro clique/tecla (gesto válido) recaptura
  _grabIfWanted() {
    if (this._wantLock && !this.paused && !this.chatOpen && document.pointerLockElement !== this.canvas) this._requestPointerLock();
  }

  bindInput() {
    this._onKeyDown = (e) => this.onKey(e, true);
    this._onKeyUp = (e) => this.onKey(e, false);
    this._onMouseDown = (e) => {
      this._grabIfWanted();
      this.mouseBtn[e.button] = true;
      if (!this.paused && !this.chatOpen && !this.player?.isDead && !this.player?.sleeping) {
        const keys = settingsStore.get('user.keys') || {};
        const atkCode = keys.attack || 'Mouse0';
        const useCode = keys.use || 'Mouse2';
        if (atkCode === 'Mouse' + e.button) {
          this._pendingAttackClick = true;
          this.breakCd = 0; // Novo clique físico zera o delay de quebrar (padrão 1.8.9)
        }
        if (useCode === 'Mouse' + e.button) {
          this._pendingUseClick = true;
          this.placeCd = 0; // Novo clique físico zera o delay de colocar bloco (fast-place 1.8.9)
        }
      }
      const pickKey = (settingsStore.get('user.keys') || {}).pick;
      if (pickKey && pickKey.startsWith('Mouse') && parseInt(pickKey.slice(5)) === e.button) {
        if (!this.paused && !this.chatOpen) this.pickBlock();
      }
    };
    this._onMouseUp = (e) => { this.mouseBtn[e.button] = false; };
    this._onMouseMove = (e) => this.onMouseMove(e);
    this._onWheel = (e) => this.onWheel(e);
    this._onResize = () => this.onResize();
    this._onContext = (e) => e.preventDefault();
    // Clique no jogo sempre tenta recapturar o mouse se ele não está travado (cobre o pedido de lock recusado pelo navegador)
    this._onClick = () => { if (!this.chatOpen && document.pointerLockElement !== this.canvas) this._requestPointerLock(); };
    this._onPLChange = () => {
      if (this.chatOpen || this.netManager) {
        this.paused = false;
      } else if (this.guiOpenFn?.() && document.pointerLockElement !== this.canvas) {
        // inventário, bancada, fornalha, baú... soltam o mouse de propósito: isso não é pausa. O Esc fecha a tela e só o Esc seguinte pausa.
        this.paused = false; this._wantLock = true;
      } else if (document.pointerLockElement === this.canvas) {
        this.paused = false; this._wantLock = false;
      } else {
        this.paused = true; this._wantLock = false;
      }
      if (!this.paused) this.mouseBtn = {};
      this.keys = {};
    };
    this._onBlur = () => { this.keys = {}; this.mouseBtn = {}; this.f3Held = false; this.endFreeLook(); };
    this.world.onTntIgnite = (x, y, z) => this.spawnTNT(x, y, z);
    this._bgInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden && this.netManager && !this.disposed) {
        this.tick();
      }
    }, 50);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('wheel', this._onWheel, { passive: true });
    window.addEventListener('resize', this._onResize);
    window.addEventListener('contextmenu', this._onContext);
    this.canvas.addEventListener('click', this._onClick);
    document.addEventListener('pointerlockchange', this._onPLChange);
  }

  // REGRA DO CHAT (não mexer sem testar): abrir o chat solta o mouse (exitPointerLock) e fecha com Enter/Esc devolvendo o mouse.
  // Enviar mensagem NÃO pode pausar o jogo, então o fechamento tem 3 passos, nesta ordem:
  //   1) chatOpen = false  2) paused = false (senão o menu de pausa aparece um quadro)  3) requestPointerLock().
  // O `pointerlockchange` que chega depois recalcula `paused` a partir do mouse travado de verdade (ver _onPLChange).
  // Todo caminho que fecha o chat (Enter, Enter vazio, Esc, clique fora) deve chamar closeChat(), nunca só `chatOpen = false`.
  closeChat() {
    this.chatOpen = false;
    this.paused = false;
    this._requestPointerLock();
    this.emitHud();
  }

  isAction(action) {
    const keys = settingsStore.get('user.keys') || {};
    const code = keys[action];
    if (!code) return false;
    if (code.startsWith('Mouse')) return !!this.mouseBtn[parseInt(code.slice(5))];
    return !!this.keys[code];
  }

  onKey(e, down) {
    // Se o usuário está digitando em um campo de texto (modal de feedback, inputs, etc.), não move o personagem nem processa atalhos do jogo
    const activeTag = document.activeElement?.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable) {
      if (!down) this.keys[e.code] = false;
      return;
    }

    // Bloquear teclas do navegador que atrapalham a jogabilidade (F1 = Ajuda Brave, F7 = Navegação com cursor)
    if (e.code === 'F1' || e.key === 'F1' || e.code === 'F7' || e.key === 'F7') {
      e.preventDefault();
      if (!down) return;
    }

    // Alt+letra é atalho do navegador (Alt+D foca a barra de endereço, Alt+F abre o menu...): dentro do jogo ele é só "olhar em volta" + andar
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code !== 'F4' && !this.paused) e.preventDefault();
    // Soltar uma tecla é sempre registrado, em qualquer tela: senão ela "gruda" (ou falha) depois de chat/inventário/F3
    if (!down) this.keys[e.code] = false;
    // Perspective: segurar ALT olha em volta sem virar o corpo; soltar volta (soltar vale em qualquer tela)
    if (e.code === 'AltLeft' || e.code === 'AltRight') {
      if (!down) this.endFreeLook();
      else {
        e.preventDefault();
        if (!e.repeat && clientStore.isOn('perspective') && !this.paused && !this.chatOpen && !this.containerOpenFn?.() && !this.player?.isDead) this.startFreeLook();
      }
      return;
    }
    if (this.chatOpen) {
      if (down && e.code === 'Escape') { this.closeChat(); }
      return;
    }
    const keys = settingsStore.get('user.keys') || {};
    const chatKey = keys.chat || 'KeyT';
    const cmdKey = keys.command || 'Slash';
    const invKey = keys.inventory || 'KeyE';

    if (this.player?.sleeping) {
      if (down && (e.code === 'Space' || e.code === keys.jump)) {
        e.preventDefault();
        this.wakeUp();
        return;
      }
      if (down && (e.code === chatKey || e.code === cmdKey || e.key === '/')) {
        this.chatPrefill = e.code === chatKey ? '' : '/';
        this.chatOpen = true;
        document.exitPointerLock?.();
        this.emitHud();
        e.preventDefault();
        return;
      }
      return;
    }
    // Shift direito: menu do Mind Client
    if (down && !e.repeat && e.code === 'ShiftRight') {
      e.preventDefault();
      this.onToggleClientMenu?.();
      return;
    }
    const playerListKey = keys.playerList || 'Tab';
    if (e.code === playerListKey || e.code === 'Tab') {
      e.preventDefault();
      this.playerListOpen = down && clientStore.isOn('tab');
      this.emitHud();
      return;
    }
    if (down && !e.repeat && voiceChat.enabled && e.code === (keys.voiceMute || 'KeyV')) { voiceChat.toggleMute(); return; }
    if (down && !e.repeat && (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === keys.sprint)) {
      this.sprintToggled = !this.sprintToggled;
    }
    if (down && e.code === invKey) {
      if (this.chatOpen) return;
      e.preventDefault();
      this.unlockAchievement('open_inventory');
      this.onToggleInventory?.();
      return;
    }
    if (down && !this.paused) {
      // "/" abre o chat já com a barra digitada (GuiChat do 1.8.9). A barra vem por tecla física (Slash, teclado US) ou pelo
      // caractere, que cobre o ABNT2, onde ela fica numa tecla diferente
      if (e.code === chatKey || e.code === cmdKey || e.key === '/') {
        this.chatPrefill = e.code === chatKey ? '' : '/';
        this.chatOpen = true;
        document.exitPointerLock?.();
        this.emitHud();
        e.preventDefault();
        return;
      }
    }
    // F3: tocar alterna o painel; segurar F3 + letra é atalho (A recarrega chunks etc.) e não alterna
    if (e.code === keys.debug) {
      e.preventDefault();
      if (down && !e.repeat) { this.f3Held = true; this.f3Used = false; }
      else if (!down) { if (this.f3Held && !this.f3Used) this.f3 = !this.f3; this.f3Held = false; }
      return;
    }
    // F3 shortcuts (PRD 12 RF-041)
    if (down && this.f3Held) {
      this.f3Used = true;
      if (e.code === 'KeyA') { e.preventDefault(); this.reloadChunks(); return; }
      if (e.code === 'KeyB') { e.preventDefault(); this.showHitboxes = !this.showHitboxes; return; }
      if (e.code === 'KeyG') { e.preventDefault(); this.showChunkBorders = !this.showChunkBorders; return; }
      if (e.code === 'KeyN') {
        e.preventDefault();
        if (this.player.gameMode === 'creative') this.player.gameMode = 'spectator';
        else if (this.player.gameMode === 'spectator') this.player.gameMode = 'creative';
        return;
      }
      if (e.code === 'KeyT') { e.preventDefault(); this.reloadAssets(); return; }
      if (e.code === 'KeyV') { e.preventDefault(); this.showChunkBorders = !this.showChunkBorders; return; }
    }
    if (down && e.code === keys.perspective) { e.preventDefault(); this.perspective = ((this.perspective || 0) + 1) % 3; return; }
    if (down && e.code === keys.drop) { e.preventDefault(); this.dropHeldItem(); return; }
    if (down && e.code === keys.hideHud) { this.hideHud = !this.hideHud; return; }
    if (down && e.code === keys.smoothCamera) { settingsStore.set('device.smoothCamera', !settingsStore.get('device.smoothCamera')); return; }
    const fsKey = keys.fullscreen || 'F11';
    if (down && (e.code === fsKey || e.code === 'F11' || e.key === 'F11')) {
      e.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
      return;
    }
    if (down && e.code === 'Escape') {
      // Esc, Esc, Esc rápido como no jogo original: o navegador devolve o mouse ao primeiro Esc, mas NÃO aceita Esc como gesto para travar
      // de novo — então pausar/retomar é feito aqui, em software, na hora. O mouse é recapturado no primeiro clique/tecla (ver _grabIfWanted).
      if (e.repeat || this.netManager || this.chatOpen || this.guiOpenFn?.()) return;
      if (this.paused) { this.resumeNow(); }
      else if (document.pointerLockElement !== this.canvas) { this.paused = true; this._wantLock = false; this.emitHud(); }
      return;
    }
    this._grabIfWanted();

    this.keys[e.code] = down;
    if (down && !e.repeat) { // repetição de tecla (segurar W/espaço) não conta como toque duplo
      if (e.code === keys.forward) {
        const now = performance.now();
        this.wTapCount = now - this.lastWTap < 350 ? this.wTapCount + 1 : 1;
        this.lastWTap = now;
      }
      if (e.code === keys.jump) {
        const now = performance.now();
        this.spaceTapCount = now - this.lastSpaceTap < 350 ? this.spaceTapCount + 1 : 1;
        this.lastSpaceTap = now;
        if (this.player.gameMode === 'creative' && this.spaceTapCount >= 2) this.player.flying = !this.player.flying;
      }
      for (let i = 1; i <= 9; i++) {
        if (e.code === keys['slot' + i]) { this.player.selectedSlot = i - 1; break; }
      }
    }
  }

  onMouseMove(e) {
    if (this.paused || this.chatOpen || this.player?.isDead || this.player?.sleeping) return;
    if (document.pointerLockElement !== this.canvas && !this.netManager) return;
    const sensPct = settingsStore.get('user.mouseSensitivity') || 100;
    // Vanilla 1.8.9: s = pct/200 (slider 0–200%); graus/px = 1,2 × (0,6·s + 0,2)³ → 100% = 0,15°/px
    const s = sensPct / 200;
    const f = s * 0.6 + 0.2;
    const mult = f * f * f * 8;
    let radPerPx = mult * 0.15 * Math.PI / 180;
    // Zoom (OptiFine): sensibilidade de zoom reduz a gira enquanto a tecla de zoom está segurada
    if (this.isZooming()) {
      radPerPx *= (settingsStore.get('user.zoomSensitivity') || 50) / 100;
    }
    // Limite máximo de deslocamento por evento para evitar giro brusco de 360° durante congelamentos/quedas de frame
    const maxDelta = 120;
    const dx = Math.max(-maxDelta, Math.min(maxDelta, e.movementX || 0));
    const dy = Math.max(-maxDelta, Math.min(maxDelta, e.movementY || 0));
    this._lookBy(dx * radPerPx, dy * radPerPx);
  }

  // Gira a câmera (rad): usado pelo mouse e pelo toque. Em "olhar em volta" (ALT) só a câmera gira, não o corpo.
  _lookBy(yaw, pitch) {
    const invert = settingsStore.get('user.invertMouse') ? -1 : 1;
    if (this.freeLook.on) {
      this.freeLook.yaw += yaw;
      this.freeLook.pitch = Math.max(-1.45, Math.min(1.45, this.freeLook.pitch + pitch * invert));
      return;
    }
    this.player.yaw += yaw;
    this.player.pitch += pitch * invert;
    const lim = Math.PI / 2 - 0.001;
    this.player.pitch = Math.max(-lim, Math.min(lim, this.player.pitch));
  }

  // ===== Controles de toque (celular). Reaproveitam as mesmas rotas do teclado e do mouse, com as teclas que o jogador configurou =====
  _touchBlocked() { return this.paused || this.chatOpen || !!this.player?.isDead || !!this.player?.sleeping; }

  // Arrastar o dedo na tela: 0,5°/px a 100% (o 1.8.9 usa 0,15°/px com mouse; o dedo percorre muito menos tela, e 0,25 ficou lento no teste em iPhone).
  // A sensibilidade é ajustável em Controles (10–300%).
  touchLook(dx, dy) {
    if (this._touchBlocked()) return;
    const sens = settingsStore.get('user.touchLookSensitivity') ?? 100;
    const rad = (0.5 * Math.PI / 180) * (sens / 100);
    const m = 60;   // um quadro congelado não vira uma volta inteira
    this._lookBy(Math.max(-m, Math.min(m, dx)) * rad, Math.max(-m, Math.min(m, dy)) * rad);
  }

  // Aperta/solta a tecla de uma ação (inventory, chat, jump, drop, perspective...) pelo mesmo caminho do teclado
  touchKey(action, down) {
    const code = (settingsStore.get('user.keys') || {})[action];
    if (!code || code.startsWith('Mouse')) return;
    this.onKey({ code, key: '', repeat: false, preventDefault() {} }, !!down);
  }

  // Botão do mouse virtual (0 atacar/quebrar, 2 usar/colocar), pelo mesmo caminho do clique
  touchButton(btn, down) {
    if (down) this._onMouseDown({ button: btn }); else this._onMouseUp({ button: btn });
  }

  // Joystick: liga/desliga as teclas de andar configuradas; correr no fim do curso para a frente
  touchMove(fw, bk, lf, rt, sprint) {
    const k = settingsStore.get('user.keys') || {};
    this.keys[k.forward] = !!fw; this.keys[k.back] = !!bk; this.keys[k.left] = !!lf; this.keys[k.right] = !!rt;
    this.sprintToggled = !!(sprint && fw);
  }

  // Toque rápido: bate se há mob na mira, senão usa/coloca
  touchTap() {
    if (this._touchBlocked()) return;
    const btn = this.raycastEntity() ? 0 : 2;
    this.touchButton(btn, true);
    this.touchButton(btn, false);
  }

  // Toque segurado: quebrar/bater; com comida ou arco na mão, segurar é usar (comer, puxar a corda)
  touchHoldButton() {
    const it = this.getHeldItem();
    return it && (isBow(it) || isFood(it.id)) ? 2 : 0;
  }

  touchPause() { this.paused = true; this.touchReset(); this.emitHud(); }
  touchResume() { this.paused = false; this.touchReset(); this.emitHud(); }
  touchReset() { this.keys = {}; this.mouseBtn = {}; this.sprintToggled = false; }

  // Aquece a GPU: compila os shaders de tudo que a cena já tem (e de objetos que só aparecem depois de uma ação, como as partículas),
  // sobe o atlas com as texturas reais e desenha um quadro. Roda atrás da tela de carregamento.
  async _warmGpu() {
    const r = this.renderer;
    try {
      r.initTexture?.(this.world.atlas.texture);
      const pm = this.particles;
      const wasVisible = pm.mesh.visible, wasCount = pm.geometry.instanceCount;
      pm.mesh.visible = true; pm.geometry.instanceCount = 1;     // só para o compile enxergar o material
      this.camera.updateMatrixWorld();
      if (r.compileAsync) await r.compileAsync(this.scene, this.camera); else r.compile(this.scene, this.camera);
      pm.mesh.visible = wasVisible; pm.geometry.instanceCount = wasCount;
      if (this.fpsScene && this.fpsCamera) {
        if (r.compileAsync) await r.compileAsync(this.fpsScene, this.fpsCamera); else r.compile(this.fpsScene, this.fpsCamera);
      }
      r.render(this.scene, this.camera);
    } catch (e) { console.warn('[GPU] aquecimento falhou (o jogo segue normal):', e); }
  }

  startFreeLook() {
    if (this.freeLook.on) return;
    this.freeLook = { on: true, yaw: 0, pitch: 0, saved: this.perspective || 0 };
    this.perspective = 1;
  }

  endFreeLook() {
    if (!this.freeLook.on) return;
    this.perspective = this.freeLook.saved;
    this.freeLook = { on: false, yaw: 0, pitch: 0, saved: 0 };
  }

  isZooming() {
    const zoomKey = (settingsStore.get('user.keys') || {}).zoom;
    return !!(zoomKey && !zoomKey.startsWith('Mouse') && this.keys[zoomKey]);
  }

  onWheel(e) {
    if (this.paused || this.chatOpen || this.player?.isDead) return;
    let s = this.player.selectedSlot + Math.sign(e.deltaY);
    if (s < 0) s = 8; if (s > 8) s = 0;
    this.player.selectedSlot = s;
  }

  onResize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const resScale = (settingsStore.get('device.resolutionScale') || 100) / 100;
    this.renderer.setPixelRatio(resScale);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.fpsCamera) {
      this.fpsCamera.aspect = w / h;
      this.fpsCamera.updateProjectionMatrix();
    }
    this.renderer.setSize(w, h, false);
  }

  // F3+A — recarregar chunks (PRD 12 RF-041)
  reloadChunks() {
    if (!this.world) return;
    for (const c of this.world.chunks.values()) {
      this.world.markAllSectionsDirty(c);
    }
  }

  // F3+T — recarregar assets (PRD 12 RF-041)
  async reloadAssets() {
    await reloadRealTextures();
    if (this.world?.atlas?.texture) this.world.atlas.texture.needsUpdate = true;
    this.sky?.applyPack?.();
    applyPackSkin(this.playerModel, this.fpsArm);
    this.reloadChunks();
    if (this.updateFirstPersonHand) this.updateFirstPersonHand();
    this.emitHud(true);
  }

  eyePos() {
    const p = this.player.pos;
    const eye = this.player.sneaking ? PLAYER.eyeSneak : PLAYER.eye;
    return { x: p.x, y: p.y + eye, z: p.z };
  }

  lookDir() {
    return lookDirFromAngles(this.player.yaw, this.player.pitch);
  }

  raycast(force = false) {
    const p = this.player;
    if (
      !force &&
      this._cachedRaycastFrame === this.frame &&
      p &&
      this._rcYaw === p.yaw &&
      this._rcPitch === p.pitch &&
      this._rcX === p.pos.x &&
      this._rcY === p.pos.y &&
      this._rcZ === p.pos.z
    ) {
      return this._cachedRaycast;
    }

    const eye = this.eyePos();
    const dir = this.lookDir();
    const reach = this.player.gameMode === 'creative' ? PLAYER.reachCreative : PLAYER.reach;
    let x = Math.floor(eye.x), y = Math.floor(eye.y), z = Math.floor(eye.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const tdx = sx !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tdy = sy !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tdz = sz !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tmx = sx !== 0 ? ((sx > 0 ? x + 1 - eye.x : eye.x - x) / Math.abs(dir.x)) : Infinity;
    let tmy = sy !== 0 ? ((sy > 0 ? y + 1 - eye.y : eye.y - y) / Math.abs(dir.y)) : Infinity;
    let tmz = sz !== 0 ? ((sz > 0 ? z + 1 - eye.z : eye.z - z) / Math.abs(dir.z)) : Infinity;
    let nx = 0, ny = 0, nz = 0;
    let tEnter = 0; // distância em que o raio entra na célula atual
    const getState = (a, b, c) => this.world.getBlock(a, b, c);
    let result = null;

    for (let i = 0; i < 80; i++) {
      const s = this.world.getBlock(x, y, z);
      const id = stateId(s);
      if (id !== 0 && !isWater(id) && !isLava(id)) {
        const blk = getBlock(id);
        if (hasShape(blk)) {
          // lajes e escadas: só vale se o raio acerta alguma das caixas (mirar no vão não seleciona o bloco)
          let best = null;
          for (const box of blockBoxes(s, getState, x, y, z)) {
            const r = rayBox(eye.x - x, eye.y - y, eye.z - z, dir.x, dir.y, dir.z, box, reach);
            if (r && (!best || r.t < best.t)) best = r;
          }
          if (best) {
            result = { x, y, z, nx: best.nx, ny: best.ny, nz: best.nz, id, meta: stateMeta(s),
              hx: eye.x + dir.x * best.t, hy: eye.y + dir.y * best.t, hz: eye.z + dir.z * best.t };
            break;
          }
        } else {
          result = { x, y, z, nx, ny, nz, id, meta: stateMeta(s),
            hx: eye.x + dir.x * tEnter, hy: eye.y + dir.y * tEnter, hz: eye.z + dir.z * tEnter };
          break;
        }
      }
      if (tmx < tmy && tmx < tmz) {
        if (tmx > reach) break;
        tEnter = tmx; x += sx; nx = -sx; ny = 0; nz = 0; tmx += tdx;
      } else if (tmy < tmz) {
        if (tmy > reach) break;
        tEnter = tmy; y += sy; nx = 0; ny = -sy; nz = 0; tmy += tdy;
      } else {
        if (tmz > reach) break;
        tEnter = tmz; z += sz; nx = 0; ny = 0; nz = -sz; tmz += tdz;
      }
    }

    if (p) {
      this._cachedRaycastFrame = this.frame;
      this._rcYaw = p.yaw;
      this._rcPitch = p.pitch;
      this._rcX = p.pos.x;
      this._rcY = p.pos.y;
      this._rcZ = p.pos.z;
      this._cachedRaycast = result;
    }
    return result;
  }

  breakBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const block = getBlock(hit.id);
    if (block.hardness < 0 && this.player.gameMode !== 'creative') return;   // no criativo quebra até bedrock e bloco de comando, como no 1.8.9
    this.particles?.spawnBlockBreak(hit.x, hit.y, hit.z, hit.id, hit.meta || 0);
    playBlockBreakSound(hit.id, { x: hit.x, y: hit.y, z: hit.z });
    const _brokenState = this.world.getBlock(hit.x, hit.y, hit.z);
    this.world.setBlock(hit.x, hit.y, hit.z, 0);
    this.breakBedPartner(hit.x, hit.y, hit.z, _brokenState);
    this._cachedRaycastFrame = -1;
    this.onBlockChange?.(hit.x, hit.y, hit.z, 0);
    this.netManager?.sendBlockChange?.(hit.x, hit.y, hit.z, 0);
    this.breakCd = 5;

    handleBlockBreakPhysics(this.world, hit.x, hit.y, hit.z, (dropItem, pos) => {
      this.particles?.spawnBlockBreak(pos.x, pos.y, pos.z, dropItem.id, dropItem.meta || 0);
      this.onBlockChange?.(pos.x, pos.y, pos.z, 0);
      this.netManager?.sendBlockChange?.(pos.x, pos.y, pos.z, 0);
    });
  }

  interactBlock(p) {
    if (p.sneaking) return false; // Shift previne interação (permite colocar bloco no baú/bancada)
    const hit = this.raycast();
    if (!hit) return false;
    const blockId = hit.id;
    const blk = getBlock(blockId);
    const meta = hit.meta || 0;
    if (blk.model === 'gate' || blk.model === 'trapdoor' || blk.model === 'door') { // madeira abre/fecha com o botão direito; ferro só com redstone
      if (blockId === 71 || blockId === 167) return true;
      this.toggleOpenable(hit.x, hit.y, hit.z);
      return true;
    }
    if (blockId === 26) { // Cama
      this.trySleep(hit.x, hit.y, hit.z);
      return true;
    }
    if (blockId === 58) { // Bancada de trabalho
      this.onOpenCraftingTable?.();
      return true;
    }
    if (blockId === 61 || blockId === 62) { // Fornalha
      this.onOpenFurnace?.(hit.x, hit.y, hit.z);
      return true;
    }
    if (blockId === 54 || blockId === 146) { // Baú e baú armadilhado
      this.onOpenChest?.(hit.x, hit.y, hit.z);
      return true;
    }
    if (blockId === 130) { // Baú do Ender: todos os baús do Ender abrem o mesmo conteúdo
      this.onOpenChest?.(hit.x, hit.y, hit.z, true);
      return true;
    }
    const at = { pos: { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 } };
    if (blockId === 140) { // vaso de flor: planta o que está na mão (muda, flor, cogumelo, cacto, arbusto morto, samambaia) ou devolve o que tinha
      const held = this.getHeldItem();
      if (meta === 0) {
        const pm = held && held.id ? potMetaFor(held.id, held.meta || 0) : -1;
        if (pm <= 0) return false;
        this._setBlockSync(hit.x, hit.y, hit.z, packState(140, pm));
        playBlockPlaceSound(2, at.pos);
        this._consumeHeld(held);
        return true;
      }
      const c = POT_CONTENTS[meta];
      if (!c) return false;
      this._setBlockSync(hit.x, hit.y, hit.z, packState(140, 0));
      const left = this.player.gameMode === 'creative' ? null : addItem(this.inventory, { id: c.item.id, count: 1, meta: c.item.meta });
      if (left) this.itemEntities?.spawnItem(left, { x: hit.x + 0.5, y: hit.y + 1, z: hit.z + 0.5 }, { x: 0, y: 1.5, z: 0 }, 10);
      return true;
    }
    if (blockId === 69) { // Alavanca: liga/desliga
      this._setBlockSync(hit.x, hit.y, hit.z, packState(69, meta ^ 8));
      playEvent('block.lever.click', { ...at, pitch: (meta & 8) ? 0.5 : 0.6 });
      return true;
    }
    if ((blockId === 77 || blockId === 143) && !(meta & 8)) { // Botão: aperta e solta sozinho (pedra 1 s, madeira 1,5 s)
      this._setBlockSync(hit.x, hit.y, hit.z, packState(blockId, meta | 8));
      const ev = blockId === 77 ? 'stone_button' : 'wooden_button';
      playEvent(`block.${ev}.click_on`, at);
      this._schedule(blockId === 77 ? 20 : 30, () => {
        const cur = this.world.getBlock(hit.x, hit.y, hit.z);
        if (stateId(cur) !== blockId) return;
        this._setBlockSync(hit.x, hit.y, hit.z, packState(blockId, stateMeta(cur) & 7));
        playEvent(`block.${ev}.click_off`, at);
      });
      return true;
    }
    if (blockId === 77 || blockId === 143) return true;
    if (blockId === 92) { // Bolo: uma fatia por clique
      if (p.hunger >= 20 && p.gameMode !== 'creative') return true;
      p.hunger = Math.min(20, (p.hunger ?? 20) + 2);
      p.saturation = Math.min(p.hunger, (p.saturation ?? 0) + 0.4);
      playEatSound(p.pos);
      this._setBlockSync(hit.x, hit.y, hit.z, (meta & 7) >= 6 ? 0 : packState(92, (meta & 7) + 1));
      return true;
    }
    if (blockId === 25) { // Bloco de notas: cada clique sobe um tom
      const n = (meta + 1) % 25;
      this._setBlockSync(hit.x, hit.y, hit.z, packState(25, n));
      playEvent('block.note_block.harp', { ...at, pitch: Math.pow(2, (n - 12) / 12) });
      return true;
    }
    if (blockId === 93 || blockId === 94) { // Repetidor: cada clique aumenta o atraso (bits 2-3)
      const d = (((meta >> 2) & 3) + 1) & 3;
      this._setBlockSync(hit.x, hit.y, hit.z, packState(blockId, (meta & 3) | (d << 2)));
      playEvent('block.comparator.click', at);
      return true;
    }
    if (SEM_TELA.has(blockId)) { this.onChatMessage?.({ type: 'system', text: `§7${blk.namePt}: a tela deste bloco ainda não existe no jogo`, timestamp: Date.now() }); return true; }
    return false;
  }

  // Placa de pressão (de pedra e de madeira): liga (meta 1) enquanto o jogador está em cima e desliga quando ele sai
  _tickPlates() {
    const p = this.player.pos;
    const x = Math.floor(p.x), y = Math.floor(p.y + 0.001), z = Math.floor(p.z);
    const id = stateId(this.world.getBlock(x, y, z));
    const on = (id === 70 || id === 72) ? { x, y, z, id } : null;
    const prev = this._plate;
    const click = (pl, state) => playEvent(`block.${pl.id === 70 ? 'stone' : 'wooden'}_pressure_plate.click_${state}`, { pos: { x: pl.x + 0.5, y: pl.y + 0.1, z: pl.z + 0.5 } });
    if (prev && (!on || prev.x !== on.x || prev.y !== on.y || prev.z !== on.z)) {
      const cur = this.world.getBlock(prev.x, prev.y, prev.z);
      if (stateId(cur) === prev.id) { this._setBlockSync(prev.x, prev.y, prev.z, packState(prev.id, 0)); click(prev, 'off'); }
      this._plate = null;
    }
    if (on && !this._plate) {
      this._setBlockSync(x, y, z, packState(id, 1));
      click(on, 'on');
      this._plate = on;
    }
  }

  // Tarefas para daqui a N ticks (botão que solta sozinho, p. ex.); roda no tick do jogo
  _schedule(ticks, fn) { (this._sched || (this._sched = [])).push({ at: this.worldTime + ticks, fn }); }
  _tickScheduled() {
    if (!this._sched || !this._sched.length) return;
    const due = this._sched.filter(t => t.at <= this.worldTime);
    if (!due.length) return;
    this._sched = this._sched.filter(t => t.at > this.worldTime);
    for (const t of due) t.fn();
  }

  placeBlock() {
    const slot = this.player.hotbar[this.player.selectedSlot];
    if (slot && slot.id === 111) {   // vitória-régia: o raio de blocos atravessa a água, então ela tem a própria mira (na superfície da água)
      const src = this.raycastFluidSource();
      if (!src || src.id !== 9 || stateId(this.world.getBlock(src.x, src.y + 1, src.z)) !== 0) return;
      this._setBlockSync(src.x, src.y + 1, src.z, packState(111, 0));
      playBlockPlaceSound(111, { x: src.x, y: src.y + 1, z: src.z });
      this._consumeHeld(slot);
      this.placeCd = 4;
      return;
    }
    const hit = this.raycast();
    if (!hit) return;
    if (!slot || !slot.id) return;
    // getBlock() devolve PEDRA para id desconhecido: item que não é bloco (graveto, balde, comida) nunca pode ser colocado
    if (slot.id !== 355 && !DOOR_ITEMS[slot.id] && !ITEM_TO_BLOCK[slot.id] && !BLOCKS[slot.id]) return;
    if (this.dimension === 'nether' && (slot.id === 8 || slot.id === 9)) {   // no Nether a água evapora ao ser colocada (só o caldeirão guarda água)
      playEvent('block.fire.extinguish', { pos: { x: hit.x + hit.nx + 0.5, y: hit.y + hit.ny + 0.5, z: hit.z + hit.nz + 0.5 }, volume: 0.5 });
      this.placeCd = 4;
      return;
    }
    let px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
    if (DOOR_ITEMS[slot.id]) { this.placeDoor(hit, slot, px, py, pz); return; }
    // o item da placa vira placa na parede quando se clica na lateral de um bloco, e em pé quando se clica em cima
    const blockId = slot.id === 323 && hit.ny === 0 ? 68 : slot.id === 397 ? (SKULL_BLOCKS[slot.meta || 0] ?? 144) : (ITEM_TO_BLOCK[slot.id] ?? slot.id);
    const placing = getBlock(blockId);
    let meta = slot.id === 397 ? 0 : (slot.meta || 0);
    let placeId = blockId;
    if (slot.id === 355) { this.placeBed(hit, slot, px, py, pz); return; }
    const getS = (a, b, c) => this.world.getBlock(a, b, c);
    let plan = computePlacement(placing, meta, hit, this.player.yaw, getS);
    if (!plan && (blockId === 93 || blockId === 94 || blockId === 149 || blockId === 150)) {
      // repetidor e comparador: a saída aponta para onde o jogador olha; só assentam em bloco sólido
      const below = getBlock(stateId(getS(px, py - 1, pz)));
      if (!below || !below.solid) return;
      plan = { x: px, y: py, z: pz, id: blockId, meta: Math.floor(this.player.yaw * 2 / Math.PI + 0.5) & 3 };
    }
    if (!plan && blockId === 115) { // verruga do Nether: só em areia das almas
      if (stateId(getS(px, py - 1, pz)) !== 88) return;
    }
    if (plan && plan.invalid) return; // ex.: escada de mão sem parede
    if (plan) { px = plan.x; py = plan.y; pz = plan.z; placeId = plan.id; meta = plan.meta; }
    if (hasShape(getBlock(placeId))) { if (this._shapeHitsPlayer(placeId, meta, px, py, pz)) return; }
    else if (this.intersectsPlayer(px, py, pz)) return;
    const targetState = this.world.getBlock(px, py, pz);
    const targetId = stateId(targetState);
    const mergingInPlace = placeId !== blockId; // laje dupla: o bloco existente é a laje que está sendo completada
    if (!mergingInPlace && targetId !== 0 && !isFluid(targetId) && !isReplaceable(targetId)) return;
    if (slot.id === 17 || slot.id === 162) {
      // tronco: a variante (bits 0-1) vem do item e o eixo (bits 2-3) da face clicada: 0 vertical, 1 leste-oeste, 2 norte-sul
      const variant = meta & (getBlock(slot.id).variantMask ?? 3);
      meta = variant | ((hit.ny !== 0 ? 0 : hit.nx !== 0 ? 1 : 2) << 2);
    }
    if (placing.hugeMushroom) meta = 14;   // cogumelo gigante: pele nos seis lados, como o do criativo
    const newState = packState(placeId, meta);
    playBlockPlaceSound(placeId, { x: px, y: py, z: pz });
    this.world.setBlock(px, py, pz, newState);
    if (placeId === 175) this._setBlockSync(px, py + 1, pz, packState(175, 8));   // planta alta: a metade de cima junto
    this._cachedRaycastFrame = -1;
    this.onBlockChange?.(px, py, pz, newState);
    this.netManager?.sendBlockChange?.(px, py, pz, newState);
    if (FALLING_BLOCK_IDS.has(placeId)) {
      const belowState = this.world.getBlock(px, py - 1, pz);
      const belowId = stateId(belowState);
      if (canFallThrough(belowId)) {
        triggerFallingColumn(this.world, px, py, pz);
      }
    }
    if (this.player.gameMode === 'survival' || this.player.gameMode === 'adventure') {
      slot.count = (slot.count || 1) - 1;
      if (slot.count <= 0) {
        this.player.hotbar[this.player.selectedSlot] = null;
      }
    }
    if (this.player.stats) {
      this.player.stats.blocksPlaced++;
      addStatByType(this.player.stats, 'blocksPlacedByType', getBlock(slot.id).namePt);
      const rsIds = [55, 69, 70, 72, 75, 76, 77, 93, 94, 123, 124, 149, 150, 151, 154];
      if (rsIds.includes(slot.id)) this.player.stats.redstonePlaced++;
    }
    this.placeCd = 4;
  }

  // Botão direito em entidade com item na mão: tesoura tosquia ovelha (1–3 de lã) e gasta a tesoura
  useOnEntity(slot) {
    if (!slot || slot.id !== 359) return false;
    const hit = this.raycastEntity();
    const e = hit && hit.entity;
    if (!e || e.typeId !== 'sheep' || e.sheared || e.isBaby || e.isDead) return false;
    e.sheared = true;
    const n = 1 + Math.floor(Math.random() * 3);
    this.itemEntities?.spawnItem({ id: 35, count: n, meta: e.woolColor || 0 }, { x: e.pos.x, y: e.pos.y + 1, z: e.pos.z }, { x: (Math.random() - 0.5) * 0.4, y: 2, z: (Math.random() - 0.5) * 0.4 }, 10);
    playEvent('entity.sheep.shear', { pos: e.pos });
    this._wearHeld(slot);
    return true;
  }

  _setBlockSync(x, y, z, state) {
    this.world.setBlock(x, y, z, state);
    this._cachedRaycastFrame = -1;
    this.onBlockChange?.(x, y, z, state);
    this.netManager?.sendBlockChange?.(x, y, z, state);
  }

  // Raio que PARA em fluido (o raycast normal atravessa água e lava): fonte = água/lava parada (ids 9 e 11)
  raycastFluidSource() {
    const eye = this.eyePos(), dir = this.lookDir();
    const reach = this.player.gameMode === 'creative' ? PLAYER.reachCreative : PLAYER.reach;
    for (let t = 0; t <= reach; t += 0.05) {
      const x = Math.floor(eye.x + dir.x * t), y = Math.floor(eye.y + dir.y * t), z = Math.floor(eye.z + dir.z * t);
      const id = stateId(this.world.getBlock(x, y, z));
      if (id === 9 || id === 11) return { x, y, z, id };
      if (id !== 0 && !isFluid(id) && !isReplaceable(id)) return null;
    }
    return null;
  }

  _consumeHeld(slot, n = 1) {
    if (this.player.gameMode === 'creative') return;
    slot.count = (slot.count || 1) - n;
    if (slot.count <= 0) this.player.hotbar[this.player.selectedSlot] = null;
  }

  _wearHeld(slot) {
    if (this.player.gameMode === 'creative') return;
    damageTool(slot, 1);
    if (isToolBroken(slot)) this.player.hotbar[this.player.selectedSlot] = null;
  }

  // Botão direito com item que não é bloco (1.8.9): balde, enxada, sementes, pederneira e aço, farinha de osso.
  // Devolve true se o item foi usado (então não tenta colocar bloco).
  useHeldItem(slot) {
    if (!slot || !slot.id) return false;
    const id = slot.id;
    // Armadura na mão: botão direito veste; se o slot já tem peça, troca (a peça antiga vai para o lugar da nova na hotbar)
    const armorDef = ITEMS[id] && ITEMS[id].armor;
    if (armorDef && this.inventory?.armor) {
      const old = this.inventory.armor[armorDef.slot];
      this.inventory.armor[armorDef.slot] = { ...slot, count: 1 };
      this.player.hotbar[this.player.selectedSlot] = old && old.id ? old : null;
      playArmorEquipSound(armorDef.material);
      this.emitHud();
      return true;
    }
    const isBucket = id === 325 || id === 326 || id === 327;
    // Balde vazio: recolhe água/lava parada (mira atravessa o fluido)
    if (id === 325) {
      const src = this.raycastFluidSource();
      if (!src) return false;
      this._setBlockSync(src.x, src.y, src.z, 0);
      const filled = { id: src.id === 9 ? 326 : 327, count: 1, meta: 0 };
      playEvent(src.id === 9 ? 'item.bucket.fill' : 'item.bucket.fill_lava', { pos: { x: src.x + 0.5, y: src.y + 0.5, z: src.z + 0.5 } });
      if (this.player.gameMode !== 'creative') {
        this._consumeHeld(slot);
        const left = addItem(this.inventory, filled);
        if (left) this.itemEntities?.spawnItem(left, this.eyePos(), { x: 0, y: 1, z: 0 }, 10);
      }
      return true;
    }
    const hit = this.raycast();
    // Caldeirão: balde de água enche (3 níveis); balde vazio esvazia um caldeirão cheio (também vale no Nether)
    if (hit && hit.id === 118 && (id === 326 || id === 325)) {
      const lvl = (hit.meta || 0) & 3;
      const at = { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 };
      if (id === 326 && lvl < 3) {
        this._setBlockSync(hit.x, hit.y, hit.z, packState(118, 3));
        playEvent('item.bucket.empty', { pos: at });
        if (this.player.gameMode !== 'creative') this.player.hotbar[this.player.selectedSlot] = { id: 325, count: 1, meta: 0 };
        return true;
      }
      if (id === 325 && lvl === 3) {
        this._setBlockSync(hit.x, hit.y, hit.z, packState(118, 0));
        playEvent('item.bucket.fill', { pos: at });
        if (this.player.gameMode !== 'creative') this.player.hotbar[this.player.selectedSlot] = { id: 326, count: 1, meta: 0 };
        return true;
      }
      return true;
    }
    if (isBucket) {
      // Balde cheio: derrama uma fonte no espaço à frente do bloco mirado
      if (!hit) return false;
      if (id === 326 && this.dimension === 'nether') {   // água no Nether evapora na hora (o balde fica vazio)
        playEvent('block.fire.extinguish', { pos: { x: hit.x + hit.nx + 0.5, y: hit.y + hit.ny + 0.5, z: hit.z + hit.nz + 0.5 }, volume: 0.5 });
        if (this.player.gameMode !== 'creative') this.player.hotbar[this.player.selectedSlot] = { id: 325, count: 1, meta: 0 };
        return true;
      }
      let tx = hit.x + hit.nx, ty = hit.y + hit.ny, tz = hit.z + hit.nz;
      const cur = stateId(this.world.getBlock(tx, ty, tz));
      if (cur !== 0 && !isReplaceable(cur) && !(isFluid(cur))) return false;
      if (this.intersectsPlayer(tx, ty, tz) && id === 327) return false;
      this._setBlockSync(tx, ty, tz, packState(id === 326 ? 9 : 11, 0));
      playEvent(id === 326 ? 'item.bucket.empty' : 'item.bucket.empty_lava', { pos: { x: tx + 0.5, y: ty + 0.5, z: tz + 0.5 } });
      if (this.player.gameMode !== 'creative') this.player.hotbar[this.player.selectedSlot] = { id: 325, count: 1, meta: 0 };
      return true;
    }
    if (!hit) return false;
    const above = stateId(this.world.getBlock(hit.x, hit.y + 1, hit.z));
    const topFree = hit.ny === 1 && (above === 0 || isReplaceable(above));
    const pos = { x: hit.x + 0.5, y: hit.y + 1, z: hit.z + 0.5 };
    // Enxada: grama/terra → terra arada
    if (id >= 290 && id <= 294) {
      if (!topFree || (hit.id !== 2 && hit.id !== 3)) return false;
      this._setBlockSync(hit.x, hit.y, hit.z, packState(60, 0));
      playBlockPlaceSound(3, pos);
      this._wearHeld(slot);
      return true;
    }
    // Sementes e raízes: plantam em terra arada
    const CROPS = { 295: 59, 391: 141, 392: 142, 361: 104, 362: 105 };
    if (CROPS[id] && hit.id === 60 && topFree) {
      this._setBlockSync(hit.x, hit.y + 1, hit.z, packState(CROPS[id], 0));
      playBlockPlaceSound(2, pos);
      this._consumeHeld(slot);
      return true;
    }
    // Pederneira e aço: acende TNT ou põe fogo no espaço à frente
    if (id === 259) {
      if (hit.id === 49) {
        // Obsidiana: tenta acender um portal do Nether na célula à frente
        const fx0 = hit.x + hit.nx, fy0 = hit.y + hit.ny, fz0 = hit.z + hit.nz;
        if (tryCreatePortal(this.world, fx0, fy0, fz0, (a, b, c, st) => this._setBlockSync(a, b, c, st))) {
          playEvent('fire.ignite', { pos });
          this._wearHeld(slot);
          return true;
        }
      }
      if (hit.id === 46) {
        this._setBlockSync(hit.x, hit.y, hit.z, 0);
        this.spawnTNT(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        playEvent('fire.ignite', { pos });
        this._wearHeld(slot);
        return true;
      }
      const fx = hit.x + hit.nx, fy = hit.y + hit.ny, fz = hit.z + hit.nz;
      if (stateId(this.world.getBlock(fx, fy, fz)) !== 0) return false;
      this._setBlockSync(fx, fy, fz, packState(51, 0));
      playEvent('fire.ignite', { pos: { x: fx + 0.5, y: fy + 0.5, z: fz + 0.5 } });
      this._wearHeld(slot);
      return true;
    }
    // Farinha de osso (corante meta 15): acelera plantação; na grama espalha grama alta
    if (id === 351 && (slot.meta || 0) === 15) {
      if ([59, 141, 142].includes(hit.id)) {
        const m = stateMeta(this.world.getBlock(hit.x, hit.y, hit.z));
        if (m >= 7) return false;
        this._setBlockSync(hit.x, hit.y, hit.z, packState(hit.id, Math.min(7, m + 2 + Math.floor(Math.random() * 4))));
        this._consumeHeld(slot);
        return true;
      }
      if (hit.id === 2 && topFree) {
        for (let i = 0; i < 12; i++) {
          const gx = hit.x + Math.floor(Math.random() * 7) - 3, gz = hit.z + Math.floor(Math.random() * 7) - 3;
          for (let gy = hit.y + 2; gy >= hit.y - 2; gy--) {
            if (stateId(this.world.getBlock(gx, gy, gz)) === 2 && stateId(this.world.getBlock(gx, gy + 1, gz)) === 0) {
              this._setBlockSync(gx, gy + 1, gz, packState(31, 1));
              break;
            }
          }
        }
        this._consumeHeld(slot);
        return true;
      }
    }
    return false;
  }

  // Porta (item 324 madeira / 330 ferro): 2 blocos de altura, precisa de chão sólido e espaço livre nos dois. Fica virada
  // para onde o jogador olha; se há uma porta igual à esquerda, a dobradiça vai para a direita (porta dupla espelhada).
  placeDoor(hit, slot, px, py, pz) {
    const doorId = DOOR_ITEMS[slot.id] || 64;
    const i = Math.floor(this.player.yaw * 2 / Math.PI + 0.5) & 3;
    const facing = [3, 0, 1, 2][i];
    for (const yy of [py, py + 1]) {
      const here = stateId(this.world.getBlock(px, yy, pz));
      if (here !== 0 && !isFluid(here) && !isReplaceable(here)) return;
    }
    const below = getBlock(stateId(this.world.getBlock(px, py - 1, pz)));
    if (!below || !below.solid || !below.opaque) return;
    if (this._shapeHitsPlayer(doorId, facing, px, py, pz)) return;
    const F = DOOR_FACES[facing], left = [F[1], -F[0]]; // esquerda de quem olha na direção F
    const ln = this.world.getBlock(px + left[0], py, pz + left[1]);
    const hingeRight = stateId(ln) === doorId && (stateMeta(ln) & 3) === facing && !(stateMeta(ln) & 8);
    this._setBlockSync(px, py, pz, packState(doorId, facing));
    this._setBlockSync(px, py + 1, pz, packState(doorId, 8 | (hingeRight ? 1 : 0)));
    playBlockPlaceSound(5, { x: px, y: py, z: pz });
    this._consumeHeld(slot);
    if (this.player.stats) this.player.stats.blocksPlaced++;
    this.placeCd = 4;
  }

  // Abre/fecha porta (o estado fica na metade de baixo) ou portão (meta & 4) e toca o som certo
  toggleOpenable(x, y, z) {
    const st = this.world.getBlock(x, y, z);
    const id = stateId(st);
    const model = getBlock(id).model;
    let ty = y;
    if (model === 'door' && (stateMeta(st) & 8)) ty = y - 1; // porta: o estado fica na metade de baixo
    const target = this.world.getBlock(x, ty, z);
    if (stateId(target) !== id) return;
    const meta = stateMeta(target) ^ 4;
    this._setBlockSync(x, ty, z, packState(id, meta));
    const open = (meta & 4) !== 0;
    const name = model === 'gate' ? 'fence_gate' : id === 71 ? 'iron_door' : id === 167 ? 'iron_trapdoor' : model === 'trapdoor' ? 'wooden_trapdoor' : 'wooden_door';
    playEvent(`block.${name}.${open ? 'open' : 'close'}`, { pos: { x: x + 0.5, y: ty + 0.5, z: z + 0.5 } });
  }

  // Cama (1.8.9): ocupa 2 blocos. O pé fica onde se clicou e a cabeceira na direção do olhar; os dois precisam de espaço livre
  // e de chão sólido embaixo. Quebrar uma das metades remove a outra (breakBedPartner).
  placeBed(hit, slot, px, py, pz) {
    const facing = Math.floor(this.player.yaw * 2 / Math.PI + 0.5) & 3;
    const [dx, dz] = BED_DIRS[facing];
    const cells = [{ x: px, z: pz, meta: facing }, { x: px + dx, z: pz + dz, meta: facing | 8 }];
    for (const c of cells) {
      const here = stateId(this.world.getBlock(c.x, py, c.z));
      if (here !== 0 && !isFluid(here) && !isReplaceable(here)) return;
      const below = getBlock(stateId(this.world.getBlock(c.x, py - 1, c.z)));
      if (!below || !below.solid) return;
      if (this._shapeHitsPlayer(26, c.meta, c.x, py, c.z)) return;
    }
    for (const c of cells) {
      const st = packState(26, c.meta);
      this.world.setBlock(c.x, py, c.z, st);
      this.onBlockChange?.(c.x, py, c.z, st);
      this.netManager?.sendBlockChange?.(c.x, py, c.z, st);
    }
    this._cachedRaycastFrame = -1;
    playBlockPlaceSound(26, { x: px, y: py, z: pz });
    if (this.player.gameMode === 'survival' || this.player.gameMode === 'adventure') {
      slot.count = (slot.count || 1) - 1;
      if (slot.count <= 0) this.player.hotbar[this.player.selectedSlot] = null;
    }
    if (this.player.stats) this.player.stats.blocksPlaced++;
    this.placeCd = 4;
  }

  // Baú quebrado: o conteúdo cai no chão (o baú em si dropa pelo registro)
  spillContainer(x, y, z, state) {
    if (stateId(state) !== 54 && stateId(state) !== 146) return;
    const c = getContainer(this.world, x, y, z);
    if (!c) return;
    for (const it of c.slots) {
      if (!it || !it.id) continue;
      const a = Math.random() * Math.PI * 2;
      this.itemEntities?.spawnItem({ id: it.id, count: it.count || 1, meta: it.meta || 0 }, { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, { x: Math.cos(a) * 1.2, y: 2, z: Math.sin(a) * 1.2 }, 10);
    }
    removeContainer(x, y, z);
  }

  // Escada de mão: o jogador dentro de uma célula com escada sobe encostado nela (EntityLivingBase.moveEntityWithHeading)
  _isOnLadder(p) {
    const b = getBlock(stateId(this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y + 0.2), Math.floor(p.pos.z))));
    return !!(b && b.climbable);
  }

  // Ao quebrar uma metade da cama ou da porta, a outra some junto (sem drop extra)
  // ===== Dimensões (Nether) =====
  _worldFor(dim) {
    if (this.worlds[dim]) return this.worlds[dim];
    const w = new ClientWorld(this.worlds.overworld.seed, this._netherDeltas, { generatorId: 'nether' });
    w.name = this.worlds.overworld.name;
    this.worlds[dim] = w;
    return w;
  }

  _attachWorld(w) {
    const old = this.world;
    if (old && old !== w) { old.unloadMeshes(); old.onBlockChange = null; }
    this.world = w;
    w.onBlockChange = (x, y, z) => { this.redstone?.markDirty(x, y, z); };
    if (this.mobs) { this.mobs.clearAll(); this.mobs.world = w; }
    if (this.projectiles) { this.projectiles.clearAll(); this.projectiles.world = w; }
    if (this.redstone) this.redstone.world = w;
  }

  // Carrega (de forma síncrona) a área ao redor de (x, z) para poder achar/colocar o portal de chegada
  _ensureArea(w, x, z, r) {
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) w.ensureChunk(cx + dx, cz + dz);
  }

  // Atravessa o portal: escala 1:8, procura (ou constrói) o portal no outro mundo e põe o jogador nele. Tudo por etapas, com a tela
  // "Carregando terreno" (GuiDownloadTerrain): o mundo de destino é gerado um chunk por vez, entre quadros, e a tela só some quando as
  // malhas ao redor do jogador estão prontas — antes o salto gerava 25 chunks de uma vez e travava o jogo.
  switchDimension(target) {
    if (target === this.dimension || this._switching) return false;
    this._switching = true;
    this._portalTicks = 0;
    this.dimLoading = { percent: 0, status: target === 'nether' ? 'Entrando no Nether' : 'Saindo do Nether' };
    playEvent('block.portal.travel', { volume: 0.5 });
    this.emitHud();
    this._doSwitch(target).catch((e) => console.warn('[portal]', e)).finally(() => { this._switching = false; this.dimLoading = null; this.emitHud(); });
    return true;
  }

  async _doSwitch(target) {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const setProg = (percent, status) => { this.dimLoading = { percent, status: status || this.dimLoading?.status }; this.emitHud(); };
    await wait(50);
    const p = this.player.pos;
    const toNether = target === 'nether';
    const dest = this._worldFor(target);
    const tx = Math.floor(toNether ? p.x / 8 : p.x * 8), tz = Math.floor(toNether ? p.z / 8 : p.z * 8);
    // 1) gera a área de chegada, um chunk por vez
    const cx0 = Math.floor(tx / 16), cz0 = Math.floor(tz / 16), R = 2;
    const total = (2 * R + 1) ** 2; let n = 0;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      dest.ensureChunk(cx0 + dx, cz0 + dz);
      setProg(Math.round((++n / total) * 55));
      await wait(0);
    }
    // 2) acha o portal de lá ou constrói um
    let portal = findNearbyPortal(dest, tx, 64, tz, toNether ? 16 : 32);
    if (!portal) {
      let by = toNether ? 70 : -1;
      if (toNether) {
        const f = findNetherFloor((a, b, c) => stateId(dest.getBlock(a, b, c)), tx, tz, 120);
        by = f > 0 ? f : 70;
      } else {
        by = 64;
        for (let y = 120; y > 1; y--) { if (stateId(dest.getBlock(tx, y, tz)) !== 0) { by = y + 1; break; } }
      }
      buildPortal(dest, tx, by, tz, () => {});
      portal = { x: tx, y: by, z: tz, meta: 1 };
    }
    setProg(60, 'Construindo terreno');
    await wait(0);
    // 3) troca de mundo e coloca o jogador; o motor segura o jogador parado até o chão dele estar carregado (_awaitChunk)
    this._attachWorld(dest);
    this.dimension = target;
    p.x = portal.x + 0.5; p.y = portal.y; p.z = portal.z + 0.5 + (portal.meta === 1 ? 1.2 : 0);
    if (this.player.vel) { this.player.vel.x = this.player.vel.y = this.player.vel.z = 0; }
    unstickPlayer(this.world, p);
    this.sky?.setVisible(target !== 'nether');
    this._portalCooldown = 60;
    this.weather?.setEnabled?.(target !== 'nether');
    this._awaitChunk = true;
    // 4) espera as malhas do entorno (até 6 s); a barra sobe com o que falta
    const t0 = performance.now(); let q0 = 0;
    while (performance.now() - t0 < 6000) {
      const pend = this.world.pendingMeshCount ? this.world.pendingMeshCount() : 0;
      q0 = Math.max(q0, pend);
      setProg(60 + Math.round((q0 ? 1 - pend / q0 : 1) * 40), 'Construindo terreno');
      if (pend === 0 && (!this.world.isIdle || this.world.isIdle()) && performance.now() - t0 > 400) break;
      await wait(60);
    }
    // o bloco de ar sob o jogador precisa estar pronto: sem isso ele cairia no vazio ao reabrir
    this.emitHud();
  }

  // Ambiente do portal: o zumbido de quem está perto de um portal (som posicional, de tempos em tempos)
  _tickPortalAmbient() {
    if (this.worldTime % 20 !== 0 || Math.random() > 0.3) return;
    const p = this.player.pos, bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) for (let dy = -3; dy <= 3; dy++) {
      if (stateId(this.world.getBlock(bx + dx, by + dy, bz + dz)) === 90) {
        playEvent('block.portal.ambient', { pos: { x: bx + dx + 0.5, y: by + dy + 0.5, z: bz + dz + 0.5 }, volume: 0.5, pitch: Math.random() * 0.4 + 0.8 });
        return;
      }
    }
  }

  tickPortal() {
    if (this._switching) return;
    if (this._portalCooldown > 0) this._portalCooldown--;
    this._tickPortalAmbient();
    const p = this.player.pos;
    const inPortal = stateId(this.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))) === 90
      || stateId(this.world.getBlock(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z))) === 90;
    if (!inPortal) { this._portalTicks = 0; return; }
    if (this._portalCooldown > 0) { this._portalCooldown = 60; return; }  // só reativa depois de sair do portal
    // 1.8.9 (Entity.portalCounter): 80 ticks (4 s) em cima do portal no sobrevivência; no criativo atravessa na hora
    if (this._portalTicks === 0) playEvent('block.portal.trigger', { volume: 0.25 });
    this._portalTicks++;
    const need = this.player.gameMode === 'creative' || this.player.creative ? 1 : 80;
    if (this._portalTicks >= need) this.switchDimension(this.dimension === 'nether' ? 'overworld' : 'nether');
  }

  // Quebrou obsidiana ou um bloco do portal: o portal inteiro some na hora (sem som extra: só o do bloco quebrado) e a conexão com o portal
  // do outro mundo também quebra (esta regra é do Mind Cave: no 1.8.9 o portal do outro lado continuava lá)
  _portalIntegrity(x, y, z) {
    const removed = checkPortalIntegrity(this.world, x, y, z, (a, b, c, st) => this._setBlockSync(a, b, c, st));
    if (removed > 0) this._breakLinkedPortal(x, y, z);
    return removed;
  }

  _breakLinkedPortal(x, y, z) {
    const toNether = this.dimension === 'overworld';
    const other = this.worlds[toNether ? 'nether' : 'overworld'];
    if (!other || other === this.world) return;
    const tx = Math.floor(toNether ? x / 8 : x * 8), tz = Math.floor(toNether ? z / 8 : z * 8);
    const found = findNearbyPortal(other, tx, Math.floor(y), tz, toNether ? 16 : 32);
    if (!found) return;
    other.setBlock(found.x, found.y, found.z, 0);
    checkPortalIntegrity(other, found.x, found.y, found.z, () => {});
  }

  breakBedPartner(x, y, z, state) {
    this.spillContainer(x, y, z, state);
    if (stateId(state) === 49 || stateId(state) === 90) this._portalIntegrity(x, y, z);
    const id = stateId(state);
    if (id === 26) {
      const pt = bedPartner(x, z, stateMeta(state));
      const other = this.world.getBlock(pt.x, y, pt.z);
      if (stateId(other) !== 26) return;
      this._setBlockSync(pt.x, y, pt.z, 0);
    } else if (isDoorBlock(getBlock(id)) || id === 175) {   // porta e planta alta: as duas metades saem juntas
      const py = (stateMeta(state) & 8) ? y - 1 : y + 1;
      if (stateId(this.world.getBlock(x, py, z)) === id) this._setBlockSync(x, py, z, 0);
    }
  }

  pickBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const b = getBlock(hit.id);
    // laje dupla vira a laje simples do mesmo tipo; escadas e lajes voltam à meta base (a orientação vem da colocação)
    let id = b.singleId || hit.id;
    let meta = hit.meta;
    if (b.singleId || isSlabBlock(b)) meta = hit.meta & 7;
    else if (isStairsBlock(b)) meta = 0;
    else if (b.variants && b.variantMask !== undefined) meta = hit.meta & b.variantMask;   // o item leva a variante, sem eixo/estado
    else if (b.model === 'door') { const lower = this.world.getBlock(hit.x, hit.y - ((hit.meta & 8) ? 1 : 0), hit.z); id = (b.drop && ITEMS[b.drop]) ? b.drop : id; meta = 0; void lower; }
    else if (hit.id === 175) meta = (hit.meta & 8) ? stateMeta(this.world.getBlock(hit.x, hit.y - 1, hit.z)) & 7 : hit.meta & 7;
    else if (hit.id === 26) { id = 355; meta = 0; }
    else if (hit.id === 63 || hit.id === 68) { id = 323; meta = 0; }
    else if ([144, 198, 199, 200, 201].includes(hit.id)) { id = 397; meta = [144, 198, 199, 200, 201].indexOf(hit.id); }
    else if (b.drop && b.drop !== hit.id && ITEMS[b.drop] && !BLOCKS[b.drop]) { id = b.drop; meta = 0; }
    else meta = (b.variants || b.dropMeta) ? meta & (b.variantMask ?? 15) : 0;
    const p = this.player;
    // 1) o item já está na hotbar: só seleciona o slot
    for (let i = 0; i < 9; i++) { const s = p.hotbar[i]; if (s && s.id === id && (s.meta || 0) === meta) { p.selectedSlot = i; this.emitHud(); return; } }
    // 2) está no inventário de cima: troca com o slot selecionado
    for (let i = 0; i < this.inventory.main.length; i++) {
      const s = this.inventory.main[i];
      if (s && s.id === id && (s.meta || 0) === meta) { this.inventory.main[i] = p.hotbar[p.selectedSlot] && p.hotbar[p.selectedSlot].id ? p.hotbar[p.selectedSlot] : null; p.hotbar[p.selectedSlot] = s; this.emitHud(); return; }
    }
    // 3) só o criativo cria o item: pilha cheia no slot selecionado (o slot é substituído por um objeto novo para a hotbar redesenhar na hora)
    if (p.gameMode === 'creative') {
      const max = (ITEMS[id] && ITEMS[id].maxStack) || 64;
      p.hotbar[p.selectedSlot] = { id, count: max, meta };
      this.emitHud();
    }
  }

  // Uma laje/escada recém-colocada não pode prender o jogador dentro dela
  _shapeHitsPlayer(id, meta, x, y, z) {
    const p = this.player.pos, hw = PLAYER.width / 2;
    const boxes = blockBoxes(packState(id, meta), (a, b, c) => this.world.getBlock(a, b, c), x, y, z) || [[0, 0, 0, 1, 1, 1]];
    return boxes.some(bx => x + bx[3] > p.x - hw && x + bx[0] < p.x + hw && y + bx[4] > p.y && y + bx[1] < p.y + PLAYER.height
      && z + bx[5] > p.z - hw && z + bx[2] < p.z + hw);
  }

  intersectsPlayer(x, y, z) {
    const p = this.player.pos, w = PLAYER.width, h = PLAYER.height;
    return (x + 1 > p.x - w / 2 && x < p.x + w / 2 &&
      y + 1 > p.y && y < p.y + h &&
      z + 1 > p.z - w / 2 && z < p.z + w / 2);
  }

  executeCommand(text) {
    this.chatOpen = false;
    if (text.startsWith('/')) {
      processCommand(this, text);
    } else if (text.trim()) {
      // Chat message
      if (this.onChatSend) {
        this.onChatSend(text);
      } else if (this.onChatMessage) {
        this.onChatMessage({ type: 'chat', user: this.player.nomeJogador, text: text.slice(0, 100), timestamp: Date.now() });
      }
    }
  }

  parseCoord(str, rel) {
    if (!str) return rel;
    if (str.startsWith('~')) return rel + (parseFloat(str.slice(1)) || 0);
    return parseFloat(str);
  }

  moveFlying(strafe, forward, friction, yaw) {
    let dist = strafe * strafe + forward * forward;
    if (dist >= 1e-4) {
      dist = Math.sqrt(dist);
      if (dist < 1) dist = 1;
      dist = friction / dist;
      strafe *= dist;
      forward *= dist;
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      this.player.vel.x += strafe * cos - forward * sin;
      this.player.vel.z += forward * cos + strafe * sin;
    }
  }

  tick() {
    if (this.gameRules.doDaylightCycle !== false) this.worldTime++;
    // RF-021: antes do chunk sob o jogador existir, ele fica parado (sem cair no vazio)
    if (this._awaitChunk) {
      if (!chunkLoadedAt(this.world, this.player.pos.x, this.player.pos.z)) return;
      this._awaitChunk = false;
      unstickPlayer(this.world, this.player.pos);
    }
    const p = this.player;
    this._prevPos = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
    this._tickFovModifier();

    // Verifica fluido em toda a caixa de colisão do jogador (pés, corpo e olhos)
    const eye = this.eyePos();
    const feetBlock = this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z));
    const bodyBlock = this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y + 0.8), Math.floor(p.pos.z));
    const eyeBlock = this.world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
    const inWaterAny = isWater(stateId(feetBlock)) || isWater(stateId(bodyBlock)) || isWater(stateId(eyeBlock));
    const inLavaAny = isLava(stateId(feetBlock)) || isLava(stateId(bodyBlock)) || isLava(stateId(eyeBlock));
    this.inFluid = inWaterAny ? 'water' : (inLavaAny ? 'lava' : null);

    // Respingo ao entrar na água (transição seco → molhado com velocidade Y negativa)
    if (this.particles && this.inFluid === 'water' && !this._wasInWater && p.vel.y < -0.3) {
      this.particles.spawnSplash(p.pos.x, p.pos.y, p.pos.z, Math.min(1.5, Math.abs(p.vel.y) * 0.8));
      playSplashSound(p.pos);
    }
    this._wasInWater = this.inFluid === 'water';

    const canMove = !p.isDead && !p.sleeping;
    const W = (canMove && this.isAction('forward')) ? 1 : 0, S = (canMove && this.isAction('back')) ? 1 : 0;
    const A = (canMove && this.isAction('left')) ? 1 : 0, Dd = (canMove && this.isAction('right')) ? 1 : 0;
    let forward = W - S, strafe = A - Dd;
    // MovementInputFromOptions (MCP 1.8.9): agachado, a entrada de andar vale 30% (≈1,3 blocos/s no chão, não só um teto de velocidade)
    if (this.isAction('sneak') && !p.flying) { forward *= 0.3; strafe *= 0.3; }
    const yaw = p.yaw;
    const fx = -Math.sin(yaw), fz = Math.cos(yaw);
    const rx = Math.cos(yaw), rz = Math.sin(yaw);
    let wx = forward * fx + strafe * rx;
    let wz = forward * fz + strafe * rz;
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-4) { wx /= wl; wz /= wl; }

    if (p.sleeping) {
      p.vel.x = 0; p.vel.y = 0; p.vel.z = 0;
      p.sleepTimer = (p.sleepTimer || 0) + 1;

      const isNight = (this.worldTime % 24000) >= 12541 && (this.worldTime % 24000) <= 23458;
      const isThunder = !!this.weather?.isThundering?.();

      const totalPlayers = 1 + (this.netManager?.remotePlayers ? this.netManager.remotePlayers.size : (this.remotePlayers ? Object.keys(this.remotePlayers).length : 0));
      let sleepingCount = 1;
      if (this.netManager?.remotePlayers) {
        for (const rp of this.netManager.remotePlayers.values()) {
          if (rp.sleeping) sleepingCount++;
        }
      } else if (this.remotePlayers) {
        for (const rp of Object.values(this.remotePlayers)) {
          if (rp.sleeping) sleepingCount++;
        }
      }

      const allSleeping = sleepingCount >= totalPlayers;

      if ((isNight || isThunder) && ((!this.netManager && p.sleepTimer >= 100) || (allSleeping && p.sleepTimer >= 60))) {
        this.worldTime = (Math.floor(this.worldTime / 24000) + 1) * 24000;
        if (this.netManager?.broadcast) {
          this.netManager.broadcast({ t: 'time', worldTime: this.worldTime });
          this.netManager.broadcast({ t: 'wake_all' });
        }
        this.wakeUp();
      } else if (!isNight && !isThunder && p.sleepTimer >= 60) {
        this.wakeUp();
      }
    }

    p.sneaking = !!this.isAction('sneak');
    const sprintKeyHold = this.isAction('sprint');
    const sprintMode = settingsStore.get('user.sprintMode') || 'toggle';
    let isSprinting = false;

    if (sprintMode === 'auto') {
      isSprinting = true;
    } else {
      isSprinting = this.sprintToggled || sprintKeyHold;
    }

    if (this.wTapCount >= 2) isSprinting = true;

    let sprint = isSprinting && forward > 0 && !p.sneaking && (p.hunger === undefined || p.hunger > 6 || p.gameMode === 'creative');
    // O toggle do Ctrl é estado do jogador: só desliga ao apertar de novo.
    // Soltar o W ou estar com fome corta a corrida do tick, mas não apaga o toggle.
    if (forward <= 0 || (p.gameMode !== 'creative' && p.hunger !== undefined && p.hunger <= 6)) {
      sprint = false;
    }
    p.sprinting = sprint;
    p.sprintToggled = !!this.sprintToggled;

    let speed;
    if (p.flying) speed = p.sprinting ? PLAYER.creativeSprint : PLAYER.creativeSpeed;
    else if (p.sneaking) speed = PLAYER.sneakSpeed;
    else if (sprint) speed = PLAYER.sprintSpeed;
    else speed = PLAYER.walkSpeed;

    if (this.inFluid === 'water') speed *= 0.5;
    if (this.inFluid === 'lava') speed *= 0.2;

    // Bloqueio/uso de item reduz velocidade (PRD 07 RF-006, RF-020)
    const _useActive = this.isAction('use') && !this.paused && !this.chatOpen;
    const _held = this.getHeldItem();
    if (!p.flying && _useActive && (isSword(_held) || isBow(_held) || p.eating)) {
      speed *= 0.2;
      sprint = false;
      p.sprinting = false;
    }

    // Velocidades são em blocos/segundo — converter para blocos/tick
    const tvx = wx * speed / TPS, tvz = wz * speed / TPS;

    // Jump cooldown (10 ticks)
    if (this.jumpTicks === undefined) this.jumpTicks = 0;
    if (!p.isDead && !p.sleeping && this.isAction('jump') && p.onGround && this.jumpTicks === 0) {
      p.vel.y = 0.42;
      this.jumpTicks = 10;
      if (p.sprinting) {
        p.vel.x += -Math.sin(yaw) * 0.2;
        p.vel.z += Math.cos(yaw) * 0.2;
      }
    }
    if (this.jumpTicks > 0) this.jumpTicks--;

    if (p.flying) {
      // Voo do criativo (EntityPlayer.moveEntityWithHeading, 1.8.9): o jogador ACELERA (0,05 por tick; 0,1 correndo) e escorrega com o atrito 0,91 do ar
      // em vez de ter velocidade fixa — cruza a ~10,1 blocos/s (20,2 correndo). Subir/descer soma ±0,15 por tick e a velocidade vertical perde 40% a cada
      // tick: estabiliza em 7,5 blocos/s e para quase na hora ao soltar a tecla.
      const flySpeed = 0.05 * (p.sprinting ? 2 : 1);
      if (this.isAction('jump')) p.vel.y += 0.15;
      if (this.isAction('sneak')) p.vel.y -= 0.15;
      this.moveFlying(strafe, forward, flySpeed, yaw);
      const vy = p.vel.y;
      const res = moveEntity(p.pos, p.vel, this.world, 1, { sneaking: p.sneaking, onGround: p.onGround, flying: p.flying });
      p.onGround = res.onGround;
      p.vel.x *= 0.91; p.vel.z *= 0.91;
      p.vel.y = vy * 0.6;
      // pousar no chão encerra o voo no criativo (EntityPlayerSP.onLivingUpdate); no meio do salto duplo ainda está no ar
      if (p.onGround && p.gameMode === 'creative' && vy <= 0) p.flying = false;
    } else if (this.inFluid === 'water') {
      this.moveFlying(strafe, forward, 0.02, yaw);
      const res = moveEntity(p.pos, p.vel, this.world, 1, { width: PLAYER.width, height: PLAYER.height });
      p.onGround = res.onGround;
      p.vel.x *= 0.8;
      p.vel.y *= 0.8;
      p.vel.z *= 0.8;
      p.vel.y -= 0.02; // Gravidade na água MC 1.8.9
      if (this.isAction('jump')) p.vel.y += 0.04;
    } else if (this.inFluid === 'lava') {
      this.moveFlying(strafe, forward, 0.02, yaw);
      const res = moveEntity(p.pos, p.vel, this.world, 1, { width: PLAYER.width, height: PLAYER.height });
      p.onGround = res.onGround;
      p.vel.x *= 0.5;
      p.vel.y *= 0.5;
      p.vel.z *= 0.5;
      p.vel.y -= 0.02; // Gravidade na lava MC 1.8.9
      if (this.isAction('jump')) p.vel.y += 0.04;
    } else {
      // Minecraft 1.8.9 EntityLivingBase.moveEntityWithHeading
      const blockBelowState = this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.2), Math.floor(p.pos.z));
      const slipperiness = getBlockSlipperiness(blockBelowState);
      const friction = p.onGround ? slipperiness * 0.91 : 0.91;
      let accel;
      if (p.onGround) {
        const baseSpeed = p.sprinting ? 0.13 : 0.1;
        accel = baseSpeed * (0.16277136 / (friction * friction * friction));
      } else {
        accel = p.sprinting ? 0.026 : 0.02;
      }
      this.moveFlying(strafe, forward, accel, yaw);
      if (this._isOnLadder(p)) {
        // 1.8.9 (antes de mover): horizontal limitado a 0,15; cai no máximo 0,15/tick; Shift segura no lugar; empurrar contra a parede
        // (colisão do tick anterior) sobe a 0,2/tick
        p.vel.x = Math.max(-0.15, Math.min(0.15, p.vel.x));
        p.vel.z = Math.max(-0.15, Math.min(0.15, p.vel.z));
        if (p.vel.y < -0.15) p.vel.y = -0.15;
        if (p.sneaking && p.vel.y < 0) p.vel.y = 0;
        if (this._ladderPush) p.vel.y = 0.2;
        p.fallDistance = 0;
      }
      const res = moveEntity(p.pos, p.vel, this.world, 1, { sneaking: p.sneaking, onGround: p.onGround, flying: p.flying });
      p.onGround = res.onGround;
      this._ladderPush = res.collidedX || res.collidedZ;
      p.vel.x *= friction;
      p.vel.z *= friction;
      p.vel.y -= PLAYER.gravity;
      p.vel.y *= 0.98;

      if (p.onGround && !p.flying) {
        const distMoved = Math.hypot(p.pos.x - (this._lastWalkX ?? p.pos.x), p.pos.z - (this._lastWalkZ ?? p.pos.z));
        this._walkDist = (this._walkDist || 0) + distMoved;
        this._lastWalkX = p.pos.x;
        this._lastWalkZ = p.pos.z;
        if (this._walkDist > 1.667 && !p.sneaking) { // 1/0,6: Entity.moveEntity soma o deslocamento × 0,6 a cada passo; agachado não toca passos
          this._walkDist = 0;
          const blockBelow = this.world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.2), Math.floor(p.pos.z));
          playStepSound(stateId(blockBelow), p.pos);
        }
      }
    }

    pushOutOfBlocks(this.world, p.pos);
    if (p.pos.y < -64) { p.pos.x = this.spawn.x; p.pos.y = this.spawn.y; p.pos.z = this.spawn.z; p.vel.y = 0; }

    if (this.breakCd > 0) this.breakCd--;
    if (this.placeCd > 0) this.placeCd--;

    // Combate, mineração e colocação de blocos com fila de clique sem perda entre ticks (1.8.9)
    const canAct = !this.paused && !this.chatOpen && !p.isDead && !p.sleeping && !this.containerOpenFn?.();
    const attackHeld = canAct && this.isAction('attack');
    const useHeld = canAct && this.isAction('use');
    const attackPressed = canAct && (this._pendingAttackClick || (attackHeld && !this._prevAttack));
    const usePressed = canAct && (this._pendingUseClick || (useHeld && !this._prevUse));
    this._pendingAttackClick = false;
    this._pendingUseClick = false;

    const attackActive = attackHeld || attackPressed;
    const useActive = useHeld || usePressed;
    const heldItem = this.getHeldItem();

    // Se o jogador clicou de novo ou mudou de bloco mirado, zera o cooldown de quebra
    if (attackPressed) {
      this.breakCd = 0;
      startSwing(this.anim);
      recordClick(this.cps);
      const entHit = this.raycastEntity();
      if (entHit) {
        const res = attackEntity(p, entHit.entity, this.world, { item: heldItem });
        if (res && res.hit && entHit.entity.isPlayer && this.netManager) {
          this.netManager.sendHit?.(entHit.entity.id, {
            damage: res.damage, crit: res.crit, sprinting: res.sprinting, kbLevel: res.kbLevel,
            attackerPos: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
          });
        }
      }
    }

    if (attackActive) {
      if (!this.anim.isSwinging) {
        startSwing(this.anim);
      }
      if (!this.raycastEntity()) {
        if (p.gameMode === 'creative' || p.gameMode === 'spectator') {
          if (this.breakCd <= 0) {
            this.breakBlock();
            this.breakCd = attackPressed ? 3 : 5;
          }
        } else {
          this.tickMining(p);
        }
      }
    } else {
      this.miningTarget = null;
      this.miningProgress = 0;
    }

    if (usePressed) {
      this.placeCd = 0;
    }

    if (useActive) {
      if (isSword(heldItem)) {
        p.blocking = true; p.usingItem = true;
      } else if (isBow(heldItem) && (p.gameMode === 'creative' || this._findArrow())) {
        p.bowDrawing = true; p.usingItem = true;
        this.bowChargeTicks++;
        // ranger da corda: começa baixo e se repete enquanto o arco enche (o 1.8.9 não tem som de puxar; usa o ranger da besta do pacote)
        if (this.bowChargeTicks === 1) playEvent('item.crossbow.loading_start', { volume: 0.6 });
        else if (this.bowChargeTicks < 20 && this.bowChargeTicks % 7 === 0) playEvent('item.crossbow.loading_middle', { volume: 0.35 });
        p.bowCharge = computeBowCharge(this.bowChargeTicks);
      } else if (this.tryStartEating(p)) {
        this.tickEating(p);
      } else if (usePressed && this.useOnEntity(heldItem)) {
        this.placeCd = 4;
      } else if (usePressed && this.interactBlock(p)) {
        this.placeCd = 4;
      } else if (this.placeCd <= 0 && !heldItem?.id) {
        // mão vazia — nada
      } else if (this.placeCd <= 0 && usePressed && this.useHeldItem(heldItem)) {
        this.placeCd = 4;
      } else if (this.placeCd <= 0) {
        this.placeBlock();
      }
    } else {
      if (p.bowDrawing && this.bowChargeTicks > 0) {
        if (p.bowCharge >= 0.1) this.shootArrow(p, p.bowCharge);
        p.bowDrawing = false; p.bowCharge = 0; this.bowChargeTicks = 0;
      }
      p.blocking = false; p.usingItem = false;
      this.stopEating();
    }

    // Animação (PRD 07 RF-040)
    tickAnimation(this.anim, p, this.worldTime);

    // Projéteis (PRD 07 RF-020)
    if (this.projectiles) {
      if (p.id === undefined) p.id = 'local_player';
      this.projectiles.tick(this._getAttackableEntities(), p);
    }

    // Track mouse button edges
    this._prevAttack = attackActive;
    this._prevUse = useActive;

    // Sobrevivência (PRD 05)
    if (p.gameMode !== 'creative' && p.gameMode !== 'spectator' && !p.isDead) {
      tickSurvival(p, this.world, { difficulty: this.difficulty, gameRules: this.gameRules, weather: this.weather });
    }
    if (p.effects && p.effects.length > 0) tickEffects(p);

    // Chuva (laço de som enquanto chove)
    if (this.weather) {
      const raining = this.weather.isRaining();
      if (raining && !this._rainSound) { this._rainSound = true; startRainSound(); }
      else if (!raining && this._rainSound) { this._rainSound = false; stopRainSound(); }
    }

    // Clima (PRD 05)
    this.tickPortal();
    if (this.weather && this.dimension !== 'nether') {
      this.weather.tick(this.worldTime, p, this.world, this.gameRules);
      this.weather.extinguishExposed(this.world, p);
    }

    // Fogo (PRD 05)
    if (this.worldTime % 30 === 0) tickFire(this.world, this.worldTime, this.weather, this.gameRules);

    // Atualizar velocidade por efeitos
    const speedMod = getSpeedModifier(p);
    if (speedMod !== 1.0) {
      p.vel.x *= speedMod;
      p.vel.z *= speedMod;
    }

    // Stats e Conquistas (PRD 12 RF-031)
    if (p.stats) {
      p.stats.playTime++;
      const dx = p.pos.x - (this._lastPosX ?? p.pos.x);
      const dz = p.pos.z - (this._lastPosZ ?? p.pos.z);
      const dist = Math.hypot(dx, dz);
      if (p.flying) p.stats.distanceFlown += dist;
      else if (p.sprinting) {
        p.stats.distanceSprinted += dist;
        if (this.difficulty !== 'peaceful') {
          p.exhaustion = Math.min(40, (p.exhaustion || 0) + dist * 0.1);
        }
      } else if (dist > 0.01) p.stats.distanceWalked += dist;
      if (this.isAction('jump') && p.onGround) {
        p.stats.jumps++;
        if (this.difficulty !== 'peaceful') {
          p.exhaustion = Math.min(40, (p.exhaustion || 0) + (p.sprinting ? 0.2 : 0.05));
        }
      }
      this._lastPosX = p.pos.x;
      this._lastPosZ = p.pos.z;
      checkStatAchievements(p.achievements, p.stats);
    }

    this.renderDistance = settingsStore.get('device.renderDistance') || this.renderDistance;
    // world.update roda só no loop (uma vez por quadro); aqui apenas mantemos o raio-alvo atualizado
    this.targetRadius = Math.floor(this.renderDistance);
    this.world._lastLoadingRadius = Math.min(this.loadingRadius || this.renderDistance, this.renderDistance);

    perfMonitor.beginStage('mobs');
    // Mobs (PRD 08)
    if (this.mobs) {
      this.mobs.tick(p, {
        world: this.world, difficulty: this.difficulty, worldTime: this.worldTime, dimension: this.dimension,
        weather: this.weather, gameRules: this.gameRules, projectiles: this.projectiles,
        inventory: this.inventory, getHeldItem: () => this.getHeldItem(),
        itemEntities: this.itemEntities, particles: this.particles,
        noiseSystem: this.noiseSystem,
        onGunshot: (pos, radius) => {
          this.noiseSystem.emit(pos, radius);
        },
        onExplode: (pos, power) => { this.detonate(pos, power); },
      });
      const mobList = this.mobs ? this.mobs.getEntities() : [];
      const remoteList = [];
      if (this.netManager?.remotePlayers) {
        for (const [id, rp] of this.netManager.remotePlayers.entries()) {
          remoteList.push({
            id,
            name: rp.name,
            nomeJogador: rp.name,
            pos: { x: rp.x ?? 0, y: rp.y ?? 0, z: rp.z ?? 0 },
            vel: rp.vel || { x: 0, y: 0, z: 0 },
            width: 0.6,
            height: 1.8,
            isPlayer: true,
            isDead: !!rp.isDead,
            hurtTime: rp.hurtTime || 0,
            hurtResistantTime: rp.hurtResistantTime || 0,
            lastDamage: rp.lastDamage || 0,
          });
        }
      }
      this.entities = [...mobList, ...remoteList];
    }

    // Armas de fogo (PRD 09)
    if (this.gunController && this.gameRules.gunsEnabled !== false) {
      this.gunController.tick(p, this.world, {
        inventory: this.inventory,
        projectiles: this.projectiles,
        gameRules: this.gameRules,
        difficulty: this.difficulty,
        onExplode: (pos, power) => { this.detonate(pos, power); },
        onGunshot: (pos, radius) => {
          this.noiseSystem.emit(pos, radius);
        },
      });
    }
    if (this.noiseSystem) this.noiseSystem.tick();
    perfMonitor.endStage('mobs');

    perfMonitor.beginStage('sim');
    tickFluids(this.world, this.worldTime, this.player.pos);
    if (this.worldTime % 4 === 0) {
      tickNearbyFallingBlocks(this.world, p.pos.x, p.pos.y, p.pos.z, 14);
    }
    if (this.worldTime % 2 === 0 && this.redstone) this.redstone.tick();
    this.tickTntEntities();
    this._tickScheduled();
    this._tickPlates();
    if (this.worldTime % 20 === 0) this.randomTickAgriculture();

    if (this.worldTime % AUTOSAVE_TICKS === 0) this.onAutosave();

    perfMonitor.endStage('sim');

    // Transmitir posição em multiplayer (a cada tick = 20 TPS com Idle Deadband e compactação estilo Eaglercraft)
    if (this.netManager) {
      const curX = Math.round(p.pos.x * 100) / 100;
      const curY = Math.round(p.pos.y * 100) / 100;
      const curZ = Math.round(p.pos.z * 100) / 100;
      const curYaw = Math.round(p.yaw * 100) / 100;
      const curPitch = Math.round(p.pitch * 100) / 100;
      const curHeld = this.getHeldItem()?.id || 0;
      const curVoice = voiceChat.getWireState();
      const curArmor = armorCodeFromSlots(this.inventory?.armor);
      const curDead = !!p.isDead;
      const curSleeping = !!p.sleeping;

      const last = this._lastSentPos;
      this._ticksSinceNetMove = (this._ticksSinceNetMove || 0) + 1;

      const hasMoved = !last ||
        Math.abs(curX - last.x) > 0.005 ||
        Math.abs(curY - last.y) > 0.005 ||
        Math.abs(curZ - last.z) > 0.005 ||
        Math.abs(curYaw - last.yaw) > 0.015 ||
        Math.abs(curPitch - last.pitch) > 0.015 ||
        curHeld !== last.held ||
        curVoice !== last.voice ||
        curArmor !== last.armor ||
        curDead !== last.dead ||
        curSleeping !== last.sleeping;

      // Envia se houver movimento/mudança de estado ou como heartbeat a cada 20 ticks (1s)
      if (hasMoved || this._ticksSinceNetMove >= 20) {
        this._ticksSinceNetMove = 0;
        this._lastSentPos = { x: curX, y: curY, z: curZ, yaw: curYaw, pitch: curPitch, held: curHeld, voice: curVoice, armor: curArmor, dead: curDead, sleeping: curSleeping };

        const posMsg = {
          t: 'move',
          id: this.netManager.user?.id || 'host',
          n: p.nomeJogador,
          x: curX,
          y: curY,
          z: curZ,
          yaw: curYaw,
          pitch: curPitch,
          dead: curDead,
          sleeping: curSleeping,
          h: curHeld,
          v: curVoice,
          a: curArmor,
        };
        if (this.netManager.broadcast) {
          this.netManager.broadcast(posMsg, undefined, false);
        } else if (this.netManager.conn) {
          this.netManager.conn.send(posMsg, false);
        }
      }
    }

    // Partículas
    if (this.particles) this.particles.tick(this.world);

    musicManager.creativeMode = p.gameMode === 'creative'; // faixas creative1-6 só tocam no criativo

    // Som do dano (o balanço de câmera sai de hurtRoll)
    const seq = p.hurtSeq || 0;
    if (this._hurtSeqSeen === undefined) this._hurtSeqSeen = seq;
    if (seq !== this._hurtSeqSeen) {
      this._hurtSeqSeen = seq;
      playPlayerHurtSound(p.lastDamageSource, p.lastDamage);
    }

    // Detectar morte para mostrar tela
    if (p.isDead && p.deathPending) {
      playEvent('entity.player.death', { pos: p.pos });
      // Solta o mouse para os botões da tela de morte (Renascer/Menu) ficarem clicáveis
      document.exitPointerLock?.();
      this._announceDeath();
      this.emitHud();
    } else if (p.isDead && this._lastHud && !this._lastHud.isDead) {
      document.exitPointerLock?.();
      this.emitHud();
    }
  }

  loop(now) {
    if (this.disposed) return;
    this._scheduleNextFrame();
    perfMonitor.beginFrame();

    // PRD 21 RF-001: timing por stage
    perfMonitor.beginStage('tick');
    const dt = Math.min(now - this.lastTime, 500); this.lastTime = now;
    
    // No online (multiplayer) e durante o chat o mundo continua rodando (1.8.9)
    const isOnline = !!this.netManager;
    // Só o menu de pausa (Esc) congela o mundo: com inventário/bancada/baú aberto o jogo segue rodando, como no original
    const canTickWorld = isOnline || !this.paused || this.chatOpen || !!this.containerOpenFn?.();

    if (canTickWorld) {
      this.tickAcc += dt;
      let ticks = 0;
      const tickT0 = performance.now();
      while (this.tickAcc >= TICK_MS && ticks < 3) {
        this.tick();
        this.tickAcc -= TICK_MS; ticks++;
        if (performance.now() - tickT0 > 15) break; // evita espiral de atraso em quadros lentos
      }
      if (this.tickAcc > TICK_MS * 2) this.tickAcc = TICK_MS * 2;
    } else {
      // Quando pausado em singleplayer, trava o acumulador e fixa a posição para eliminar tremedeira
      this.tickAcc = 0;
      if (this.player?.pos) {
        this._prevPos = { ...this.player.pos };
      }
    }
    perfMonitor.endStage('tick');

    const maxFps = settingsStore.get('device.maxFps');
    let shouldRender = true;
    if (maxFps !== 'unlimited' && maxFps !== 'vsync') {
      const minFrameTime = 1000 / parseInt(maxFps);
      if (now - (this._lastRender || 0) < minFrameTime) shouldRender = false;
    }
    if (settingsStore.get('device.pauseRenderWhenHidden') && document.hidden) shouldRender = false;

    // PRD 23 RF-002/003: despacho com orçamento; o raio só cresce quando a fila anterior esvazia
    perfMonitor.beginStage('meshDispatch');
    const world = this.world;
    if (world) {
      const p = this.player.pos;
      if (this.loadingRadius < this.targetRadius && world.loadBacklog() === 0 && world.pendingMeshCount() < 12) {
        this.loadingRadius++;
      }
      const rd = Math.floor(Math.min(this.loadingRadius, this.renderDistance));
      world._lastLoadingRadius = rd;
      world.update(this.scene, p.x, p.z, rd, p.y);
    }
    perfMonitor.endStage('meshDispatch');
    // PRD 23 RF-007: upload à GPU com orçamento (≤ 2 ms por quadro)
    perfMonitor.beginStage('upload');
    if (world) world.uploadMeshes();
    perfMonitor.endStage('upload');

    if (shouldRender) {
      this._lastRender = now;
      tickTextureAnimations(this.worldTime);
      perfMonitor.beginStage('entities');
      this.updateSkyAndLighting();
      this.updateCamera();
      // Atualiza Frustum da câmera para culling de entidades e itens (Sodium / Patcher)
      this._projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      this._cameraFrustum.setFromProjectionMatrix(this._projScreenMatrix);

      this.updateOutline();
      this.updateDestroyOverlay();
      this.updatePlayerModel();
      this.updateRemotePlayers();
      // Pausado em singleplayer o mundo congela (como no original): não há o que animar nos itens, mobs e partículas
      const frozen = this.paused && !isOnline && !this.chatOpen && !this.containerOpenFn?.();
      if (this.itemEntities && !frozen) {
        const inv = this.inventory || this.player.inventory;
        this.itemEntities.update(Math.min(dt, 100) / 1000, this.player, inv, this.world, this.worldTime, this._cameraFrustum, this.camera);
      }
      if (this.mobs && !frozen) this.mobs.renderUpdate(this.worldTime / 20, this.player.pos, this._cameraFrustum, Math.min(1, Math.max(0, this.tickAcc / TICK_MS)));
      if (this.particles && !frozen) this.particles.renderUpdate();
      perfMonitor.endStage('entities');
      perfMonitor.beginStage('render');
      if (this.world) {
        this.world.cullChunks(this.camera.position, this.lookDir(), this.renderDistance, this._cameraFrustum);
      }
      const mbOn = clientStore.isOn('motionblur');
      const mbAmount = mbOn ? clientStore.get('motionblur', 'amount') || 4 : 0;
      if (mbOn && this.motionBlur && !this.paused) {
        this.motionBlur.renderWithBlur(
          () => this.renderer.render(this.scene, this.camera),
          mbAmount,
          this.canvas.clientWidth,
          this.canvas.clientHeight,
          this.renderer.getPixelRatio()
        );
      } else {
        this.renderer.render(this.scene, this.camera);
      }
      // Captura os Draw Calls e Triângulos reais do mundo antes que a cena da mão (fpsScene) zere o renderer.info
      this._worldDrawCalls = this.renderer.info.render.calls;
      this._worldTriangles = this.renderer.info.render.triangles;
      this.updateFirstPersonHand();
      // showCrosshair() do 1.8.9: some com o F3 (que desenha os eixos), com F1 e com qualquer tela aberta
      this.crosshair?.render(
        this.canvas.clientWidth, this.canvas.clientHeight,
        !this.f3 && !this.hideHud && !this.paused && !this.chatOpen && !this.player.isDead && !this.containerOpenFn?.(),
      );


      this.fpsFrames++;
      perfMonitor.endStage('render');
    }
    if (now - this.fpsTime > 500) {
      this.fps = Math.round(this.fpsFrames * 1000 / (now - this.fpsTime));
      this.fpsFrames = 0; this.fpsTime = now;
    }
    this.frame++;
    if (this.titleTicks > 0) this.titleTicks--;
    // RF-050: HUD no máximo 10×/s
    perfMonitor.beginStage('hud');
    // Com GUI/pausa aberta o HUD quase não muda: emitir 10×/s refazia a árvore React inteira (inventário com ~100 ícones) à toa
    // Por tempo, não por quadro: a 2000 FPS "a cada 6 quadros" eram >300 renders React por segundo (era o que derrubava o FPS)
    if (now - (this._hudAt || 0) >= (this.paused && !this.chatOpen ? 250 : 66)) this.emitHud();
    perfMonitor.endStage('hud');
    const info = perfMonitor.info;
    if (world) {
      info.meshQ = world.pendingMeshCount();
      info.inFlight = world.inflight.size;
      info.chunks = world.chunks.size;
      info.errors = world.stats.errors;
      info.timeouts = world.stats.timeouts;
    }
    this._perfCtx.loadingRadius = this.loadingRadius;
    this._perfCtx.meshQ = info.meshQ;
    perfMonitor.endFrame(this._perfCtx);
  }

  updateSkyAndLighting() {
    const time = this.worldTime;
    this.sky.update(time, this.camera);
    if (this.dimension === 'nether') { this._updateNetherLook(); return; }

    const sb = skyBrightnessFactor(time);
    const ss = sunsetFactor(time);
    const u = this.world.uniforms;

    // Escurecimento por clima
    const rainDark = this.weather ? this.weather.getSkyDarkness() : 0;
    const rainFactor = Math.max(0.3, 1 - rainDark * 0.06);

    let skyR = Math.min(1, 0.6 * sb + ss * 0.25) * rainFactor;
    let skyG = Math.min(1, 0.75 * sb + ss * 0.08) * rainFactor;
    let skyB = Math.min(1, 1.0 * sb - ss * 0.12) * rainFactor;

    // Flash de raio
    if (this.weather && this.weather.lightningFlash > 0) {
      skyR = Math.min(1, skyR + 0.6);
      skyG = Math.min(1, skyG + 0.6);
      skyB = Math.min(1, skyB + 0.6);
    }

    u.uSkyColor.value.setRGB(skyR, skyG, skyB);
    u.uSunBright.value = sunBrightness(this.worldTime);
    u.uBrightness.value = (settingsStore.get('device.brightness') || 0) / 100;
    if (u.uFullbright) u.uFullbright.value = clientStore.isOn('fullbright') ? 1 : 0;
    // PRD 23 RF-021: névoa sempre ligada, de 75% a 100% de RD × 16 blocos (esconde a borda do mundo carregado)
    const rd = Math.max(2, this.renderDistance);
    const fogDist = rd * 16;
    if (!this._uwColor) this._uwColor = new THREE.Color();
    if (this.inFluid === 'water') {
      // PRD 23 RF-024: névoa/tinta subaquática SÓ com os olhos dentro de um bloco de água
      this._uwColor.setRGB(0.04 + 0.12 * sb, 0.12 + 0.28 * sb, 0.25 + 0.45 * sb);
      u.uFogColor.value.copy(this._uwColor);
      u.uFogNear.value = 0;
      u.uFogFar.value = Math.min(fogDist, 28);
      this.scene.background = this._uwColor;
    } else if (this.inFluid === 'lava') {
      this._uwColor.setRGB(0.55, 0.14, 0.02);
      u.uFogColor.value.copy(this._uwColor);
      u.uFogNear.value = 0;
      u.uFogFar.value = 4;
      this.scene.background = this._uwColor;
    } else {
      u.uFogColor.value.copy(this.sky.fogColor);
      u.uFogNear.value = fogDist * 0.75;
      u.uFogFar.value = fogDist;
      this.scene.background = this.sky.skyColor;
    }

    // Partículas de chuva/neve
    if (this.weather) this.weather.updateVisuals(this.camera, this.world);
  }

  // Nether: sem céu, névoa avermelhada curta, luz ambiente fixa
  _updateNetherLook() {
    const u = this.world.uniforms;
    u.uSkyColor.value.setRGB(0.42, 0.3, 0.3);
    u.uSunBright.value = 1;
    u.uBrightness.value = (settingsStore.get('device.brightness') || 0) / 100;
    if (u.uFullbright) u.uFullbright.value = clientStore.isOn('fullbright') ? 1 : 0;
    if (!this._netherFog) this._netherFog = new THREE.Color(0.2, 0.03, 0.03);
    u.uFogColor.value.copy(this._netherFog);
    const fogDist = Math.max(2, this.renderDistance) * 16;
    u.uFogNear.value = Math.min(fogDist * 0.2, 24);
    u.uFogFar.value = Math.min(fogDist, 96);
    this.scene.background = this._netherFog;
  }

  // EntityPlayerSP.getFOVMultiplier (1.8.9): 1,1 voando; × (velocidade/velocidade-base + 1) / 2 — correr dá ×1,3 de velocidade, logo 1,15;
  // poção de velocidade/lentidão entra na mesma conta; arco esticado encolhe até 15 % (quadrático até 20 ticks).
  _fovTarget() {
    const p = this.player;
    let f = 1;
    if (p.flying) f *= 1.1;
    const speedRatio = (p.sprinting ? 1.3 : 1) * getSpeedModifier(p);
    f *= (speedRatio + 1) / 2;
    if (p.bowDrawing && this.bowChargeTicks > 0) {
      let t = this.bowChargeTicks / 20;
      t = t > 1 ? 1 : t * t;
      f *= 1 - t * 0.15;
    }
    return Number.isFinite(f) ? f : 1;
  }

  // EntityRenderer.updateFovModifierHand: a cada tick o valor anda metade do caminho até o alvo (fica entre 0,1 e 1,5)
  _tickFovModifier() {
    this._fovModPrev = this._fovMod;
    this._fovMod += (this._fovTarget() - this._fovMod) * 0.5;
    if (this._fovMod > 1.5) this._fovMod = 1.5;
    if (this._fovMod < 0.1) this._fovMod = 0.1;
  }

  updateCamera() {
    const fov = settingsStore.get('user.fov') || 70;
    const zooming = this.isZooming();
    // Interpola entre o valor do tick anterior e o atual com o progresso do tick: a transição fica contínua em qualquer taxa de quadros
    const pt = Math.min(1, Math.max(0, this.tickAcc / TICK_MS));
    const mod = this._fovModPrev + (this._fovMod - this._fovModPrev) * pt;
    const targetFov = zooming ? Math.min(fov, 30) : fov * mod;
    if (Math.abs(this.camera.fov - targetFov) > 0.005) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
    const eye = this.eyePos();
    if (this._prevPos && !this.paused) {
      const partialTick = Math.min(1, Math.max(0, this.tickAcc / TICK_MS));
      eye.x = this._prevPos.x + (this.player.pos.x - this._prevPos.x) * partialTick;
      eye.y = (this._prevPos.y + (this.player.pos.y - this._prevPos.y) * partialTick) + (this.player.sneaking ? PLAYER.eyeSneak : PLAYER.eye);
      eye.z = this._prevPos.z + (this.player.pos.z - this._prevPos.z) * partialTick;
    }
    if (this.freeLook.on && (this.paused || this.chatOpen || this.containerOpenFn?.())) this.endFreeLook();
    const dir = this.freeLook.on
      ? lookDirFromAngles(this.player.yaw + this.freeLook.yaw, Math.max(-1.45, Math.min(1.45, this.player.pitch + this.freeLook.pitch)))
      : this.lookDir();
    const pMode = this.perspective || 0;
    if (pMode > 0) {
      let d = 4.0;
      const mult = pMode === 1 ? -1 : 1;

      // Colisão de câmera com blocos sólidos (Third Person Camera Collision)
      const step = 0.2;
      for (let dist = 0.4; dist <= 4.0; dist += step) {
        const cx = Math.floor(eye.x + dir.x * dist * mult);
        const cy = Math.floor(eye.y + dir.y * dist * mult);
        const cz = Math.floor(eye.z + dir.z * dist * mult);
        if (cy >= 0 && cy < 256) {
          const blockId = typeof this.world.getBlockId === 'function' ? this.world.getBlockId(cx, cy, cz) : stateId(this.world.getBlock(cx, cy, cz));
          const b = getBlock(blockId);
          if (b && b.solid) {
            d = Math.max(0.4, dist - 0.2);
            break;
          }
        }
      }

      this.camera.position.set(
        eye.x + dir.x * d * mult,
        eye.y + dir.y * d * mult,
        eye.z + dir.z * d * mult
      );
      this.camera.lookAt(eye.x, eye.y, eye.z);
      this.playerModel.visible = true;
    } else {
      this.camera.position.set(eye.x, eye.y, eye.z);
      this.camera.lookAt(eye.x + dir.x, eye.y + dir.y, eye.z + dir.z);
      this.playerModel.visible = false;
      if (settingsStore.get('user.viewBobbing')) {
        const spd = Math.hypot(this.player.vel.x, this.player.vel.z);
        if (spd > 0.5) {
          const bp = this.worldTime * 0.15;
          const ba = Math.min(1, spd / 5) * 0.05;
          this.camera.position.y += Math.sin(bp * 2) * ba;
        }
      }
    }
    // Tombamento clássico ao morrer (1.8.9: tomba para o lado 90 graus e câmera fica no chão)
    if (this.player.isDead) {
      this._deathRoll = Math.min(1, (this._deathRoll || 0) + 0.05);
      this.camera.position.set(eye.x, this.player.pos.y + 0.2, eye.z);
      this.camera.rotateZ(this._deathRoll * (Math.PI / 2));
    } else if (this.player.sleeping) {
      this.camera.position.set(eye.x, this.player.pos.y + 0.4, eye.z);
    } else {
      this._deathRoll = 0;
    }
    // Balanço de câmera ao tomar dano (1.8.9: 14° · sen(f⁴·π), f = hurtTime/10). Sem direção do golpe: rola sempre para o mesmo lado.
    this._hurtRollValue = this.hurtRoll();
    if (this._hurtRollValue && !this.player.isDead) this.camera.rotateZ(this._hurtRollValue);
    updateAudioListener(this.camera.position, dir);
  }

  hurtRoll() {
    const p = this.player;
    if (this.paused || !(p.hurtTime > 0)) return 0;
    const partial = Math.min(1, Math.max(0, this.tickAcc / TICK_MS));
    const f = Math.max(0, p.hurtTime - partial) / 10;
    return -Math.sin(f * f * f * f * Math.PI) * 14 * Math.PI / 180;
  }

  updateOutline() {
    const hideAll = () => { this.outline.visible = false; for (const o of this._outlineExtra) o.visible = false; };
    if (this.paused || this.chatOpen) { hideAll(); return; }
    const hit = this.raycast();
    if (!hit) { hideAll(); this.outline.scale.set(1, 1, 1); return; }
    const blk = getBlock(hit.id);
    // lajes e escadas: um contorno por caixa (a escada tem até 3); os demais usam a caixa de seleção do registro
    let boxes = [getSelectionBox(hit.id, hit.meta) || [0, 0, 0, 1, 1, 1]];
    if (hasShape(blk)) {
      boxes = blockBoxes(this.world.getBlock(hit.x, hit.y, hit.z), (a, b, c) => this.world.getBlock(a, b, c), hit.x, hit.y, hit.z) || boxes;
    }
    const targets = [this.outline, ...this._outlineExtra];
    targets.forEach((o, i) => {
      const box = boxes[i];
      if (!box) { o.visible = false; return; }
      const w = box[3] - box[0], h = box[4] - box[1], d = box[5] - box[2];
      o.position.set(hit.x + box[0] + w / 2, hit.y + box[1] + h / 2, hit.z + box[2] + d / 2);
      o.scale.set(w * 1.002, h * 1.002, d * 1.002);
      o.visible = true;
    });
  }

  updateDestroyOverlay() {
    if (this.miningProgress > 0 && this.miningTarget && !this.paused) {
      const stage = Math.min(9, Math.floor(this.miningProgress * 10));
      const target = this.miningTarget;
      this.destroyMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
      this.destroyMesh.visible = true;

      if (!this._destroyStageTextures.has(stage)) {
        getPackUrl(MC + 'textures/blocks/destroy_stage_' + stage + '.png').then(url => {
          if (url) {
            const loader = new THREE.TextureLoader();
            loader.load(url, (tex) => {
              tex.magFilter = THREE.NearestFilter;
              tex.minFilter = THREE.NearestFilter;
              this._destroyStageTextures.set(stage, tex);
              if (this.destroyMesh && Math.min(9, Math.floor(this.miningProgress * 10)) === stage) {
                this.destroyMesh.material.map = tex;
                this.destroyMesh.material.needsUpdate = true;
              }
            });
          }
        });
      } else {
        const tex = this._destroyStageTextures.get(stage);
        if (this.destroyMesh.material.map !== tex) {
          this.destroyMesh.material.map = tex;
          this.destroyMesh.material.needsUpdate = true;
        }
      }
    } else {
      if (this.destroyMesh) this.destroyMesh.visible = false;
    }
  }

  // Reaplica regras/dificuldade salvos na tela de opções enquanto o jogo roda
  applyWorldRules(gameRules, difficulty) {
    this.gameRules = { ...DEFAULT_GAME_RULES, ...(gameRules || {}) };
    if (difficulty) this.difficulty = difficulty;
  }

  updatePlayerModel() {
    const p = this.player;
    const m = this.playerModel;
    const inThirdPerson = (this.perspective || 0) > 0;

    if (inThirdPerson) {
      const partialTick = Math.min(1, Math.max(0, this.tickAcc / TICK_MS));
      placePlayerModel(m, p.pos, p.yaw);
      applyThirdPersonPose(m, this.anim, p, this.worldTime, partialTick);
      setModelHeldItem(m, this.getHeldItem()?.id);
      setModelArmor(m, armorCodeFromSlots(this.inventory?.armor));
      setModelCape(m, this._capeSrc, settingsStore.get('user.skinParts.cape') !== false);
    }

    const isHurt = p.hurtTime > 0;
    const hurtColor = isHurt ? 0xff5555 : 0xffffff;
    if (this._lastHurtColor !== hurtColor) {
      this._lastHurtColor = hurtColor;
      m.traverse((c) => { if (c.material && c.material.color && !c.isSprite) c.material.color.setHex(isHurt ? hurtColor : (c.material.userData?.baseColor ?? hurtColor)); });
      if (this.fpsArm) {
        this.fpsArm.traverse((c) => { if (c.material && c.material.color) c.material.color.setHex(hurtColor); });
      }
    }

    if (this.nametag) {
      this.nametag.visible = inThirdPerson && clientStore.isOn('nametags') && clientStore.get('nametags', 'own');
      if (this.nametag.visible) this.nametag.position.y = p.isDead ? 0.85 : 2.35;
    }
    if (this.voiceIconLocal && inThirdPerson) {
      this.voiceIconLocal.position.y = (p.isDead ? 0.85 : 2.35) + 0.3;
      setVoiceIconState(this.voiceIconLocal, voiceChat.getWireState());
    }
  }

  // Capa remota: uma busca por nickname (guardada em cache; valor undefined = busca em voo)
  _ensureRemoteCape(entry, name) {
    if (!name) return;
    if (!this._remoteCapeCache) this._remoteCapeCache = new Map();
    if (this._remoteCapeCache.has(name)) {
      const v = this._remoteCapeCache.get(name);
      if (v !== undefined) setModelCape(entry.group, v || null, true);
      return;
    }
    this._remoteCapeCache.set(name, undefined);
    fetchCraftheadCape(name)
      .then((c) => {
        this._remoteCapeCache.set(name, c ? c.png : null);
        setModelCape(entry.group, c ? c.png : null, true);
      })
      .catch(() => { this._remoteCapeCache.set(name, null); });
  }

  // Skin remota: busca pelo nickname (cacheada). Todas as skins da sala são baixadas em paralelo (ver _prefetchRemoteSkins) e o modelo do
  // jogador remoto só aparece quando a skin chegou (ou falhou/estourou 2,5 s), em vez de mostrar Steve e trocar depois.
  _fetchRemoteSkin(name) {
    if (!this._remoteSkinCache) this._remoteSkinCache = new Map();
    if (!this._remoteSkinPromises) this._remoteSkinPromises = new Map();
    if (this._remoteSkinPromises.has(name)) return this._remoteSkinPromises.get(name);
    const p = fetchCraftheadSkin(name)
      .then((res) => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const cv = document.createElement('canvas');
          cv.width = 64; cv.height = 64;
          cv.getContext('2d').drawImage(img, 0, 0);
          const tex = new THREE.CanvasTexture(cv);
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.needsUpdate = true;
          const v = { tex, slim: res.slim };
          this._remoteSkinCache.set(name, v);
          resolve(v);
        };
        img.onerror = () => { this._remoteSkinCache.set(name, null); resolve(null); };
        img.src = res.png;
      }))
      .catch(() => { this._remoteSkinCache.set(name, null); return null; });
    this._remoteSkinPromises.set(name, p);
    return p;
  }

  _prefetchRemoteSkins(names) {
    const todo = [...new Set(names)].filter((n) => n && n !== 'Player' && n !== 'Steve');
    for (const n of todo) { this._fetchRemoteSkin(n); }
    return Promise.all(todo.map((n) => this._fetchRemoteSkin(n)));
  }

  _ensureRemoteSkin(entry, name) {
    const generic = !name || name === 'Player' || name === 'Steve';
    if (generic) { entry.group.visible = true; return; }
    if (!this._remoteSkinCache) this._remoteSkinCache = new Map();
    const v = this._remoteSkinCache.get(name);
    if (v === undefined) {
      this._fetchRemoteSkin(name);
      if (!entry.group.visible && performance.now() - (entry.born || 0) > 2500) entry.group.visible = true; // demorou demais: mostra o padrão
      return;
    }
    if (v && !entry._skinApplied) {
      const player = entry.group?.userData?.playerObject;
      if (player) {
        player.setSkinTexture(v.tex);
        player.modelType = v.slim ? 'slim' : 'default';
        entry._skinApplied = true;
      }
    }
    entry.group.visible = true;
  }

  updateRemotePlayers() {
    if (!this.netManager) return;
    if (!this._remoteMeshes) this._remoteMeshes = new Map();

    const remoteMap = this.netManager.remotePlayers;
    const activeIds = new Set();

    if (remoteMap) {
      for (const [id, rp] of remoteMap.entries()) {
        activeIds.add(id);
        let entry = this._remoteMeshes.get(id);
        if (!entry) {
          const group = buildPlayerModel();
          group.visible = false; // fica oculto até a skin chegar (ver _ensureRemoteSkin); buildPlayerModel já nasce oculto
          const tag = createNametag(rp.name || 'Player');
          tag.position.y = 2.35;
          group.add(tag);
          const icon = createVoiceIcon();   // microfone em cima do nome: falando (cor = tom) ou mutado
          icon.position.y = 2.65;
          group.add(icon);
          this.scene.add(group);
          entry = { group, tag, icon, born: performance.now(), anim: createAnimationState() };
          this._remoteMeshes.set(id, entry);
        }

        const now = performance.now();
        interpolateRemotePlayer(rp, now);

        const rx = rp.x || 0;
        const ry = rp.y || 0;
        const rz = rp.z || 0;

        // Voz por aproximação: posição do jogador, tom (alcance) e ícone do microfone (sempre atualizada)
        voiceChat.updateRemotePosition(id, { x: rx, y: ry, z: rz });
        voiceChat.setRemoteVoice(id, rp.voice | 0);
        if (entry?.icon) setVoiceIconState(entry.icon, rp.voice | 0);

        // Otimização Eaglercraft: Frustum & Distance Culling de Jogadores Remotos
        const myPos = this.player?.pos || this.camera.position;
        const maxDist = (this.renderDistance || 8) * 16;
        const dx = rx - myPos.x;
        const dz = rz - myPos.z;
        const tooFar = (dx * dx + dz * dz) > (maxDist * maxDist);

        let inFrustum = true;
        if (!tooFar && this._cameraFrustum) {
          if (!entry._box) entry._box = new THREE.Box3();
          entry._box.min.set(rx - 0.8, ry - 0.2, rz - 0.8);
          entry._box.max.set(rx + 0.8, ry + 2.4, rz + 0.8);
          inFrustum = this._cameraFrustum.intersectsBox(entry._box);
        }

        if (tooFar || !inFrustum) {
          entry.group.visible = false;
          entry._prev = { x: rx, y: ry, z: rz, t: now };
          continue;
        }

        placePlayerModel(entry.group, { x: rx, y: ry, z: rz }, rp.yaw || 0);
        // Item que o jogador remoto está segurando (chegou junto com o move)
        setModelHeldItem(entry.group, rp.held);
        setModelArmor(entry.group, rp.armor);
        // Capa e skin do remoto: busca pelo nickname (cacheada)
        this._ensureRemoteCape(entry, rp.name);
        this._ensureRemoteSkin(entry, rp.name);
        if (entry._prev) {
          const dt = Math.max(0.001, (now - entry._prev.t) / 1000);
          const spd = Math.hypot(rx - entry._prev.x, rz - entry._prev.z) / dt;
          const vy = (ry - entry._prev.y) / dt;
          const cp = entry.group.userData.cape;
          if (cp && cp.visible) {
            const base = (10.8 * Math.PI) / 180;
            const flare = Math.min(1, spd / 7) * 0.55 + Math.min(1, Math.max(0, -vy) / 8) * 1.1;
            cp.rotation.x += (base + flare - cp.rotation.x) * 0.15;
          }
          if (entry.anim && !rp.sleeping && !rp.isDead) {
            entry.anim.speed = spd;
            if (spd > 0.05) entry.anim.walkPhase += spd * dt * 2.5;
            // mesma conta dos passos do 1.8.9, em tempo real: distância por tick = velocidade / 20; o fator por quadro equivale aos ticks que passaram
            const ticks = dt * 20, a = entry.anim;
            const f = Math.min(1, (spd / 20) * 4);
            a.prevLimbSwingAmount = a.limbSwingAmount;
            a.limbSwingAmount += (f - a.limbSwingAmount) * (1 - Math.pow(0.6, ticks));
            a.limbSwing += a.limbSwingAmount * ticks;
            a.hasLimb = true; a.age += ticks;
            applyThirdPersonPose(entry.group, entry.anim, rp, this.worldTime, 0);
          }
        }
        entry._prev = { x: rx, y: ry, z: rz, t: now };
        if (rp.sleeping) {
          entry.group.rotation.x = -Math.PI / 2;
          entry.group.rotation.z = 0;
          entry.group.position.y = ry + 0.2;
          if (entry.tag) entry.tag.position.y = 0.9;
        } else {
          // Morto: tomba de lado, fica vermelho e treme (o 1.8.9 gira o corpo 90° em ~20 ticks)
          rp.deathProgress = rp.isDead ? Math.min(1, (rp.deathProgress || 0) + 0.06) : 0;
          entry.group.rotation.z = rp.deathProgress * Math.PI / 2;
          entry.group.rotation.x = rp.isDead && rp.deathProgress < 1 ? Math.sin(performance.now() * 0.08) * 0.06 : 0;
          const tint = rp.isDead ? 0xff5555 : 0xffffff;
          if (entry.tint !== tint) {
            entry.tint = tint;
            entry.group.traverse(c => { if (c.material && c.material.color && !c.isSprite) c.material.color.setHex(tint); });
          }
          if (entry.tag) {
            entry.tag.position.y = rp.isDead ? 0.85 : 2.35;
            entry.tag.visible = clientStore.isOn('nametags') && clientStore.get('nametags', 'others');
          }
          if (entry.icon) entry.icon.position.y = (rp.isDead ? 0.85 : 2.35) + 0.3;
        }
      }
    }

    for (const [id, entry] of this._remoteMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.group);
        disposeVoiceIcon(entry.icon);
        this._remoteMeshes.delete(id);
      }
    }
  }

  emitHud(force = false) {
    this._hudAt = performance.now();
    const p = this.player;
    if (!p) return;

    const isF3 = !!this.f3;
    const clientCoords = clientStore.isOn('coordinates');
    const clientDir = clientStore.isOn('direction');
    const clientFps = clientStore.isOn('fps') || !!settingsStore.get('device.showFps');
    const clientCps = clientStore.isOn('cps');

    const px = p.pos.x;
    const py = p.pos.y;
    const pz = p.pos.z;
    const yaw = p.yaw;

    if (!force && !isF3 && this._lastHudSig) {
      const sig = this._lastHudSig;
      const posMoved = (clientCoords && (Math.abs(px - sig.px) > 0.005 || Math.abs(py - sig.py) > 0.005 || Math.abs(pz - sig.pz) > 0.005)) ||
                       (clientDir && Math.abs(yaw - sig.yaw) > 0.015);
      const fpsChanged = clientFps && (this.fps !== sig.fps);
      const cpsChanged = clientCps && (this.cps !== sig.cps);
      const playerChanged = p.health !== sig.health ||
                            p.hunger !== sig.hunger ||
                            p.air !== sig.air ||
                            p.selectedSlot !== sig.selectedSlot ||
                            p.isDead !== sig.isDead ||
                            p.sleeping !== sig.sleeping ||
                            p.sleepTimer !== sig.sleepTimer ||
                            p.eating !== sig.eating ||
                            p.eatingTicks !== sig.eatingTicks ||
                            p.blocking !== sig.blocking ||
                            p.bowDrawing !== sig.bowDrawing ||
                            p.bowCharge !== sig.bowCharge ||
                            p.flying !== sig.flying ||
                            p.sneaking !== sig.sneaking ||
                            p.sprinting !== sig.sprinting ||
                            (p.effects ? p.effects.length : 0) !== sig.effectsLen ||
                            p.xpLevel !== sig.xpLevel ||
                            p.absorption !== sig.absorption ||
                            p.fireTicks !== sig.fireTicks ||
                            p.hurtTime !== sig.hurtTime;
      const engineChanged = this.paused !== sig.paused ||
                            this.chatOpen !== sig.chatOpen ||
                            this.hideHud !== sig.hideHud ||
                            this.inFluid !== sig.inFluid ||
                            (this.titleTicks > 0) !== sig.hasTitle ||
                            (this._portalTicks > 0) !== sig.hasPortal ||
                            this.playerListOpen !== sig.playerListOpen ||
                            musicManager.isPlaying !== sig.musicPlaying ||
                            musicManager.trackName !== sig.musicTrack ||
                            voiceChat.micMuted !== sig.voiceMuted ||
                            voiceChat.isSpeaking !== sig.voiceSpeaking ||
                            voiceChat.localStream !== sig.voiceActive;

      if (!posMoved && !fpsChanged && !cpsChanged && !playerChanged && !engineChanged) {
        return;
      }
    }

    this._lastHudSig = {
      isF3,
      px, py, pz, yaw,
      fps: this.fps,
      cps: this.cps,
      health: p.health,
      hunger: p.hunger,
      air: p.air,
      selectedSlot: p.selectedSlot,
      isDead: p.isDead,
      sleeping: p.sleeping,
      sleepTimer: p.sleepTimer,
      eating: p.eating,
      eatingTicks: p.eatingTicks,
      blocking: p.blocking,
      bowDrawing: p.bowDrawing,
      bowCharge: p.bowCharge,
      flying: p.flying,
      sneaking: p.sneaking,
      sprinting: p.sprinting,
      effectsLen: p.effects ? p.effects.length : 0,
      xpLevel: p.xpLevel,
      absorption: p.absorption,
      fireTicks: p.fireTicks,
      hurtTime: p.hurtTime,
      paused: this.paused,
      chatOpen: this.chatOpen,
      hideHud: this.hideHud,
      inFluid: this.inFluid,
      hasTitle: this.titleTicks > 0,
      hasPortal: this._portalTicks > 0,
      playerListOpen: this.playerListOpen,
      musicPlaying: musicManager.isPlaying,
      musicTrack: musicManager.trackName,
      voiceMuted: voiceChat.micMuted,
      voiceSpeaking: voiceChat.isSpeaking,
      voiceActive: voiceChat.localStream,
    };

    const yawRad = ((p.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const deg = yawRad * 180 / Math.PI;
    let facing = 'Sul (+Z)';
    if (deg < 45 || deg >= 315) facing = 'Sul (+Z)';
    else if (deg < 135) facing = 'Oeste (-X)';
    else if (deg < 225) facing = 'Norte (-Z)';
    else facing = 'Leste (+X)';

    let hit = null;
    let light = { sky: 15, block: 0 };
    let biome = '—';
    let perfStats = null;
    let drawCalls = 0;
    let triangles = 0;

    if (isF3) {
      hit = this.raycast();
      const eye = this.eyePos();
      if (this.world?.getLight) light = this.world.getLight(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
      if (this.world?.getBiomeAt) biome = this.world.getBiomeAt(Math.floor(p.pos.x), Math.floor(p.pos.z))?.name || '—';
      perfStats = perfMonitor.getStats();
      drawCalls = this._worldDrawCalls ?? this.renderer?.info?.render?.calls ?? 0;
      triangles = this._worldTriangles ?? this.renderer?.info?.render?.triangles ?? 0;
    }

    const t = this.worldTime % 24000;
    const hours = Math.floor((t / 1000 + 6) % 24);
    const mins = Math.floor((t % 1000) / 1000 * 60);

    const totalPlayers = 1 + (this.netManager?.remotePlayers ? this.netManager.remotePlayers.size : (this.remotePlayers ? Object.keys(this.remotePlayers).length : 0));
    let sleepingCount = p.sleeping ? 1 : 0;
    if (this.netManager?.remotePlayers) {
      for (const rp of this.netManager.remotePlayers.values()) {
        if (rp.sleeping) sleepingCount++;
      }
    } else if (this.remotePlayers) {
      for (const rp of Object.values(this.remotePlayers)) {
        if (rp.sleeping) sleepingCount++;
      }
    }

    const hud = {
      sleeping: !!p.sleeping,
      sleepFade: p.sleeping ? Math.min(1, (p.sleepTimer || 0) / 40) : 0,
      sleepingStatus: (sleepingCount > 0) ? `${sleepingCount}/${totalPlayers} jogadores dormindo, durma para amanhecer` : null,
      fps: this.fps,
      tps: 20,
      xyz: isF3 ? `${p.pos.x.toFixed(3)} / ${p.pos.y.toFixed(3)} / ${p.pos.z.toFixed(3)}` : `${Math.floor(p.pos.x)} / ${Math.floor(p.pos.y)} / ${Math.floor(p.pos.z)}`,
      px: p.pos.x, py: p.pos.y, pz: p.pos.z,
      block: `${Math.floor(p.pos.x)}, ${Math.floor(p.pos.y)}, ${Math.floor(p.pos.z)}`,
      chunk: `${chunkCoord(Math.floor(p.pos.x))}, ${chunkCoord(Math.floor(p.pos.z))}`,
      facing,
      yaw: deg.toFixed(1),
      pitch: (p.pitch * 180 / Math.PI).toFixed(1),
      targeted: (isF3 && hit) ? `${getBlock(hit.id).namePt} @ ${hit.x},${hit.y},${hit.z}` : '—',
      hotbar: p.hotbar,
      selectedSlot: p.selectedSlot,
      gamemode: p.gameMode,
      flying: p.flying,
      sneaking: p.sneaking,
      sprinting: p.sprinting,
      sprintToggled: !!this.sprintToggled,
      worldTime: this.worldTime,
      dayTime: t,
      clock: `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`,
      skyLight: light.sky,
      blockLight: light.block,
      inFluid: this.inFluid,
      paused: this.paused,
      chatOpen: this.chatOpen,
      shaderMode: settingsStore.get('device.shaderMode') === 'shaders' ? 1 : 0,
      hideHud: this.hideHud,
      showFps: settingsStore.get('device.showFps'),
      f3: this.f3,
      build: 'PRD-07',
      health: p.health ?? 20,
      maxHealth: p.maxHealth ?? 20,
      absorption: p.absorption ?? 0,
      hunger: p.hunger ?? 20,
      saturation: p.saturation ?? 5,
      air: p.air ?? 300,
      xpLevel: p.xpLevel ?? 0,
      xpProgress: getXPProgress(p),
      effects: p.effects || [],
      armor: getArmorPoints(p.armor || []),
      fireTicks: p.fireTicks ?? 0,
      hurtTime: p.hurtTime ?? 0,
      isDead: p.isDead ?? false,
      deathMessage: p.isDead ? (p.deathText || `${p.nomeJogador || 'Jogador'} ${this._getDeathMessage()}`) : null,
      eating: p.eating ?? false,
      eatingTicks: p.eatingTicks ?? 0,
      weather: this.weather ? (this.weather.isThundering() ? 'thunder' : (this.weather.isRaining() ? 'rain' : 'clear')) : 'clear',
      difficulty: this.difficulty,
      blocking: p.blocking ?? false,
      bowCharge: p.bowCharge ?? 0,
      bowDrawing: p.bowDrawing ?? false,
      cps: getCps(this.cps),
      swingProgress: this.anim.swingProgress,
      mobCount: this.mobs ? this.mobs.getMobCount() : 0,
      gun: this.gunController ? this.gunController.getHudData() : null,
      gunStats: this.gunController ? this.gunController.stats : null,
      noiseEvents: this.noiseSystem ? this.noiseSystem.events.length : 0,
      gunsEnabled: this.gameRules.gunsEnabled !== false,
      biome,
      moonPhase: Math.floor((this.worldTime / 24000) % 8),
      meshQueueSize: this.world.pendingMeshCount(),
      drawCalls,
      triangles,
      chunksLoaded: this.world.chunks ? this.world.chunks.size : 0,
      stats: p.stats || null,
      achievements: p.achievements || null,
      showHitboxes: this.showHitboxes,
      showChunkBorders: this.showChunkBorders,
      realTextures: isRealTexturesLoaded(),
      // aviso no HUD só quando há algo carregando de verdade: download das texturas ou os chunks restantes até a distância de renderização
      dimLoading: this.dimLoading || null,
      portalProgress: this._portalTicks > 0 && !this._switching ? Math.min(1, this._portalTicks / 80) : 0,
      loadingNote: isPackDownloading() ? 'Carregando texturas...' : (this.loadingRadius < this.targetRadius ? 'Carregando chunks...' : null),
      build: 'PRD-21',
      title: this.titleTicks > 0 ? this.titleText : null,
      subtitle: this.titleTicks > 0 ? this.subtitleText : null,
      perf: perfStats || perfMonitor.getStats(),
      gpuRenderer: perfMonitor.gpuRenderer,
      isSoftwareRenderer: perfMonitor.isSoftwareRenderer,
      loadingRadius: this.loadingRadius,
      targetRadius: this.targetRadius,
      dimension: this.dimension,
      portalProgress: this._portalTicks > 0 ? Math.min(1, this._portalTicks / 80) : 0,
      playerListOpen: !!this.playerListOpen,
      pings: this.netManager?.getAllPings() || [{ name: p.nomeJogador || 'Jogador', pingMs: 0, isHost: true, id: 'local', rank: 'owner' }],
      selfName: p.nomeJogador || null,
      scoreboard: this.world?.scoreboard || null,
      worldName: this.world?.name || 'Mundo',
      isHost: this.netManager ? !!this.netManager.room : true,
      musicTrack: musicManager.isPlaying ? musicManager.trackName : null,
      voiceChat: {
        muted: voiceChat.micMuted,
        speaking: voiceChat.isSpeaking,
        tier: voiceChat.voiceTier,
        active: !!voiceChat.localStream,
      },
    };
    this._lastHud = hud;
    this.onHud(hud);
  }

  // PRD 21 RF-002: log de travamentos copiável
  getFreezeLog() { return perfMonitor.getFreezes(); }
  getPerfStats() { return perfMonitor.getStats(); }

  // Explosão simples (fallback quando mobs não está disponível)
  _explodeSimple(pos, power, player) {
    const dx = player.pos.x - pos.x, dy = (player.pos.y + 1) - pos.y, dz = player.pos.z - pos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < power * 2) {
      const dmg = (1 - dist / (power * 2)) * power * 4;
      applyDamage(player, dmg, 'explosion');
    }
  }

  tickMining(p) {
    const hit = this.raycast(true);
    if (!hit) { this.miningTarget = null; this.miningProgress = 0; return; }
    const block = getBlock(hit.id);
    if (block.hardness < 0) return;

    const tool = this.getHeldItem();
    const time = getMiningTime(hit.id, tool, p.effects, this.inFluid === 'water', p.onGround);
    if (time === Infinity) return;

    // Blocos instantâneos (grama, flores, tocha ou eficiência alta): quebram na hora sem esperar breakCd!
    if (time <= 1) {
      this.breakBlockSurvival(hit, tool);
      this.miningTarget = null;
      this.miningProgress = 0;
      return;
    }

    if (!this.miningTarget || this.miningTarget.x !== hit.x || this.miningTarget.y !== hit.y || this.miningTarget.z !== hit.z) {
      this.miningTarget = { x: hit.x, y: hit.y, z: hit.z };
      this.miningProgress = 0;
    }

    if (this.breakCd > 0) return;
    this.miningProgress += 1 / time;
    this._digTick = (this._digTick || 0) + 1;
    if (this._digTick % 4 === 0) playDigSound(hit.id, { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
    if (this.miningProgress >= 1) {
      this.breakBlockSurvival(hit, tool);
      this.miningTarget = null;
      this.miningProgress = 0;
      this.breakCd = 4; // Pausa curta entre quebras contínuas segurando o botão
    }
  }

  breakBlockSurvival(hit, tool) {
    const block = getBlock(hit.id);
    if (block.hardness < 0) return;
    // planta alta: o tipo mora na metade de baixo, então quebrar a de cima larga o mesmo que a de baixo
    const dropMeta = hit.id === 175 && (hit.meta & 8) ? stateMeta(this.world.getBlock(hit.x, hit.y - 1, hit.z)) & 7 : hit.meta;
    const drops = getDrops(hit.id, tool, dropMeta);
    for (const drop of drops) {
      const item = { id: drop.id, count: drop.count, meta: drop.meta || 0 };
      const rx = (Math.random() - 0.5) * 0.2;
      const rz = (Math.random() - 0.5) * 0.2;
      if (this.itemEntities) {
        const dropPos = { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 };
        const vel = { x: rx, y: 2.0, z: rz };
        this.itemEntities.spawnItem(item, dropPos, vel, 0);
        if (this.netManager) {
          const pkt = { t: 'item_drop', item, pos: dropPos, vel, pickupDelay: 0 };
          if (this.netManager.broadcast) this.netManager.broadcast(pkt);
          else this.netManager.conn?.send(pkt);
        }
      } else if (this.inventory) {
        addItem(this.inventory, item);
      }
    }
    const xpFn = ORE_XP[hit.id];
    if (xpFn) {
      const amt = xpFn();
      if (amt > 0) {
        if (this.itemEntities?.spawnXpOrb) {
          this.itemEntities.spawnXpOrb(amt, { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
        } else {
          addXP(this.player, amt);
        }
      }
    }
    if (tool) {
      const dmg = getToolDamage(hit.id, tool);
      damageTool(tool, dmg);
      if (isToolBroken(tool)) {
        this.player.hotbar[this.player.selectedSlot] = { id: 0, meta: 0 };
      }
    }
    if (this.player.stats) {
      this.player.stats.blocksMined++;
      addStatByType(this.player.stats, 'blocksMinedByType', block.namePt);
      if (block.name === 'log' || block.name === 'wood') this.player.stats.woodMined++;
      if (hit.id === 15) this.player.stats.ironCollected++;
      if (hit.id === 56) this.player.stats.diamondsCollected++;
      checkStatAchievements(this.player.achievements, this.player.stats);
    }
    this.particles?.spawnBlockBreak(hit.x, hit.y, hit.z, hit.id, hit.meta || 0);
    playBlockBreakSound(hit.id, { x: hit.x, y: hit.y, z: hit.z });
    const _brokenState = this.world.getBlock(hit.x, hit.y, hit.z);
    this.world.setBlock(hit.x, hit.y, hit.z, 0);
    this._cachedRaycastFrame = -1;
    this.breakBedPartner(hit.x, hit.y, hit.z, _brokenState);
    this.onBlockChange?.(hit.x, hit.y, hit.z, 0);
    this.netManager?.sendBlockChange?.(hit.x, hit.y, hit.z, 0);

    handleBlockBreakPhysics(this.world, hit.x, hit.y, hit.z, (dropItem, pos) => {
      if (this.itemEntities) {
        const vel = { x: (Math.random() - 0.5) * 0.2, y: 1.5, z: (Math.random() - 0.5) * 0.2 };
        this.itemEntities.spawnItem(dropItem, pos, vel, 10);
        if (this.netManager) {
          const pkt = { t: 'item_drop', item: dropItem, pos, vel, pickupDelay: 10 };
          if (this.netManager.broadcast) this.netManager.broadcast(pkt);
          else this.netManager.conn?.send(pkt);
        }
      } else if (this.inventory) {
        addItem(this.inventory, dropItem);
      }
      playPopSound(pos);
      this.particles?.spawnBlockBreak(pos.x, pos.y, pos.z, dropItem.id, dropItem.meta || 0);
      this.onBlockChange?.(pos.x, pos.y, pos.z, 0);
      this.netManager?.sendBlockChange?.(pos.x, pos.y, pos.z, 0);
    });

  }

  dropHeldItem() {
    const p = this.player;
    if (p.isDead) return;
    const slot = p.hotbar[p.selectedSlot];
    if (!slot || !slot.id) return;

    const itemToDrop = { id: slot.id, count: 1, meta: slot.meta || 0 };
    slot.count = (slot.count || 1) - 1;
    if (slot.count <= 0) {
      p.hotbar[p.selectedSlot] = { id: 0, meta: 0 };
    }
    this._throwItem(itemToDrop);
  }

  // Joga uma pilha para a frente do jogador (Q solta 1; clicar fora do inventário com a pilha no cursor solta tudo, como no 1.8.9)
  _throwItem(itemToDrop) {
    const p = this.player;
    const eye = this.eyePos();
    const dir = this.lookDir();
    const spawnPos = {
      x: eye.x + dir.x * 0.4,
      y: eye.y + dir.y * 0.4 - 0.1,
      z: eye.z + dir.z * 0.4,
    };
    const vel = {
      x: dir.x * 4.5 + p.vel.x,
      y: dir.y * 4.5 + 1.5,
      z: dir.z * 4.5 + p.vel.z,
    };

    this.itemEntities?.spawnItem(itemToDrop, spawnPos, vel, 20);
    playPopSound(spawnPos);
    if (this.netManager) {
      const pkt = { t: 'item_drop', item: itemToDrop, pos: spawnPos, vel, pickupDelay: 20 };
      if (this.netManager.broadcast) this.netManager.broadcast(pkt);
      else this.netManager.conn?.send(pkt);
    }
    this.emitHud();
  }

  getHeldItem() {
    const slot = this.player.hotbar[this.player.selectedSlot];
    return (slot && slot.id) ? slot : null;
  }

  // === Comer (PRD 05 RF-034) ===
  tryStartEating(p) {
    const slot = this.getHeldItem();
    if (!slot || !isFood(slot.id)) return false;
    if (!canEat(p, slot.id)) return false;
    if (!p.eating) { p.eating = true; p.eatingTicks = 0; }
    return true;
  }

  tickEating(p) {
    if (!p.eating) return;
    p.eatingTicks++;
    if (p.eatingTicks >= 7 && p.eatingTicks % 4 === 0 && p.eatingTicks < 32) playEatSound(p.pos);
    if (p.eatingTicks >= 32) {
      playBurpSound(p.pos);
      const slot = p.hotbar[p.selectedSlot];
      if (slot && slot.id && isFood(slot.id)) {
        eatFood(p, slot.id);
        slot.count = (slot.count || 1) - 1;
        if (slot.count <= 0) p.hotbar[p.selectedSlot] = { id: 0, meta: 0 };
      }
      p.eating = false;
      p.eatingTicks = 0;
    }
  }

  stopEating() {
    if (this.player.eating) { this.player.eating = false; this.player.eatingTicks = 0; }
  }

  // === Cama e Sono (Minecraft 1.8.9) ===
  trySleep(bx, by, bz) {
    const p = this.player;
    if (p.isDead) return;
    if (this.dimension === 'nether') {   // 1.8.9 (BlockBed): no Nether a cama explode, com fogo, e some inteira
      const st = this.world.getBlock(bx, by, bz);
      const pt = bedPartner(bx, bz, stateMeta(st));
      this._setBlockSync(bx, by, bz, 0);
      if (stateId(this.world.getBlock(pt.x, by, pt.z)) === 26) this._setBlockSync(pt.x, by, pt.z, 0);
      this.detonate({ x: bx + 0.5, y: by + 0.5, z: bz + 0.5 }, 5);
      return;
    }
    const can = canSleep(p, this.worldTime, this.weather?.isThundering?.(), this.mobs?.mobs);
    if (!can.ok) {
      if (this.onChatMessage) {
        this.onChatMessage({ type: 'system', text: `§c${can.reason}`, timestamp: Date.now() });
      }
      return;
    }
    p.sleeping = true;
    p.bedPos = { x: bx, y: by, z: bz };
    // Dormir define o ponto de renascimento na cama (1.8.9); se a cama sumir, o renascer volta ao spawn do mundo
    p.spawnX = bx; p.spawnY = by; p.spawnZ = bz; p.hasBedSpawn = true;
    p.sleepTimer = 0;
    p.spawnPos = { x: bx, y: by + 1, z: bz };
    p.pos.x = bx + 0.5;
    p.pos.y = by + 0.6875;
    p.pos.z = bz + 0.5;
    p.vel.x = 0;
    p.vel.y = 0;
    p.vel.z = 0;

    if (this.netManager) {
      const pkt = { t: 'sleep', sleeping: true, bedPos: { x: bx, y: by, z: bz } };
      if (this.netManager.broadcast) this.netManager.broadcast(pkt);
      else if (this.netManager.conn) this.netManager.conn.send(pkt);
    }
    this.emitHud();
  }

  wakeUp() {
    const p = this.player;
    if (!p.sleeping) return;
    p.sleeping = false;
    p.sleepTimer = 0;
    if (!p.stats.survivedNight) p.stats.survivedNight = true;
    if (p.bedPos) {
      const out = this._bedExit(p.bedPos.x, p.bedPos.y, p.bedPos.z);
      p.pos.x = out.x; p.pos.y = out.y; p.pos.z = out.z;
    }
    if (this.netManager) {
      const pkt = { t: 'sleep', sleeping: false, bedPos: p.bedPos };
      if (this.netManager.broadcast) this.netManager.broadcast(pkt);
      else if (this.netManager.conn) this.netManager.conn.send(pkt);
    }
    this.emitHud();
  }

  checkAllSleeping() {
    const p = this.player;
    const isHost = this.netManager ? !!this.netManager.broadcast : true;
    if (!isHost) return;

    const totalPlayers = 1 + (this.netManager?.remotePlayers ? this.netManager.remotePlayers.size : (this.remotePlayers ? Object.keys(this.remotePlayers).length : 0));
    let sleepingCount = p.sleeping ? 1 : 0;
    if (this.netManager?.remotePlayers) {
      for (const rp of this.netManager.remotePlayers.values()) {
        if (rp.sleeping) sleepingCount++;
      }
    } else if (this.remotePlayers) {
      for (const rp of Object.values(this.remotePlayers)) {
        if (rp.sleeping) sleepingCount++;
      }
    }

    if (sleepingCount >= totalPlayers && totalPlayers > 0) {
      this.worldTime = (Math.floor(this.worldTime / 24000) + 1) * 24000;
      if (this.netManager?.broadcast) {
        this.netManager.broadcast({ t: 'time', worldTime: this.worldTime });
        this.netManager.broadcast({ t: 'wake_all' });
      }
      this.wakeUp();
    }
  }

  // === Combate (PRD 07) ===
  _getDeathMessage() {
    const p = this.player;
    const source = p.lastDamageSource;
    // O agressor só conta se bateu há pouco: queda/lava depois de uma briga ("foi derrubado por X"), mas não de um golpe antigo
    const recent = p._lastAttacker && p._attackedAt && Date.now() - p._attackedAt < 8000;
    const killer = recent ? p._lastAttacker : null;
    const weapon = recent && (source === 'attack' || source === 'projectile') ? p._lastWeapon : null;
    return getDeathMessage(source, killer, weapon);
  }

  // Sobrevivência sem keepInventory: tudo cai no chão onde o jogador morreu (1.8.9: Entity.dropItem com espalhamento aleatório)
  dropInventoryOnDeath() {
    const p = this.player, inv = this.inventory;
    if (!inv || p.gameMode === 'creative' || p.gameMode === 'spectator' || this.gameRules?.keepInventory) return;
    const spill = (it) => {
      if (!it || !it.id || !(it.count > 0)) return;
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
      const itemData = { id: it.id, count: it.count, meta: it.meta || 0 };
      const pos = { x: p.pos.x, y: p.pos.y + 0.5, z: p.pos.z };
      const vel = { x: Math.cos(a) * sp, y: 3 + Math.random() * 2, z: Math.sin(a) * sp };
      this.itemEntities?.spawnItem(itemData, pos, vel, 40);
      if (this.netManager) {
        const pkt = { t: 'item_drop', item: itemData, pos, vel, pickupDelay: 40 };
        if (this.netManager.broadcast) this.netManager.broadcast(pkt);
        else this.netManager.conn?.send(pkt);
      }
    };

    for (const arr of [inv.hotbar, inv.main, inv.armor, inv.crafting]) {
      for (let i = 0; i < arr.length; i++) { spill(arr[i]); arr[i] = null; }
    }
    spill(inv.cursor); inv.cursor = null;
    inv.craftResult = null;
    const droppedXp = getDroppedXP(p);
    if (droppedXp > 0 && this.itemEntities?.spawnXpOrb) {
      this.itemEntities.spawnXpOrb(droppedXp, { x: p.pos.x, y: p.pos.y + 0.5, z: p.pos.z });
    }
    p.xp = 0;
    p.xpLevel = 0;
  }

  // Anuncia a morte uma vez: chat local, outros jogadores e estatística
  _announceDeath() {
    const p = this.player;
    p.deathPending = false;
    const text = `${p.nomeJogador || 'Jogador'} ${this._getDeathMessage()}`;
    p.deathText = text;
    this.onChatMessage?.({ type: 'system', text: '§f' + text, timestamp: Date.now() });
    if (this.netManager) {
      if (this.netManager.broadcast) this.netManager.broadcast({ t: 'chat', system: true, text: '§f' + text });
      else this.netManager.conn?.send({ t: 'death', cause: this._getDeathMessage() });
    }
    if (p.stats) p.stats.deaths = (p.stats.deaths || 0) + 1;
    // Registro da morte com o que foi perdido (antes de esvaziar o inventário), e gravação imediata para a perda valer online
    const lost = [];
    if (this.inventory && p.gameMode !== 'creative' && p.gameMode !== 'spectator' && !this.gameRules?.keepInventory) {
      for (const arr of [this.inventory.hotbar, this.inventory.main, this.inventory.armor]) {
        for (const it of arr) if (it && it.id) lost.push({ id: it.id, count: it.count || 1, meta: it.meta || 0 });
      }
    }
    this.onDeath?.({ message: text, cause: p.lastDamageSource, killer: p._lastAttacker || null, pos: { ...p.pos }, itemsLost: lost, xpLevel: p.xpLevel || 0 });
    this.dropInventoryOnDeath();
    this.onAutosave?.();
  }

  // === Conquistas (PRD 12 RF-030) ===
  unlockAchievement(id) {
    if (this.player.achievements && tryUnlock(this.player.achievements, id)) {
      this.emitHud();
    }
  }

  trackStat(key, amount = 1) {
    if (this.player.stats) {
      addStat(this.player.stats, key, amount);
      checkStatAchievements(this.player.achievements, this.player.stats);
    }
  }

  trackMobKill(mobType) {
    if (this.player.stats) {
      this.player.stats.mobsKilled++;
      addStatByType(this.player.stats, 'mobsKilledByType', mobType);
      if (mobType === 'elite_gunner' || mobType === 'elite') this.player.stats.eliteKilled++;
      checkStatAchievements(this.player.achievements, this.player.stats);
    }
  }

  raycastEntity() {
    if (this.entities.length === 0) return null;
    const eye = this.eyePos();
    const dir = this.lookDir();
    const reach = this.player.gameMode === 'creative' ? ATTACK_REACH.creative : ATTACK_REACH.survival;
    let closest = null;
    let closestT = reach;
    for (const e of this.entities) {
      if (e.isDead) continue;
      const box = this._entityBox(e);
      const t = _rayAABB(eye, dir, box);
      if (t !== null && t >= 0 && t < closestT) {
        closestT = t;
        closest = { entity: e, dist: t };
      }
    }
    // Bloco sólido mais próximo bloqueia a entidade (RF-003)
    if (closest) {
      const blockHit = this.raycast();
      if (blockHit) {
        const bDist = Math.hypot(blockHit.x + 0.5 - eye.x, blockHit.y + 0.5 - eye.y, blockHit.z + 0.5 - eye.z);
        if (bDist < closest.dist) return null;
      }
    }
    return closest;
  }

  _entityBox(e) {
    const w = 0.6, h = 1.8;
    const p = e.pos;
    return {
      minX: p.x - w / 2 - 0.1, maxX: p.x + w / 2 + 0.1,
      minY: p.y - 0.1, maxY: p.y + h + 0.1,
      minZ: p.z - w / 2 - 0.1, maxZ: p.z + w / 2 + 0.1,
    };
  }

  _getAttackableEntities() {
    return this.entities.filter(e => !e.isDead);
  }

  // Primeira pilha de flechas (id 262) na hotbar ou no inventário; { arr, i } ou null
  _findArrow() {
    const inv = this.inventory;
    if (!inv) return null;
    for (const arr of [inv.hotbar, inv.main]) for (let i = 0; i < arr.length; i++) if (arr[i] && arr[i].id === 262 && arr[i].count > 0) return { arr, i };
    return null;
  }

  shootArrow(p, charge) {
    if (!this.projectiles) return;
    // 1.8.9: sem flechas não atira; gasta 1 a cada disparo (no criativo é livre)
    if (p.gameMode !== 'creative') {
      const a = this._findArrow();
      if (!a) return;
      a.arr[a.i].count--;
      if (a.arr[a.i].count <= 0) a.arr[a.i] = null;
    }
    playBowSound(p.pos);
    const proj = this.projectiles.spawnArrow(p, charge, {
      onHitEntity: (pr, entity) => {
        if (entity) entity._lastAttacker = p.nomeJogador || p.name;
      },
    });
    if (proj) proj.pickupMode = p.gameMode === 'creative' ? 2 : 1;
    this._wearHeld(p.hotbar[p.selectedSlot]); // desgaste do arco (antes lia um campo que não existe e nunca gastava)
  }

  throwProjectile(p, itemId) {
    if (!this.projectiles) return;
    if (p.gameMode !== 'creative') {
      const slot = p.hotbar[p.selectedSlot];
      if (slot) {
        slot.count = (slot.count || 1) - 1;
        if (slot.count <= 0) p.hotbar[p.selectedSlot] = { id: 0, meta: 0 };
      }
    }
    if (itemId === 368) {
      const proj = this.projectiles.spawnThrowable(p, itemId);
      if (proj) {
        proj.shooterTeleport = (pos) => {
          p.pos.x = pos.x; p.pos.y = pos.y; p.pos.z = pos.z;
          applyDamage(p, 5, 'fall');
        };
      }
    } else {
      this.projectiles.spawnThrowable(p, itemId);
    }
  }

  // === Mão em 1ª pessoa (PRD 07 RF-050..052) ===
  _buildFirstPersonHand() {
    this.fpsScene = new THREE.Scene();
    this.fpsCamera = new THREE.PerspectiveCamera(70, this.canvas.clientWidth / this.canvas.clientHeight, 0.05, 10);
    this.fpsCamera.position.set(0, 0, 0);
    this.renderer.autoClear = false;

    // Iluminação padrão de item do 1.8.9 (RenderHelper.enableStandardItemLighting): ambiente 0,4 e duas luzes 0,6 vindas de (0,2; 1; -0,7) e
    // (-0,2; 1; 0,7). No three r171 as luzes são físicas (divididas por π), por isso as intensidades levam ×π. As direções giram com a visão
    // (o GL as fixa depois de rotacionar pitch e yaw) e o conjunto escurece com a luz do local (lightmap), como o braço no escuro de uma caverna.
    this._handAmb = new THREE.AmbientLight(0xffffff, 0.4 * Math.PI);
    this._handL0 = new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI);
    this._handL1 = new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI);
    this.fpsScene.add(this._handAmb, this._handL0, this._handL1);

    this.handRig = buildHandRig();
    this.fpsArm = this.handRig.arm;
    this.fpsItemGroup = this.handRig.itemGroup;
    this.fpsScene.add(this.fpsArm, this.handRig.itemRoot);
    this.fpsItem = null;
  }

  _updateHandLighting() {
    if (!this._handL0) return;
    const p = this.player, pitch = p.pitch, yaw = p.yaw;
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    const rot = (vx, vy, vz, out) => {
      const x1 = cy * vx + sy * vz, y1 = vy, z1 = -sy * vx + cy * vz;
      out.set(x1, cp * y1 - sp * z1, sp * y1 + cp * z1);
    };
    const n0 = 1 / Math.hypot(0.2, 1.0, 0.7);
    rot(0.2 * n0, 1.0 * n0, -0.7 * n0, this._handL0.position);
    rot(-0.2 * n0, 1.0 * n0, 0.7 * n0, this._handL1.position);

    const eye = this.eyePos();
    const ex = Math.floor(eye.x), ey = Math.floor(eye.y), ez = Math.floor(eye.z);
    // Só recalcula a coluna de luz quando o jogador muda de bloco ou o brilho do sol muda
    const sunB = this.world.uniforms?.uSunBright?.value ?? 1;
    if (this._hlEx !== ex || this._hlEy !== ey || this._hlEz !== ez || Math.abs((this._hlSun ?? -1) - sunB) > 0.02) {
      this._hlEx = ex; this._hlEy = ey; this._hlEz = ez; this._hlSun = sunB;
      let open = true;
      for (let y = ey + 1; y < Math.min(255, ey + 64); y++) {
        if (isSolid(stateId(this.world.getBlock(ex, y, ez)))) { open = false; break; }
      }
      const L = this.world.getLight(ex, ey, ez);
      const lvl = (l) => { const f = 1 - l; return (1 - f) / (f * 3 + 1); };
      const skyL = open ? 15 : (Number.isFinite(L?.sky) ? L.sky : 15);
      const blkL = Number.isFinite(L?.block) ? L.block : 0;
      const sky = lvl(skyL / 15) * sunB * 0.95 + 0.05, blk = lvl(blkL / 15) * 1.5;
      this._handTargetF = Math.max(0.05, Math.min(1, (sky + blk) * 0.96 + 0.03));
    }
    const targetF = this._handTargetF ?? 1;
    this._handLightF = (this._handLightF ?? targetF) + (targetF - (this._handLightF ?? targetF)) * 0.2;
    this._handAmb.intensity = 0.4 * Math.PI * this._handLightF;
    this._handL0.intensity = this._handL1.intensity = 0.6 * Math.PI * this._handLightF;
  }

  updateFirstPersonHand() {
    if (!this.fpsScene) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (Math.abs(this.fpsCamera.aspect - w / h) > 0.01) {
      this.fpsCamera.aspect = w / h;
      this.fpsCamera.updateProjectionMatrix();
    }

    const p = this.player;
    const heldItem = this.getHeldItem();

    // Atualizar mesh do item — texturizado (atlas/ícone), mesmo builder do item dropado.
    // Normalizado para 1×1(×1): o cubo do item caído mede 0,25 e o plano 0,3; a escala real vem da cadeia do ItemRenderer (firstPersonHand.itemMatrix)
    let handStyle = 'sprite';
    const glintOn = hasGlint(heldItem);
    if (heldItem && heldItem.id) {
      const blk = heldItem.id < 256 ? BLOCKS[heldItem.id] : null;
      const cutout = blk && (blk.model === 'cross' || blk.model === 'torch' || blk.model === 'crop' || !blk.solid);
      handStyle = blk && !cutout ? 'block' : 'sprite';
      // arco: o desenho muda com a carga (bow_standby → bow_pulling_0/1/2 aos 0 / 0,65 / 0,9 de carga), já com a flecha encaixada
      const pull = this.bowChargeTicks / 20;
      const viewMeta = isBow(heldItem) && p.bowDrawing ? (pull >= 0.9 ? 3 : pull >= 0.65 ? 2 : 1) : (heldItem.meta || 0);
      const spriteNow = isItemSpriteReady({ id: heldItem.id, meta: viewMeta });
      if (!this.fpsItem || this.fpsItem._itemId !== heldItem.id || this.fpsItem._meta !== viewMeta || this.fpsItem._glint !== glintOn || this.fpsItem._spriteReady !== spriteNow) {
        // Materiais são cacheados/partilhados — só remove do grupo, sem dispose
        if (this.fpsItem) this.fpsItemGroup.remove(this.fpsItem);
        if (this.fpsGlint) { this.fpsItemGroup.remove(this.fpsGlint.group); this.fpsGlint = null; }
        this.fpsItem = createItemMesh({ id: heldItem.id, meta: viewMeta }, 1, this.world?.atlas);
        this.fpsItem._itemId = heldItem.id;
        this.fpsItem._meta = viewMeta;
        this.fpsItem._glint = glintOn;
        this.fpsItem._spriteReady = spriteNow;
        this.fpsItem.scale.setScalar(handStyle === 'block' ? 4 : 1 / (blk ? 0.32 : 0.3));
        if (handStyle === 'sprite') this.fpsItem.scale.x *= -1; // a frente do item plano sai espelhada em x (ver itemMatrix)
        this.fpsItemGroup.add(this.fpsItem);
        if (glintOn) {
          this.fpsGlint = buildGlintOverlay(this.fpsItem);
          this.fpsGlint.group.scale.copy(this.fpsItem.scale);
          this.fpsItemGroup.add(this.fpsGlint.group);
        }
      }
      if (this.fpsGlint) this.fpsGlint.update(performance.now());
    } else {
      if (this.fpsItem) { this.fpsItemGroup.remove(this.fpsItem); this.fpsItem = null; }
      if (this.fpsGlint) { this.fpsItemGroup.remove(this.fpsGlint.group); this.fpsGlint = null; }
    }

    this._updateHandLighting();
    this.fpsCamera.rotation.z = this._hurtRollValue || 0; // a mão também balança com o dano
    // Pose da mão (RF-051): braço com micro-interpolação sub-tick fluida
    const partialTick = Math.min(1, Math.max(0, this.tickAcc / TICK_MS));
    poseHand(this.handRig, this.anim, p, heldItem ? getItem(heldItem.id) : null, !!(heldItem && heldItem.id), this.worldTime / 20, partialTick, handStyle);

    // Renderizar a mão por cima do mundo (RF-050)
    if ((this.perspective === 0) && !this.paused) {
      this.renderer.clearDepth();
      this.renderer.render(this.fpsScene, this.fpsCamera);
    }
  }

  // Posição livre ao lado da cama (chão sólido e 2 blocos de ar); sem lado livre, em cima da cama
  _bedExit(bx, by, bz) {
    const free = (x, y, z) => {
      const a = getBlock(stateId(this.world.getBlock(x, y, z))), b = getBlock(stateId(this.world.getBlock(x, y + 1, z)));
      const floor = getBlock(stateId(this.world.getBlock(x, y - 1, z)));
      return (!a || !a.solid) && (!b || !b.solid) && floor && floor.solid;
    };
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      if (free(bx + dx, by, bz + dz)) return { x: bx + dx + 0.5, y: by, z: bz + dz + 0.5 };
    }
    return { x: bx + 0.5, y: by + 0.6, z: bz + 0.5 };
  }

  // === Morte e renascimento (PRD 05 RF-050..051) ===
  respawn() {
    const p = this.player;
    this._deathRoll = 0;
    let spawn = { x: this.spawn.x, y: this.spawn.y, z: this.spawn.z };
    if (p.hasBedSpawn) {
      if (stateId(this.world.getBlock(p.spawnX, p.spawnY, p.spawnZ)) === 26) {
        spawn = this._bedExit(p.spawnX, p.spawnY, p.spawnZ);
      } else {
        p.hasBedSpawn = false; // cama destruída: volta ao spawn do mundo (tile.bed.notValid)
        this.onChatMessage?.({ type: 'system', text: '§cSua cama estava ausente ou obstruída', timestamp: Date.now() });
      }
    }
    if (this.dimension !== 'overworld') {
      this._attachWorld(this.worlds.overworld); this.dimension = 'overworld'; this.sky?.setVisible(true); this._portalTicks = 0;
    }
    respawnPlayer(p, spawn);
    unstickPlayer(this.world, p.pos);
    this._requestPointerLock();
    this.emitHud();
  }

  async saveAndExit() {
    document.exitPointerLock?.();
    await this.onAutosave();
  }

  // === PRD 11: TNT e Explosões ===
  spawnTNT(x, y, z) {
    if (!this._tntRender) this._tntRender = new TntRenderer(this.scene);
    playFuseSound({ x, y, z });
    this.tntEntities.push({ pos: { x, y, z }, vel: { x: (Math.random()-0.5)*0.1, y: 0.2, z: (Math.random()-0.5)*0.1 }, fuse: 80 });
  }

  tickTntEntities() {
    let detonated = 0;   // no máximo 6 explosões por tick: numa cadeia de centenas o resto espera 1 tick (ninguém vê), em vez de um quadro de 100 ms
    for (let i = this.tntEntities.length - 1; i >= 0; i--) {
      const tnt = this.tntEntities[i];
      tnt.fuse--;
      // Física simples
      tnt.vel.y -= 0.04;
      const nx = tnt.pos.x + tnt.vel.x;
      const ny = tnt.pos.y + tnt.vel.y;
      const nz = tnt.pos.z + tnt.vel.z;
      // Colisão com chão
      const groundId = stateId(this.world.getBlock(Math.floor(nx), Math.floor(ny - 0.5), Math.floor(nz)));
      if (groundId !== 0 && isSolid(groundId)) {
        tnt.pos.y = Math.floor(ny) + 0.5;
        tnt.vel.y = 0;
        tnt.pos.x = nx; tnt.pos.z = nz;
      } else {
        tnt.pos.x = nx; tnt.pos.y = ny; tnt.pos.z = nz;
      }
      // Explodir
      if (tnt.fuse <= 0) {
        if (detonated >= 6) { tnt.fuse = 0; continue; }
        detonated++;
        this.detonate(tnt.pos, 4);
        this.tntEntities.splice(i, 1);
      }
    }
    this._tntRender?.update(this.tntEntities);
    // TNT pendente (cadeia)
    for (let i = this.pendingTnt.length - 1; i >= 0; i--) {
      this.pendingTnt[i].ticksLeft--;
      if (this.pendingTnt[i].ticksLeft <= 0) {
        this.spawnTNT(this.pendingTnt[i].x, this.pendingTnt[i].y, this.pendingTnt[i].z);
        this.pendingTnt.splice(i, 1);
      }
    }
  }

  detonate(pos, power) {
    if (canPlayExplosionSound()) {
      playExplodeSound(pos);
    }
    const result = explode(this.world, pos, power, {
      fire: false,
      breakBlocks: this.gameRules.explosionsBreakBlocks !== false,
      dropItems: this.gameRules.doTileDrops !== false,
    });

    // Explosão levou pedaço da moldura ou do portal: o portal restante desfaz inteiro
    if (result.destroyed && result.destroyed.length) { for (const d of result.destroyed) this._portalIntegrity(d.x, d.y, d.z); }

    // Partículas de explosão controladas (estilo 1.8.9)
    if (this.particles) {
      this.particles.spawnNamed?.('hugeexplosion', pos.x, pos.y, pos.z, 1);
      this.particles.spawnNamed?.('smoke', pos.x, pos.y, pos.z, 8);
    }

    // Desova drops agrupados (máximo 64 por entidade — zero lag de centenas de 3D meshes)
    if (this.itemEntities && result.droppedItems && result.droppedItems.length > 0) {
      for (const d of result.droppedItems) {
        const vel = {
          x: (Math.random() - 0.5) * 1.5,
          y: 1.5 + Math.random() * 1.5,
          z: (Math.random() - 0.5) * 1.5,
        };
        this.itemEntities.spawnItem(
          { id: d.id, count: d.count || 1, meta: d.meta || 0 },
          { x: d.x, y: d.y, z: d.z },
          vel,
          10
        );
      }
    }

    // Dano ao jogador
    const p = this.player;
    const pDmg = getExplosionDamage(p.pos, pos, power);
    if (pDmg.damage > 0) {
      applyDamage(p, pDmg.damage, 'explosion');
      p.vel.x += pDmg.knockback.x;
      p.vel.y += pDmg.knockback.y;
      p.vel.z += pDmg.knockback.z;
    }
    // Dano a mobs
    if (this.entities) {
      for (const e of this.entities) {
        if (e.isDead) continue;
        const eDmg = getExplosionDamage(e.pos, pos, power);
        if (eDmg.damage > 0 && e.health !== undefined) {
          e.health -= eDmg.damage;
          if (e.pos) {
            e.pos.x += eDmg.knockback.x;
            e.pos.y += eDmg.knockback.y;
            e.pos.z += eDmg.knockback.z;
          }
          if (e.health <= 0) e.isDead = true;
        }
      }
    }
    // Cadeia de TNT
    for (const chain of result.chainTNT) {
      this.pendingTnt.push({ x: chain.x, y: chain.y, z: chain.z, ticksLeft: chain.delay });
    }
    this.emitHud();
  }

  // === PRD 11: Agricultura (random tick) ===
  randomTickAgriculture() {
    const p = this.player.pos;
    const r = Math.min(this.renderDistance, 6) * 16;
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(p.x + (Math.random() - 0.5) * r * 2);
      const z = Math.floor(p.z + (Math.random() - 0.5) * r * 2);
      const y = Math.floor(p.y + (Math.random() - 0.5) * 16);
      if (y < 0 || y >= 256) continue;
      tickAgriculture(this.world, x, y, z, this.worldTime);
    }
  }

  async saveAndExit() {
    if (this.onAutosave) {
      try {
        await this.onAutosave();
      } catch (e) {
        console.warn('[Engine] Erro ao salvar em saveAndExit:', e);
      }
    }
  }

  stop() {
    this.disposed = true;
    if (_activeEngine === this) _activeEngine = null;
    musicManager.stop();
    voiceChat.stop();
    cancelAnimationFrame(this.raf);

    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this._resizeObs?.disconnect();
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('contextmenu', this._onContext);
    this.canvas.removeEventListener('click', this._onClick);
    document.removeEventListener('pointerlockchange', this._onPLChange);
    window.removeEventListener('beforeunload', this._onBeforeUnload);
    if (this._unsubCape) { this._unsubCape.forEach((fn) => fn()); this._unsubCape = null; }
    document.exitPointerLock?.();
    MobEntity.onSound = null;
    if (this.projectiles) this.projectiles.dispose();
    if (this.particles) this.particles.dispose();
    if (this.mobs) this.mobs.dispose();
    if (this.gunController) this.gunController = null;
    if (this._bulletDecals) this._bulletDecals = [];
    this._tntRender?.dispose(); this._tntRender = null;
    this.tntEntities = [];
    this.pendingTnt = [];
    this.crosshair?.dispose();
    this.motionBlur?.dispose();
    this._unsubClientStore?.();
    this._unsubSettingsStore?.();
    if (this.sky) this.sky.dispose();
    if (this.weather) this.weather.dispose();
    for (const w of Object.values(this.worlds)) if (w && w !== this.world) w.dispose(this.scene);
    if (this.world) this.world.dispose(this.scene);
    // Sem forceContextLoss: o canvas do jogo é reaproveitado se a tela montar de novo (StrictMode/voltar ao jogo) e um canvas de contexto perdido
    // faz o próximo WebGLRenderer falhar com "Cannot read properties of null (reading 'precision')". O contexto some com o canvas.
    if (this.renderer) this.renderer.dispose();
  }
}