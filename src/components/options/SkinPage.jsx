import React, { useState, useRef } from "react";
import { GuiScreen, GuiButton, GuiText, JavaButton, useGui } from "@/components/java";
import { useSettings } from "@/game/settingsStore";
import { useT } from "@/game/i18n";
import PlayerPreview from "@/components/game/PlayerPreview";
import { getSkinChoice, setSkinChoice, readSkinFile, getCapeChoice, setCapeChoice } from "@/game/skinStore";
import { fetchCraftheadSkin, fetchCraftheadCape } from "@/game/crafthead";
import { useSkinDrop } from "@/components/useSkinDrop";

const PREVIEW = { box: { x: 0, y: 0, w: 52, h: 70 }, feet: { x: 26, y: 67 }, unit: 30, refUp: 50 };

const PARTS = [
  { key: 'cape', label: 'Capa' }, { key: 'jacket', label: 'Jaqueta' },
  { key: 'sleeveL', label: 'Manga esq.' }, { key: 'sleeveR', label: 'Manga dir.' },
  { key: 'pantsL', label: 'Calça esq.' }, { key: 'pantsR', label: 'Calça dir.' },
  { key: 'hat', label: 'Chapéu' },
];

function SkinContent({ onBack }) {
  const { scale, guiHeight } = useGui();
  const store = useSettings();
  const t = useT();
  const parts = store.get('user.skinParts') || {};
  const setPart = (k, v) => store.set(`user.skinParts.${k}`, v);

  const [choice, setChoice] = useState(getSkinChoice());
  const [error, setError] = useState('');
  const [rev, setRev] = useState(0);
  const fileRef = useRef(null);
  const pick = (c) => { setChoice(c); setSkinChoice(c); setError(''); setRev((r) => r + 1); };
  const applyFile = async (file) => {
    try { pick({ kind: 'custom', png: await readSkinFile(file) }); } catch (err) { setError(err.message); }
  };
  useSkinDrop(applyFile);
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) applyFile(file);
  };

  const [cape, setCape] = useState(getCapeChoice());
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState('');
  const [nickStatus, setNickStatus] = useState('');
  const [nickError, setNickError] = useState('');
  const resetMsgs = () => { setNickStatus(''); setNickError(''); };
  const searchSkin = async () => {
    setBusy('skin'); resetMsgs();
    try {
      pick({ kind: 'custom', png: (await fetchCraftheadSkin(nick)).png });
      setNickStatus(`Skin de ${nick.trim()} aplicada.`);
    } catch (err) { setNickError(err.message); }
    finally { setBusy(''); }
  };
  const searchCape = async () => {
    setBusy('cape'); resetMsgs();
    try {
      const c = await fetchCraftheadCape(nick);
      setCapeChoice(c); setCape(c); setRev((r) => r + 1);
      setNickStatus(c ? `Capa de ${c.user} aplicada.` : `${nick.trim()} não tem capa.`);
    } catch (err) { setNickError(err.message); }
    finally { setBusy(''); }
  };
  const removeCape = () => {
    setCapeChoice(null); setCape(null); setRev((r) => r + 1); resetMsgs();
    setNickStatus('Capa removida.');
  };

  const Section = ({ children }) => (
    <div style={{ marginBottom: 3 * scale, textAlign: 'center' }}>
      <GuiText text={children} color="#A0A0A0" shadow scale={scale} />
    </div>
  );
  const Msg = ({ text, color }) => (
    text ? (
      <div style={{ textAlign: 'center', minHeight: 10 * scale }}>
        <GuiText text={text} color={color} shadow scale={scale} />
      </div>
    ) : null
  );

  return (
    <>
      <div style={{ position: 'absolute', left: '50%', top: 6 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Personalização de skin" color="#FFFFFF" shadow scale={scale} />
      </div>

      <div
        className="mc-scrollbar"
        style={{
          position: 'absolute', left: '50%', top: 20 * scale, bottom: 32 * scale,
          width: 312 * scale, transform: 'translateX(-50%)',
          overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 * scale,
        }}
      >
        <Section>Skin</Section>
        <div style={{ display: 'flex', gap: 6 * scale, justifyContent: 'center', alignItems: 'flex-start', marginBottom: 4 * scale }}>
          <div className="relative" style={{ width: 52 * scale, height: 70 * scale, background: '#000000', border: `${2 * scale}px solid #373737`, boxSizing: 'border-box', flexShrink: 0 }}>
            <PlayerPreview key={rev} S={scale} preset={PREVIEW} capeVisible={!!parts.cape} />
          </div>
          <div style={{ display: 'grid', gap: 2 * scale }}>
            <JavaButton label="Steve" onClick={() => pick({ kind: 'steve' })} width={150} />
            <JavaButton label="Alex (braço fino)" onClick={() => pick({ kind: 'alex' })} width={150} />
            <JavaButton label="Enviar skin (PNG)" onClick={() => fileRef.current?.click()} width={150} />
            <input ref={fileRef} type="file" accept="image/png" onChange={onFile} style={{ display: 'none' }} />
            <div style={{ textAlign: 'center', marginTop: 2 * scale }}>
              <GuiText text={choice.kind === 'custom' ? 'Skin: personalizada' : `Skin: ${choice.kind}`} color="#A0A0A0" shadow scale={scale} />
            </div>
          </div>
        </div>
        <Msg text={error} color="#FF5555" />

        <Section>Crafthead (nickname)</Section>
        <div style={{ display: 'flex', gap: 4 * scale, justifyContent: 'center', marginBottom: 3 * scale }}>
          <input
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && nick && !busy) searchSkin(); }}
            placeholder="Nickname do Minecraft"
            maxLength={16}
            style={{
              width: 150 * scale, height: 20 * scale,
              background: '#000000', border: `${scale}px solid #A0A0A0`,
              color: '#E0E0E0', caretColor: '#E0E0E0',
              fontSize: `${8 * scale}px`, fontFamily: 'monospace',
              padding: `0 ${4 * scale}px`, boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `${150 * scale}px ${150 * scale}px`, gap: `${2 * scale}px`, justifyContent: 'center', marginBottom: 3 * scale }}>
          <JavaButton label={busy === 'skin' ? 'Buscando…' : 'Buscar skin'} onClick={searchSkin} disabled={!!busy || !nick} width={150} />
          <JavaButton label={busy === 'cape' ? 'Buscando…' : 'Buscar capa'} onClick={searchCape} disabled={!!busy || !nick} width={150} />
          {cape && <JavaButton label="Remover capa" onClick={removeCape} width={150} />}
        </div>
        <Msg text={cape ? `Capa atual: ${cape.user}` : 'Sem capa'} color="#A0A0A0" />
        <Msg text={nickStatus} color="#55FF55" />
        <Msg text={nickError} color="#FF5555" />

        <div style={{ height: 4 * scale }} />
        <Section>Partes visíveis</Section>
        <div style={{ display: 'grid', gridTemplateColumns: `${150 * scale}px ${150 * scale}px`, gap: `${2 * scale}px`, justifyContent: 'center' }}>
          {PARTS.map((p) => (
            <JavaButton
              key={p.key} label={p.label} value={!!parts[p.key]}
              options={[{ value: true, label: 'Ligado' }, { value: false, label: 'Desligado' }]}
              onChange={(v) => setPart(p.key, v)}
              width={150}
            />
          ))}
        </div>
      </div>

      <GuiButton x={-100} y={guiHeight - 28} width={200} label={t('gui.done')} onClick={onBack} />
    </>
  );
}

export default function SkinPage({ onBack }) {
  return (
    <GuiScreen>
      <SkinContent onBack={onBack} />
    </GuiScreen>
  );
}
