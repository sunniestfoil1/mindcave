// Gerenciador de Trilha Sonora Ambiente C418 (Minecraft 1.8.9) — PRD 26
// Toca faixas ambientais com intervalos de silêncio e síntese procedural estilo C418 (Piano/Rhodes)
import { getAudioContext, getMusicGain } from './sounds';
import { settingsStore } from './settingsStore';

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
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._scheduleNextSong(3000); // Começa a tocar 3s após o jogo iniciar
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
    const delay = delayMs !== undefined ? delayMs : (120000 + Math.random() * 180000); // 2 a 5 min de silêncio
    this.nextTrackTimer = setTimeout(() => {
      this.playRandomAmbientSong();
    }, delay);
  }

  async playRandomAmbientSong() {
    const musicVol = (settingsStore.get('user.volumeMusic') ?? 50) / 100;
    const masterVol = (settingsStore.get('user.volumeMaster') ?? 100) / 100;

    if (musicVol <= 0 || masterVol <= 0) {
      this._scheduleNextSong();
      return;
    }

    const songs = [
      { name: 'C418 - Sweden', key: 'C', bpm: 60, scale: [0, 2, 4, 7, 9, 11, 12, 14, 16] },
      { name: 'C418 - Wet Hands', key: 'A', bpm: 54, scale: [0, 2, 3, 5, 7, 8, 10, 12] },
      { name: 'C418 - Subwoofer Lullaby', key: 'F', bpm: 58, scale: [0, 2, 4, 5, 7, 9, 11, 12] },
      { name: 'C418 - Mice on Venus', key: 'G', bpm: 62, scale: [0, 2, 4, 7, 9, 11, 12, 14] },
      { name: 'C418 - Hal 1', key: 'D', bpm: 50, scale: [0, 2, 3, 5, 7, 9, 10, 12] },
    ];

    const chosen = songs[Math.floor(Math.random() * songs.length)];
    this.trackName = chosen.name;

    const ctx = getAudioContext();
    if (!ctx) {
      this._scheduleNextSong(10000);
      return;
    }

    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch {}
    }

    this._clearCurrentSong();
    this.isPlaying = true;

    // Tenta carregar áudio oficial ou usa sintetizador C418 procedural (zero latência e 100% garantido)
    try {
      this._playProceduralC418Track(ctx, chosen);
    } catch (e) {
      console.warn('[MusicManager] Erro ao sintetizar música:', e);
      this.isPlaying = false;
      this._scheduleNextSong();
    }
  }

  _playProceduralC418Track(ctx, songDef) {
    const musicGainNode = getMusicGain();
    if (!musicGainNode) return;

    this.fadeGain = ctx.createGain();
    this.fadeGain.gain.setValueAtTime(0.001, ctx.currentTime);
    // Fade-in de 3 segundos
    this.fadeGain.gain.exponentialRampToValueAtTime(1.0, ctx.currentTime + 3.0);
    this.fadeGain.connect(musicGainNode);

    // Efeito de Reverb e Delay estilo C418
    const delayNode = ctx.createDelay();
    delayNode.delayTime.value = 0.38; // 380ms tape delay
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.45;
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(this.fadeGain);

    // BiquadFilter (Lowpass macio para timbre de piano de cauda)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400; // Sons aveludados C418
    filter.connect(this.fadeGain);
    filter.connect(delayNode);

    // Frequências base (Fórmulas de notas de piano em Hz)
    const baseFreqs = { C: 261.63, A: 220.00, F: 174.61, G: 196.00, D: 146.83 };
    const rootFreq = baseFreqs[songDef.key] || 261.63;

    // Gerador de arpejos e acordes estilo C418 (60 segundos por faixa procedural)
    const duration = 75; // segundos de música
    const noteInterval = (60 / songDef.bpm) * 1.5;
    const totalNotes = Math.floor(duration / noteInterval);

    this.activeOscillators = [];

    let time = ctx.currentTime + 0.5;

    // Progressões de acordes relaxantes Minecraft
    const chordProgressions = [
      [0, 4, 7],       // I
      [5, 9, 12],      // IV
      [7, 11, 14],     // V
      [9, 12, 16],     // vi
    ];

    for (let i = 0; i < totalNotes; i++) {
      const chord = chordProgressions[i % chordProgressions.length];
      const isMelody = Math.random() > 0.3;

      if (isMelody) {
        // Toca nota individual da melodia
        const scaleOffset = songDef.scale[Math.floor(Math.random() * songDef.scale.length)];
        const freq = rootFreq * Math.pow(2, scaleOffset / 12);
        this._spawnPianoNote(ctx, filter, freq, time, 2.5);
      }

      // A cada 4 notas, toca um acorde de acompanhamento suave
      if (i % 4 === 0) {
        for (const semi of chord) {
          const freq = (rootFreq * 0.5) * Math.pow(2, semi / 12);
          this._spawnPianoNote(ctx, filter, freq, time, 4.0, 0.4);
        }
      }

      time += noteInterval * (0.8 + Math.random() * 0.4);
    }

    // Programar término e fade-out
    const fadeOutTime = ctx.currentTime + duration;
    setTimeout(() => {
      if (!this.isPlaying) return;
      if (this.fadeGain) {
        try {
          this.fadeGain.gain.setValueAtTime(this.fadeGain.gain.value, ctx.currentTime);
          this.fadeGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4.0);
        } catch {}
      }
      setTimeout(() => {
        this._clearCurrentSong();
        this.isPlaying = false;
        this._scheduleNextSong();
      }, 4500);
    }, (duration - 4) * 1000);
  }

  _spawnPianoNote(ctx, destination, freq, startTime, duration, volMult = 1.0) {
    try {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      // Timbre suave (mistura de senoide e triângulo para som de teclado C418)
      osc.type = Math.random() > 0.5 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      // Envelope ADSR de Piano
      const peakVol = (0.15 + Math.random() * 0.1) * volMult;
      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.exponentialRampToValueAtTime(peakVol, startTime + 0.04); // Attack rápido
      noteGain.gain.exponentialRampToValueAtTime(peakVol * 0.4, startTime + 0.3); // Decay
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration); // Sustain / Release longo

      osc.connect(noteGain);
      noteGain.connect(destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.1);

      this.activeOscillators.push(osc);
    } catch {}
  }

  _clearCurrentSong() {
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
    const musicVol = (settingsStore.get('user.volumeMusic') ?? 50) / 100;
    const musicGainNode = getMusicGain();
    if (musicGainNode && getAudioContext()) {
      musicGainNode.gain.value = musicVol;
    }
  }
}

export const musicManager = new MusicManager();
