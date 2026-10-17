// Editar o texto da placa (GuiEditSign): 4 linhas de até 15 letras e o botão Pronto. Esc também fecha e guarda.
import React, { useEffect, useState } from 'react';
import { GuiScreen, GuiButton, GuiTextField, GuiText, useGui } from '@/components/java';
import { getSign, setSign } from '@/game/containers';

function Inner({ pos, onClose }) {
  const gui = useGui();
  const scale = gui?.scale || 1;
  const [lines, setLines] = useState(() => { const s = getSign(pos.x, pos.y, pos.z) || []; return [0, 1, 2, 3].map((i) => s[i] || ''); });
  const save = () => { setSign(pos.x, pos.y, pos.z, lines); onClose(); };
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); setSign(pos.x, pos.y, pos.z, lines); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  return (
    <>
      <div style={{ position: 'absolute', left: '50%', top: 40 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Editar mensagem da placa:" color="#FFFFFF" shadow scale={scale} />
      </div>
      {lines.map((l, i) => (
        <GuiTextField key={i} x={-75} y={(70 + i * 22)} width={150} value={l} maxLength={15} autoFocus={i === 0} onChange={(v) => setLines((a) => a.map((x, k) => (k === i ? v : x)))} />
      ))}
      <GuiButton x={-100} y={170} width={200} label="Pronto" onClick={save} />
    </>
  );
}

export default function SignEditor({ pos, onClose }) {
  return (
    <GuiScreen background="gradient">
      <Inner pos={pos} onClose={onClose} />
    </GuiScreen>
  );
}
