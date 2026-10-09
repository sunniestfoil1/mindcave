import React, { useState } from "react";
import SettingsLayout from "./SettingsLayout";
import { OptionButton, OptionSlider, OptionToggle } from "./OptionControls";
import { useSettings } from "@/game/settingsStore";

function OptionRenderer({ opt }) {
  const store = useSettings();
  const value = store.get(opt.key);

  if (opt.type === 'button') {
    return (
      <OptionButton
        label={opt.label} value={value} options={opt.options}
        onChange={(v) => store.set(opt.key, v)}
        tooltip={opt.tooltip} perfImpact={opt.perfImpact}
        disabled={opt.disabled} disabledReason={opt.disabledReason}
      />
    );
  }
  if (opt.type === 'slider') {
    return (
      <OptionSlider
        label={opt.label} value={value} min={opt.min} max={opt.max} step={opt.step}
        format={opt.format} onChange={(v) => store.set(opt.key, v)}
        tooltip={opt.tooltip} perfImpact={opt.perfImpact}
        disabled={opt.disabled}
      />
    );
  }
  if (opt.type === 'toggle') {
    return (
      <OptionToggle
        label={opt.label} value={!!value}
        onChange={(v) => store.set(opt.key, v)}
        tooltip={opt.tooltip} perfImpact={opt.perfImpact}
        disabled={opt.disabled}
      />
    );
  }
  return null;
}

export default function SettingsPage({ title, sections, onBack, resetScope }) {
  const [search, setSearch] = useState('');
  const store = useSettings();

  const q = search.toLowerCase();
  const filtered = sections
    .map(s => ({
      ...s,
      options: s.options.filter(o => !q || o.label.toLowerCase().includes(q) || (o.tooltip || '').toLowerCase().includes(q)),
    }))
    .filter(s => s.options.length > 0);

  return (
    <SettingsLayout
      title={title} onBack={onBack} search={search} onSearch={setSearch}
      onReset={resetScope ? () => store.resetScope(resetScope) : undefined}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {filtered.map(section => (
          <div key={section.name}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">{section.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {section.options.map(opt => <OptionRenderer key={opt.key} opt={opt} />)}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhuma opção encontrada.</p>}
      </div>
    </SettingsLayout>
  );
}