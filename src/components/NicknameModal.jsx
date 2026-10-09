import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { getNickname, setNickname } from "@/game/guestIdentity";

export default function NicknameModal({ onClose, onSaved }) {
  const [name, setName] = useState(getNickname());

  const handleSave = () => {
    const clean = setNickname(name);
    onSaved?.(clean);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f1620] border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Trocar Nickname</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-white/40 mb-3">Escolha como você quer ser chamado no jogo. Máximo 16 caracteres.</p>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          maxLength={16}
          className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-emerald-400/50 focus:bg-white/10 focus:outline-none text-white text-sm transition-colors"
          placeholder="Seu nickname"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
          >
            <Check className="w-4 h-4" /> Salvar
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}