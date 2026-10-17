import React, { useCallback, useEffect, useRef, useState } from "react";
import { musicManager } from "@/game/musicManager";
import { settingsStore } from "@/game/settingsStore";
import { McText, usePackTexture, useGuiScaleValue } from "./GuiSprite";
import { playClickSound } from "@/game/sounds";
import { radioBus } from "@/game/radioBus";
import { measureMcText } from "@/game/gui/font";

export const RADIO_PLAYLIST = [
  { id: "calm3", title: "Sweden", artist: "C418", disc: "record_cat", src: "/assets/sounds/music/game/calm3.ogg" },
  { id: "hal1", title: "Subwoofer Lullaby", artist: "C418", disc: "record_blocks", src: "/assets/sounds/music/game/hal1.ogg" },
  { id: "piano2", title: "Wet Hands", artist: "C418", disc: "record_chirp", src: "/assets/sounds/music/game/piano2.ogg" },
  { id: "piano3", title: "Mice on Venus", artist: "C418", disc: "record_far", src: "/assets/sounds/music/game/piano3.ogg" },
  { id: "calm1", title: "Minecraft", artist: "C418", disc: "record_mall", src: "/assets/sounds/music/game/calm1.ogg" },
  { id: "calm2", title: "Clark", artist: "C418", disc: "record_mellohi", src: "/assets/sounds/music/game/calm2.ogg" },
  { id: "hal2", title: "Living Mice", artist: "C418", disc: "record_stal", src: "/assets/sounds/music/game/hal2.ogg" },
  { id: "hal3", title: "Haggstrom", artist: "C418", disc: "record_strad", src: "/assets/sounds/music/game/hal3.ogg" },
  { id: "hal4", title: "Danny", artist: "C418", disc: "record_ward", src: "/assets/sounds/music/game/hal4.ogg" },
  { id: "piano1", title: "Dry Hands", artist: "C418", disc: "record_13", src: "/assets/sounds/music/game/piano1.ogg" },
  { id: "nuance1", title: "Key", artist: "C418", disc: "record_wait", src: "/assets/sounds/music/game/nuance1.ogg" },
  { id: "nuance2", title: "Oxygène", artist: "C418", disc: "record_11", src: "/assets/sounds/music/game/nuance2.ogg" },
  // as faixas dos discos de música (as mesmas que tocam no jukebox)
  { id: "r13", title: "13", artist: "C418", disc: "record_13", src: "/assets/sounds/records/13.ogg" },
  { id: "rcat", title: "cat", artist: "C418", disc: "record_cat", src: "/assets/sounds/records/cat.ogg" },
  { id: "rblocks", title: "blocks", artist: "C418", disc: "record_blocks", src: "/assets/sounds/records/blocks.ogg" },
  { id: "rchirp", title: "chirp", artist: "C418", disc: "record_chirp", src: "/assets/sounds/records/chirp.ogg" },
  { id: "rfar", title: "far", artist: "C418", disc: "record_far", src: "/assets/sounds/records/far.ogg" },
  { id: "rmall", title: "mall", artist: "C418", disc: "record_mall", src: "/assets/sounds/records/mall.ogg" },
  { id: "rmellohi", title: "mellohi", artist: "C418", disc: "record_mellohi", src: "/assets/sounds/records/mellohi.ogg" },
  { id: "rstal", title: "stal", artist: "C418", disc: "record_stal", src: "/assets/sounds/records/stal.ogg" },
  { id: "rstrad", title: "strad", artist: "C418", disc: "record_strad", src: "/assets/sounds/records/strad.ogg" },
  { id: "rward", title: "ward", artist: "C418", disc: "record_ward", src: "/assets/sounds/records/ward.ogg" },
  { id: "r11", title: "11", artist: "C418", disc: "record_11", src: "/assets/sounds/records/11.ogg" },
  { id: "rwait", title: "wait", artist: "C418", disc: "record_wait", src: "/assets/sounds/records/wait.ogg" },
  { id: "r5", title: "5", artist: "Samuel Aberg", disc: "record_13", src: "/assets/sounds/records/5.ogg" },
  { id: "rotherside", title: "otherside", artist: "Lena Raine", disc: "record_cat", src: "/assets/sounds/records/otherside.ogg" },
  { id: "rpigstep", title: "Pigstep", artist: "Lena Raine", disc: "record_blocks", src: "/assets/sounds/records/pigstep.ogg" },
];

const CROSSFADE_TIME = 0.35;
const DEFAULT_VOLUME = 1;

// 8 faixas otimizadas especificamente para a curva acústica do piano/ambiente do C418
// (faixas logarítmicas de 40Hz a 10.000Hz com ganho equalizado para todas as 8 barras terem movimento real)
const BAND_RANGES = [
  [40, 140],    // 1. Sub-graves & Graves
  [140, 300],   // 2. Graves médios
  [300, 600],   // 3. Médios baixos (corpo do piano)
  [600, 1100],  // 4. Médios centrais
  [1100, 2000], // 5. Médios agudos (melodia)
  [2000, 3500], // 6. Presença e ataque das notas
  [3500, 6000], // 7. Brilho acústico
  [6000, 10000] // 8. Ar e harmônicos
];
const BAND_BOOST = [1.6, 1.8, 2.0, 2.4, 2.8, 3.5, 4.4, 5.5];

const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
const wrapIndex = (i, len) => ((i % len) + len) % len;

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
  let gameHeld = false;   // o jogo (jukebox perto) abafou o rádio; se o jogador pausar nesse meio tempo, o jogo NÃO religa
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
    try { p.el.currentTime = 0; } catch {}
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
    try { to.el.currentTime = 0; } catch {}
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
    start() { playImmediate(0); },
    toggle() {
      if (!ensureGraph()) return;
      const p = players[active];
      if (!p.el.src) { playImmediate(index); return; }
      if (!p.el.paused) { p.el.pause(); playing = false; }
      else { playing = true; p.el.play().catch(() => {}); }
      emit();
    },
    next() { crossfadeTo(index + 1); },
    prev() { crossfadeTo(index - 1); },
    setVolume(value) {
      volume = clamp(value, 0, 1);
      if (master) master.gain.value = level();
      emit();
    },
    setBaseVolume(value) {
      baseVolume = clamp(value, 0, 1);
      if (master && !gameHeld) master.gain.value = level();
    },
    // O jogo abafa o rádio (jukebox perto): desce a 0 em 1 s e pausa; ao soltar, volta com 1,5 s de subida — só se o jogador não pausou no meio
    duck() {
      if (!ctx || !playing || gameHeld) return;
      gameHeld = true;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 1);
      setTimeout(() => { if (gameHeld && players) players[active].el.pause(); }, 1050);
    },
    unduck() {
      if (!gameHeld) return;
      gameHeld = false;
      if (!ctx || !playing) return;   // o jogador pausou enquanto isso: continua pausado
      const now = ctx.currentTime;
      players[active].el.play().catch(() => {});
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(level(), now + 1.5);
    },
    getSpectrum() {
      if (!analyser) return new Array(8).fill(0);
      analyser.getByteFrequencyData(freqData);
      const nyquist = ctx.sampleRate / 2;
      return BAND_RANGES.map(([lo, hi], i) => {
        const from = Math.max(0, Math.floor((lo / nyquist) * freqData.length));
        const to = Math.min(freqData.length - 1, Math.ceil((hi / nyquist) * freqData.length));
        let sum = 0, count = 0;
        for (let k = from; k <= to; k++) { sum += freqData[k]; count++; }
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
      ctx = null; master = null; analyser = null; freqData = null; players = null;
      listeners.clear();
    },
  };
}

// Visualizador pixelizado em degraus (estilo barra de XP / Noteblock 1.8.9)
function PixelVisualizer({ bandsRef, S }) {
  const canvasRef = useRef(null);
  const w = 26 * S;
  const h = 18 * S;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    g.imageSmoothingEnabled = false;
    let raf = 0;

    const draw = () => {
      const { cur, peak } = bandsRef.current;
      g.fillStyle = "#101010";
      g.fillRect(0, 0, w, h);

      const step = Math.max(1, S);
      const barW = 2 * S;
      const gap = 1 * S;
      const offsetX = 1 * S;

      for (let i = 0; i < 8; i++) {
        const x = offsetX + i * (barW + gap);
        const rawH = clamp(cur[i], 0.06, 1) * (h - 2 * S);
        const snappedH = Math.max(step, Math.floor(rawH / step) * step);
        const y = h - S - snappedH;

        // Sombra escura da barra
        g.fillStyle = "#1E4D0B";
        g.fillRect(x, y, barW, snappedH);
        // Verde clássico de XP do Minecraft 1.8.9
        g.fillStyle = "#80FF20";
        g.fillRect(x, y, barW, Math.max(step, snappedH - step));

        // Pico em dourado (#FFFF55)
        const rawPeak = clamp(peak[i], 0.06, 1) * (h - 2 * S);
        const peakY = h - S - Math.max(step, Math.floor(rawPeak / step) * step);
        g.fillStyle = "#FFFF55";
        g.fillRect(x, peakY, barW, step);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [bandsRef, S, w, h]);

  return (
    <div
      style={{
        width: w,
        height: h,
        boxSizing: "border-box",
        borderTop: `${S}px solid #373737`,
        borderLeft: `${S}px solid #373737`,
        borderRight: `${S}px solid #FFFFFF`,
        borderBottom: `${S}px solid #FFFFFF`,
        imageRendering: "pixelated",
        flexShrink: 0,
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} aria-hidden />
    </div>
  );
}

// Slot clássico com disco centralizado que GIRA quando a música está tocando
function DiscSlot({ discName, playing, S }) {
  const discUrl = usePackTexture(`textures/items/${discName}.png`);
  const slotSize = 20 * S;
  const iconSize = 16 * S;

  return (
    <div
      style={{
        width: slotSize,
        height: slotSize,
        background: "#8B8B8B",
        borderTop: `${S}px solid #373737`,
        borderLeft: `${S}px solid #373737`,
        borderRight: `${S}px solid #FFFFFF`,
        borderBottom: `${S}px solid #FFFFFF`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        flexShrink: 0,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes mcDiscSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {discUrl ? (
        <img
          src={discUrl}
          alt=""
          draggable={false}
          style={{
            width: iconSize,
            height: iconSize,
            imageRendering: "pixelated",
            animation: "mcDiscSpin 4s linear infinite",
            animationPlayState: playing ? "running" : "paused",
            filter: playing ? "none" : "grayscale(0.35) brightness(0.85)",
            display: "block",
            margin: "auto",
          }}
        />
      ) : (
        <div style={{ position: "relative", width: 8 * S, height: 9 * S }}>
          <McText text="♪" x={4} y={0} S={S} color={playing ? "#55FFFF" : "#808080"} shadow align="center" />
        </div>
      )}
    </div>
  );
}

function MarqueeText({ text, S, color, shadow, maxWidthGui = 78 }) {
  const maxW = maxWidthGui * S;
  const textW = measureMcText(text, color, 8 * S);
  const overflow = textW > maxW;
  const stripRef = useRef(null);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return undefined;
    if (!overflow) {
      el.style.transform = 'translate3d(0px, 0, 0)';
      return undefined;
    }
    let raf = 0;
    let start = performance.now();
    const speed = 18 * S;
    const totalDistance = textW + 24 * S;
    const tick = (now) => {
      const elapsed = (now - start) / 1000;
      if (elapsed > 1.5) {
        const travel = (elapsed - 1.5) * speed;
        if (travel >= totalDistance) {
          start = now;
          el.style.transform = 'translate3d(0px, 0, 0)';
        } else {
          el.style.transform = `translate3d(${-Math.round(travel)}px, 0, 0)`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, textW, maxW, overflow, S]);

  return (
    <div style={{ position: "relative", width: maxW, height: 9 * S, overflow: "hidden" }}>
      <div
        ref={stripRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          display: "flex",
          gap: 24 * S,
          willChange: overflow ? "transform" : "auto",
        }}
      >
        <div style={{ position: "relative", width: textW, height: 9 * S }}>
          <McText text={text} x={0} y={0} S={S} color={color} shadow />
        </div>
        {overflow && (
          <div style={{ position: "relative", width: textW, height: 9 * S }}>
            <McText text={text} x={0} y={0} S={S} color={color} shadow />
          </div>
        )}
      </div>
    </div>
  );
}

// Mini-botão estilo GuiButton 1.8.9 usando widgets.png
function McMiniButton({ label, icon, title, onClick, widgetsUrl, S, w = 14, h = 14 }) {
  const [hover, setHover] = useState(false);
  const stateY = hover ? 86 : 66;
  const halfW = Math.floor(w / 2);
  const bgSize = 256 * S;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => {
        playClickSound();
        onClick?.();
      }}
      style={{
        position: "relative",
        width: w * S,
        height: h * S,
        padding: 0,
        border: `${S}px solid #000000`,
        background: "#707070",
        cursor: "pointer",
        flexShrink: 0,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {widgetsUrl && (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: halfW * S,
              height: h * S,
              backgroundImage: `url(${widgetsUrl})`,
              backgroundPosition: `${-1 * S}px ${-(stateY + 2) * S}px`,
              backgroundSize: `${bgSize}px ${bgSize}px`,
              imageRendering: "pixelated",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: (w - halfW) * S,
              height: h * S,
              backgroundImage: `url(${widgetsUrl})`,
              backgroundPosition: `${-(199 - (w - halfW)) * S}px ${-(stateY + 2) * S}px`,
              backgroundSize: `${bgSize}px ${bgSize}px`,
              imageRendering: "pixelated",
            }}
          />
        </>
      )}
      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon ? (
          icon(hover)
        ) : (
          <McText
            text={label}
            x={(w - 2) / 2}
            y={Math.max(1, Math.floor((h - 10) / 2))}
            S={S}
            color={hover ? "#FFFFA0" : "#E0E0E0"}
            shadow
            align="center"
          />
        )}
      </div>
    </button>
  );
}

// Mini-slider de volume estilo JavaSlider 1.8.9 (largura aumentada para 38px para caber 100% com folga)
function McMiniVolume({ value, onChange, widgetsUrl, S }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState(false);
  const w = 38;
  const h = 14;
  const knobW = 6;
  const knobX = Math.round(clamp(value, 0, 1) * (w - knobW - 2));
  const bgSize = 256 * S;

  const updateFromClientX = useCallback(
    (clientX) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const rel = (clientX - rect.left) / S;
      const pct = clamp((rel - knobW / 2) / (w - knobW - 2), 0, 1);
      onChange(Math.round(pct * 20) / 20);
    },
    [S, onChange]
  );

  useEffect(() => {
    if (!dragging) return undefined;
    const onMove = (e) => updateFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, updateFromClientX]);

  return (
    <div
      ref={trackRef}
      title={`Volume: ${Math.round(value * 100)}%`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => {
        e.preventDefault();
        setDragging(true);
        updateFromClientX(e.clientX);
      }}
      style={{
        position: "relative",
        width: w * S,
        height: h * S,
        background: "#000000",
        border: `${S}px solid #000000`,
        cursor: "pointer",
        flexShrink: 0,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Fundo da trilha */}
      {widgetsUrl && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${widgetsUrl})`,
            backgroundPosition: `${-1 * S}px ${-48 * S}px`,
            backgroundSize: `${bgSize}px ${bgSize}px`,
            imageRendering: "pixelated",
          }}
        />
      )}
      {/* Cursor (knob) */}
      <div
        style={{
          position: "absolute",
          left: knobX * S,
          top: 0,
          width: knobW * S,
          height: (h - 2) * S,
          background: hover || dragging ? "#9A9FA8" : "#7E7E7E",
          borderTop: `${S}px solid #FFFFFF`,
          borderLeft: `${S}px solid #FFFFFF`,
          borderRight: `${S}px solid #373737`,
          borderBottom: `${S}px solid #373737`,
          boxSizing: "border-box",
        }}
      />
      <McText
        text={`${Math.round(value * 100)}%`}
        x={(w - 2) / 2}
        y={Math.max(1, Math.floor((h - 10) / 2))}
        S={S}
        color={hover || dragging ? "#FFFFA0" : "#E0E0E0"}
        shadow
        align="center"
      />
    </div>
  );
}

export default function RadioWidget({ visible = true }) {
  const rawS = useGuiScaleValue();
  const S = Math.max(1, Math.min(2, rawS));
  const widgetsUrl = usePackTexture("textures/gui/widgets.png");

  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = createRadioEngine(RADIO_PLAYLIST);
  const engine = engineRef.current;

  const [state, setState] = useState({ index: 0, playing: false, volume: DEFAULT_VOLUME });
  const [entered, setEntered] = useState(false);
  const [flash, setFlash] = useState(false);
  const lastIndex = useRef(0);
  const bandsRef = useRef({ cur: new Float32Array(8), peak: new Float32Array(8) });
  const gamepadHeld = useRef(false);

  useEffect(() => {
    musicManager.disabled = true;
    musicManager.stop();
    const unsubscribe = engine.subscribe((next) => {
      if (next.index !== lastIndex.current) {
        lastIndex.current = next.index;
        setFlash(true);
        setTimeout(() => setFlash(false), 600);
      }
      setState(next);
    });
    engine.setBaseVolume(musicVolumeFromSettings());
    const offSettings = settingsStore.subscribe(() => engine.setBaseVolume(musicVolumeFromSettings()));
    const offBus = radioBus.subscribe((ducked) => (ducked ? engine.duck() : engine.unduck()));
    engine.start();
    return () => {
      offBus();
      musicManager.disabled = false;
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
    const { cur, peak } = bandsRef.current;
    if (!state.playing) {
      for (let i = 0; i < 8; i++) {
        cur[i] *= 0.85;
        peak[i] *= 0.85;
      }
      return;
    }
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrame.current) / 1000);
    lastFrame.current = now;
    const raw = engine.getSpectrum();
    for (let i = 0; i < 8; i++) {
      const target = raw[i] || 0;
      const ease = target > cur[i] ? 0.55 : 0.18;
      cur[i] += (target - cur[i]) * ease;
      peak[i] = cur[i] > peak[i] ? cur[i] : Math.max(0, peak[i] - dt * 0.85);
    }
  }, [engine, state.playing]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      frame();
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let pad = null;
      for (let i = 0; i < pads.length; i++) {
        if (pads[i]) { pad = pads[i]; break; }
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

  return (
    <div
      className={`${shown ? "pointer-events-auto" : "pointer-events-none"} fixed z-50 select-none`}
      aria-hidden={!shown}
      aria-label="Jukebox / Rádio"
      style={{
        right: 6 * S,
        bottom: 6 * S,
        transform: shown ? "translateX(0)" : "translateX(calc(100% + 24px))",
        transition: "transform 280ms steps(8, end)",
        imageRendering: "pixelated",
      }}
    >
      {/* Moldura clássica 1.8.9 com chanfro 3D de píxeis */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4 * S,
          padding: `${3 * S}px ${4 * S}px`,
          background: "#212121",
          outline: `${S}px solid #000000`,
          borderTop: `${2 * S}px solid #555555`,
          borderLeft: `${2 * S}px solid #555555`,
          borderRight: `${2 * S}px solid #121212`,
          borderBottom: `${2 * S}px solid #121212`,
          boxShadow: `0 ${2 * S}px 0 rgba(0,0,0,0.65)`,
        }}
      >
        {/* Slot do Disco de Música da 1.8.9 (Gira durante a reprodução) */}
        <DiscSlot discName={track.disc} playing={state.playing} S={S} />

        {/* Nome da faixa em Marquee/Carrossel + Autor em tamanho reduzido */}
        <div
          style={{
            position: "relative",
            width: 78 * S,
            height: 20 * S,
            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ position: "relative", width: 78 * S, height: 9 * S, overflow: "hidden" }}>
            <MarqueeText
              text={track.title}
              S={S}
              color={flash ? "#55FFFF" : state.playing ? "#FFFF55" : "#A0A0A0"}
              shadow
              maxWidthGui={78}
            />
          </div>
          <div
            style={{
              position: "relative",
              height: 7 * S,
              marginTop: 1 * S,
              transformOrigin: "left center",
              transform: "scale(0.72)",
              imageRendering: "pixelated",
            }}
          >
            <McText
              text={`${track.artist} [R3]`}
              x={0}
              y={0}
              S={S}
              color="#808080"
              shadow
            />
          </div>
        </div>

        {/* Analisador de espectro calibrado para as 8 frequências acústicas */}
        <PixelVisualizer bandsRef={bandsRef} S={S} />

        {/* Controles: Anterior, Play/Pause com ícone nítido, Próximo e Slider 100% sem sobreposição */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 * S }}>
          <McMiniButton label="<" title="Faixa anterior" onClick={engine.prev} widgetsUrl={widgetsUrl} S={S} w={12} h={14} />
          <McMiniButton
            title={state.playing ? "Pausar" : "Tocar"}
            onClick={engine.toggle}
            widgetsUrl={widgetsUrl}
            S={S}
            w={14}
            h={14}
            icon={(hover) => {
              const fillColor = hover ? "#FFFFA0" : "#E0E0E0";
              const shadowColor = "#3F3F3F";
              return state.playing ? (
                <div style={{ display: "flex", gap: 2 * S, position: "relative" }}>
                  <div style={{ width: 2 * S, height: 6 * S, background: fillColor, boxShadow: `${S}px ${S}px 0 ${shadowColor}` }} />
                  <div style={{ width: 2 * S, height: 6 * S, background: fillColor, boxShadow: `${S}px ${S}px 0 ${shadowColor}` }} />
                </div>
              ) : (
                <div style={{ position: "relative", marginLeft: S }}>
                  <div style={{
                    width: 0,
                    height: 0,
                    borderTop: `${3.5 * S}px solid transparent`,
                    borderBottom: `${3.5 * S}px solid transparent`,
                    borderLeft: `${6 * S}px solid ${fillColor}`,
                    filter: `drop-shadow(${S}px ${S}px 0 ${shadowColor})`,
                  }} />
                </div>
              );
            }}
          />
          <McMiniButton label=">" title="Próxima faixa (Ctrl+N / R3)" onClick={engine.next} widgetsUrl={widgetsUrl} S={S} w={12} h={14} />
          <McMiniVolume value={state.volume} onChange={engine.setVolume} widgetsUrl={widgetsUrl} S={S} />
        </div>
      </div>
    </div>
  );
}
