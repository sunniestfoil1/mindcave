// Lobby chat — PRD 15 MC15-RF-052
// Chat do saguão entre usuários do app, fora de qualquer mundo.
import React, { useState, useEffect, useRef } from 'react';
import { mindcaveApi } from '@/api/supabaseClient';

export default function LobbyChat({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const scrollRef = useRef(null);
  const unsubRef = useRef(null);

  useEffect(() => {
    // Load recent messages
    (async () => {
      try {
        const res = await mindcaveApi.entities.LobbyMessage.filter({}, { sort: '-created_date', limit: 30 });
        const items = (res.items || res || []).reverse();
        setMessages(items);
      } catch {}
    })();

    // Subscribe to new messages
    unsubRef.current = mindcaveApi.entities.LobbyMessage.subscribe((event) => {
      if (event.type === 'create' && event.data) {
        setMessages(prev => [...prev.slice(-49), event.data]);
      }
    });

    return () => { if (unsubRef.current) unsubRef.current(); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim().slice(0, 100);
    if (!text) return;
    setInput('');
    try {
      await mindcaveApi.entities.LobbyMessage.create({
        userId: user.id,
        userName: user.full_name || user.email || 'Player',
        message: text,
      });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="border-t border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-white/50 hover:text-white/70 hover:bg-white/5"
      >
        <span className={`w-2 h-2 rounded-full ${open ? 'bg-emerald-400' : 'bg-white/20'}`} />
        Chat do saguão {messages.length > 0 && `(${messages.length})`}
      </button>
      {open && (
        <div className="p-3 space-y-2">
          <div ref={scrollRef} className="h-32 overflow-y-auto space-y-1 text-xs">
            {messages.length === 0 && <p className="text-white/30 text-center py-4">Nenhuma mensagem ainda. Diga olá!</p>}
            {messages.map((m, i) => (
              <div key={i} className="text-white/70">
                <span className="text-emerald-400/80 font-semibold">{m.userName}</span>
                <span className="text-white/30 mx-1">:</span>
                {m.message}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 100))}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder="Mensagem…"
              className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs outline-none focus:border-emerald-400/30"
            />
            <button onClick={send} disabled={!input.trim()} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 rounded text-xs font-semibold">Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
}