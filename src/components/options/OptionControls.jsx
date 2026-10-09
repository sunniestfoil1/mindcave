import React, { useState } from "react";

const PERF_COLORS = { none: 'text-muted-foreground', low: 'text-green-500', medium: 'text-yellow-500', high: 'text-red-500' };
const PERF_LABELS = { none: 'Nenhum', low: 'Baixo', medium: 'Médio', high: 'Alto' };

function Tooltip({ text, perfImpact }) {
  if (!text) return null;
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg border border-border pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
      {text}
      {perfImpact && perfImpact !== 'none' && (
        <div className={`mt-1 font-semibold ${PERF_COLORS[perfImpact]}`}>Impacto: {PERF_LABELS[perfImpact]}</div>
      )}
    </div>
  );
}

export function OptionButton({ label, value, options, onChange, tooltip, perfImpact, disabled, disabledReason }) {
  const idx = options.findIndex(o => o.value === value);
  const current = options[idx] || options[0];
  const cycle = (dir) => {
    if (disabled) return;
    const n = (idx + dir + options.length) % options.length;
    onChange(options[n].value);
  };
  return (
    <div className="group relative">
      <Tooltip text={tooltip} perfImpact={perfImpact} />
      <div className={`flex items-center bg-card border border-border rounded px-3 py-1.5 ${disabled ? 'opacity-50' : 'hover:border-primary cursor-pointer'}`}
        onClick={() => cycle(1)} onContextMenu={(e) => { e.preventDefault(); cycle(-1); }}>
        <span className="text-sm text-foreground/80 flex-1 truncate">{label}</span>
        <span className="text-sm font-semibold text-foreground px-2 py-0.5 bg-secondary rounded">
          {disabled ? (disabledReason || 'Indisponível') : (current?.label ?? String(value))}
        </span>
      </div>
    </div>
  );
}

export function OptionSlider({ label, value, min, max, step = 1, format, onChange, tooltip, perfImpact, disabled }) {
  const [dragging, setDragging] = useState(false);
  const fmt = format || (v => String(v));
  return (
    <div className="group relative">
      <Tooltip text={tooltip} perfImpact={perfImpact} />
      <div className={`flex items-center bg-card border border-border rounded px-3 py-1.5 ${disabled ? 'opacity-50' : ''}`}>
        <span className="text-sm text-foreground/80 flex-1 truncate">{label}</span>
        <span className="text-sm font-semibold text-foreground ml-2 min-w-[60px] text-right">{fmt(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onMouseDown={() => setDragging(true)} onMouseUp={() => setDragging(false)}
        className="w-full h-1 mt-1 accent-primary cursor-pointer"
      />
    </div>
  );
}

export function OptionToggle({ label, value, onChange, tooltip, perfImpact, disabled }) {
  return (
    <div className="group relative">
      <Tooltip text={tooltip} perfImpact={perfImpact} />
      <div
        className={`flex items-center bg-card border border-border rounded px-3 py-1.5 ${disabled ? 'opacity-50' : 'hover:border-primary cursor-pointer'}`}
        onClick={() => !disabled && onChange(!value)}
      >
        <span className="text-sm text-foreground/80 flex-1 truncate">{label}</span>
        <span className={`text-sm font-semibold px-2 py-0.5 rounded ${value ? 'bg-green-600 text-white' : 'bg-secondary text-muted-foreground'}`}>
          {value ? 'Ligado' : 'Desligado'}
        </span>
      </div>
    </div>
  );
}

export { Tooltip, PERF_COLORS, PERF_LABELS };