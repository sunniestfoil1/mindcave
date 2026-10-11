import React from "react";
import { Search, RotateCcw, ArrowLeft } from "lucide-react";

export default function SettingsLayout({ title, children, onBack, onReset, search, onSearch }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="border-b border-border px-6 py-4 flex items-center gap-4 bg-card">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        )}
        <h1 className="text-xl font-bold flex-1">{title}</h1>
        {onSearch !== undefined && (
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={(e) => onSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-3 py-1.5 text-sm bg-input border border-border rounded outline-none focus:border-primary w-48"
            />
          </div>
        )}
        {onReset && (
          <button onClick={onReset} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 border border-border rounded">
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar padrão
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {children}
      </div>
    </div>
  );
}