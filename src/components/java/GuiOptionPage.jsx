import React from 'react';
import { GuiScreen, GuiButton, GuiText, useGui } from './index';
import { JavaOption } from './GuiOptionControls';
import { useSettings } from '@/game/settingsStore';

// Java 1.8.9 settings page — renders option sections (same format as optionDefinitions.js)
// in a scrollable 2-column grid of 150px buttons/sliders.
function GuiOptionPageContent({ title, sections, onBack, resetScope }) {
  const { guiHeight, scale } = useGui();
  const store = useSettings();

  return (
    <>
      {/* Title */}
      <div style={{ position: 'absolute', left: '50%', top: 6 * scale, transform: 'translateX(-50%)' }}>
        <GuiText text={title} color="#FFFFFF" shadow scale={scale} />
      </div>

      {/* Scrollable options grid */}
      <div
        className="mc-scrollbar"
        style={{
          position: 'absolute', left: '50%', top: 20 * scale, bottom: 32 * scale,
          width: 312 * scale, transform: 'translateX(-50%)',
          overflowY: 'auto', overflowX: 'hidden',
          paddingRight: 4 * scale,
        }}
      >
        {sections.map(section => (
          <div key={section.name} style={{ marginBottom: 6 * scale }}>
            {section.name && (
              <div style={{ marginBottom: 2 * scale, textAlign: 'center' }}>
                <GuiText text={section.name} color="#A0A0A0" shadow scale={scale} />
              </div>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `${150 * scale}px ${150 * scale}px`,
              gap: `${2 * scale}px`,
              justifyContent: 'center',
            }}>
              {section.options.map(opt => (
                <JavaOption key={opt.key} opt={opt} store={store} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Done button */}
      <GuiButton x={-100} y={guiHeight - 28} width={200} label="Pronto" onClick={onBack} />
      {resetScope && (
        <GuiButton x={-204} y={guiHeight - 28} width={98} label="Restaurar" onClick={() => store.resetScope(resetScope)} />
      )}
    </>
  );
}

export default function GuiOptionPage(props) {
  return (
    <GuiScreen>
      <GuiOptionPageContent {...props} />
    </GuiScreen>
  );
}