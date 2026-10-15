import React, { useState, useRef } from "react";
import { GuiScreen, GuiButton, GuiText, JavaButton, useGui } from "@/components/java";
import { useSettings } from "@/game/settingsStore";
import { exportOptionsTxt, parseOptionsTxt } from "@/game/optionsTxt";
import { useT } from "@/game/i18n";

function ImportExportContent({ onBack }) {
  const { guiHeight, scale } = useGui();
  const t = useT();
  const store = useSettings();

  const [importText, setImportText] = useState('');
  const [diff, setDiff] = useState(null);
  const [applyUser, setApplyUser] = useState(true);
  const [applyDevice, setApplyDevice] = useState(true);
  const [applied, setApplied] = useState(false);
  const fileRef = useRef(null);

  // options.txt (Minecraft 1.8.9)
  const [txtDiff, setTxtDiff] = useState(null);
  const [txtApplied, setTxtApplied] = useState(false);
  const [txtError, setTxtError] = useState('');
  const [txtNote, setTxtNote] = useState('');
  const txtFileRef = useRef(null);
  const get = (p) => store.get(p);

  const handleTxtExport = () => {
    const { text, skipped } = exportOptionsTxt(get);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'options.txt';
    a.click();
    URL.revokeObjectURL(url);
    setTxtError('');
    setTxtNote(skipped.length ? `${skipped.length} opções só existem no Mind Cave e ficaram de fora do arquivo.` : '');
  };

  const readTxt = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const r = parseOptionsTxt(reader.result, get);
        setTxtDiff(r);
        setTxtApplied(false);
        setTxtNote('');
        setTxtError(r.changes.length ? '' : 'Nenhuma diferença em relação às configurações atuais.');
      } catch (e) {
        setTxtError(e.message);
      }
    };
    reader.readAsText(file);
  };

  const handleTxtFile = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) readTxt(file);
  };

  const handleTxtApply = () => {
    if (!txtDiff) return;
    for (const c of txtDiff.changes) store.set(c.path, c.to);
    setTxtApplied(true);
  };

  const handleExport = () => {
    const blob = new Blob([store.exportSettings()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mindcave-settings.json';
    a.click();
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
        if (parsed.user) {
          for (const k of Object.keys(parsed.user)) {
            if (JSON.stringify(store.get('user.' + k)) !== JSON.stringify(parsed.user[k])) d.user.push(k);
          }
        }
        if (parsed.device) {
          for (const k of Object.keys(parsed.device)) {
            if (JSON.stringify(store.get('device.' + k)) !== JSON.stringify(parsed.device[k])) d.device.push(k);
          }
        }
        setDiff(d);
        setApplied(false);
      } catch {
        setDiff({ error: 'JSON inválido' });
      }
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    try {
      store.importSettings(importText, { user: applyUser, device: applyDevice });
      setApplied(true);
    } catch (e) {
      setDiff({ error: e.message });
    }
  };

  return (
    <>
      {/* Título */}
      <div style={{ position: 'absolute', left: '50%', top: 8 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Importar / Exportar Opções" color="#FFFFFF" shadow scale={scale} />
      </div>

      {/* Painel rolável 1.8.9 */}
      <div
        className="mc-scrollbar"
        style={{
          position: 'absolute',
          left: '50%',
          top: 24 * scale,
          bottom: 34 * scale,
          width: 312 * scale,
          transform: 'translateX(-50%)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 4 * scale,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 10 * scale,
        }}
      >
        {/* Bloco 1: options.txt Minecraft Vanilla 1.8.9 */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: 8 * scale,
        }}>
          <div style={{ marginBottom: 4 * scale }}>
            <GuiText text="Arquivo options.txt (Vanilla 1.8.9)" color="#FFFF55" shadow scale={scale} />
          </div>
          <div style={{ marginBottom: 6 * scale }}>
            <GuiText text="Importe ou exporte o arquivo options.txt real do seu .minecraft." color="#A0A0A0" shadow scale={scale} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `${146 * scale}px ${146 * scale}px`, gap: `${4 * scale}px` }}>
            <JavaButton
              label="Exportar options.txt"
              onClick={handleTxtExport}
              width={146}
            />
            <input ref={txtFileRef} type="file" accept=".txt,text/plain" onChange={handleTxtFile} style={{ display: 'none' }} />
            <JavaButton
              label="Importar options.txt"
              onClick={() => txtFileRef.current?.click()}
              width={146}
            />
          </div>

          {txtDiff && txtDiff.changes.length > 0 && (
            <div style={{ marginTop: 6 * scale, background: 'rgba(0, 0, 0, 0.3)', padding: 6 * scale }}>
              <div style={{ marginBottom: 4 * scale }}>
                <GuiText text={`${txtDiff.changes.length} alterações detectadas:`} color="#55FF55" shadow scale={scale} />
              </div>
              <div style={{ maxHeight: 60 * scale, overflowY: 'auto', marginBottom: 6 * scale }}>
                {txtDiff.changes.slice(0, 8).map((c) => (
                  <div key={c.path} style={{ marginBottom: 1 * scale }}>
                    <GuiText text={`${c.path}: ${String(c.from)} -> ${String(c.to)}`} color="#FFAA00" shadow scale={scale} />
                  </div>
                ))}
                {txtDiff.changes.length > 8 && (
                  <GuiText text={`... e mais ${txtDiff.changes.length - 8} opções`} color="#888888" shadow scale={scale} />
                )}
              </div>
              <JavaButton
                label="Aplicar Alterações"
                onClick={handleTxtApply}
                width={146}
              />
            </div>
          )}

          {txtError && (
            <div style={{ marginTop: 4 * scale }}>
              <GuiText text={txtError} color="#FF5555" shadow scale={scale} />
            </div>
          )}
          {txtNote && (
            <div style={{ marginTop: 4 * scale }}>
              <GuiText text={txtNote} color="#FFAA00" shadow scale={scale} />
            </div>
          )}
          {txtApplied && (
            <div style={{ marginTop: 4 * scale }}>
              <GuiText text="Configurações do options.txt aplicadas!" color="#55FF55" shadow scale={scale} />
            </div>
          )}
        </div>

        {/* Bloco 2: Backup Completo JSON do Mind Cave */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: 8 * scale,
        }}>
          <div style={{ marginBottom: 4 * scale }}>
            <GuiText text="Backup JSON Mind Cave" color="#55FF55" shadow scale={scale} />
          </div>
          <div style={{ marginBottom: 6 * scale }}>
            <GuiText text="Backup integral de controles, perfis e ajustes de vídeo." color="#A0A0A0" shadow scale={scale} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `${146 * scale}px ${146 * scale}px`, gap: `${4 * scale}px` }}>
            <JavaButton
              label="Baixar Backup JSON"
              onClick={handleExport}
              width={146}
            />
            <input ref={fileRef} type="file" accept=".json" onChange={handleFile} style={{ display: 'none' }} />
            <JavaButton
              label="Carregar JSON"
              onClick={() => fileRef.current?.click()}
              width={146}
            />
          </div>

          {diff && !diff.error && (
            <div style={{ marginTop: 6 * scale, background: 'rgba(0, 0, 0, 0.3)', padding: 6 * scale }}>
              <div style={{ marginBottom: 4 * scale }}>
                <GuiText text={`${diff.user.length + diff.device.length} configurações diferentes:`} color="#55FF55" shadow scale={scale} />
              </div>
              <div style={{ display: 'flex', gap: 6 * scale, marginBottom: 6 * scale }}>
                <JavaButton
                  label={`Usuário: ${applyUser ? 'SIM' : 'NÃO'}`}
                  onClick={() => setApplyUser(!applyUser)}
                  width={140}
                />
                <JavaButton
                  label={`Dispositivo: ${applyDevice ? 'SIM' : 'NÃO'}`}
                  onClick={() => setApplyDevice(!applyDevice)}
                  width={140}
                />
              </div>
              <JavaButton
                label="Aplicar Selecionadas"
                onClick={handleApply}
                width={146}
              />
            </div>
          )}

          {diff?.error && (
            <div style={{ marginTop: 4 * scale }}>
              <GuiText text={diff.error} color="#FF5555" shadow scale={scale} />
            </div>
          )}
          {applied && (
            <div style={{ marginTop: 4 * scale }}>
              <GuiText text="Backup aplicado com sucesso!" color="#55FF55" shadow scale={scale} />
            </div>
          )}
        </div>

        {/* Dica de pasta .minecraft */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: 6 * scale,
        }}>
          <GuiText text="Dica: No Windows, pressione Win+R e digite %appdata%\\.minecraft para localizar seu options.txt oficial." color="#888888" shadow scale={scale} />
        </div>
      </div>

      {/* Botão Concluído */}
      <GuiButton
        x={-100}
        y={guiHeight - 28}
        width={200}
        label={t('gui.done')}
        onClick={onBack}
      />
    </>
  );
}

export default function ImportExportPage({ onBack }) {
  return (
    <GuiScreen background="dirt">
      <ImportExportContent onBack={onBack} />
    </GuiScreen>
  );
}