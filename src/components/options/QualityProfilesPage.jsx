import React from "react";
import SettingsLayout from "./SettingsLayout";
import { useSettings } from "@/game/settingsStore";
import { QUALITY_PROFILES } from "@/game/settingsDefaults";
import { Check } from "lucide-react";

const PROFILE_DESC = {
  minimum: { desc: 'Notebook fraco · 60+ FPS', color: 'border-gray-600' },
  low: { desc: 'PC básico · 60 FPS', color: 'border-green-700' },
  medium: { desc: 'PC médio · 60 FPS', color: 'border-blue-700' },
  high: { desc: 'PC forte · Shaders', color: 'border-purple-700' },
  ultra: { desc: 'PC potente · Tudo no máximo', color: 'border-yellow-600' },
};

export default function QualityProfilesPage({ onBack }) {
  const store = useSettings();
  const current = store.detectProfile();

  return (
    <SettingsLayout title="Perfis de qualidade" onBack={onBack}>
      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(QUALITY_PROFILES).map(([name, p]) => {
            const isCurrent = current === name;
            const desc = PROFILE_DESC[name];
            return (
              <div
                key={name}
                onClick={() => store.applyProfile(name)}
                className={`cursor-pointer border-2 ${desc.color} ${isCurrent ? 'ring-2 ring-primary' : ''} bg-card rounded-lg p-4 hover:scale-[1.02] transition-transform`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold capitalize">{name === 'custom' ? 'Personalizado' : name}</h3>
                  {isCurrent && <Check className="w-5 h-5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{desc.desc}</p>
                <div className="text-xs space-y-0.5 text-foreground/70">
                  <div>Distância: {p.renderDistance} chunks</div>
                  <div>Gráficos: {p.graphics === 'fast' ? 'Rápidos' : 'Detalhados'}</div>
                  <div>Luz suave: {p.smoothLighting === 'off' ? 'Desligada' : p.smoothLighting === 'min' ? 'Mínima' : 'Máxima'}</div>
                  <div>Partículas: {p.particles === 'all' ? 'Todas' : p.particles === 'decreased' ? 'Reduzidas' : 'Mínimas'}</div>
                  <div>Mipmap: {p.mipmaps}</div>
                  <div>Escala res.: {p.resolutionScale}%</div>
                  <div>Shaders: {p.shaderMode === 'shaders' ? 'Ligados' : 'Clássico'}</div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-4">Perfil atual: <span className="font-semibold capitalize">{current === 'custom' ? 'Personalizado' : current}</span>. Mudar uma opção avulsa marca como Personalizado.</p>
      </div>
    </SettingsLayout>
  );
}