// Motor do jogo (imperativo, three.js). PRD 01 §3.3 + PRD 02 (céu, luz, fluidos, comandos)
import * as THREE from 'three';
import { TICK_MS, TPS, PLAYER, AUTOSAVE_TICKS } from './constants';
import { moveEntity, unstickPlayer, pushOutOfBlocks, collidesAt, chunkLoadedAt, getBlockSlipperiness } from './physics';
import { packState, stateId, stateMeta, chunkCoord } from './chunk';
import { getBlock, isWater, isLava, isFluid, isReplaceable, isSolid, BLOCK_NAMES, getSelectionBox } from './blocks';
import { blockBoxes, rayBox, hasShape, isSlabBlock, isStairsBlock, computePlacement } from './shapes';
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
import { getArmorPoints, getItem } from './items';
import { ProjectileManager } from './projectiles';
import { createAnimationState, tickAnimation, startSwing, applyThirdPersonPose } from './animation';
import { buildHandRig, poseHand } from './firstPersonHand';
import { attackEntity, isSword, isBow, isThrowable, computeBowCharge, createCpsTracker, recordClick, getCps, ATTACK_REACH } from './combat';
import { MobManager } from './mobManager';
import { MobEntity } from './mobEntity';
import { GunController } from './guns/shooting';
import { NoiseSystem } from './guns/noiseSystem';
import { getGunDef, getGunState, createGunState, GUNS, isGunItem, isAccessoryItem } from './guns/registry';
import { DEFAULT_GAME_RULES } from './constants';
import { isGun, isAccessory } from './items';
import { RedstoneSystem } from './redstone';
import { explode, getExplosionDamage } from './explosions';
import { tickAgriculture, applyBonemeal, trampleFarmland, harvestCrop } from './agriculture';
import { createStats, serializeStats, deserializeStats, addStat, addStatByType } from './stats';
import { createAchievementState, serializeAchievements, deserializeAchievements, tryUnlock, checkStatAchievements } from './achievements';
import { loadRealTextures, isRealTexturesLoaded, tickTextureAnimations } from './textures';
import { lookDirFromAngles } from './viewMath';
import { buildPlayerModel, loadPlayerGlb, loadFirstPersonArmGlb, applyPackSkin, placePlayerModel, setModelHeldItem, setModelCape } from './playerModel';
import { onSkinChange, onCapeChange, getCapeChoice } from './skinStore';
import { fetchCraftheadCape } from './crafthead';
import { loadPack, ensurePack, isPackReady, getPackUrl, MC } from './pack';
import { initBiomeTint } from './biomeTint';
import { playStepSound, playDigSound, playBlockBreakSound, playBlockPlaceSound, playHurtSound, playPlayerHurtSound, playHitSound, playMobSound, playSplashSound, playEvent, playEatSound, playBurpSound, playBowSound, startRainSound, stopRainSound, playExplodeSound, playFuseSound, playLevelUpSound, updateAudioListener, playPopSound } from './sounds';
import { createNametag } from './nametag';
import { ParticleManager } from './particles';
import { ItemEntityManager, createItemMesh } from './itemEntity';
import { perfMonitor } from './perfMonitor';
import { musicManager } from './musicManager';
import { voiceChat } from './net/voiceChat';

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
    this.player = opts.player;
    this.spawn = opts.spawn;
    this.onHud = opts.onHud || (() => {});
    this.onProgress = opts.onProgress || null;
    this.onAutosave = opts.onAutosave || (async () => {});
    this.renderDistance = opts.renderDistance || 6;
    this.keys = {};
    this.mouseBtn = {};
    this.lastSpaceTap = 0; this.spaceTapCount = 0;
    this.lastWTap = 0; this.wTapCount = 0;
    this.breakCd = 0; this.placeCd = 0;
    this.tickAcc = 0; this.lastTime = 0;
    this.worldTime = opts.worldTime || 0;
    this.gameRules = opts.gameRules || {};
    this.difficulty = opts.difficulty || 'normal';
    this.onToggleInventory = opts.onToggleInventory || (() => {});
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
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // sem conversão: ver ColorManagement acima
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0xc0d8ff, 1); // cor do horizonte — evita tela preta antes dos chunks carregarem

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(PLAYER.fov, w / h, 0.05, 1000);

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
    if (this._savedInventory) {
      deserializeInventory(this.inventory, this._savedInventory);
    }

    // Projéteis e combate (PRD 07)
    this.projectiles = new ProjectileManager(this.scene, this.world);
    this._buildFirstPersonHand();

    // Mobs (PRD 08)
    this.mobs = new MobManager(this.scene, this.world);
    MobEntity.onSound = (mob, kind) => playMobSound(mob, kind);

    // Armas de fogo (PRD 09)
    this.gunController = new GunController(this);
    this.noiseSystem = new NoiseSystem();
    this._bulletDecals = [];

    // Partículas (blocos quebrados, respingos) — estilo 1.8.9
    this.particles = new ParticleManager(this.scene);
    this.itemEntities = new ItemEntityManager(this.scene, this.world);
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

    // Modelo baseado em skin 64×64 (skinview3d) — já completo, sem GLB

    // PRD 04: Carregar pacote de recursos de 106MB com barra de progresso em tempo real (Cache API garante 0ms nas próximas visitas)
    if (this.onProgress) this.onProgress(0, 'Carregando pacote de recursos 1.8.9...');
    await ensurePack((prog) => {
      if (this.onProgress && prog) {
        this.onProgress(prog.percent, prog.status);
      }
    });

    // PRD 21 RF-020: carregamento em fases — gerar só 5×5 chunks (radius 2) para a área inicial jogável.
    // O resto carrega progressivamente via growth do loadingRadius no loop (RF-021).
    const p = this.player.pos;
    this.loadingRadius = 2;
    this.targetRadius = settingsStore.get('device.renderDistance') || this.renderDistance;
    this.world._lastLoadingRadius = this.loadingRadius;
    // PRD 23: as malhas chegam dos workers de forma assíncrona — espera curta pela área inicial
    await this.world.warmUp(this.scene, p.x, p.z, this.loadingRadius, p.y, 4000, this.onProgress);
    if (this.disposed) return; // a tela foi fechada durante o carregamento
    perfMonitor.detectGpu(this.renderer.getContext());

    // Carregar texturas reais do Minecraft 1.8.9 (atualiza o atlas em segundo plano)
    // A textura é compartilhada por todos os materiais — needsUpdate basta, sem re-meshing
    loadRealTextures().then(() => {
      if (this.world?.atlas?.texture) this.world.atlas.texture.needsUpdate = true;
    });
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
        loadRealTextures();
      });
    }

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
    this.raf = requestAnimationFrame(this.loop);
  }

  _requestPointerLock() {
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) { /* pointer lock not available (iframe) */ }
  }

  bindInput() {
    this._onKeyDown = (e) => this.onKey(e, true);
    this._onKeyUp = (e) => this.onKey(e, false);
    this._onMouseDown = (e) => {
      this.mouseBtn[e.button] = true;
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
    this._onClick = () => { if (this.paused && !this.chatOpen) this._requestPointerLock(); };
    this._onPLChange = () => {
      this.paused = document.pointerLockElement !== this.canvas;
      if (!this.paused) this.mouseBtn = {};
      this.keys = {};
    };
    this._onBlur = () => { this.keys = {}; this.mouseBtn = {}; this.f3Held = false; };
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

  isAction(action) {
    const keys = settingsStore.get('user.keys') || {};
    const code = keys[action];
    if (!code) return false;
    if (code.startsWith('Mouse')) return !!this.mouseBtn[parseInt(code.slice(5))];
    return !!this.keys[code];
  }

  onKey(e, down) {
    // Soltar uma tecla é sempre registrado, em qualquer tela: senão ela "gruda" (ou falha) depois de chat/inventário/F3
    if (!down) this.keys[e.code] = false;
    if (this.chatOpen) {
      if (down && e.code === 'Escape') { this.chatOpen = false; this.emitHud(); }
      return;
    }
    const keys = settingsStore.get('user.keys') || {};
    const playerListKey = keys.playerList || 'Tab';
    if (e.code === playerListKey || e.code === 'Tab') {
      e.preventDefault();
      this.playerListOpen = down;
      this.emitHud();
      return;
    }
    if (down && !e.repeat && (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === keys.sprint)) {
      this.sprintToggled = !this.sprintToggled;
    }
    if (down && (e.code === 'KeyE' || e.code === keys.inventory)) {
      if (this.chatOpen) return;
      e.preventDefault();
      this.unlockAchievement('open_inventory');
      this.onToggleInventory?.();
      return;
    }
    if (down && !this.paused) {
      if (e.code === 'KeyT' || e.code === 'Slash' || e.code === keys.chat || e.code === keys.command) {
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
    if (down && e.code === keys.fullscreen) {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.();
      return;
    }
    if (down && (e.code === 'Escape')) return;
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
    if (this.paused || this.chatOpen || this.player?.isDead) return;
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
    const invert = settingsStore.get('user.invertMouse') ? -1 : 1;
    this.player.yaw += e.movementX * radPerPx;
    this.player.pitch += e.movementY * radPerPx * invert;
    const lim = Math.PI / 2 - 0.001;
    this.player.pitch = Math.max(-lim, Math.min(lim, this.player.pitch));
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
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
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
  reloadAssets() {
    if (this.world?.atlas?.texture) this.world.atlas.texture.needsUpdate = true;
    this.emitHud();
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
    if (!force && this._cachedRaycastFrame === this.frame && p) {
      const posKey = `${p.yaw.toFixed(3)}_${p.pitch.toFixed(3)}_${p.pos.x.toFixed(2)}_${p.pos.y.toFixed(2)}_${p.pos.z.toFixed(2)}`;
      if (this._cachedRaycastPosKey === posKey) {
        return this._cachedRaycast;
      }
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
      this._cachedRaycastPosKey = `${p.yaw.toFixed(3)}_${p.pitch.toFixed(3)}_${p.pos.x.toFixed(2)}_${p.pos.y.toFixed(2)}_${p.pos.z.toFixed(2)}`;
      this._cachedRaycast = result;
    }
    return result;
  }

  breakBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const block = getBlock(hit.id);
    if (block.hardness < 0) return;
    this.particles?.spawnBlockBreak(hit.x, hit.y, hit.z, hit.id);
    playBlockBreakSound(hit.id, { x: hit.x, y: hit.y, z: hit.z });
    this.world.setBlock(hit.x, hit.y, hit.z, 0);
    this._cachedRaycastFrame = -1;
    this.onBlockChange?.(hit.x, hit.y, hit.z, 0);
    this.netManager?.sendBlockChange?.(hit.x, hit.y, hit.z, 0);
    this.breakCd = 5;
  }

  interactBlock(p) {
    if (p.sneaking) return false; // Shift previne interação (permite colocar bloco no baú/bancada)
    const hit = this.raycast();
    if (!hit) return false;
    const blockId = hit.id;
    if (blockId === 58) { // Bancada de trabalho
      this.onOpenCraftingTable?.();
      return true;
    }
    if (blockId === 61 || blockId === 62) { // Fornalha
      this.onOpenFurnace?.(hit.x, hit.y, hit.z);
      return true;
    }
    if (blockId === 54) { // Baú
      this.onOpenChest?.(hit.x, hit.y, hit.z);
      return true;
    }
    return false;
  }

  placeBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const slot = this.player.hotbar[this.player.selectedSlot];
    if (!slot || !slot.id) return;
    let px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
    const placing = getBlock(slot.id);
    let meta = slot.meta || 0;
    let placeId = slot.id;
    const plan = computePlacement(placing, meta, hit, this.player.yaw, (a, b, c) => this.world.getBlock(a, b, c));
    if (plan) { px = plan.x; py = plan.y; pz = plan.z; placeId = plan.id; meta = plan.meta; }
    if (hasShape(getBlock(placeId))) { if (this._shapeHitsPlayer(placeId, meta, px, py, pz)) return; }
    else if (this.intersectsPlayer(px, py, pz)) return;
    const targetState = this.world.getBlock(px, py, pz);
    const targetId = stateId(targetState);
    const mergingInPlace = placeId !== slot.id; // laje dupla: o bloco existente é a laje que está sendo completada
    if (!mergingInPlace && targetId !== 0 && !isFluid(targetId) && !isReplaceable(targetId)) return;
    if (slot.id === 17) {
      if (hit.ny !== 0) meta = 0;
      else if (hit.nx !== 0) meta = 1;
      else meta = 2;
    }
    const newState = packState(placeId, meta);
    playBlockPlaceSound(placeId, { x: px, y: py, z: pz });
    this.world.setBlock(px, py, pz, newState);
    this._cachedRaycastFrame = -1;
    this.onBlockChange?.(px, py, pz, newState);
    this.netManager?.sendBlockChange?.(px, py, pz, newState);
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

  pickBlock() {
    const hit = this.raycast();
    if (!hit) return;
    const b = getBlock(hit.id);
    // laje dupla vira a laje simples do mesmo tipo; escadas e lajes voltam à meta base (a orientação vem da colocação)
    const id = b.singleId || hit.id;
    let meta = hit.meta;
    if (b.singleId || isSlabBlock(b)) meta = hit.meta & 7;
    else if (isStairsBlock(b)) meta = 0;
    this.player.hotbar[this.player.selectedSlot] = { id, meta };
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

    const W = this.isAction('forward') ? 1 : 0, S = this.isAction('back') ? 1 : 0;
    const A = this.isAction('left') ? 1 : 0, Dd = this.isAction('right') ? 1 : 0;
    const forward = W - S, strafe = A - Dd;
    const yaw = p.yaw;
    const fx = -Math.sin(yaw), fz = Math.cos(yaw);
    const rx = Math.cos(yaw), rz = Math.sin(yaw);
    let wx = forward * fx + strafe * rx;
    let wz = forward * fz + strafe * rz;
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-4) { wx /= wl; wz /= wl; }

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
    if (this.isAction('jump') && p.onGround && this.jumpTicks === 0) {
      p.vel.y = 0.42;
      this.jumpTicks = 10;
      if (p.sprinting) {
        p.vel.x += -Math.sin(yaw) * 0.2;
        p.vel.z += Math.cos(yaw) * 0.2;
      }
    }
    if (this.jumpTicks > 0) this.jumpTicks--;

    if (p.flying) {
      const speed = (p.sprinting ? PLAYER.creativeSprint : PLAYER.creativeSpeed) / TPS;
      const wl = Math.hypot(strafe, forward);
      let fx = 0, fz = 0;
      if (wl > 1e-4) {
        const sin = Math.sin(yaw), cos = Math.cos(yaw);
        fx = (strafe * cos - forward * sin) / wl * speed;
        fz = (forward * cos + strafe * sin) / wl * speed;
      }
      p.vel.x = fx; p.vel.z = fz;
      let vy = 0;
      if (this.isAction('jump')) vy += 1;
      if (this.isAction('sneak')) vy -= 1;
      p.vel.y = vy * PLAYER.creativeSpeed / TPS;
      const res = moveEntity(p.pos, p.vel, this.world, 1, { sneaking: p.sneaking, onGround: p.onGround, flying: p.flying });
      p.onGround = res.onGround;
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
      const res = moveEntity(p.pos, p.vel, this.world, 1, { sneaking: p.sneaking, onGround: p.onGround, flying: p.flying });
      p.onGround = res.onGround;
      p.vel.x *= friction;
      p.vel.z *= friction;
      p.vel.y -= PLAYER.gravity;
      p.vel.y *= 0.98;

      if (p.onGround && !p.flying) {
        const distMoved = Math.hypot(p.pos.x - (this._lastWalkX ?? p.pos.x), p.pos.z - (this._lastWalkZ ?? p.pos.z));
        this._walkDist = (this._walkDist || 0) + distMoved;
        this._lastWalkX = p.pos.x;
        this._lastWalkZ = p.pos.z;
        if (p.sprinting && distMoved > 0.001) {
          p.exhaustion = Math.min(40, (p.exhaustion || 0) + distMoved * 0.1);
        }
        if (this._walkDist > 1.8) {
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

    // Combate e ações (PRD 07 RF-001..034) — morto não ataca/interage
    const attackActive = this.isAction('attack') && !this.paused && !this.chatOpen && !p.isDead;
    const useActive = this.isAction('use') && !this.paused && !this.chatOpen && !p.isDead;
    const attackPressed = attackActive && !this._prevAttack;
    const usePressed = useActive && !this._prevUse;
    const heldItem = this.getHeldItem();

    // Left-click: swing + atacar entidade / minerar (RF-001, RF-051)
    if (attackPressed) {
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
      // Mineração contínua — só se não há entidade no caminho
      if (!this.raycastEntity()) {
        if (p.gameMode === 'creative' || p.gameMode === 'spectator') {
          if (this.breakCd <= 0) { this.breakBlock(); this.breakCd = 5; startSwing(this.anim); }
        } else {
          this.tickMining(p);
          // 1.8.9: o balanço repete enquanto segura o botão sobre um bloco
          if (this.miningTarget && !this.anim.isSwinging) startSwing(this.anim);
        }
      }
    } else {
      this.miningTarget = null;
      this.miningProgress = 0;
    }

    // Right-click: bloquear / arco / comer / arremessar / colocar (RF-006, RF-020, RF-030)
    if (useActive) {
      if (isSword(heldItem)) {
        p.blocking = true; p.usingItem = true;
      } else if (isBow(heldItem)) {
        p.bowDrawing = true; p.usingItem = true;
        this.bowChargeTicks++;
        p.bowCharge = computeBowCharge(this.bowChargeTicks);
      } else if (this.tryStartEating(p)) {
        this.tickEating(p);
      } else if (usePressed && this.interactBlock(p)) {
        this.placeCd = 4;
      } else if (this.placeCd <= 0 && !heldItem?.id) {
        // mão vazia — nada
      } else if (this.placeCd <= 0) {
        this.placeBlock();
      }
    } else {
      // Release
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
    if (this.weather) {
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
        p.exhaustion = Math.min(40, (p.exhaustion || 0) + dist * 0.1);
      } else if (dist > 0.01) p.stats.distanceWalked += dist;
      if (this.isAction('jump') && p.onGround) {
        p.stats.jumps++;
        p.exhaustion = Math.min(40, (p.exhaustion || 0) + (p.sprinting ? 0.2 : 0.05));
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
        world: this.world, difficulty: this.difficulty, worldTime: this.worldTime,
        weather: this.weather, gameRules: this.gameRules, projectiles: this.projectiles,
        inventory: this.inventory, getHeldItem: () => this.getHeldItem(),
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
    if (this.worldTime % 2 === 0 && this.redstone) this.redstone.tick();
    this.tickTntEntities();
    if (this.worldTime % 20 === 0) this.randomTickAgriculture();

    if (this.worldTime % AUTOSAVE_TICKS === 0) this.onAutosave();

    perfMonitor.endStage('sim');

    // Transmitir posição em multiplayer (a cada 2 frames)
    if (this.netManager && (this.frame % 2 === 0)) {
      const posMsg = {
        t: 'move',
        id: this.netManager.user?.id || 'host',
        n: p.nomeJogador,
        x: p.pos.x,
        y: p.pos.y,
        z: p.pos.z,
        yaw: p.yaw,
        pitch: p.pitch,
        dead: !!p.isDead,
        h: this.getHeldItem()?.id || 0,
      };
      if (this.netManager.broadcast) {
        this.netManager.broadcast(posMsg);
      } else if (this.netManager.conn) {
        this.netManager.conn.send(posMsg);
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
    this.raf = requestAnimationFrame(this.loop);
    perfMonitor.beginFrame();

    // PRD 21 RF-001: timing por stage
    perfMonitor.beginStage('tick');
    const dt = Math.min(now - this.lastTime, 500); this.lastTime = now;
    
    // No online (multiplayer) o mundo não pausa; no singleplayer pausa
    const isOnline = !!this.netManager;
    const canTickWorld = isOnline || (!this.paused && !this.chatOpen);

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
      if (this.itemEntities) {
        const inv = this.inventory || this.player.inventory;
        this.itemEntities.update(Math.min(dt, 100) / 1000, this.player, inv, this.world, this.worldTime, this._cameraFrustum);
      }
      if (this.mobs) this.mobs.renderUpdate(this.worldTime / 20, this.player.pos, this._cameraFrustum);
      if (this.particles) this.particles.renderUpdate();
      perfMonitor.endStage('entities');
      perfMonitor.beginStage('render');
      this.renderer.render(this.scene, this.camera);
      this.updateFirstPersonHand();
      this.fpsFrames++;
      perfMonitor.endStage('render');
    }
    if (now - this.fpsTime > 500) {
      this.fps = Math.round(this.fpsFrames * 1000 / (now - this.fpsTime));
      this.fpsFrames = 0; this.fpsTime = now;
    }
    this.frame++;
    // RF-050: HUD no máximo 10×/s
    perfMonitor.beginStage('hud');
    if (this.frame % 6 === 0) this.emitHud();
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

  updateCamera() {
    const fov = settingsStore.get('user.fov') || 70;
    const zooming = this.isZooming();
    let targetFov = zooming ? Math.min(fov, 30) : fov;
    // FOV dinamico ao correr (+15% Minecraft 1.8.9 Sprint FOV)
    if (this.player.sprinting && !zooming) {
      targetFov *= 1.15;
    }
    // FOV reduz ao puxar arco (PRD 07 RF-020)
    if (this.player.bowDrawing && this.player.bowCharge > 0) {
      targetFov -= this.player.bowCharge * 10;
    }
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
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
    const dir = this.lookDir();
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
    // Balanço de câmera ao tomar dano (1.8.9: 14° · sen(f⁴·π), f = hurtTime/10). Sem direção do golpe: rola sempre para o mesmo lado.
    this._hurtRollValue = this.hurtRoll();
    if (this._hurtRollValue) this.camera.rotateZ(this._hurtRollValue);
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
    placePlayerModel(m, p.pos, p.yaw);
    applyThirdPersonPose(m, this.anim, p, this.worldTime);
    // Item na mão visível no F5 (o mesh de 1ª pessoa só renderiza em perspective === 0)
    setModelHeldItem(m, this.getHeldItem()?.id);
    // Capa: segue a opção "modelPart_cape" da customização de skin
    setModelCape(m, this._capeSrc, settingsStore.get('user.skinParts.cape') !== false);

    // Efeito de flash vermelho ao tomar dano (Hurt Red Tint)
    const isHurt = p.hurtTime > 0;
    const hurtColor = isHurt ? 0xff5555 : 0xffffff;
    m.traverse(c => { if (c.material && c.material.color) c.material.color.setHex(hurtColor); });
    if (this.fpsArm) {
      this.fpsArm.traverse(c => { if (c.material && c.material.color) c.material.color.setHex(hurtColor); });
    }
    // Nametag acompanha a altura (abaixa se morto)
    if (this.nametag) this.nametag.position.y = p.isDead ? 0.5 : 2.1;
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
          group.visible = true; // buildPlayerModel esconde o modelo local em 1ª pessoa; o remoto precisa aparecer
          const tag = createNametag(rp.name || 'Player');
          tag.position.y = 2.1;
          group.add(tag);
          this.scene.add(group);
          entry = { group, tag };
          this._remoteMeshes.set(id, entry);
        }

        if (rp.targetX !== undefined) {
          rp.x = (rp.x ?? rp.targetX) + (rp.targetX - (rp.x ?? rp.targetX)) * 0.3;
          rp.y = (rp.y ?? rp.targetY) + (rp.targetY - (rp.y ?? rp.targetY)) * 0.3;
          rp.z = (rp.z ?? rp.targetZ) + (rp.targetZ - (rp.z ?? rp.targetZ)) * 0.3;
          rp.yaw = (rp.yaw ?? rp.targetYaw) + (rp.targetYaw - (rp.yaw ?? rp.targetYaw)) * 0.3;
        }

        placePlayerModel(entry.group, { x: rp.x || 0, y: rp.y || 0, z: rp.z || 0 }, rp.yaw || 0);
        // Item que o jogador remoto está segurando (chegou junto com o move)
        setModelHeldItem(entry.group, rp.held);
        // Capa do remoto: busca pelo nickname (cacheada) e balança com a velocidade
        this._ensureRemoteCape(entry, rp.name);
        const now = performance.now();
        if (entry._prev) {
          const dt = Math.max(0.001, (now - entry._prev.t) / 1000);
          const spd = Math.hypot((rp.x || 0) - entry._prev.x, (rp.z || 0) - entry._prev.z) / dt;
          const vy = ((rp.y || 0) - entry._prev.y) / dt;
          const cp = entry.group.userData.cape;
          if (cp && cp.visible) {
            const base = (10.8 * Math.PI) / 180;
            const flare = Math.min(1, spd / 7) * 0.55 + Math.min(1, Math.max(0, -vy) / 8) * 1.1;
            cp.rotation.x += (base + flare - cp.rotation.x) * 0.15;
          }
        }
        entry._prev = { x: rp.x || 0, y: rp.y || 0, z: rp.z || 0, t: now };
        // Morto: tomba de lado, fica vermelho e treme (o 1.8.9 gira o corpo 90° em ~20 ticks)
        rp.deathProgress = rp.isDead ? Math.min(1, (rp.deathProgress || 0) + 0.06) : 0;
        entry.group.rotation.z = rp.deathProgress * Math.PI / 2;
        entry.group.rotation.x = rp.isDead && rp.deathProgress < 1 ? Math.sin(performance.now() * 0.08) * 0.06 : 0;
        const tint = rp.isDead ? 0xff5555 : 0xffffff;
        if (entry.tint !== tint) {
          entry.tint = tint;
          entry.group.traverse(c => { if (c.material && c.material.color && !c.isSprite) c.material.color.setHex(tint); });
        }
        if (entry.tag) entry.tag.position.y = rp.isDead ? 0.5 : 2.1;

        // Atualizar áudio posicional 3D para voz
        voiceChat.updateRemotePosition(id, { x: rp.x || 0, y: rp.y || 0, z: rp.z || 0 });
      }
    }

    for (const [id, entry] of this._remoteMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(entry.group);
        this._remoteMeshes.delete(id);
      }
    }
  }

  emitHud() {
    const p = this.player;
    const yaw = ((p.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const deg = yaw * 180 / Math.PI;
    let facing;
    if (deg < 45 || deg >= 315) facing = 'Sul (+Z)';
    else if (deg < 135) facing = 'Oeste (-X)';
    else if (deg < 225) facing = 'Norte (-Z)';
    else facing = 'Leste (+X)';
    const hit = this.raycast();
    const eye = this.eyePos();
    const light = this.world.getLight(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
    const t = this.worldTime % 24000;
    const hours = Math.floor((t / 1000 + 6) % 24);
    const mins = Math.floor((t % 1000) / 1000 * 60);
    const hud = {
      fps: this.fps,
      tps: 20,
      xyz: `${p.pos.x.toFixed(3)} / ${p.pos.y.toFixed(3)} / ${p.pos.z.toFixed(3)}`,
      block: `${Math.floor(p.pos.x)}, ${Math.floor(p.pos.y)}, ${Math.floor(p.pos.z)}`,
      chunk: `${chunkCoord(Math.floor(p.pos.x))}, ${chunkCoord(Math.floor(p.pos.z))}`,
      facing,
      yaw: deg.toFixed(1),
      pitch: (p.pitch * 180 / Math.PI).toFixed(1),
      targeted: hit ? `${getBlock(hit.id).namePt} @ ${hit.x},${hit.y},${hit.z}` : '—',
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
      biome: this.world.getBiomeAt ? (this.world.getBiomeAt(Math.floor(p.pos.x), Math.floor(p.pos.z))?.name || '—') : '—',
      dimension: 'overworld',
      moonPhase: Math.floor((this.worldTime / 24000) % 8),
      meshQueueSize: this.world.pendingMeshCount(),
      drawCalls: this.renderer?.info?.render?.calls || 0,
      triangles: this.renderer?.info?.render?.triangles || 0,
      chunksLoaded: this.world.chunks ? this.world.chunks.size : 0,
      stats: p.stats || null,
      achievements: p.achievements || null,
      showHitboxes: this.showHitboxes,
      showChunkBorders: this.showChunkBorders,
      realTextures: isRealTexturesLoaded(),
      build: 'PRD-21',
      perf: perfMonitor.getStats(),
      gpuRenderer: perfMonitor.gpuRenderer,
      isSoftwareRenderer: perfMonitor.isSoftwareRenderer,
      loadingRadius: this.loadingRadius,
      targetRadius: this.targetRadius,
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

  // === Mineração (PRD 06 RF-060) ===
  tickMining(p) {
    const hit = this.raycast();
    if (!hit) { this.miningTarget = null; this.miningProgress = 0; return; }
    if (!this.miningTarget || this.miningTarget.x !== hit.x || this.miningTarget.y !== hit.y || this.miningTarget.z !== hit.z) {
      this.miningTarget = { x: hit.x, y: hit.y, z: hit.z };
      this.miningProgress = 0;
    }
    const block = getBlock(hit.id);
    if (block.hardness < 0) return;
    if (this.breakCd > 0) return; // pausa de 5 ticks entre blocos, como na 1.8.9
    const tool = this.getHeldItem();
    const time = getMiningTime(hit.id, tool, p.effects, this.inFluid === 'water', p.onGround);
    if (time === Infinity) return;
    // Dureza 0 (grama alta, flores, tochas): quebra no mesmo tick, como na 1.8.9
    this.miningProgress += time === 0 ? 1 : 1 / time;
    this._digTick = (this._digTick || 0) + 1;
    if (this._digTick % 4 === 0) playDigSound(hit.id, { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
    if (this.miningProgress >= 1) {
      this.breakBlockSurvival(hit, tool);
      this.miningTarget = null;
      this.miningProgress = 0;
      this.breakCd = 5;
    }
  }

  breakBlockSurvival(hit, tool) {
    const block = getBlock(hit.id);
    if (block.hardness < 0) return;
    const drops = getDrops(hit.id, tool, hit.meta);
    for (const drop of drops) {
      const item = { id: drop.id, count: drop.count, meta: drop.meta || 0 };
      const rx = (Math.random() - 0.5) * 0.2;
      const rz = (Math.random() - 0.5) * 0.2;
      if (this.itemEntities) {
        this.itemEntities.spawnItem(
          item,
          { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 },
          { x: rx, y: 2.0, z: rz },
          0
        );
      } else if (this.inventory) {
        addItem(this.inventory, item);
      }
    }
    const xpFn = ORE_XP[hit.id];
    if (xpFn) addXP(this.player, xpFn());
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
    this.particles?.spawnBlockBreak(hit.x, hit.y, hit.z, hit.id);
    this.world.setBlock(hit.x, hit.y, hit.z, 0);
    this.onBlockChange?.(hit.x, hit.y, hit.z, 0);
    this.netManager?.sendBlockChange?.(hit.x, hit.y, hit.z, 0);
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
      this.itemEntities?.spawnItem({ id: it.id, count: it.count, meta: it.meta || 0 },
        { x: p.pos.x, y: p.pos.y + 0.5, z: p.pos.z }, { x: Math.cos(a) * sp, y: 3 + Math.random() * 2, z: Math.sin(a) * sp }, 40);
    };
    for (const arr of [inv.hotbar, inv.main, inv.armor, inv.crafting]) {
      for (let i = 0; i < arr.length; i++) { spill(arr[i]); arr[i] = null; }
    }
    spill(inv.cursor); inv.cursor = null;
    inv.craftResult = null;
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

  shootArrow(p, charge) {
    if (!this.projectiles) return;
    playBowSound(p.pos);
    this.projectiles.spawnArrow(p, charge, {
      onHitEntity: (proj, entity) => {
        if (entity) entity._lastAttacker = p.nomeJogador || p.name;
      },
    });
    const slot = p.hotbar[p.selectedSlot];
    if (slot && slot.durability !== undefined && p.gameMode !== 'creative') {
      slot.durability--;
      if (slot.durability <= 0) p.hotbar[p.selectedSlot] = { id: 0, meta: 0 };
    }
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

    this.fpsScene.add(new THREE.AmbientLight(0xffffff, 1.0));

    this.handRig = buildHandRig();
    this.fpsArm = this.handRig.arm;
    this.fpsItemGroup = this.handRig.itemGroup;
    this.fpsScene.add(this.fpsArm, this.handRig.itemRoot);
    this.fpsItem = null;
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

    // Atualizar mesh do item — texturizado (atlas/ícone), mesmo builder do item dropado
    if (heldItem && heldItem.id) {
      if (!this.fpsItem || this.fpsItem._itemId !== heldItem.id) {
        // Materiais são cacheados/partilhados — só remove do grupo, sem dispose
        if (this.fpsItem) this.fpsItemGroup.remove(this.fpsItem);
        this.fpsItem = createItemMesh({ id: heldItem.id, meta: heldItem.meta || 0 }, 1, this.world?.atlas);
        this.fpsItem._itemId = heldItem.id;
        this.fpsItem.scale.setScalar(1.4);
        this.fpsItemGroup.add(this.fpsItem);
      }
    } else {
      if (this.fpsItem) { this.fpsItemGroup.remove(this.fpsItem); this.fpsItem = null; }
    }

    this.fpsCamera.rotation.z = this._hurtRollValue || 0; // a mão também balança com o dano
    // Pose da mão (RF-051): braço vazio como na 1.8.9; com item, só o item
    poseHand(this.handRig, this.anim, p, heldItem ? getItem(heldItem.id) : null, !!(heldItem && heldItem.id), this.worldTime / 20);

    // Renderizar a mão por cima do mundo (RF-050)
    if ((this.perspective === 0) && !this.paused) {
      this.renderer.clearDepth();
      this.renderer.render(this.fpsScene, this.fpsCamera);
    }
  }

  // === Morte e renascimento (PRD 05 RF-050..051) ===
  respawn() {
    const p = this.player;
    const spawn = p.hasBedSpawn
      ? { x: p.spawnX + 0.5, y: p.spawnY, z: p.spawnZ + 0.5 }
      : { x: this.spawn.x, y: this.spawn.y, z: this.spawn.z };
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
    const geo = new THREE.BoxGeometry(0.98, 0.98, 0.98);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.tntEntities.push({ pos: { x, y, z }, vel: { x: (Math.random()-0.5)*0.1, y: 0.2, z: (Math.random()-0.5)*0.1 }, fuse: 80, mesh });
  }

  tickTntEntities() {
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
      // Atualizar mesh
      if (tnt.mesh) {
        tnt.mesh.position.set(tnt.pos.x, tnt.pos.y, tnt.pos.z);
        const flash = Math.floor(tnt.fuse / 5) % 2 === 0;
        tnt.mesh.material.color.setHex(flash ? 0xffffff : 0xff0000);
      }
      // Explodir
      if (tnt.fuse <= 0) {
        if (tnt.mesh) { this.scene.remove(tnt.mesh); tnt.mesh.geometry.dispose(); tnt.mesh.material.dispose(); }
        this.detonate(tnt.pos, 4);
        this.tntEntities.splice(i, 1);
      }
    }
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
    playExplodeSound(pos);
    const result = explode(this.world, pos, power, {
      fire: false,
      breakBlocks: this.gameRules.explosionsBreakBlocks !== false,
      dropItems: this.gameRules.doTileDrops !== false,
    });
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
    musicManager.stop();
    voiceChat.stop();
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
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
    for (const tnt of this.tntEntities) {
      if (tnt.mesh) { this.scene.remove(tnt.mesh); tnt.mesh.geometry.dispose(); tnt.mesh.material.dispose(); }
    }
    this.tntEntities = [];
    this.pendingTnt = [];
    if (this.sky) this.sky.dispose();
    if (this.weather) this.weather.dispose();
    if (this.world) this.world.dispose(this.scene);
    if (this.renderer) this.renderer.dispose();
  }
}