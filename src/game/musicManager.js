// Gerenciador de Trilha Sonora Ambiente C418 (Minecraft 1.8.9) — PRD 26
// Toca as faixas originais autênticas de C418 (Sweden, Subwoofer Lullaby, Wet Hands, Mice on Venus, etc.)
import { getAudioContext, getMusicGain } from './sounds';
import { settingsStore } from './settingsStore';

export const REAL_C418_TRACKS = [
  // Clássicas de Sobrevivência (Overworld)
  { name: 'C418 - Sweden', file: '/assets/sounds/music/game/calm3.ogg' },
  { name: 'C418 - Subwoofer Lullaby', file: '/assets/sounds/music/game/hal1.ogg' },
  { name: 'C418 - Wet Hands', file: '/assets/sounds/music/game/piano2.ogg' },
  { name: 'C418 - Mice on Venus', file: '/assets/sounds/music/game/piano3.ogg' },
  { name: 'C418 - Minecraft', file: '/assets/sounds/music/game/calm1.ogg' },
  { name: 'C418 - Clark', file: '/assets/sounds/music/game/calm2.ogg' },
  { name: 'C418 - Living Mice', file: '/assets/sounds/music/game/hal2.ogg' },
  { name: 'C418 - Haggstrom', file: '/assets/sounds/music/game/hal3.ogg' },
  { name: 'C418 - Danny', file: '/assets/sounds/music/game/hal4.ogg' },
  { name: 'C418 - Dry Hands', file: '/assets/sounds/music/game/piano1.ogg' },
  { name: 'C418 - Key', file: '/assets/sounds/music/game/nuance1.ogg' },
  { name: 'C418 - Oxygène', file: '/assets/sounds/music/game/nuance2.ogg' },
  // Faixas do Modo Criativo
  { name: 'C418 - Aria Math', file: '/assets/sounds/music/game/creative/creative1.ogg' },
  { name: 'C418 - Dreiton', file: '/assets/sounds/music/game/creative/creative2.ogg' },
  { name: 'C418 - Taswell', file: '/assets/sounds/music/game/creative/creative3.ogg' },
  { name: 'C418 - Biome Fest', file: '/assets/sounds/music/game/creative/creative4.ogg' },
  { name: 'C418 - Blind Spots', file: '/assets/sounds/music/game/creative/creative5.ogg' },
  { name: 'C418 - Haunt Muskie', file: '/assets/sounds/music/game/creative/creative6.ogg' },
];

class MusicManager {
  constructor() {
    this.currentTrack = null;
    this.isPlaying = false;
    this.nextTrackTimer = null;
    this.fadeGain = null;
    this.activeOscillators = [];
    this.soundTrackAudio = null;
    this.enabled = true;
    this._started = false;
    this.trackName = '';

    // Inscreve para atualizar o volume em tempo real ao mover os sliders de áudio
    settingsStore.subscribe(() => {
      this.updateVolume();
    });
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._scheduleNextSong(2500); // Inicia primeira faixa 2.5s após entrar no jogo
  }

  stop() {
    this._clearCurrentSong();
    if (this.nextTrackTimer) {
      clearTimeout(this.nextTrackTimer);
      this.nextTrackTimer = null;
    }
    this.isPlaying = false;
    this._started = false;
  }

  _scheduleNextSong(delayMs) {
    if (this.nextTrackTimer) clearTimeout(this.nextTrackTimer);
    // Intervalo de silêncio autêntico do Minecraft (1 a 3 minutos entre faixas)
    const delay = delayMs !== undefined ? delayMs : (60000 + Math.random() * 120000);
    this.nextTrackTimer = setTimeout(() => {
      this.playRandomAmbientSong();
    }, delay);
  }

  async playRandomAmbientSong() {
    const musicVol = (settingsStore.get('user.volumeMusic') ?? 100) / 100;
    const masterVol = (settingsStore.get('user.volumeMaster') ?? 100) / 100;

    if (musicVol <= 0 || masterVol <= 0) {
      this._scheduleNextSong(15000);
      return;
    }

    const chosen = REAL_C418_TRACKS[Math.floor(Math.random() * REAL_C418_TRACKS.length)];
    this.playTrack(chosen);
  }

  playTrack(track) {
    this._clearCurrentSong();
    this.trackName = track.name;
    this.isPlaying = true;

    try {
      const audio = new Audio(track.file);
      audio.preload = 'auto';

      const getTargetVol = () => {
        const musicVol = (settingsStore.get('user.volumeMusic') ?? 100) / 100;
        const masterVol = (settingsStore.get('user.volumeMaster') ?? 100) / 100;
        return Math.max(0, Math.min(1, musicVol * masterVol * 0.75));
      };

      const targetVol = getTargetVol();
      if (targetVol <= 0) {
        this.isPlaying = false;
        this._scheduleNextSong(15000);
        return;
      }

      audio.volume = 0.001;
      this.soundTrackAudio = audio;

      audio.play().then(() => {
        // Fade-in suave de 3 segundos
        let currentVol = 0.001;
        const stepTime = 100;
        const steps = 30;
        const increment = (targetVol - 0.001) / steps;

        const fadeInterval = setInterval(() => {
          if (!this.soundTrackAudio || this.soundTrackAudio !== audio) {
            clearInterval(fadeInterval);
            return;
          }
          currentVol = Math.min(getTargetVol(), currentVol + increment);
          audio.volume = Math.max(0, Math.min(1, currentVol));
          if (currentVol >= getTargetVol()) {
            clearInterval(fadeInterval);
          }
        }, stepTime);
      }).catch(err => {
        console.warn('[MusicManager] Reprodução via Audio falhou, usando fallback procedural:', err);
        const ctx = getAudioContext();
        if (ctx) {
          this._playProceduralC418Track(ctx, { name: track.name, key: 'C', bpm: 58, scale: [0, 2, 4, 7, 9, 11, 12] });
        } else {
          this.isPlaying = false;
          this._scheduleNextSong(10000);
        }
      });

      audio.onended = () => {
        this.isPlaying = false;
        this.soundTrackAudio = null;
        this._scheduleNextSong();
      };

      audio.onerror = () => {
        this.isPlaying = false;
        this.soundTrackAudio = null;
        this._scheduleNextSong(15000);
      };
    } catch (e) {
      console.warn('[MusicManager] Erro ao instanciar áudio:', e);
      this.isPlaying = false;
      this._scheduleNextSong(15000);
    }
  }

  _playProceduralC418Track(ctx, songDef) {
    const musicGainNode = getMusicGain();
    if (!musicGainNode) return;

    this.fadeGain = ctx.createGain();
    this.fadeGain.gain.setValueAtTime(0.001, ctx.currentTime);
    this.fadeGain.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 3.0);
    this.fadeGain.connect(musicGainNode);

    const delayNode = ctx.createDelay();
    delayNode.delayTime.value = 0.38;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.45;
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(this.fadeGain);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    filter.connect(this.fadeGain);
    filter.connect(delayNode);

    const rootFreq = 261.63;
    const duration = 60;
    const noteInterval = 1.6;
    const totalNotes = Math.floor(duration / noteInterval);

    this.activeOscillators = [];
    let time = ctx.currentTime + 0.5;

    for (let i = 0; i < totalNotes; i++) {
      const scaleOffset = songDef.scale[Math.floor(Math.random() * songDef.scale.length)];
      const freq = rootFreq * Math.pow(2, scaleOffset / 12);
      this._spawnPianoNote(ctx, filter, freq, time, 2.5);
      time += noteInterval;
    }

    setTimeout(() => {
      this._clearCurrentSong();
      this.isPlaying = false;
      this._scheduleNextSong();
    }, duration * 1000);
  }

  _spawnPianoNote(ctx, destination, freq, startTime, duration) {
    try {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(noteGain);
      noteGain.connect(destination);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);
      this.activeOscillators.push(osc);
    } catch {}
  }

  _clearCurrentSong() {
    if (this.soundTrackAudio) {
      try {
        this.soundTrackAudio.pause();
        this.soundTrackAudio.currentTime = 0;
      } catch {}
      this.soundTrackAudio = null;
    }
    for (const osc of this.activeOscillators) {
      try { osc.stop(); osc.disconnect(); } catch {}
    }
    this.activeOscillators = [];
    if (this.fadeGain) {
      try { this.fadeGain.disconnect(); } catch {}
      this.fadeGain = null;
    }
  }

  updateVolume() {
    const musicVol = (settingsStore.get('user.volumeMusic') ?? 100) / 100;
    const masterVol = (settingsStore.get('user.volumeMaster') ?? 100) / 100;
    const target = Math.max(0, Math.min(1, musicVol * masterVol * 0.75));
    if (this.soundTrackAudio) {
      this.soundTrackAudio.volume = target;
    }
  }
}

export const musicManager = new MusicManager();
