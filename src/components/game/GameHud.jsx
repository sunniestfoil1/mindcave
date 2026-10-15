import React, { useState } from "react";
import SurvivalHud from "./SurvivalHud";
import HudBars from "./HudBars";
import PlayerListOverlay from "./PlayerListOverlay";
import ScoreboardSidebar from "./ScoreboardSidebar";
import { GuiScreen, GuiButton, GuiText, useGui } from "@/components/java";
import { voiceChat, VOICE_RANGES, VOICE_TIER_NAMES } from "@/game/net/voiceChat";
import { McText, useGuiScaleValue } from "./GuiSprite";
import { perfMonitor } from "@/game/perfMonitor";
import { useSettings } from "@/game/settingsStore";

const SHADER_NAMES = ['Clássico', 'Shaders'];

function MicImg({ muted, size, style }) {
  return (
    <img
      src={muted ? '/assets/ui/mic-muted.svg' : '/assets/ui/mic.svg'}
      alt=""
      draggable={false}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated', ...style }}
    />
  );
}

function PauseMenuContent({ hud, onPause }) {
  const { guiHeight, scale } = useGui();
  const k = Math.floor(guiHeight / 4) - 16;
  const voice = hud.voiceChat;
  const [voiceError, setVoiceError] = useState('');

  const toggleVoice = async () => {
    setVoiceError('');
    if (voice?.active) {
      voiceChat.stopMicrophone();
      return;
    }
    const stream = await voiceChat.initLocalMicrophone();
    if (!stream) setVoiceError('Não foi possível usar o microfone. Libere a permissão no navegador.');
  };

  const iconClick = async () => {
    if (voice?.active) voiceChat.toggleMute();
    else await toggleVoice();
  };

  const tierText = voice?.speaking
    ? `Falando em tom ${VOICE_TIER_NAMES[voice.tier]}: ouvem até ${VOICE_RANGES[voice.tier]} blocos`
    : `Tom baixo ${VOICE_RANGES[0]} blocos · médio ${VOICE_RANGES[1]} · alto ${VOICE_RANGES[2]}`;

  return (
    <>
      <div style={{ position: 'absolute', left: '50%', top: 40 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Menu do jogo" color="#FFFFFF" shadow scale={scale} />
      </div>
      <GuiButton x={-100} y={k + 24} width={200} label="Voltar ao jogo" onClick={onPause} />
      <GuiButton x={-100} y={k + 48} width={98} label="Bugs & Ideias" onClick={hud.onFeedback} />
      <GuiButton x={2} y={k + 48} width={98} label="Estatísticas" onClick={hud.onStats} />
      <GuiButton x={-100} y={k + 72} width={98} label="Opções..." onClick={hud.onOptions} />
      {hud.onOpenToLAN && <GuiButton x={2} y={k + 72} width={98} label="Abrir para LAN" onClick={hud.onOpenToLAN} />}
      <GuiButton x={-100} y={k + 96} width={200} label="Salvar e sair para o título" onClick={hud.onExit} />
      {voice && (
        <>
          <GuiButton
            x={-100}
            y={k + 124}
            width={200}
            label={voice.active ? 'Desativar Chat de Voz por Aproximação' : 'Ativar Chat de Voz por Aproximação'}
            onClick={toggleVoice}
          />
          <GuiButton
            x={-124}
            y={k + 124}
            width={20}
            title={voice.active ? (voice.muted ? 'Microfone mutado: clique para ligar' : 'Microfone ligado: clique para mutar') : 'Ativar o chat de voz'}
            icon={<MicImg muted={!voice.active || voice.muted} size={12 * scale} />}
            onClick={iconClick}
          />
          <div style={{ position: 'absolute', left: 0, right: 0, top: (k + 148) * scale, display: 'flex', justifyContent: 'center' }}>
            <GuiText
              text={voiceError || (voice.active ? tierText : 'O alcance da voz depende do seu tom: sussurro, fala normal e voz alta')}
              color={voiceError ? '#FF5555' : '#A0A0A0'}
              shadow
              scale={scale}
            />
          </div>
        </>
      )}
    </>
  );
}

function SleepScreenOverlay({ fade }) {
  const { guiHeight } = useGui();
  const wakeUp = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    }, 50);
  };
  return (
    <div
      className="fixed inset-0 z-40 pointer-events-auto"
      style={{ backgroundColor: `rgba(0, 0, 0, ${Math.min(0.85, 0.35 + (fade || 0) * 0.5)})` }}
    >
      <GuiButton x={-100} y={guiHeight - 40} width={200} label="Sair da cama" onClick={wakeUp} />
    </div>
  );
}

function VoiceStatusIcon({ voice }) {
  const S = useGuiScaleValue();
  const tint = voice.muted
    ? 'none'
    : voice.speaking
    ? voice.tier === 0
      ? 'hue-rotate(-20deg)'
      : voice.tier === 2
      ? 'sepia(1) saturate(4)'
      : 'none'
    : 'opacity(0.45)';
  return <MicImg muted={voice.muted} size={9 * S} style={{ filter: tint }} />;
}

function F3Line({ children, S, align = 'left' }) {
  if (!children) return null;
  return (
    <div style={{ display: 'flex', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <span
        style={{
          backgroundColor: 'rgba(80, 80, 80, 0.55)',
          color: '#E0E0E0',
          fontFamily: "'Minecraft', monospace",
          fontSize: `${8 * S}px`,
          lineHeight: `${9 * S}px`,
          padding: `0 ${2 * S}px`,
          textShadow: `${S}px ${S}px 0 #3f3f3f`,
          whiteSpace: 'pre',
        }}
      >
        {children}
      </span>
    </div>
  );
}

export default function GameHud({ hud, onPause }) {
  const S = useGuiScaleValue();
  const store = useSettings();

  if (!hud || hud.hideHud) return null;
  const hideInGameHud = hud.hasGuiOpen || hud.paused;
  const reducedDebug = !!(store.get('user.reducedDebugInfo') || hud.reducedDebugInfo);
  const dispW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const dispH = typeof window !== 'undefined' ? window.innerHeight : 720;

  return (
    <div className="pointer-events-none fixed inset-0 select-none font-mono text-white" style={{ imageRendering: 'pixelated' }}>
      {hud.portalProgress > 0 && (
        <div className="absolute inset-0" style={{ background: 'rgba(110,40,180,0.55)', opacity: hud.portalProgress }} />
      )}

      <div className={`transition-opacity duration-150 ${hideInGameHud ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <SurvivalHud hud={hud} />
        <HudBars hud={hud} />

        {(hud.title || hud.subtitle) && (
          <div className="absolute inset-x-0 top-[22%] flex flex-col items-center gap-2 pointer-events-none">
            {hud.title && (
              <div style={{ position: 'relative', height: 20 * S }}>
                <McText text={hud.title} x={0} y={0} S={S * 2} color="#FFFFFF" shadow align="center" />
              </div>
            )}
            {hud.subtitle && (
              <div style={{ position: 'relative', height: 10 * S }}>
                <McText text={hud.subtitle} x={0} y={0} S={S} color="#E0E0E0" shadow align="center" />
              </div>
            )}
          </div>
        )}
      </div>

      {hud.sleepingStatus && (
        <div style={{ position: 'fixed', left: '50%', bottom: 68 * S, transform: 'translateX(-50%)', zIndex: 20 }}>
          <McText text={hud.sleepingStatus} x={0} y={0} S={S} color="#FFFFFF" shadow align="center" />
        </div>
      )}

      {hud.sleeping && (
        <GuiScreen background="gradient">
          <SleepScreenOverlay fade={hud.sleepFade} />
        </GuiScreen>
      )}

      {hud.inFluid === 'water' && <div className="absolute inset-0 bg-blue-800/35 pointer-events-none" />}
      {hud.inFluid === 'lava' && <div className="absolute inset-0 bg-red-800/60 pointer-events-none" />}

      <div style={{ position: 'absolute', top: 2 * S, left: 2 * S, display: 'flex', alignItems: 'center', gap: 4 * S, zIndex: 30 }}>
        {hud.showFps && !hud.f3 && (
          <div style={{ position: 'relative', height: 9 * S, width: 60 * S }}>
            <McText text={`${hud.fps} fps`} x={0} y={0} S={S} color="#FFFFFF" shadow />
          </div>
        )}
        {hud.voiceChat?.active && !hud.paused && <VoiceStatusIcon voice={hud.voiceChat} />}
      </div>

      {hud.f3 && (
        <div
          style={{
            position: 'absolute',
            left: 2 * S,
            right: 2 * S,
            top: 2 * S,
            display: 'flex',
            justifyContent: 'space-between',
            pointerEvents: 'none',
          }}
        >
          {/* Coluna Esquerda F3 (1.8.9) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: S }}>
            <F3Line S={S}>{`Minecraft 1.8.9 (${hud.build || 'Mind Cave'}/vanilla)`}</F3Line>
            <F3Line S={S}>{`${hud.fps} fps (${hud.chunkUpdates ?? 0} chunk updates) T: ${hud.tps} tps`}</F3Line>
            <F3Line S={S}>{`C: ${hud.chunksLoaded ?? 0} D: ${store.get('device.renderDistance') ?? 8}, E: ${hud.mobCount ?? 0}`}</F3Line>
            <div style={{ height: 4 * S }} />
            {!reducedDebug ? (
              <>
                <F3Line S={S}>{`XYZ: ${hud.xyz}`}</F3Line>
                <F3Line S={S}>{`Block: ${hud.block}`}</F3Line>
                <F3Line S={S}>{`Chunk: ${hud.chunk}`}</F3Line>
                <F3Line S={S}>{`Facing: ${hud.facing} (${hud.yaw}° / ${hud.pitch}°)`}</F3Line>
                <F3Line S={S}>{`Light: ${hud.skyLight + hud.blockLight} (${hud.skyLight} sky, ${hud.blockLight} block)`}</F3Line>
                <F3Line S={S}>{`Biome: ${typeof hud.biome === 'string' ? hud.biome : (hud.biome?.name || 'Plains')}`}</F3Line>
                <F3Line S={S}>{`Local Difficulty: ${hud.difficulty === 'hard' ? '3.50' : hud.difficulty === 'easy' ? '1.50' : '2.25'} (Day ${Math.floor((hud.worldTime || 0) / 24000)})`}</F3Line>
                {hud.targeted && <F3Line S={S}>{`Looking at: ${hud.targeted}`}</F3Line>}
              </>
            ) : (
              <F3Line S={S}>Reduced debug info: true</F3Line>
            )}
          </div>

          {/* Coluna Direita F3 (1.8.9) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: S }}>
            <F3Line S={S} align="right">Java: WebGL2 64bit</F3Line>
            <F3Line S={S} align="right">
              {`Mem: ${Math.round(perfMonitor.getStats().jsHeapMB)}MB / ${Math.round(perfMonitor.getStats().jsHeapTotalMB)}MB`}
            </F3Line>
            <F3Line S={S} align="right">{`GC Longos: ${perfMonitor.getStats().longGcCount}`}</F3Line>
            <div style={{ height: 4 * S }} />
            <F3Line S={S} align="right">{`Display: ${dispW}x${dispH} (WebGL)`}</F3Line>
            <F3Line S={S} align="right">{perfMonitor.gpuRenderer || 'GPU Accelerator'}</F3Line>
            <F3Line S={S} align="right">{`Draw Calls: ${hud.drawCalls ?? 0} · Tri: ${(hud.triangles ?? 0).toLocaleString()}`}</F3Line>
            <F3Line S={S} align="right">{`Shader: ${SHADER_NAMES[hud.shaderMode] || 'Clássico'} · CPS: ${hud.cps ?? 0}`}</F3Line>
          </div>
        </div>
      )}

      {!hud.realTextures && (
        <div style={{ position: 'absolute', top: 4 * S, left: '50%', transform: 'translateX(-50%)' }}>
          <McText text="Carregando texturas..." x={0} y={0} S={S} color="#FFFF55" shadow align="center" />
        </div>
      )}

      <PlayerListOverlay
        visible={hud.playerListOpen}
        worldName={hud.worldName}
        players={hud.pings}
        selfName={hud.selfName}
      />

      <ScoreboardSidebar scoreboard={hud.scoreboard} />

      {hud.paused && !hud.chatOpen && !hud.hasGuiOpen && !hud.isDead && (
        <GuiScreen background="gradient">
          <PauseMenuContent hud={hud} onPause={onPause} />
        </GuiScreen>
      )}
    </div>
  );
}