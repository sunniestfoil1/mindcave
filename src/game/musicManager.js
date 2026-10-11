// Gerenciador de Trilha Sonora Ambiente C418 (Minecraft 1.8.9) — PRD 26
// Toca as faixas originais autênticas de C418 (Sweden, Subwoofer Lullaby, Wet Hands, Mice on Venus, etc.)
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
  { name: 'C418 - Biome Fest', file: '/assets/sounds/music/game/creative/creative1.ogg', creative: true },
  { name: 'C418 - Blind Spots', file: '/assets/sounds/music/game/creative/creative2.ogg', creative: true },
  { name: 'C418 - Haunt Muskie', file: '/assets/sounds/music/game/creative/creative3.ogg', creative: true },
  { name: 'C418 - Aria Math', file: '/assets/sounds/music/game/creative/creative4.ogg', creative: true },
  { name: 'C418 - Dreiton', file: '/assets/sounds/music/game/creative/creative5.ogg', creative: true },
  { name: 'C418 - Taswell', file: '/assets/sounds/music/game/creative/creative6.ogg', creative: true },
];
// As pastas music/game/* de outras compositoras (Lena Raine etc.) são de versões novas e não entram: só as 18 faixas da 1.8.9.

// Sacola embaralhada: nenhuma faixa repete antes de todas do pool tocarem; o fim da sacola reembaralha (loop infinito)
let bag = [];
let lastFile = null;
function nextFromBag(creativeMode) {
  if (!bag.length) {
    const pool = REAL_C418_TRACKS.filter(t => creativeMode || !t.creative);
    bag = pool.slice();
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    if (bag.length > 1 && bag[bag.length - 1].file === lastFile) bag.unshift(bag.pop()); // a próxima (fim do array) não repete a última tocada
  }
  const t = bag.pop();
  lastFile = t.file;
  return t;
}

class MusicManager {
  constructor() {
    this.currentTrack = null;
    this.isPlaying = false;
    this.nextTrackTimer = null;
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

    this.playTrack(nextFromBag(!!this.creativeMode));
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
        // Sem som sintético: se o navegador bloqueou o autoplay, a mesma faixa toca no primeiro clique/tecla
        this.soundTrackAudio = null;
        this.isPlaying = false;
        if (err && err.name === 'NotAllowedError') {
          const retry = () => {
            window.removeEventListener('pointerdown', retry);
            window.removeEventListener('keydown', retry);
            if (!this._started || this.isPlaying) return;
            this.playTrack(track);
          };
          window.addEventListener('pointerdown', retry, { once: true });
          window.addEventListener('keydown', retry, { once: true });
        } else {
          this._scheduleNextSong(15000);
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

  _clearCurrentSong() {
    if (this.soundTrackAudio) {
      try {
        this.soundTrackAudio.pause();
        this.soundTrackAudio.currentTime = 0;
      } catch {}
      this.soundTrackAudio = null;
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
