import React from 'react';
import { GuiButton, GuiText, useGui } from '@/components/java';
import { LANGS, getLang, setLang, useT } from '@/game/i18n';

// Tela de idioma (PRD 20 §2.7): lista, troca na hora, botão Pronto.
// "Forçar fonte Unicode" ficou de fora: o jogo não tem consumidor para essa
// opção (fonte atual é o arquivo Minecraft local, sem página unicode) — e
// MC20-RF-050 proíbe opção sem consumidor.
export default function LanguagePage({ onBack }) {
  const t = useT();
  const { guiHeight, scale } = useGui();
  const current = getLang();

  const startY = Math.floor(guiHeight / 4);

  return (
    <>
      {/* Título */}
      <div style={{ position: 'absolute', left: '50%', top: 6 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text={t('options.languageTitle')} color="#FFFFFF" shadow scale={scale} />
      </div>

      {/* Lista de idiomas — nomes no próprio idioma, como no jogo */}
      {LANGS.map((l, i) => (
        <GuiButton
          key={l.id}
          x={-100} y={startY + i * 24} width={200}
          label={(current === l.id ? '✓ ' : '') + l.name}
          onClick={() => setLang(l.id)}
        />
      ))}

      {/* Aviso oficial de tradução */}
      <div style={{
        position: 'absolute', left: '50%', top: startY + LANGS.length * 24 + 6 * scale,
        transform: 'translateX(-50%)', width: 340 * scale, textAlign: 'center',
      }}>
        <GuiText text={t('options.languageWarning')} color="#A0A0A0" shadow scale={Math.max(1, scale * 0.75)} />
      </div>

      {/* Concluído */}
      <GuiButton x={-100} y={guiHeight - 28} width={200} label={t('gui.done')} onClick={onBack} />
    </>
  );
}
