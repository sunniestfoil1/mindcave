import React from "react";

export default function DeathScreen({ hud, onRespawn, onTitle, isOwner, isHardcore, onDeleteWorld }) {
  if (!hud?.isDead) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-950/70 backdrop-blur-sm">
      <div className="text-center text-white px-8">
        <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: "monospace" }}>
          {isHardcore ? "Fim de jogo!" : "Você morreu!"}
        </h1>
        {hud.deathMessage && (
          <p className="text-red-200 text-sm mb-1">{hud.deathMessage}</p>
        )}
        <p className="text-white/60 text-xs mb-6">
          Pontuação: <span className="text-emerald-400 font-bold">{hud.xpLevel}</span>
        </p>
        {isHardcore ? (
          <div className="space-y-2 max-w-xs mx-auto">
            <button
              onClick={onRespawn}
              className="w-full px-6 py-2.5 bg-yellow-600 hover:bg-yellow-500 rounded font-semibold text-sm"
            >
              Espectar o mundo
            </button>
            {isOwner && (
              <button
                onClick={onDeleteWorld}
                className="w-full px-6 py-2.5 bg-red-700 hover:bg-red-600 rounded font-semibold text-sm"
              >
                Excluir mundo e voltar
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-w-xs mx-auto">
            <button
              onClick={onRespawn}
              className="w-full px-6 py-2.5 bg-green-600 hover:bg-green-500 rounded font-semibold text-sm"
            >
              Renascer
            </button>
            <button
              onClick={onTitle}
              className="w-full px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded font-semibold text-sm"
            >
              Tela de título
            </button>
          </div>
        )}
      </div>
    </div>
  );
}