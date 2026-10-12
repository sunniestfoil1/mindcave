import React from "react";
import { GuiScreen, GuiButton, GuiText, JavaButton, useGui } from "@/components/java";
import { useSettings } from "@/game/settingsStore";
import { QUALITY_PROFILES } from "@/game/settingsDefaults";
import { useT } from "@/game/i18n";

const PROFILE_LABELS = {
  potato: 'Batata', minimum: 'Mínimo', low: 'Baixo',
  medium: 'Médio', high: 'Alto', ultra: 'Ultra',
};
const PROFILE_DESC = {
  potato: 'PC muito fraco · 30+ FPS',
  minimum: 'Notebook fraco · 60+ FPS',
  low: 'PC básico · 60 FPS',
  medium: 'PC médio · 60 FPS',
  high: 'PC forte · Shaders',
  ultra: 'PC potente · Tudo no máximo',
};

function QualityProfilesContent({ onBack }) {
  const { guiHeight, scale } = useGui();
  const store = useSettings();
  const t = useT();
  const current = store.detectProfile();

  // "Personalizado" entra no ciclo só como estado — não tem valores para aplicar
  const options = [
    ...Object.keys(QUALITY_PROFILES).map((k) => ({ value: k, label: PROFILE_LABELS[k] || k })),
    { value: 'custom', label: 'Personalizado' },
  ];

  return (
    <>
      <div style={{ position: 'absolute', left: '50%', top: 6 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text="Perfis de qualidade" color="#FFFFFF" shadow scale={scale} />
      </div>

      <div style={{
        position: 'absolute', left: '50%', top: 36 * scale,
        transform: 'translateX(-50%)',
        display: 'grid', gap: 4 * scale, justifyItems: 'center',
      }}>
        <JavaButton
          label="Perfil" value={current} options={options}
          onChange={(v) => { if (v !== 'custom') store.applyProfile(v); }}
          width={200}
        />
        <JavaButton label="Otimizado (máx. desempenho)" onClick={() => store.applyOptimized()} width={200} />
      </div>

      <div style={{
        position: 'absolute', left: '50%', top: 92 * scale, transform: 'translateX(-50%)',
        width: 300 * scale, textAlign: 'center',
      }}>
        <GuiText text={PROFILE_DESC[current] || 'Personalizado: uma opção avulsa saiu do perfil.'}
          color="#A0A0A0" shadow scale={scale} />
      </div>

      <div style={{
        position: 'absolute', left: '50%', top: guiHeight - 44 * scale, transform: 'translateX(-50%)',
        textAlign: 'center',
      }}>
        <GuiText text="Mudar uma opção avulsa marca como Personalizado." color="#808080" shadow scale={scale} />
      </div>

      <GuiButton x={-100} y={guiHeight - 28} width={200} label={t('gui.done')} onClick={onBack} />
    </>
  );
}

export default function QualityProfilesPage({ onBack }) {
  return (
    <GuiScreen>
      <QualityProfilesContent onBack={onBack} />
    </GuiScreen>
  );
}
