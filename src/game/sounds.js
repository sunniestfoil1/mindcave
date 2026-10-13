// Sistema completo de áudio 3D e efeitos sonoros (Minecraft 1.8.9) — PRD 04
import { getBlock } from './blocks';
import { settingsStore } from './settingsStore';

let audioCtx = null;
const soundBufferCache = new Map();
let masterGain = null;
let sfxGain = null;
let blocksGain = null;
let hostileGain = null;
let neutralGain = null;
let playersGain = null;
let weatherGain = null;
let uiGain = null;
let ambientGain = null;
let musicGain = null;
let voiceGain = null;
let isMuted = false;
let rainSource = null;
let listenerPos = { x: 0, y: 0, z: 0 };

let keepAliveOsc = null;

export function getAudioContext() {
  if (!audioCtx) initAudio();
  return audioCtx;
}

export function getMusicGain() {
  if (!musicGain && audioCtx) {
    musicGain = audioCtx.createGain();
    const musicVol = (settingsStore.get('user.volumeMusic') ?? 50) / 100;
    musicGain.gain.value = musicVol;
    musicGain.connect(masterGain || audioCtx.destination);
  }
  return musicGain;
}

export function getVoiceGain() {
  if (!voiceGain && audioCtx) {
    voiceGain = audioCtx.createGain();
    voiceGain.gain.value = 1.0;
    voiceGain.connect(masterGain || audioCtx.destination);
  }
  return voiceGain;
}

// Inicializa o contexto Web Audio na primeira interação do usuário (User Gesture)
export function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(audioCtx.destination);

      sfxGain = audioCtx.createGain();
      sfxGain.gain.value = 1.0;
      sfxGain.connect(masterGain);

      blocksGain = audioCtx.createGain();
      blocksGain.gain.value = 1.0;
      blocksGain.connect(masterGain);

      hostileGain = audioCtx.createGain();
      hostileGain.gain.value = 1.0;
      hostileGain.connect(masterGain);

      neutralGain = audioCtx.createGain();
      neutralGain.gain.value = 1.0;
      neutralGain.connect(masterGain);

      playersGain = audioCtx.createGain();
      playersGain.gain.value = 1.0;
      playersGain.connect(masterGain);

      weatherGain = audioCtx.createGain();
      weatherGain.gain.value = 1.0;
      weatherGain.connect(masterGain);

      uiGain = audioCtx.createGain();
      uiGain.gain.value = 1.0;
      uiGain.connect(masterGain);

      ambientGain = audioCtx.createGain();
      ambientGain.gain.value = 0.6;
      ambientGain.connect(masterGain);

      musicGain = audioCtx.createGain();
      const musicVol = (settingsStore.get('user.volumeMusic') ?? 50) / 100;
      musicGain.gain.value = musicVol;
      musicGain.connect(masterGain);

      voiceGain = audioCtx.createGain();
      voiceGain.gain.value = 1.0;
      voiceGain.connect(masterGain);

      // Técnica de Pré-aquecimento / Continuous Keep-Alive Audio Stream (Zero Latency)
      try {
        const keepAliveGain = audioCtx.createGain();
        keepAliveGain.gain.value = 0.00001; // Praticamente 0, porém impede suspensão de hardware
        keepAliveGain.connect(audioCtx.destination);

        keepAliveOsc = audioCtx.createOscillator();
        keepAliveOsc.type = 'sine';
        keepAliveOsc.frequency.value = 440;
        keepAliveOsc.connect(keepAliveGain);
        keepAliveOsc.start();
      } catch (e) {}

      updateAudioVolumes();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

if (typeof window !== 'undefined') {
  const resumeOnGesture = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('pointerdown', resumeOnGesture, { passive: true });
  window.addEventListener('keydown', resumeOnGesture, { passive: true });
  window.addEventListener('touchstart', resumeOnGesture, { passive: true });
}

export function updateAudioVolumes() {
  if (!audioCtx) return;
  const masterVol = (settingsStore.get('user.volumeMaster') ?? 100) / 100;
  const musicVol = (settingsStore.get('user.volumeMusic') ?? 100) / 100;
  const blocksVol = (settingsStore.get('user.volumeBlocks') ?? 100) / 100;
  const hostileVol = (settingsStore.get('user.volumeHostile') ?? 100) / 100;
  const neutralVol = (settingsStore.get('user.volumeNeutral') ?? 100) / 100;
  const playersVol = (settingsStore.get('user.volumePlayers') ?? 100) / 100;
  const weatherVol = (settingsStore.get('user.volumeWeather') ?? 100) / 100;
  const uiVol = (settingsStore.get('user.volumeUi') ?? 100) / 100;
  const ambientVol = (settingsStore.get('user.volumeAmbient') ?? 100) / 100;

  if (masterGain) masterGain.gain.value = masterVol;
  if (musicGain) musicGain.gain.value = musicVol;
  if (blocksGain) blocksGain.gain.value = blocksVol;
  if (hostileGain) hostileGain.gain.value = hostileVol;
  if (neutralGain) neutralGain.gain.value = neutralVol;
  if (playersGain) playersGain.gain.value = playersVol;
  if (weatherGain) weatherGain.gain.value = weatherVol;
  if (uiGain) uiGain.gain.value = uiVol;
  if (ambientGain) ambientGain.gain.value = ambientVol * 0.6;
  if (sfxGain) sfxGain.gain.value = 1.0;
}

settingsStore.subscribe(() => {
  updateAudioVolumes();
});

// Atualiza a posição e orientação dos ouvidos do jogador no Web Audio API
export function updateAudioListener(pos, dir) {
  if (!audioCtx) initAudio();
  if (!audioCtx || !audioCtx.listener) return;
  listenerPos = { x: pos.x, y: pos.y, z: pos.z };
  const l = audioCtx.listener;
  try {
    if (l.positionX) {
      l.positionX.value = pos.x;
      l.positionY.value = pos.y;
      l.positionZ.value = pos.z;
    } else if (l.setPosition) {
      l.setPosition(pos.x, pos.y, pos.z);
    }
    if (dir) {
      if (l.forwardX) {
        l.forwardX.value = dir.x;
        l.forwardY.value = dir.y;
        l.forwardZ.value = dir.z;
      } else if (l.setOrientation) {
        l.setOrientation(dir.x, dir.y, dir.z, 0, 1, 0);
      }
    }
  } catch {}
}

// Garante desbloqueio de áudio ao interagir com a tela
if (typeof window !== 'undefined') {
  const unlock = () => {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  };
  window.addEventListener('click', unlock);
  window.addEventListener('mousedown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerlockchange', unlock);
}

// Carrega e decodifica um arquivo .ogg em AudioBuffer com cache
async function loadSoundBuffer(relPath) {
  if (soundBufferCache.has(relPath)) {
    return soundBufferCache.get(relPath);
  }

  const cleanPath = relPath.startsWith('/') ? relPath.slice(1) : relPath;
  const url = `/assets/sounds/${cleanPath}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    if (!audioCtx) initAudio();
    if (!audioCtx) return null;

    const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
    soundBufferCache.set(relPath, audioBuf);
    return audioBuf;
  } catch (e) {
    return null;
  }
}

// Toca um som (estéreo 2D ou posicional 3D)
export async function playSound(relPath, opts = {}) {
  if (isMuted) return null;
  if (!audioCtx) initAudio();
  if (!audioCtx) return null;

  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch {}
  }

  const masterVol = (settingsStore.get('user.volumeMaster') ?? 100) / 100;
  if (masterVol <= 0) return null;

  if (masterGain) masterGain.gain.value = masterVol;

  const buffer = await loadSoundBuffer(relPath);
  if (!buffer) return null;

  try {
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    // Variação aleatória de pitch (0.9 a 1.1 — padrão Minecraft)
    const pitch = opts.pitch !== undefined ? opts.pitch : (0.9 + Math.random() * 0.2);
    source.playbackRate.value = pitch;

    const gainNode = audioCtx.createGain();
    const volume = (opts.volume !== undefined ? opts.volume : 1.0);
    gainNode.gain.value = volume;

    const resolveChannelNode = (path, options) => {
      if (options.ambient) return ambientGain || masterGain;
      if (options.category === 'blocks' || options.blocks) return blocksGain || sfxGain || masterGain;
      if (options.category === 'hostile') return hostileGain || sfxGain || masterGain;
      if (options.category === 'neutral') return neutralGain || sfxGain || masterGain;
      if (options.category === 'player' || options.category === 'players') return playersGain || sfxGain || masterGain;
      if (options.category === 'ui') return uiGain || sfxGain || masterGain;
      if (options.category === 'weather') return weatherGain || ambientGain || masterGain;

      const p = String(path).toLowerCase();
      if (p.startsWith('dig/') || p.startsWith('step/') || p.includes('/step') || p.includes('/dig') || p.includes('chest') || p.includes('door') || p.includes('piston')) {
        return blocksGain || sfxGain || masterGain;
      }
      if (p.includes('zombie') || p.includes('creeper') || p.includes('skeleton') || p.includes('spider') || p.includes('enderman') || p.includes('ghast') || p.includes('blaze') || p.includes('slime')) {
        return hostileGain || sfxGain || masterGain;
      }
      if (p.includes('cow') || p.includes('sheep') || p.includes('pig') || p.includes('chicken') || p.includes('villager') || p.includes('horse') || p.includes('wolf')) {
        return neutralGain || sfxGain || masterGain;
      }
      if (p.includes('player') || p.includes('damage') || p.includes('fall') || p.includes('eat') || p.includes('burp')) {
        return playersGain || sfxGain || masterGain;
      }
      if (p.includes('ui/') || p.includes('click') || p.includes('pop') || p.includes('levelup')) {
        return uiGain || sfxGain || masterGain;
      }
      if (p.includes('rain') || p.includes('thunder')) {
        return weatherGain || ambientGain || masterGain;
      }
      return sfxGain || masterGain;
    };

    let targetNode = resolveChannelNode(relPath, opts);

    // Se o som está muito próximo da cabeça do jogador (<= 3 blocos), toca direto sem atenuação excessiva
    let dist = 999;
    if (opts.pos) {
      dist = Math.hypot(opts.pos.x - listenerPos.x, opts.pos.y - listenerPos.y, opts.pos.z - listenerPos.z);
    }

    if (opts.pos && dist > 3 && audioCtx.createPanner) {
      const panner = audioCtx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'linear';
      panner.refDistance = 3;
      panner.maxDistance = 96;
      panner.rolloffFactor = 0.8;
      panner.setPosition(opts.pos.x, opts.pos.y, opts.pos.z);

      source.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(targetNode || audioCtx.destination);
    } else {
      source.connect(gainNode);
      gainNode.connect(targetNode || audioCtx.destination);
    }

    source.loop = !!opts.loop;
    source.start(0);
    return source;
  } catch (e) {
    return null;
  }
}

// Mapeamento de blocos para categorias de som
function getSoundCategory(blockId) {
  const block = getBlock(blockId);
  if (!block) return 'stone';
  const name = block.namePt ? block.namePt.toLowerCase() : '';

  if (name.includes('grama') || name.includes('terra') || name.includes('muda') || name.includes('folha')) return 'grass';
  if (name.includes('madeira') || name.includes('tábua') || name.includes('tronco') || name.includes('bancada')) return 'wood';
  if (name.includes('areia')) return 'sand';
  if (name.includes('cascalho')) return 'gravel';
  if (name.includes('neve') || name.includes('gelo')) return 'snow';
  if (name.includes('vidro')) return 'glass';
  if (name.includes('pedra') || name.includes('pedregulho') || name.includes('minério')) return 'stone';

  return 'stone';
}

// === TODOS OS GATILHOS DE ÁUDIO DO MINECRAFT 1.8.9 ===

// Passos (Footsteps)
export function playStepSound(blockId, pos) {
  const cat = getSoundCategory(blockId);
  let soundName = `step/${cat}${Math.floor(Math.random() * 4) + 1}.ogg`;
  if (cat === 'wood') soundName = `step/wood${Math.floor(Math.random() * 6) + 1}.ogg`;
  if (cat === 'grass') soundName = `step/grass${Math.floor(Math.random() * 6) + 1}.ogg`;
  playSound(soundName, { pos, volume: 0.35 });
}

// Mineração contínua (Dig)
export function playDigSound(blockId, pos) {
  const cat = getSoundCategory(blockId);
  playSound(`dig/${cat}${Math.floor(Math.random() * 4) + 1}.ogg`, { pos, volume: 0.4 });
}

// Destruição de bloco (Break)
export function playBlockBreakSound(blockId, pos) {
  const cat = getSoundCategory(blockId);
  playSound(`dig/${cat}1.ogg`, { pos, volume: 0.8, pitch: 0.9 + Math.random() * 0.2 });
}

// Colocação de bloco (Place)
export function playBlockPlaceSound(blockId, pos) {
  const cat = getSoundCategory(blockId);
  playSound(`step/${cat}${Math.floor(Math.random() * 4) + 1}.ogg`, { pos, volume: 0.7 });
}

// Dano no jogador
export function playHurtSound(pos) {
  playSound(`damage/hit${Math.floor(Math.random() * 3) + 1}.ogg`, { pos, volume: 0.8 });
}

// Dano no jogador por origem: queda usa fallsmall/fallbig (1.8.9: grande acima de 4 de dano); o resto, damage/hit1-3
export function playPlayerHurtSound(source, amount) {
  if (source === 'fall') {
    playSound(amount > 4 ? 'damage/fallbig.ogg' : 'damage/fallsmall.ogg', { volume: 0.8 });
  } else {
    playHurtSound();
  }
}

// Ataque / Impacto de espada
export function playHitSound(pos) {
  playSound(`damage/hit1.ogg`, { pos, volume: 0.6, pitch: 1.1 });
}

// Disparo de arco
export function playBowSound(pos) {
  playSound(`random/bow.ogg`, { pos, volume: 0.8 });
}

export function playBowHitSound(pos) {
  playEvent('entity.arrow.hit', { pos, volume: 0.8 });
}

// Comida / Mastigação
export function playEatSound(pos) {
  playSound(`random/eat${Math.floor(Math.random() * 3) + 1}.ogg`, { pos, volume: 0.5 });
}

export function playBurpSound(pos) {
  playSound(`random/burp.ogg`, { pos, volume: 0.7 });
}

// Explosão de TNT / Fusível
export function playFuseSound(pos) {
  playSound(`random/fuse.ogg`, { pos, volume: 0.8 });
}

export function playExplodeSound(pos) {
  playEvent('entity.generic.explode', { pos, volume: 1.0 });
}

// XP / Level Up / Item Pop
export function playLevelUpSound() {
  playSound(`random/levelup.ogg`, { volume: 0.9, pitch: 1.0 });
}

export function playPopSound(pos) {
  playSound(`random/pop.ogg`, { pos, volume: 0.5, pitch: 0.8 + Math.random() * 0.4 });
}

// Clique na UI
export function playClickSound() {
  playSound(`random/click.ogg`, { volume: 0.5, pitch: 1.0 });
}

// Baú (Open/Close)
export function playChestOpenSound(pos) {
  playEvent('block.chest.open', { pos, volume: 0.6 });
}

export function playChestCloseSound(pos) {
  playEvent('block.chest.close', { pos, volume: 0.6 });
}

// Porta (Open/Close)
export function playDoorOpenSound(pos) {
  playEvent('block.wooden_door.open', { pos, volume: 0.7 });
}

export function playDoorCloseSound(pos) {
  playEvent('block.wooden_door.close', { pos, volume: 0.7 });
}

// Respingo na água
export function playSplashSound(pos) {
  playEvent('entity.generic.splash', { pos, volume: 0.7 });
}

// Som de chuva (Loop)
export function startRainSound() {
  if (!rainSource) {
    playSound(`ambient/weather/rain1.ogg`, { loop: true, ambient: true, volume: 0.4 }).then(src => {
      rainSource = src;
    });
  }
}

export function stopRainSound() {
  if (rainSource) {
    try { rainSource.stop(); } catch {}
    rainSource = null;
  }
}

// Armadura (Equipar / Quebrar)
export function playArmorEquipSound(armorType = 'generic', pos) {
  const known = ['diamond', 'iron', 'gold', 'leather', 'chain'];
  playEvent(`item.armor.equip_${known.includes(armorType) ? armorType : 'generic'}`, { pos, volume: 0.8 });
}

export function playArmorBreakSound(pos) {
  playEvent('entity.item.break', { pos, volume: 0.9 });
}

// === Eventos de som (sounds.json do pacote de áudio) ===
// O arquivo mapeia 1462 eventos ("entity.zombie.hurt") para os 5981 .ogg de public/assets/sounds. Os eventos de jogo
// passam por aqui em vez de nomes de arquivo escritos à mão.
let eventsTable = null;
let eventsPromise = null;
function loadEvents() {
  if (eventsTable) return Promise.resolve(eventsTable);
  if (!eventsPromise) {
    eventsPromise = fetch('/assets/sounds/sounds.json')
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((t) => { eventsTable = t; return t; });
  }
  return eventsPromise;
}

// Sorteio ponderado; entradas { type: 'event' } apontam para outro evento
function pickEventSound(table, entry, depth = 0) {
  if (!entry || !entry.sounds || !entry.sounds.length || depth > 4) return null;
  const list = entry.sounds.map((s) => (typeof s === 'string' ? { name: s } : s));
  const total = list.reduce((a, s) => a + (s.weight || 1), 0);
  let r = Math.random() * total;
  let chosen = list[0];
  for (const s of list) { r -= (s.weight || 1); if (r <= 0) { chosen = s; break; } }
  if (chosen.type === 'event') return pickEventSound(table, table[chosen.name], depth + 1);
  return { file: chosen.name, volume: chosen.volume ?? 1, pitch: chosen.pitch };
}

export async function playEvent(event, opts = {}) {
  const table = await loadEvents();
  const entry = table[event];
  const s = pickEventSound(table, entry);
  if (!s) return null;
  return playSound(`${s.file}.ogg`, {
    pos: opts.pos,
    volume: (opts.volume ?? 1) * (entry.volume ?? 1) * s.volume,
    pitch: opts.pitch ?? s.pitch,
  });
}

// Nome do som de cada mob (variantes tecnológicas usam o do zumbi)
const MOB_SOUND_NAME = {
  zombie: 'zombie', zombie_soldier: 'zombie', zombie_miner: 'zombie', zombie_scout: 'zombie', zombie_sapper: 'zombie',
  zombie_armored: 'zombie', zombie_sniper: 'zombie', skeleton: 'skeleton', creeper: 'creeper', spider: 'spider',
  enderman: 'enderman', pig: 'pig', cow: 'cow', sheep: 'sheep', chicken: 'chicken', wolf: 'wolf', slime: 'slime',
  witch: 'witch', bat: 'bat',
};

// kind: hurt | death | ambient | step | primed | teleport | scream | stare
export function playMobSound(mob, kind) {
  const name = MOB_SOUND_NAME[mob.typeId];
  if (!name) return null;
  const generic = { primed: 'entity.creeper.primed', shoot: 'entity.arrow.shoot' };
  const event = generic[kind] || `entity.${name}.${kind}`;
  return playEvent(event, { pos: mob.pos, volume: kind === 'step' ? 0.35 : 1 });
}
