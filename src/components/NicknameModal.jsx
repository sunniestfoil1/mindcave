// Personalizar jogador: nick + skin (Steve, Alex ou PNG 64×64 enviado) com prévia, no estilo dos menus do jogo.
import React, { useState, useRef, useEffect } from "react";
import { GuiScreen, GuiButton, GuiText, GuiTextField, useGui } from "@/components/java";
import PlayerPreview from "@/components/game/PlayerPreview";
import { getNickname, setNickname } from "@/game/guestIdentity";
import { getSkinChoice, setSkinChoice, readSkinFile } from "@/game/skinStore";
import { useSkinDrop } from "@/components/useSkinDrop";

const PREVIEW = { box: { x: 0, y: 0, w: 52, h: 70 }, feet: { x: 26, y: 67 }, unit: 30, refUp: 50 };

function Content({ onClose, onSaved }) {
  const { scale, guiWidth, guiHeight } = useGui();
  const [name, setName] = useState(getNickname());
  const [choice, setChoice] = useState(getSkinChoice());
  const [error, setError] = useState('');
  const [rev, setRev] = useState(0); // força a prévia a recarregar a skin
  const fileRef = useRef(null);
  const top = Math.max(24, Math.floor(guiHeight / 2) - 100);

  useEffect(() => { setRev(r => r + 1); }, [choice]);

  const pick = (kind) => { const c = kind === 'custom' ? choice : { kind }; setError(''); setChoice(c); setSkinChoice(c); };
  const applyFile = async (file) => {
    try {
      const png = await readSkinFile(file);
      const c = { kind: 'custom', png };
      setChoice(c); setSkinChoice(c); setError('');
    } catch (err) { setError(err.message); }
  };
  useSkinDrop(applyFile);
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) applyFile(file);
  };
  const save = () => { const clean = setNickname(name); onSaved?.(clean); onClose(); };
  const label = (k, text) => (choice.kind === k ? `§e> ${text} <` : text);

  return (
    <>
      <div style={{ position: 'absolute', left: '50%', top: top * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Personalizar jogador" color="#FFFFFF" shadow />
      </div>
      <div style={{ position: 'absolute', left: (guiWidth / 2 - 100) * scale, top: (top + 20) * scale }}>
        <GuiText text="Nome no jogo" color="#A0A0A0" shadow />
      </div>
      <GuiTextField x={-100} y={top + 31} width={200} value={name} onChange={setName} maxLength={16} autoFocus />

      {/* Prévia: caixa preta como a do inventário, boneco olhando para o mouse */}
      <div style={{ position: 'absolute', left: (guiWidth / 2 + 12) * scale, top: (top + 60) * scale, width: 52 * scale, height: 70 * scale, background: '#000', border: `${scale}px solid #373737` }}>
        <PlayerPreview key={rev} S={scale} preset={PREVIEW} />
      </div>
      <GuiButton x={-100} y={top + 60} width={104} label={label('steve', 'Steve')} onClick={() => pick('steve')} />
      <GuiButton x={-100} y={top + 84} width={104} label={label('alex', 'Alex')} onClick={() => pick('alex')} />
      <GuiButton x={-100} y={top + 108} width={104} label={label('custom', 'Enviar skin...')} onClick={() => fileRef.current?.click()} />
      <input ref={fileRef} type="file" accept="image/png" onChange={onFile} style={{ display: 'none' }} />

      <div style={{ position: 'absolute', left: (guiWidth / 2 - 100) * scale, top: (top + 134) * scale, maxWidth: 200 * scale }}>
        <GuiText text={error ? `§c${error}` : 'PNG de skin — arraste aqui ou clique (convertemos p/ 64×64)'} color="#A0A0A0" shadow />
      </div>

      <GuiButton x={-100} y={top + 158} width={98} label="Salvar" onClick={save} />
      <GuiButton x={2} y={top + 158} width={98} label="Cancelar" onClick={onClose} />
    </>
  );
}

export default function NicknameModal({ onClose, onSaved }) {
  return (
    <GuiScreen>
      <Content onClose={onClose} onSaved={onSaved} />
    </GuiScreen>
  );
}
