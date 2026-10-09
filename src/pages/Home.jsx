import React, { useState } from "react";
import ItemRigBrowser from "@/components/game/ItemRigBrowser";
import AssetsVoxelBrowser from "@/components/game/AssetsVoxelBrowser";
import MatchlockViewer from "@/components/game/MatchlockViewer";

export default function Home() {
  const [tab, setTab] = useState("itemRig");

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
            Itens Minecraft — Visualizador 3D
          </h1>
          <p className="text-sm text-muted-foreground">
            Componentes separados por nome e categoria. Clique em um item para visualizá-lo em 3D.
            Arraste para girar, scroll para zoom.
          </p>
        </div>

        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setTab("itemRig")}
            className={
              "px-4 py-2 rounded-md text-sm font-medium transition-colors " +
              (tab === "itemRig" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent")
            }
          >
            Minecraft Item Rig
          </button>
          <button
            onClick={() => setTab("assetsVoxel")}
            className={
              "px-4 py-2 rounded-md text-sm font-medium transition-colors " +
              (tab === "assetsVoxel" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent")
            }
          >
            Minecraft Assets Voxel
          </button>
          <button
            onClick={() => setTab("matchlock")}
            className={
              "px-4 py-2 rounded-md text-sm font-medium transition-colors " +
              (tab === "matchlock" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent")
            }
          >
            Arma (Matchlock)
          </button>
        </div>

        {tab === "itemRig" ? <ItemRigBrowser /> : tab === "assetsVoxel" ? <AssetsVoxelBrowser /> : <MatchlockViewer />}
      </div>
    </div>
  );
}