// Chat UI — PRD 15 MC15-RF-050..053
// Overlay de chat com formatação §, histórico, autocomplete, links.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { parseMcCodes, extractLinks, autocompleteChat, CHAT_COMMANDS, checkMention } from '@/game/net/chatSystem';
import { useGuiScaleValue } from './GuiSprite';

function McSpan({ part }) {
  const style = {
    color: part.style.color,
    fontWeight: part.style.bold ? 'bold' : 'normal',
    fontStyle: part.style.italic ? 'italic' : 'normal',
    textDecoration: [part.style.underline ? 'underline' : '', part.style.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
  };
  return <span style={style}>{part.text}</span>;
}

function McText({ text }) {
  const parts = parseMcCodes(text);
  return <>{parts.map((p, i) => <McSpan key={i} part={p} />)}</>;
}

function ChatLine({ msg, myName }) {
  if (!msg) return null;
  const textStr = typeof msg.text === 'string' ? msg.text : (typeof msg.m === 'string' ? msg.m : (msg.cmd || ''));
  const userStr = msg.user || msg.u || 'Player';
  const isMention = msg.type === 'chat' && checkMention(textStr, myName);
  let display;
  
  // Tag do canal/escopo da mensagem
  const scopeTag = msg.channel === 'global' ? (
    <span className="text-emerald-400 font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] mr-1.5">[GLOBAL]</span>
  ) : (
    <span className="text-cyan-400 font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] mr-1.5">[MUNDO]</span>
  );

  if (msg.type === 'system') {
    display = <>{scopeTag}<McText text={textStr} /></>;
  } else if (msg.type === 'chat') {
    display = <>
      {scopeTag}
      <span className="text-yellow-200 font-medium">&lt;{userStr}&gt; </span>
      <span className={isMention ? 'text-yellow-300 font-bold bg-yellow-900/50 px-1 rounded' : 'text-white'}>

        {extractLinks(textStr).map((p, i) => p.type === 'link'
          ? <a key={i} href={p.text} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300" onClick={(e) => { if (!confirm('Abrir link: ' + p.text + '?')) e.preventDefault(); }}>{p.text}</a>
          : <McText key={i} text={p.text} />)}
      </span>
    </>;
  } else if (msg.type === 'whisper' || msg.type === 'whisper-out') {
    const prefix = msg.type === 'whisper-out' ? `§7Você sussurra para ${msg.target || 'alguém'}: ` : `§7${userStr} sussurra para você: `;
    display = <span className="italic">{scopeTag}<McText text={prefix + '§7' + textStr} /></span>;
  } else if (msg.type === 'me') {
    display = <span className="italic text-purple-300">{scopeTag}* {userStr} {textStr}</span>;
  } else {
    display = <>{scopeTag}<McText text={textStr} /></>;
  }
  return <div className={`text-sm leading-snug p-1.5 rounded bg-black/60 backdrop-blur-xs my-0.5 ${msg.type === 'system' ? 'text-gray-400' : ''}`}>{display}</div>;
}

export default function ChatUI({ engine, netManager, playerNames = [] }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [showHistory, setShowHistory] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef([]);

  // Register callback for incoming messages
  useEffect(() => {
    if (!engine) return;
    const addMessage = (msg) => {
      const channelTag = msg.channel || (netManager ? 'mundo' : 'global');
      const textStr = typeof msg.text === 'string' ? msg.text : (typeof msg.m === 'string' ? msg.m : (msg.cmd || ''));
      const userStr = msg.user || msg.u || 'Player';
      const now = msg.timestamp || Date.now();
      
      // Previne mensagens duplicadas (eco do servidor/race conditions)
      const isDuplicate = messagesRef.current.some(m => {
        const mText = typeof m.text === 'string' ? m.text : (typeof m.m === 'string' ? m.m : (m.cmd || ''));
        const mUser = m.user || m.u || 'Player';
        return mUser === userStr && mText === textStr && Math.abs(now - (m.timestamp || 0)) < 1800;
      });
      if (isDuplicate) return;

      const full = { ...msg, channel: channelTag, timestamp: now, text: textStr, user: userStr };
      messagesRef.current = [...messagesRef.current.slice(-99), full];
      setMessages(messagesRef.current);
    };
    engine.onChatMessage = addMessage;
    if (netManager) {
      netManager.onChatMessage = addMessage;
    }
    return () => { engine.onChatMessage = null; };
  }, [engine, netManager]);

  // Sync chatOpen from HUD
  useEffect(() => {
    if (!engine) return;
    const interval = setInterval(() => {
      if (engine.chatOpen !== chatOpen) {
        setChatOpen(engine.chatOpen);
        if (engine.chatOpen) {
          setShowHistory(true);
          setInput(engine.chatPrefill || ''); // "/" abre o chat já com a barra
          engine.chatPrefill = '';
        }
      }
    }, 50);
    return () => clearInterval(interval);
  }, [engine, chatOpen]);

  // Com a barra já digitada o cursor tem de ficar depois dela
  useEffect(() => {
    const el = inputRef.current;
    if (chatOpen && el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, [chatOpen]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, showHistory]);

  // REGRA DO CHAT: depois de enviar (ou Enter vazio) o chat fecha por engine.closeChat(), que devolve o mouse ao jogo.
  // Não troque por `engine.chatOpen = false` solto: o jogo ficaria pausado/sem mouse. Teste: T, digitar, Enter → continua jogando.
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) {
      if (engine?.closeChat) engine.closeChat();
      else {
        if (engine) engine.chatOpen = false;
        engine?._requestPointerLock?.();
      }
      setChatOpen(false);
      setInput('');
      return;
    }
    setHistory(prev => [...prev.slice(-49), text]);
    setHistoryIdx(-1);

    const myName = engine?.player?.nomeJogador || '';
    if (netManager) {
      netManager.sendChat(myName || 'Player', text);
    } else {
      engine.executeCommand(text);
    }
    if (engine?.closeChat) engine.closeChat();
    else {
      if (engine) engine.chatOpen = false;
      engine?._requestPointerLock?.();
    }
    setChatOpen(false);
    setInput('');
  }, [input, engine, netManager]);


  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { handleSend(); }
    else if (e.key === 'Escape') {
      if (engine?.closeChat) engine.closeChat();
      else if (engine) engine.chatOpen = false;
      setChatOpen(false);
      setInput('');
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const newIdx = historyIdx < 0 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(newIdx);
      setInput(history[newIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < 0) return;
      const newIdx = historyIdx + 1;
      if (newIdx >= history.length) { setHistoryIdx(-1); setInput(''); }
      else { setHistoryIdx(newIdx); setInput(history[newIdx]); }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const result = autocompleteChat(input, playerNames, CHAT_COMMANDS);
      if (result) setInput(typeof result === 'string' ? result : result[0]);
    }
  }, [handleSend, history, historyIdx, input, playerNames, engine]);

  const myName = engine?.player?.nomeJogador || '';
  const S = useGuiScaleValue();
  // Canto inferior direito. Se a janela é estreita e a hotbar ocuparia o mesmo espaço, o chat sobe para acima da vida/hotbar
  const free = Math.floor((window.innerWidth - 182 * S) / 2) - 16;
  const narrow = free < 260;
  const width = Math.min(440, narrow ? Math.floor(window.innerWidth * 0.5) : free);
  const bottom = narrow ? 52 * S : 12;

  return (
    <>
      <div className="fixed right-3 z-50 flex flex-col gap-1.5 pointer-events-auto" style={{ width, maxWidth: '90vw', bottom }}>
        {/* Mensagens: as mais novas ficam coladas na caixa de digitação */}
        <div
          ref={scrollRef}
          className={`w-full overflow-y-auto flex flex-col transition-all duration-200 ${chatOpen || showHistory ? 'max-h-[50vh] opacity-100' : 'max-h-48 opacity-80 pointer-events-none'}`}
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="mt-auto">
            {messages.slice(showHistory ? 0 : -12).map((msg, i) => (
              <ChatLine key={i} msg={msg} myName={myName} />
            ))}
          </div>
        </div>

        {/* Caixa de digitação */}
        {chatOpen && (
          <div className="w-full">
            <input
              data-chat-input
              ref={inputRef}
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 100))}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!input) {
                  if (engine?.closeChat) engine.closeChat();
                  else if (engine) engine.chatOpen = false;
                  setChatOpen(false);
                }
              }}
              className="w-full bg-black/90 text-white text-sm px-3.5 py-2.5 rounded border border-emerald-500/50 shadow-xl outline-none font-mono"
            />
          </div>
        )}
      </div>
    </>
  );
}
