import React, { useState, useRef } from "react";
import SettingsLayout from "./SettingsLayout";
import { useSettings } from "@/game/settingsStore";
import { OptionToggle } from "./OptionControls";
import PlayerPreview from "@/components/game/PlayerPreview";
import { getSkinChoice, setSkinChoice, readSkinFile } from "@/game/skinStore";

const PREVIEW = { box: { x: 0, y: 0, w: 52, h: 70 }, feet: { x: 26, y: 67 }, unit: 30, refUp: 50 };

export default function SkinPage({ onBack }) {
  const store = useSettings();
  const parts = store.get('user.skinParts') || {};
  const setPart = (k, v) => store.set(`user.skinParts.${k}`, v);
  const [choice, setChoice] = useState(getSkinChoice());
  const [error, setError] = useState('');
  const [rev, setRev] = useState(0);
  const fileRef = useRef(null);
  const pick = (c) => { setChoice(c); setSkinChoice(c); setError(''); setRev(r => r + 1); };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    try { pick({ kind: 'custom', png: await readSkinFile(file) }); } catch (err) { setError(err.message); }
  };

  return (
    <SettingsLayout title="Personalização de skin" onBack={onBack}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Skin</h2>
          <div className="flex items-start gap-4">
            <div className="relative bg-black border-2 border-[#373737]" style={{ width: 52 * 3, height: 70 * 3 }}>
              <PlayerPreview key={rev} S={3} preset={PREVIEW} />
            </div>
            <div className="flex-1 space-y-2">
              {[['steve', 'Steve'], ['alex', 'Alex (braço fino)']].map(([k, label]) => (
                <button key={k} onClick={() => pick({ kind: k })}
                  className={`w-full px-3 py-1.5 text-sm rounded border ${choice.kind === k ? 'border-emerald-400 bg-emerald-500/10' : 'border-border bg-input'}`}>{label}</button>
              ))}
              <button onClick={() => fileRef.current?.click()}
                className={`w-full px-3 py-1.5 text-sm rounded border ${choice.kind === 'custom' ? 'border-emerald-400 bg-emerald-500/10' : 'border-border bg-input'}`}>Enviar skin (PNG 64×64)</button>
              <input ref={fileRef} type="file" accept="image/png" onChange={onFile} className="hidden" />
              {error && <p className="text-xs text-red-400">{error}</p>}
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