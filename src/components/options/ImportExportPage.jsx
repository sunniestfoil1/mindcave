import React, { useState, useRef } from "react";
import SettingsLayout from "./SettingsLayout";
import { useSettings } from "@/game/settingsStore";
import { Download, Upload, Check } from "lucide-react";

export default function ImportExportPage({ onBack }) {
  const store = useSettings();
  const [importText, setImportText] = useState('');
  const [diff, setDiff] = useState(null);
  const [applyUser, setApplyUser] = useState(true);
  const [applyDevice, setApplyDevice] = useState(true);
  const [applied, setApplied] = useState(false);
  const fileRef = useRef(null);

  const handleExport = () => {
    const blob = new Blob([store.exportSettings()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'mindcave-settings.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      setImportText(text);
      try {
        const parsed = JSON.parse(text);
        const d = { user: [], device: [] };
        if (parsed.user) for (const k of Object.keys(parsed.user)) {
          if (JSON.stringify(store.get('user.' + k)) !== JSON.stringify(parsed.user[k])) d.user.push(k);
        }
        if (parsed.device) for (const k of Object.keys(parsed.device)) {
          if (JSON.stringify(store.get('device.' + k)) !== JSON.stringify(parsed.device[k])) d.device.push(k);
        }
        setDiff(d);
        setApplied(false);
      } catch { setDiff({ error: 'JSON inválido' }); }
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    try {
      store.importSettings(importText, { user: applyUser, device: applyDevice });
      setApplied(true);
    } catch (e) { setDiff({ error: e.message }); }
  };

  return (
    <SettingsLayout title="Importar / Exportar configurações" onBack={onBack}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">Exportar</h2>
          <p className="text-xs text-muted-foreground mb-3">Exporta todas as configurações (usuário + dispositivo + teclas) para um arquivo JSON.</p>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm">
            <Download className="w-4 h-4" /> Baixar configurações
          </button>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-2">Importar</h2>
          <input ref={fileRef} type="file" accept=".json" onChange={handleFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded text-sm mb-3">
            <Upload className="w-4 h-4" /> Escolher arquivo
          </button>

          {diff && !diff.error && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">{diff.user.length + diff.device.length} diferenças encontradas:</div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={applyUser} onChange={e => setApplyUser(e.target.checked)} />
                  Aplicar usuário ({diff.user.length})
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={applyDevice} onChange={e => setApplyDevice(e.target.checked)} />
                  Aplicar dispositivo ({diff.device.length})
                </label>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Ver diferenças</summary>
                <div className="mt-2 space-y-1">
                  {diff.user.map(k => <div key={'u'+k} className="text-yellow-500">user.{k}</div>)}
                  {diff.device.map(k => <div key={'d'+k} className="text-blue-500">device.{k}</div>)}
                </div>
              </details>
              <button onClick={handleApply} className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm">
                Aplicar selecionadas
              </button>
            </div>
          )}
          {diff?.error && <p className="text-red-500 text-sm">{diff.error}</p>}
          {applied && <p className="text-green-500 text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Configurações aplicadas!</p>}
        </div>
      </div>
    </SettingsLayout>
  );
}