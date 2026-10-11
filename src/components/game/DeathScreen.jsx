import React from "react";
import GuiScreen from "@/components/java/GuiScreen";
import GuiButton from "@/components/java/GuiButton";
import { useGui } from "@/components/java/GuiContext";

function DeathScreenContent({ hud, onRespawn, onTitle, isOwner, isHardcore, onDeleteWorld }) {
  const gui = useGui();
  const scale = gui?.scale || 1;
  const guiHeight = gui?.guiHeight || 240;

  // No Java 1.8.9:
  // Título em y = guiHeight / 4 - 16
  // Mensagem e Pontuação no meio
  // Botões em y = guiHeight / 4 + 48 e + 72
  const titleY = Math.max(30, Math.floor(guiHeight / 4) - 20);
  const btnY1 = titleY + 68;
  const btnY2 = btnY1 + 24;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', select: 'none', userSelect: 'none' }}>
      {/* Título com sombra clássica Java 1.8.9 */}
      <div
        style={{
          position: 'absolute',
          top: titleY * scale,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: "'Minecraft', monospace",
          fontSize: `${18 * scale}px`,
          fontWeight: 'bold',
          color: '#FFFFFF',
          textShadow: `${2 * scale}px ${2 * scale}px 0 #500000`,
          letterSpacing: '1px',
        }}
      >
        {isHardcore ? "Fim de jogo!" : "Você morreu!"}
      </div>

      {/* Mensagem de morte (se houver) */}
      {hud.deathMessage && (
        <div
          style={{
            position: 'absolute',
            top: (titleY + 28) * scale,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: "'Minecraft', monospace",
            fontSize: `${9 * scale}px`,
            color: '#E0E0E0',
            textShadow: `${scale}px ${scale}px 0 #3F3F3F`,
          }}
        >
          {hud.deathMessage}
        </div>
      )}

      {/* Pontuação */}
      <div
        style={{
          position: 'absolute',
          top: (titleY + (hud.deathMessage ? 42 : 32)) * scale,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: "'Minecraft', monospace",
          fontSize: `${10 * scale}px`,
          color: '#FFFFFF',
          textShadow: `${scale}px ${scale}px 0 #3F3F3F`,
        }}
      >
        Pontuação: <span style={{ color: '#FFFF55', textShadow: `${scale}px ${scale}px 0 #3F3F00` }}>{hud.xpLevel || 0}</span>
      </div>

      {/* Botões Java 1.8.9 oficiais */}
      {isHardcore ? (
        <>
          <GuiButton
            x={-100}
            y={btnY1}
            width={200}
            label="Espectar o mundo"
            onClick={onRespawn}
          />
          {isOwner && (
            <GuiButton
              x={-100}
              y={btnY2}
              width={200}
              label="Excluir mundo e voltar"
              onClick={onDeleteWorld}
            />
          )}
        </>
      ) : (
        <>
          <GuiButton
            x={-100}
            y={btnY1}
            width={200}
            label="Renascer"
            onClick={onRespawn}
          />
          <GuiButton
            x={-100}
            y={btnY2}
            width={200}
            label="Menu Principal"
            onClick={onTitle}
          />
        </>
      )}
    </div>
  );
}

export default function DeathScreen({ hud, onRespawn, onTitle, isOwner, isHardcore, onDeleteWorld }) {
  if (!hud?.isDead) return null;

  return (
    <GuiScreen background="death">
      <DeathScreenContent
        hud={hud}
        onRespawn={onRespawn}
        onTitle={onTitle}
        isOwner={isOwner}
        isHardcore={isHardcore}
        onDeleteWorld={onDeleteWorld}
      />
    </GuiScreen>
  );
}