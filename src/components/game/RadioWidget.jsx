import React, { useCallback, useEffect, useRef, useState } from "react";
import { musicManager } from "@/game/musicManager";
import { settingsStore } from "@/game/settingsStore";

// Rádio do canto inferior direito: crossfade entre faixas, visualizador de 8 bandas,
// play/pause sem reiniciar a faixa, volume e atalhos Ctrl/Shift + N e R3 do controle.
// Montagem: <RadioWidget /> dentro de Game.jsx, só depois que `hud` existe — antes disso
// o musicManager ainda não foi iniciado pelo engine e o stop() de montagem não pegaria.

// Fonte única do rádio. Formato: { id, title, artist, cover, src }.
// cover vazio renderiza o ícone ♪; preencha com o caminho da capa quando houver.
export const RADIO_PLAYLIST = [
  { id: "calm3", title: "Sweden", artist: "C418", cover: "", src: "/assets/sounds/music/game/calm3.ogg" },
  { id: "hal1", title: "Subwoofer Lullaby", artist: "C418", cover: "", src: "/assets/sounds/music/game/hal1.ogg" },
  { id: "piano2", title: "Wet Hands", artist: "C418", cover: "", src: "/assets/sounds/music/game/piano2.ogg" },
  { id: "piano3", title: "Mice on Venus", artist: "C418", cover: "", src: "/assets/sounds/music/game/piano3.ogg" },
  { id: "calm1", title: "Minecraft", artist: "C418", cover: "", src: "/assets/sounds/music/game/calm1.ogg" },
  { id: "calm2", title: "Clark", artist: "C418", cover: "", src: "/assets/sounds/music/game/calm2.ogg" },
  { id: "hal2", title: "Living Mice", artist: "C418", cover: "", src: "/assets/sounds/music/game/hal2.ogg" },
  { id: "hal3", title: "Haggstrom", artist: "C418", cover: "", src: "/assets/sounds/music/game/hal3.ogg" },
  { id: "hal4", title: "Danny", artist: "C418", cover: "", src: "/assets/sounds/music/game/hal4.ogg" },
  { id: "piano1", title: "Dry Hands", artist: "C418", cover: "", src: "/assets/sounds/music/game/piano1.ogg" },
  { id: "nuance1", title: "Key", artist: "C418", cover: "", src: "/assets/sounds/music/game/nuance1.ogg" },
  { id: "nuance2", title: "Oxygène", artist: "C418", cover: "", src: "/assets/sounds/music/game/nuance2.ogg" },
];

const CROSSFADE_TIME = 0.35;
const DEFAULT_VOLUME = 1;
const BAND_RANGES = [
  [20, 80], [80, 160], [160, 350], [350, 800],
  [800, 1800], [1800, 4000], [4000, 8000], [8000, 12000],
];
const BAND_BOOST = [1.4, 1.3, 1.2, 1.1, 1.0, 1.0, 1.1, 1.2];

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
const wrapIndex = (i, len) => ((i % len) + len) % len;

// Mesmo cálculo do musicManager: música × master, com o fator 0,75 de trilha ambiente.
const musicVolumeFromSettings = () =>
  ((settingsStore.get("user.volumeMusic") ?? 100) / 100) *
  ((settingsStore.get("user.volumeMaster") ?? 100) / 100) *
  0.75;

function createRadioEngine(playlist) {
  let ctx = null;
  let master = null;
  let analyser = null;
  let freqData = null;
  let players = null;
  let active = 0;
  let index = 0;
  let volume = DEFAULT_VOLUME;
  let baseVolume = 0.75;
  let playing = false;
  let crossfadeTimer = null;
  let unlockHandler = null;
  const listeners = new Set();

  const level = () => volume * baseVolume;
  const snapshot = () => ({ index, playing, volume, track: playlist[index] });
  const emit = () => {
    const state = snapshot();
    listeners.forEach((fn) => fn(state));
  };

  function ensureGraph() {
    if (ctx) return true;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor || !playlist.length) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = level();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    players = [0, 1].map(() => {
      const el = new Audio();
      el.preload = "auto";
      el.crossOrigin = "anonymous";
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain);
      gain.connect(master);
      return { el, gain };
    });
    // Navegador cria o AudioContext suspenso: só sai do mudo no primeiro clique/tecla.
    unlockHandler = () => {
      if (ctx.state === "suspended") ctx.resume();
      const p = players[active];
      if (playing && p.el.paused) p.el.play().catch(() => {});
      removeUnlockListener();
    };
    addUnlockListener();
    return true;
  }

  function addUnlockListener() {
    document.addEventListener("pointerdown", unlockHandler);
    document.addEventListener("keydown", unlockHandler);
  }

  function removeUnlockListener() {
    document.removeEventListener("pointerdown", unlockHandler);
    document.removeEventListener("keydown", unlockHandler);
  }

  function ensureSrc(player, trackIndex) {
    const src = playlist[trackIndex].src;
    if (player.el.getAttribute("src") !== src) {
      player.el.src = src;
      player.el.load();
    }
  }

  function hardStopInactive() {
    if (!players) return;
    players.forEach((p, i) => {
      if (i === active) return;
      p.el.pause();
      p.gain.gain.cancelScheduledValues(ctx.currentTime);
      p.gain.gain.value = 0;
    });
  }

  function playImmediate(trackIndex) {
    if (!ensureGraph()) return;
    if (crossfadeTimer) {
      clearTimeout(crossfadeTimer);
      crossfadeTimer = null;
    }
    hardStopInactive();
    index = wrapIndex(trackIndex, playlist.length);
    const p = players[active];
    ensureSrc(p, index);
    p.gain.gain.cancelScheduledValues(ctx.currentTime);
    p.gain.gain.value = level();
    try {
      p.el.currentTime = 0;
    } catch {
      /* faixa ainda não tem metadados de duração */
    }
    p.el.play().catch(() => {});
    playing = true;
    emit();
  }

  function crossfadeTo(trackIndex) {
    if (!ensureGraph()) return;
    if (crossfadeTimer) {
      clearTimeout(crossfadeTimer);
      crossfadeTimer = null;
    }
    hardStopInactive();

    const from = players[active];
    const toIndex = wrapIndex(trackIndex, playlist.length);
    const toSlot = 1 - active;
    const to = players[toSlot];
    ensureSrc(to, toIndex);
    try {
      to.el.currentTime = 0;
    } catch {
      /* faixa ainda não tem metadados de duração */
    }

    const now = ctx.currentTime;
    to.gain.gain.cancelScheduledValues(now);
    to.gain.gain.setValueAtTime(0, now);
    to.gain.gain.linearRampToValueAtTime(level(), now + CROSSFADE_TIME);
    from.gain.gain.cancelScheduledValues(now);
    from.gain.gain.setValueAtTime(from.gain.gain.value, now);
    from.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_TIME);

    to.el.play().catch(() => {});
    active = toSlot;
    index = toIndex;
    playing = true;
    emit();

    crossfadeTimer = setTimeout(() => {
      crossfadeTimer = null;
      from.el.pause();
      from.gain.gain.value = 0;
    }, CROSSFADE_TIME * 1000 + 30);
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      fn(snapshot());
      return () => listeners.delete(fn);
    },
    start() {
      playImmediate(0);
    },
    toggle() {
      if (!ensureGraph()) return;
      const p = players[active];
      if (!p.el.src) {
        playImmediate(index);
        return;
      }
      if (!p.el.paused) {
        p.el.pause();
        playing = false;
      } else {
        playing = true;
        p.el.play().catch(() => {});
      }
      emit();
    },
    next() {
      crossfadeTo(index + 1);
    },
    prev() {
      crossfadeTo(index - 1);
    },
    setVolume(value) {
      volume = clamp(value, 0, 1);
      if (master) master.gain.value = level();
      emit();
    },
    setBaseVolume(value) {
      baseVolume = clamp(value, 0, 1);
      if (master) master.gain.value = level();
    },
    getSpectrum() {
      if (!analyser) return new Array(8).fill(0);
      analyser.getByteFrequencyData(freqData);
      const nyquist = ctx.sampleRate / 2;
      return BAND_RANGES.map(([lo, hi], i) => {
        const from = Math.max(0, Math.floor((lo / nyquist) * freqData.length));
        const to = Math.min(freqData.length - 1, Math.ceil((hi / nyquist) * freqData.length));
        let sum = 0;
        let count = 0;
        for (let k = from; k <= to; k++) {
          sum += freqData[k];
          count++;
        }
        if (!count) return 0;
        return clamp((sum / count / 255) * BAND_BOOST[i], 0, 1);
      });
    },
    dispose() {
      if (crossfadeTimer) clearTimeout(crossfadeTimer);
      crossfadeTimer = null;
      removeUnlockListener();
      unlockHandler = null;
      if (players) players.forEach((p) => p.el.pause());
      if (ctx && ctx.state !== "closed") ctx.close().catch(() => {});
      ctx = null;
      master = null;
      analyser = null;
      freqData = null;
      players = null;
      listeners.clear();
    },
  };
}

function Visualizer({ bandsRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = 38;
    const height = 28;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;

    const draw = () => {
      const { cur, peak } = bandsRef.current;
      g.clearRect(0, 0, width, height);
      const spacing = 2.5;
      const barW = Math.max(2, (width - spacing * 7) / 8);

      for (let i = 0; i < 8; i++) {
        const h = clamp(cur[i], 0.05, 1) * height;
        const x = i * (barW + spacing);
        g.fillStyle = "rgba(0, 191, 255, 0.85)";
        g.fillRect(x, height - h, barW, h);

        const peakY = height - clamp(peak[i], 0.05, 1) * height;
        g.fillStyle = "#66f2ff";
        g.fillRect(x, peakY, barW, 2);
      }
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [bandsRef]);

  return <canvas ref={canvasRef} className="h-7 w-[38px]" aria-hidden />;
}

export default function RadioWidget({ visible = true }) {
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = createRadioEngine(RADIO_PLAYLIST);
  const engine = engineRef.current;

  const [state, setState] = useState({ index: 0, playing: false, volume: DEFAULT_VOLUME });
  const [entered, setEntered] = useState(false);
  const [pop, setPop] = useState(true);
  const lastIndex = useRef(0);
  const bandsRef = useRef({ cur: new Float32Array(8), peak: new Float32Array(8) });
  const gamepadHeld = useRef(false);

  useEffect(() => {
    const unsubscribe = engine.subscribe((next) => {
      if (next.index !== lastIndex.current) {
        lastIndex.current = next.index;
        setPop(false);
        requestAnimationFrame(() => requestAnimationFrame(() => setPop(true)));
      }
      setState(next);
    });
    // O rádio assume a trilha: senão a mixtape ambiente do musicManager toca junto.
    musicManager.stop();
    engine.setBaseVolume(musicVolumeFromSettings());
    const offSettings = settingsStore.subscribe(() => engine.setBaseVolume(musicVolumeFromSettings()));
    engine.start();
    return () => {
      offSettings();
      unsubscribe();
      engine.dispose();
    };
  }, [engine]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== "KeyN") return;
      if (!(e.ctrlKey || e.shiftKey || e.metaKey)) return;
      e.preventDefault();
      engine.next();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine]);

  const lastFrame = useRef(performance.now());
  const frame = useCallback(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrame.current) / 1000);
    lastFrame.current = now;
    const raw = engine.getSpectrum();
    const { cur, peak } = bandsRef.current;
    for (let i = 0; i < 8; i++) {
      const target = raw[i] || 0;
      const ease = target > cur[i] ? 0.55 : 0.18;
      cur[i] += (target - cur[i]) * ease;
      peak[i] = cur[i] > peak[i] ? cur[i] : Math.max(0, peak[i] - dt * 0.85);
    }
  }, [engine]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      frame();
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let pad = null;
      for (let i = 0; i < pads.length; i++) {
        if (pads[i]) {
          pad = pads[i];
          break;
        }
      }
      const r3 = !!(pad && pad.buttons[11] && pad.buttons[11].pressed);
      if (r3 && !gamepadHeld.current) engine.next();
      gamepadHeld.current = r3;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, frame]);

  const track = RADIO_PLAYLIST[state.index] || RADIO_PLAYLIST[0];
  const shown = visible && entered;
  const transform = shown ? "translateX(0)" : "translateX(120%)";
  const opacity = shown ? (pop ? 1 : 0.4) : 0;
  const scale = pop ? "scale(1)" : "scale(0.95)";

  const btn =
    "flex h-[22px] w-[22px] items-center justify-center rounded-[3px] border border-[#1ab3ff]/40 bg-[#122648]/70 text-[10px] leading-none text-white transition-colors hover:border-cyan-300/70 hover:bg-[#1a3560]/90 focus-visible:outline focus-visible:outline-1 focus-visible:outline-cyan-300 active:scale-95";

  return (
    <div
      className={`${shown ? "pointer-events-auto" : "pointer-events-none"} fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)] font-mono select-none`}
      aria-hidden={!shown}
      style={{
        transform,
        opacity,
        width: 331,
        transition: "transform 420ms cubic-bezier(0.33, 1, 0.68, 1), opacity 290ms ease-out",
      }}
      aria-label="Rádio"
    >
      <div
        className="flex items-center gap-[7px] rounded-md border border-cyan-400/45 bg-[#060e1c]/90 py-1 pl-1.5 pr-2 shadow-[0_0_6px_rgba(0,0,0,0.4)]"
        style={{
          transform: scale,
          opacity: pop ? 1 : 0.4,
          transition: "transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 350ms ease-out",
        }}
      >
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-sm bg-[#0a1a2e]">
          <div className="absolute inset-0 flex items-center justify-center text-cyan-400/50 text-lg">♪</div>
          {track.cover && (
            <img src={track.cover} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="truncate text-[13px] font-bold leading-tight text-white">{track.title}</span>
          <span className="truncate text-[11px] leading-tight text-cyan-300/90">{track.artist}</span>
        </div>

        <Visualizer bandsRef={bandsRef} />

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className={btn} onClick={engine.prev} title="Faixa anterior" aria-label="Faixa anterior">
            ⏮
          </button>
          <button
            type="button"
            className={btn}
            onClick={engine.toggle}
            title={state.playing ? "Pausar" : "Tocar"}
            aria-label={state.playing ? "Pausar" : "Tocar"}
          >
            {state.playing ? "⏸" : "▶"}
          </button>
          <button type="button" className={btn} onClick={engine.next} title="Próxima faixa" aria-label="Próxima faixa">
            ⏭
          </button>
          <span className="px-0.5 text-[10px] font-bold text-cyan-400/85" title="Ctrl/Shift + N ou botão R3 do controle">
            R3
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={state.volume}
            onChange={(e) => engine.setVolume(Number(e.target.value))}
            className="h-4 w-11 cursor-pointer accent-cyan-400"
            aria-label="Volume do rádio"
          />
        </div>
      </div>
    </div>
  );
}
