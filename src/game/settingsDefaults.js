// Definições centrais de configurações do Mind Cave (PRD 03)
// Fonte única de verdade: todas as opções, escopos, padrões e faixas.

export const SETTINGS_VERSION = 1;

// ─── Defaults por escopo ───────────────────────────────────────────────

export const DEFAULT_DEVICE = {
  // Vídeo (1.8.9)
  graphics: 'fancy',
  renderDistance: 8,
  smoothLighting: 'max',
  maxFps: 'vsync',
  anaglyph3d: false,
  guiScale: 'auto',
  brightness: 0,
  clouds: 'fancy',
  fullscreen: false,
  particles: 'all',
  vsync: true,
  mipmaps: 4,
  entityShadows: true,
  alternatingBlocks: true,
  // Vídeo — extensões
  resolutionScale: 100,
  anisotropicFiltering: 4,
  leaves: 'default',
  betterGrass: 'off',
  fog: 'fancy',
  fogStart: 40,
  sky: true,
  sun: true,
  stars: true,
  animatedTextures: 'all',
  dynamicLights: 'off',
  entityDistance: 100,
  chunkUpdatesPerFrame: 2,
  smoothCamera: false,
  fovEffects: 100,
  showFps: false,
  screenShake: 100,
  // Sombras
  entityBlobShadows: true,
  sunShadows: 'off',
  shadowResolution: 1024,
  shadowDistance: 64,
  shadowCascades: 1,
  shadowSmoothness: 'pcf',
  foliageShadows: false,
  entityShadowCast: false,
  cloudShadows: false,
  ambientOcclusion: 'vertex',
  // Shaders
  shaderMode: 'classic',
  shaderPreset: 'off',
  sunIntensity: 100,
  blockLightIntensity: 100,
  blockLightColor: 'warm',
  nightBrightness: 5,
  exposure: 100,
  autoExposure: false,
  tonemapping: 'aces',
  waterWaves: 'off',
  waveHeight: 50,
  waterReflections: 'off',
  waterRefraction: false,
  waterCaustics: false,
  waterFoam: false,
  bloom: 0,
  vignette: 0,
  saturation: 100,
  contrast: 100,
  colorTemp: 0,
  chromaticAberration: 0,
  grain: 0,
  sharpness: 0,
  antialiasing: 'off',
  // Desempenho
  meshingWorkers: 'auto',
  genWorkers: 'auto',
  memoryBudget: 512,
  loadPace: 'balanced',
  greedyMeshing: 'auto',
  pauseRenderWhenHidden: true,
  powerSaver: false,
  perfGraph: false,
  // Rede (dispositivo)
  interpolationDelay: 'auto',
  showPing: true,
  showNetIndicator: false,
};

export const DEFAULT_USER = {
  // Geral
  fov: 70,
  viewBobbing: true,
  lang: 'pt_BR',
  // Controles — mouse
  mouseSensitivity: 100,
  invertMouse: false,
  rawInput: true,
  scrollSensitivity: 10,
  discreteScroll: false,
  adsSensitivity: 100,
  zoomSensitivity: 50,
  // Controles — modos
  sneakMode: 'hold',
  sprintMode: 'hold',
  aimMode: 'hold',
  // Controles — teclas
  keys: {
    forward: 'KeyW', left: 'KeyA', back: 'KeyS', right: 'KeyD',
    jump: 'Space', sneak: 'ShiftLeft', sprint: 'ControlLeft',
    attack: 'Mouse0', use: 'Mouse2', pick: 'Mouse1',
    drop: 'KeyQ', inventory: 'KeyE',
    slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3', slot4: 'Digit4',
    slot5: 'Digit5', slot6: 'Digit6', slot7: 'Digit7', slot8: 'Digit8', slot9: 'Digit9',
    chat: 'KeyT', command: 'Slash', playerList: 'Tab', voiceMute: 'KeyV',
    screenshot: 'F2', perspective: 'F5', smoothCamera: 'F8',
    fullscreen: 'F11', hideHud: 'F1', debug: 'F3',
    reload: 'KeyR', fireMode: 'KeyB', zoom: 'KeyC', studio: 'F7',
  },
  // Áudio
  volumeMaster: 100, volumeMusic: 100, volumeRecords: 100, volumeWeather: 100,
  volumeBlocks: 100, volumeHostile: 100, volumeNeutral: 100, volumePlayers: 100,
  volumeAmbient: 100, volumeWeapons: 100, volumeUi: 100,
  audioDevice: 'default', audioOnFocusLoss: 'mute', subtitles: false,
  // Skin
  skinParts: { cape: true, jacket: false, sleeveL: false, sleeveR: false, pantsL: false, pantsR: false, hat: true },
  skin: 'explorador', armModel: 'classic', cape: 'none',
  // Chat
  chat: 'visible', chatColors: true, webLinks: true, confirmLinks: true,
  textOpacity: 100, bgOpacity: 50, chatScale: 100, chatWidth: 320,
  chatHeightFocused: 180, chatHeightUnfocused: 90, chatVisibleTime: 10,
  reducedDebugInfo: false, chatTimestamp: false,
  // Acessibilidade
  soundCaptions: false, reduceFlashes: false, textBackground: 'chat',
  textBgOpacity: 50, highContrastCrosshair: false, colorBlindFilter: 'none',
  minTextScale: 0, hideDistortion: false,
  // Idioma
  language: 'pt_BR',
};

export const DEFAULT_WORLD_RULES = {
  difficulty: 'normal', lockDifficulty: false,
  gameRules: {
    doDaylightCycle: true, doMobSpawning: true, doMobLoot: true, doTileDrops: true,
    doEntityDrops: true, doFireTick: true, keepInventory: false, mobGriefing: true,
    naturalRegeneration: true, randomTickSpeed: 3, showDeathMessages: true,
    sendCommandFeedback: true, commandBlockOutput: true, logAdminCommands: true,
    reducedDebugInfo: false,
  },
  mcGameRules: {
    gunsEnabled: true, techZombies: true, techZombieChance: 15,
    friendlyFire: true, explosionsBreakBlocks: true, devTools: true,
  },
  maxPlayers: 8, guestRenderDistance: 12, simulationDistance: 6,
  pvp: true, guestGameMode: 'world', guestCommands: false,
};

// ─── Perfis de qualidade (PRD 03 §13) ─────────────────────────────────

export const QUALITY_PROFILES = {
  potato: { graphics: 'fast', renderDistance: 3, smoothLighting: 'off', particles: 'minimal', mipmaps: 0, resolutionScale: 50, shaderMode: 'classic', clouds: 'off', entityShadows: false, entityBlobShadows: false, sunShadows: 'off', ambientOcclusion: 'off', fog: 'off', sky: false, stars: false, sun: false, animatedTextures: 'off', entityDistance: 50, maxFps: 30, chunkUpdatesPerFrame: 1, leaves: 'fast', betterGrass: 'off', waterWaves: 'off', bloom: 0, vignette: 0, antialiasing: 'off', anisotropicFiltering: 0, screenShake: 0, dynamicLights: 'off', smoothCamera: false, pauseRenderWhenHidden: true, powerSaver: true, alternatingBlocks: false, foliageShadows: false, entityShadowCast: false, cloudShadows: false },
  minimum: { graphics: 'fast', renderDistance: 4, smoothLighting: 'off', particles: 'minimal', mipmaps: 0, resolutionScale: 75, shaderMode: 'classic' },
  low: { graphics: 'fast', renderDistance: 6, smoothLighting: 'min', particles: 'decreased', mipmaps: 2, resolutionScale: 100, shaderMode: 'classic' },
  medium: { graphics: 'fancy', renderDistance: 8, smoothLighting: 'max', particles: 'all', mipmaps: 4, resolutionScale: 100, shaderMode: 'classic' },
  high: { graphics: 'fancy', renderDistance: 12, smoothLighting: 'max', particles: 'all', mipmaps: 4, resolutionScale: 100, shaderMode: 'shaders' },
  ultra: { graphics: 'fancy', renderDistance: 16, smoothLighting: 'max', particles: 'all', mipmaps: 4, resolutionScale: 125, shaderMode: 'shaders' },
};

// ─── Rótulos de tecla ─────────────────────────────────────────────────

export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Mouse')) {
    const n = parseInt(code.slice(5));
    return ['Botão Esq.', 'Botão Meio', 'Botão Dir.'][n] || `Mouse ${n}`;
  }
  const map = {
    Space: 'Espaço', ShiftLeft: 'Shift Esq.', ShiftRight: 'Shift Dir.',
    ControlLeft: 'Ctrl Esq.', ControlRight: 'Ctrl Dir.',
    AltLeft: 'Alt Esq.', AltRight: 'Alt Dir.',
    Tab: 'Tab', Enter: 'Enter', Escape: 'Esc',
    Backspace: '←', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'",
    Comma: ',', Period: '.', BracketLeft: '[', BracketRight: ']',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    CapsLock: 'Caps Lock', ContextMenu: 'Menu',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('F') && code.length <= 3) return code;
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

// ─── Lista de ações de tecla (para a tela de controles) ────────────────

export const KEY_ACTIONS = [
  { group: 'Movimento', actions: [
    { id: 'forward', label: 'Frente' }, { id: 'left', label: 'Esquerda' },
    { id: 'back', label: 'Trás' }, { id: 'right', label: 'Direita' },
    { id: 'jump', label: 'Pular' }, { id: 'sneak', label: 'Agachar' },
    { id: 'sprint', label: 'Correr' },
  ]},
  { group: 'Jogabilidade', actions: [
    { id: 'attack', label: 'Atacar/Destruir' }, { id: 'use', label: 'Usar item/Colocar bloco' },
    { id: 'pick', label: 'Escolher bloco' }, { id: 'drop', label: 'Soltar item' },
    { id: 'inventory', label: 'Abrir inventário' },
  ]},
  { group: 'Inventário', actions: [
    { id: 'slot1', label: 'Slot 1' }, { id: 'slot2', label: 'Slot 2' },
    { id: 'slot3', label: 'Slot 3' }, { id: 'slot4', label: 'Slot 4' },
    { id: 'slot5', label: 'Slot 5' }, { id: 'slot6', label: 'Slot 6' },
    { id: 'slot7', label: 'Slot 7' }, { id: 'slot8', label: 'Slot 8' },
    { id: 'slot9', label: 'Slot 9' },
  ]},
  { group: 'Multijogador', actions: [
    { id: 'chat', label: 'Abrir chat' }, { id: 'command', label: 'Abrir comando' },
    { id: 'playerList', label: 'Lista de jogadores' }, { id: 'voiceMute', label: 'Silenciar microfone' },
  ]},
  { group: 'Diversos', actions: [
    { id: 'screenshot', label: 'Captura de tela' }, { id: 'perspective', label: 'Alternar perspectiva' },
    { id: 'smoothCamera', label: 'Câmera suave' }, { id: 'fullscreen', label: 'Tela cheia' },
    { id: 'hideHud', label: 'Ocultar HUD' }, { id: 'debug', label: 'Tela de debug' },
  ]},
  { group: 'Mind Cave', actions: [
    { id: 'reload', label: 'Recarregar arma' }, { id: 'fireMode', label: 'Modo de disparo' },
    { id: 'zoom', label: 'Zoom' }, { id: 'studio', label: 'Abrir Mind Cave Studio' },
  ]},
];