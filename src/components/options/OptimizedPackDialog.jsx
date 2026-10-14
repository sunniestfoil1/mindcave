import React, { useState } from 'react';
import { GuiScreen, GuiButton, GuiText, useGui } from '@/components/java';
import { useT } from '@/game/i18n';
import { PACK_CATALOG, OPTIMIZED_PACK_ID, ensurePackBuffer, getSelectedPackIds, setSelectedPackIds } from '@/game/resourcePacks';

// Pergunta que acompanha o Modo Otimizado: o pacote de texturas otimizado só baixa se o jogador quiser, e só vale depois de
// aplicar (a página recarrega, como a troca de pacote em Opções > Pacotes de recursos). Layout do GuiYesNo do 1.8.9.
function DialogContent({ onClose }) {
  const t = useT();
  const { guiHeight, scale } = useGui();
  const pack = PACK_CATALOG.find((p) => p.id === OPTIMIZED_PACK_ID);
  const [step, setStep] = useState('ask'); // ask | downloading | ready | error
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');

  const download = async () => {
    setStep('downloading');
    try {
      await ensurePackBuffer(pack, setPercent);
      setStep('ready');
    } catch (e) {
      setError(`${t('resourcePack.failed')}: ${e.message}`);
      setStep('error');
    }
  };
  const apply = () => {
    setSelectedPackIds([...getSelectedPackIds().filter((id) => id !== pack.id), pack.id]);
    window.location.reload();
  };

  const mb = `${(pack.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  const line = (text, y, color = '#FFFFFF') => (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y * scale, display: 'flex', justifyContent: 'center' }}>
      <GuiText text={text} color={color} shadow scale={scale} />
    </div>
  );
  const by = Math.floor(guiHeight / 6) + 96;

  return (
    <>
      {line(t('optpack.title'), 70)}
      {step === 'ask' && <>{line(t('optpack.ask'), 90)}{line(`${pack.id} (${mb})`, 100, '#A0A0A0')}</>}
      {step === 'downloading' && line(`${t('resourcePack.download')} ${percent}%`, 90)}
      {step === 'ready' && <>{line(t('optpack.ready'), 90)}{line(t('optpack.reloadNote'), 100, '#A0A0A0')}</>}
      {step === 'error' && line(error, 90, '#FF5555')}

      {step === 'ask' && <>
        <GuiButton x={-155} y={by} width={150} label={t('optpack.download')} onClick={download} />
        <GuiButton x={5} y={by} width={150} label={t('optpack.notNow')} onClick={onClose} />
      </>}
      {step === 'ready' && <>
        <GuiButton x={-155} y={by} width={150} label={t('optpack.apply')} onClick={apply} />
        <GuiButton x={5} y={by} width={150} label={t('optpack.later')} onClick={onClose} />
      </>}
      {step === 'error' && <GuiButton x={-75} y={by} width={150} label={t('optpack.ok')} onClick={onClose} />}
    </>
  );
}

// Tela própria (fundo de terra, como o GuiYesNo) por cima da tela que perguntou
export default function OptimizedPackDialog({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <GuiScreen><DialogContent onClose={onClose} /></GuiScreen>
    </div>
  );
}
