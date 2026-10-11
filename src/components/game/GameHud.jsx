import React from "react";
import SurvivalHud from "./SurvivalHud";
import HudBars from "./HudBars";
import PlayerListOverlay from "./PlayerListOverlay";
import ScoreboardSidebar from "./ScoreboardSidebar";
import { GuiScreen, GuiButton, GuiText, useGui } from "@/components/java";
import { voiceChat } from "@/game/net/voiceChat";
import { perfMonitor } from "@/game/perfMonitor";

const SHADER_NAMES = ['Clássico', 'Shaders'];

function PauseMenuContent({ hud, onPause }) {
  const { guiHeight, scale } = useGui();
  const k = Math.floor(guiHeight / 4) - 16;
  return (
    <>
      {/* Title */}
      <div style={{ position: 'absolute', left: '50%', top: 40 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Menu do jogo" color="#FFFFFF" shadow scale={scale} />
      </div>
      {/* Buttons — RF-025 */}
      <GuiButton x={-100} y={k + 24} width={200} label="Voltar ao jogo" onClick={onPause} />
      <GuiButton x={-100} y={k + 48} width={98} label="Conquistas" disabled />
      <GuiButton x={2} y={k + 48} width={98} label="Estatísticas" onClick={hud.onStats} />
      <GuiButton x={-100} y={k + 96} width={98} label="Opções..." onClick={hud.onOptions} />
      {hud.onOpenToLAN && <GuiButton x={2} y={k + 96} width={98} label="Abrir para LAN" onClick={hud.onOpenToLAN} />}
      <GuiButton x={-100} y={k + 120} width={200} label="Salvar e sair para o título" onClick={hud.onExit} />
    </>
  );
}

export default function GameHud({ hud, onPause }) {
  if (!hud || hud.hideHud) return null;
  return (
    <div className="pointer-events-none fixed inset-0 select-none font-mono text-white">
      <SurvivalHud hud={hud} />
      {/* Overlay de fluido */}
      {hud.inFluid === 'water' && (
        <div className="absolute inset-0 bg-blue-600/20" />
      )}
      {hud.inFluid === 'lava' && (
        <div className="absolute inset-0 bg-red-700/50" />
      )}

      {/* Mira */}
      {!hud.paused && !hud.chatOpen && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="relative w-4 h-4">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[2px] h-4 bg-white/90 shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
            <div className="absolute top-1/2 left-0 -translate-y-1/2 h-[2px] w-4 bg-white/90 shadow-[0_0_2px_rgba(0,0,0,0.9)]" />
          </div>
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

      {/* Status da Trilha Sonora C418 & Voice Chat */}
      <div className="absolute top-2 left-2 flex items-center gap-2 pointer-events-auto z-30">
        {hud.showFps && !hud.f3 && (
          <div className="text-xs text-white/80 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded border border-white/10">
            {hud.fps} fps
          </div>
        )}
        {hud.voiceChat && (
          <button
            onClick={async () => {
              if (!hud.voiceChat.active) {
                await voiceChat.initLocalMicrophone();
              } else {
                voiceChat.toggleMute();
              }
            }}
            className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 font-mono transition-all cursor-pointer ${
              !hud.voiceChat.active
                ? 'bg-stone-800/80 text-stone-300 hover:bg-stone-700 border border-stone-600'
                : hud.voiceChat.muted
                ? 'bg-red-900/70 text-red-200 border border-red-500/30'
                : hud.voiceChat.speaking
                ? 'bg-green-600/80 text-white border border-green-400 animate-pulse'
                : 'bg-emerald-900/60 text-emerald-200 border border-emerald-500/40'
            }`}
            title={!hud.voiceChat.active ? "Clique para solicitar permissão e ativar microfone" : "Clique para alternar o microfone (Mute/Unmute)"}
          >
            {!hud.voiceChat.active
              ? '🎤 Ativar Mic'
              : hud.voiceChat.muted
              ? '🔇 Mic Mutado'
              : hud.voiceChat.speaking
              ? '🎙️ Falando...'
              : '🎤 Mic Ativo'}
          </button>
        )}
        {hud.musicTrack && !hud.f3 && (
          <div className="text-xs text-yellow-300/90 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded border border-yellow-500/20 flex items-center gap-1 animate-fade-in">
            🎶 {hud.musicTrack}
          </div>
        )}
      </div>

      {/* Relógio */}
      <div className="absolute top-2 right-2 text-xs text-white/80 bg-black/30 px-2 py-0.5 rounded">
        🕐 {hud.clock} · {SHADER_NAMES[hud.shaderMode]} [V]
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