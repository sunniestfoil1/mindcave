import React, { useState } from 'react';
import { AlertTriangle, Copy, Home } from 'lucide-react';

export default function CrashScreen({ error, onExit }) {
  const [copied, setCopied] = useState(false);
  const build = error?.build || 'desconhecido';
  const stack = error?.stack || String(error);
  const ua = navigator.userAgent;
  const url = window.location.href;
  const time = new Date().toISOString();

  const report = `Mind Cave — Relatório de Erro
Build: ${build}
URL: ${url}
Navegador: ${ua}
Hora: ${time}

Erro: ${error?.message || String(error)}

Pilha:
${stack}

(Anexe este relatório ao reportar o problema.)`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="text-red-500" size={32} />
          <h1 className="text-2xl font-bold text-white">Algo deu errado</h1>
        </div>
        <p className="text-white/60 text-sm mb-4">
          Ocorreu um erro inesperado. Seu progresso pode ter sido salvo pelo autosave.
          Copie o relatório abaixo para ajudar a diagnosticar o problema.
        </p>
        <pre className="bg-black/60 border border-white/10 rounded p-3 text-xs text-red-300/80 font-mono overflow-auto max-h-48 mb-4 whitespace-pre-wrap break-all">
          {error?.message || String(error)}
        </pre>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-semibold text-white text-sm"
          >
            <Copy size={16} />
            {copied ? 'Copiado!' : 'Copiar relatório'}
          </button>
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded font-semibold text-white text-sm"
          >
            <Home size={16} />
            Voltar ao menu
          </button>
        </div>
      </div>
    </div>
  );
}