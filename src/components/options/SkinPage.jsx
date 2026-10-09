import React from "react";
import SettingsLayout from "./SettingsLayout";
import { useSettings } from "@/game/settingsStore";
import { OptionToggle } from "./OptionControls";

const SKINS = ['explorador', 'guerreiro', 'mineiro', 'arqueiro', 'alquimista'];

export default function SkinPage({ onBack }) {
  const store = useSettings();
  const parts = store.get('user.skinParts') || {};
  const setPart = (k, v) => store.set(`user.skinParts.${k}`, v);

  return (
    <SettingsLayout title="Personalização de skin" onBack={onBack}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Skin</h2>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 bg-gradient-to-b from-amber-700 to-amber-900 rounded-lg flex items-center justify-center text-4xl">
              🧍
            </div>
            <div className="flex-1 space-y-2">
              <select
                value={store.get('user.skin')} onChange={e => store.set('user.skin', e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-input border border-border rounded"
              >
                {SKINS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <select
                value={store.get('user.armModel')} onChange={e => store.set('user.armModel', e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-input border border-border rounded"
              >
                <option value="classic">Modelo de braço: Clássico (4px)</option>
                <option value="slim">Modelo de braço: Fino (3px)</option>
              </select>
              <select
                value={store.get('user.cape')} onChange={e => store.set('user.cape', e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-input border border-border rounded"
              >
                <option value="none">Capa: Nenhuma</option>
                <option value="classic">Capa: Clássica</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Partes visíveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { key: 'cape', label: 'Capa' }, { key: 'jacket', label: 'Jaqueta' },
              { key: 'sleeveL', label: 'Manga esquerda' }, { key: 'sleeveR', label: 'Manga direita' },
              { key: 'pantsL', label: 'Calça esquerda' }, { key: 'pantsR', label: 'Calça direita' },
              { key: 'hat', label: 'Chapéu' },
            ].map(p => (
              <OptionToggle key={p.key} label={p.label} value={!!parts[p.key]} onChange={v => setPart(p.key, v)} perfImpact="none" />
            ))}
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}