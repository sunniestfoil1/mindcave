import React, { useState } from "react";
import SurvivalHud from "./SurvivalHud";
import HudBars from "./HudBars";
import PlayerListOverlay from "./PlayerListOverlay";
import ScoreboardSidebar from "./ScoreboardSidebar";
import { GuiScreen, GuiButton, GuiText, useGui } from "@/components/java";
import { voiceChat, VOICE_RANGES, VOICE_TIER_NAMES } from "@/game/net/voiceChat";
import { useGuiScaleValue } from "./GuiSprite";
import { perfMonitor } from "@/game/perfMonitor";

const SHADER_NAMES = ['Clássico', 'Shaders'];

// Ícone de microfone (pixel art) do chat de voz: cortado e vermelho quando está desligado ou mutado
function MicImg({ muted, size, style }) {
  return <img src={muted ? '/assets/ui/mic-muted.svg' : '/assets/ui/mic.svg'} alt="" draggable={false} width={size} height={size} style={{ imageRendering: 'pixelated', ...style }} />;
}

function PauseMenuContent({ hud, onPause }) {
  const { guiHeight, scale } = useGui();
  const k = Math.floor(guiHeight / 4) - 16;
  const voice = hud.voiceChat;
  const [voiceError, setVoiceError] = useState('');
  const toggleVoice = async () => {
    setVoiceError('');
    if (voice?.active) { voiceChat.stopMicrophone(); return; }
    const stream = await voiceChat.initLocalMicrophone();
    if (!stream) setVoiceError('Não foi possível usar o microfone. Libere a permissão no navegador.');
  };
  const iconClick = async () => { if (voice?.active) voiceChat.toggleMute(); else await toggleVoice(); };
  const tierText = voice?.speaking
    ? `Falando em tom ${VOICE_TIER_NAMES[voice.tier]}: ouvem até ${VOICE_RANGES[voice.tier]} blocos`
    : `Tom baixo ${VOICE_RANGES[0]} blocos · médio ${VOICE_RANGES[1]} · alto ${VOICE_RANGES[2]}`;
  return (
    <>
      {/* Title */}
      <div style={{ position: 'absolute', left: '50%', top: 40 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Menu do jogo" color="#FFFFFF" shadow scale={scale} />
      </div>
      {/* Buttons — RF-025 */}
      <GuiButton x={-100} y={k + 24} width={200} label="Voltar ao jogo" onClick={onPause} />
      <GuiButton x={-100} y={k + 48} width={98} label="Bugs & Ideias" onClick={hud.onFeedback} />
      <GuiButton x={2} y={k + 48} width={98} label="Estatísticas" onClick={hud.onStats} />
      <GuiButton x={-100} y={k + 72} width={98} label="Opções..." onClick={hud.onOptions} />
      {hud.onOpenToLAN && <GuiButton x={2} y={k + 72} width={98} label="Abrir para LAN" onClick={hud.onOpenToLAN} />}
      <GuiButton x={-100} y={k + 96} width={200} label="Salvar e sair para o título" onClick={hud.onExit} />
      {/* Chat de voz por aproximação: botão de ligar/desligar e, ao lado, o ícone do microfone (mutar) */}
      {voice && (
        <>
          <GuiButton x={-100} y={k + 124} width={200}
            label={voice.active ? 'Desativar Chat de Voz por Aproximação' : 'Ativar Chat de Voz por Aproximação'}
            onClick={toggleVoice} />
          <GuiButton x={-124} y={k + 124} width={20} title={voice.active ? (voice.muted ? 'Microfone mutado: clique para ligar' : 'Microfone ligado: clique para mutar') : 'Ativar o chat de voz'}
            icon={<MicImg muted={!voice.active || voice.muted} size={12 * scale} />} onClick={iconClick} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: (k + 148) * scale, display: 'flex', justifyContent: 'center' }}>
            <GuiText text={voiceError || (voice.active ? tierText : 'O alcance da voz depende do seu tom: sussurro, fala normal e voz alta')}
              color={voiceError ? '#FF5555' : '#A0A0A0'} shadow scale={scale} />
          </div>
        </>
      )}
    </>
  );
}

// Indicador discreto do próprio microfone enquanto joga (o botão de ligar/desligar fica só no menu de pausa)
function VoiceStatusIcon({ voice }) {
  const S = useGuiScaleValue();
  const tint = voice.muted ? 'none' : voice.speaking ? (voice.tier === 0 ? 'hue-rotate(-20deg)' : voice.tier === 2 ? 'sepia(1) saturate(4)' : 'none') : 'opacity(0.45)';
  return <MicImg muted={voice.muted} size={9 * S} style={{ filter: tint }} />;
}

export default function GameHud({ hud, onPause }) {
  if (!hud || hud.hideHud) return null;
  const hideInGameHud = hud.hasGuiOpen || hud.paused;
  return (
    <div className="pointer-events-none fixed inset-0 select-none font-mono text-white">
      {hud.portalProgress > 0 && <div className="absolute inset-0" style={{ background: 'rgba(110,40,180,0.55)', opacity: hud.portalProgress }} />}
      {/* Camada do HUD de jogo: Transição suave de opacidade (100% jogando, 0% ao abrir GUI) */}
      <div className={`transition-opacity duration-150 ${hideInGameHud ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <SurvivalHud hud={hud} />
        {/* A mira em si é desenhada pelo engine (src/game/crosshair.js); aqui ficam só os indicadores ao redor dela */}
        {!hud.paused && !hud.chatOpen && (hud.blocking || (hud.bowDrawing && hud.bowCharge > 0)) && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            {/* Indicador de bloqueio com espada */}
            {hud.blocking && (
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-lg">🛡️</div>
            )}
            {/* Barra de carga do arco */}
            {hud.bowDrawing && hud.bowCharge > 0 && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-16 h-1 bg-black/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/80 transition-all"
                  style={{ width: `${hud.bowCharge * 100}%` }}
                />
              </div>
            )}
          </div>
        )}
        {/* Hotbar, vida, fome, armadura e XP com a textura oficial */}
        <HudBars hud={hud} />
        {/* Título / Subtítulo de tela (/title) */}
        {(hud.title || hud.subtitle) && (
          <div className="absolute inset-x-0 top-[16%] flex flex-col items-center gap-1 pointer-events-none">
            {hud.title && (
              <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] text-center px-4">
                {hud.title}
              </div>
            )}
            {hud.subtitle && (
              <div className="text-lg sm:text-xl text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] text-center px-4">
                {hud.subtitle}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mensagem de Sono Multiplayer (1/4 jogadores dormindo, durma para amanhecer) */}
      {hud.sleepingStatus && (
        <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-black/60 px-3 py-1 rounded text-sm text-yellow-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] animate-fade-in font-mono border border-yellow-500/30">
            {hud.sleepingStatus}
          </div>
        </div>
      )}

      {/* Tela de Dormir (Fade out escuro e dica de acordar) */}
      {hud.sleeping && (
        <div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center pointer-events-none transition-colors duration-300"
          style={{ backgroundColor: `rgba(0, 0, 0, ${Math.min(0.92, 0.4 + (hud.sleepFade || 0) * 0.52)})` }}
        >
          <div className="text-center space-y-3 pointer-events-auto">
            <div className="text-xl text-white font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              Você está dormindo...
            </div>
            <div className="text-sm text-white/75 bg-black/50 px-4 py-1.5 rounded-full border border-white/10">
              Pressione <kbd className="px-2 py-0.5 bg-white/20 rounded text-white font-mono font-bold">Espaço</kbd> para sair da cama
            </div>
          </div>
        </div>
      )}

      {/* Overlay de fluido */}
      {hud.inFluid === 'water' && (
        <div className="absolute inset-0 bg-blue-600/20" />
      )}
      {hud.inFluid === 'lava' && (
        <div className="absolute inset-0 bg-red-700/50" />
      )}

      {/* Status da Trilha Sonora C418 & Voice Chat */}
      <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-auto z-30">
        {hud.showFps && !hud.f3 && (
          <div className="text-xs text-white/80 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded border border-white/10">
            {hud.fps} fps
          </div>
        )}
        {hud.voiceChat?.active && !hud.paused && <VoiceStatusIcon voice={hud.voiceChat} />}
        {hud.musicTrack && !hud.f3 && (
          <div className="text-xs text-yellow-300/90 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded border border-yellow-500/20 flex items-center gap-1 animate-fade-in">
            🎶 {hud.musicTrack}
          </div>
        )}
      </div>

      {/* F3 Screen - Authentic Minecraft 1.8.9 Layout */}
      {hud.f3 && (
        <div className="absolute inset-x-2 top-2 flex justify-between pointer-events-none text-xs font-mono text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
          {/* Left Column */}
          <div className="bg-black/40 p-2 rounded max-w-[45vw] space-y-0.5">
            <div className="font-bold text-yellow-300">Minecraft 1.8.9 (Mind Cave {hud.build})</div>
            <div>{hud.fps} fps ({hud.tps} tps)</div>
            <div className="h-1" />
            <div>XYZ: {hud.xyz}</div>
            <div>Block: {hud.block}</div>
            <div>Chunk: {hud.chunk}</div>
            <div>Facing: {hud.facing} (Yaw: {hud.yaw}° / Pitch: {hud.pitch}°)</div>
            <div>Light: {hud.skyLight} sky, {hud.blockLight} block</div>
            <div>Biome: {typeof hud.biome === 'string' ? hud.biome : (hud.biome?.name || 'Planícies')}</div>
            <div>Local Difficulty: {hud.difficulty === 'hard' ? '3.50' : hud.difficulty === 'easy' ? '1.50' : '2.25'} (Day {Math.floor(hud.worldTime / 24000)})</div>
            <div>Looking at: {hud.targeted}</div>
          </div>

          {/* Right Column (Hardware & Engine Metrics) */}
          <div className="bg-black/40 p-2 rounded text-right max-w-[45vw] space-y-0.5">
            <div className="font-bold text-green-400">Java: WebGL2 64bit</div>
            <div>Mem: {Math.round(perfMonitor.getStats().jsHeapMB)}MB / {Math.round(perfMonitor.getStats().jsHeapTotalMB)}MB</div>
            <div>GC Longos: {perfMonitor.getStats().longGcCount}</div>
            <div className="h-1" />
            <div>Display: 1280x720 ({perfMonitor.gpuRenderer || 'GPU Accelerator'})</div>
            <div>Draw Calls: {hud.drawCalls ?? 0} · Triângulos: {(hud.triangles ?? 0).toLocaleString()}</div>
            <div>Chunks: {hud.chunksLoaded ?? 0} em memória · {hud.meshQueueSize ?? 0} na fila de malha</div>
            <div>Entidades / Mobs: {hud.mobCount ?? 0} ativos</div>
            <div>Shader: {SHADER_NAMES[hud.shaderMode]} · CPS: {hud.cps}</div>
          </div>
        </div>
      )}

      {/* Prompt de comando */}
      {hud.chatOpen && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 w-96 max-w-[80vw]">
          <div className="bg-black/70 rounded px-3 py-1.5 text-sm text-white/90">
            <span className="text-white/50">Digite um comando (Enter=enviar, Esc=fechar):</span>
          </div>
        </div>
      )}

      {/* Indicador de texturas carregando */}
      {!hud.realTextures && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-yellow-400/80 bg-black/40 px-2 py-0.5 rounded-full flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 border border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
          Carregando texturas…
        </div>
      )}

      {/* Indicadores F3 (PRD 12 RF-041) */}
      {hud.showHitboxes && !hud.paused && (
        <div className="absolute top-10 right-2 text-xs text-red-400 bg-black/50 px-2 py-0.5 rounded">Hitboxes ON (F3+B)</div>
      )}
      {hud.showChunkBorders && !hud.paused && (
        <div className="absolute top-10 right-2 text-xs text-yellow-400 bg-black/50 px-2 py-0.5 rounded">Bordas de Chunk ON (F3+G)</div>
      )}

      {/* TAB Player List Overlay */}
      <PlayerListOverlay
        visible={hud.playerListOpen}
        worldName={hud.worldName}
        players={hud.pings}
        selfName={hud.selfName}
      />

      {/* Scoreboard Sidebar */}
      <ScoreboardSidebar scoreboard={hud.scoreboard} />

      {/* Pausa — Java 1.8.9 style (PRD 19 RF-025) */}
      {hud.paused && !hud.chatOpen && !hud.hasGuiOpen && !hud.isDead && (
        <GuiScreen background="gradient">
          <PauseMenuContent hud={hud} onPause={onPause} />
        </GuiScreen>
      )}
    </div>
  );
}