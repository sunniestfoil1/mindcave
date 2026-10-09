import React from "react";
import ModelScene from "./ModelScene";

const URL = "https://media.mindcaveApi.com/files/public/6ac3fe2840f638f998ba590c/1bd37af9c_minecraft_matchlock.glb";

export default function MatchlockViewer() {
  return (
    <div className="max-w-2xl mx-auto">
      <ModelScene url={URL} colorize />
      <p className="mt-2 text-xs text-muted-foreground text-center">
        Arma Matchlock — item segurável pelo jogador (Steve)
      </p>
    </div>
  );
}