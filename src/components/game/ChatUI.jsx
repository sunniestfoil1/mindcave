// Chat UI — PRD 15 MC15-RF-050..053
// Overlay de chat com formatação §, histórico, autocomplete, links.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { parseMcCodes, extractLinks, autocompleteChat, CHAT_COMMANDS, checkMention } from '@/game/net/chatSystem';

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
      <span className="text-yellow-200 font-medium">{userStr}: </span>
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
  const messagesRef = useRef([]);

  // Register callback for incoming messages
  useEffect(() => {
    if (!engine) return;
    const addMessage = (msg) => {
      const channelTag = msg.channel || (netManager ? 'mundo' : 'global');
      const full = { ...msg, channel: channelTag, timestamp: msg.timestamp || Date.now() };
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
        if (engine.chatOpen) setShowHistory(true);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [engine, chatOpen]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, showHistory]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) {
      engine.chatOpen = false;
      setChatOpen(false);
      setInput('');
      return;
    }
    setHistory(prev => [...prev.slice(-49), text]);
    setHistoryIdx(-1);

    if (netManager) {
      netManager.sendChat(text);
    } else {
      engine.executeCommand(text);
    }
    engine.chatOpen = false;
    setChatOpen(false);
    setInput('');
  }, [input, engine, netManager]);

  const handleKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { handleSend(); }
    else if (e.key === 'Escape') { engine.chatOpen = false; setChatOpen(false); setInput(''); }
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

  return (
    <>
      {/* Container de Chat posicionado no canto superior direito e maior */}
      <div className="fixed top-12 right-3 w-[440px] max-w-[90vw] z-50 flex flex-col gap-1.5 pointer-events-auto">
        {/* Message display */}
        <div
          ref={scrollRef}
          className={`w-full overflow-y-auto transition-all duration-200 ${chatOpen || showHistory ? 'max-h-[50vh] opacity-100' : 'max-h-48 opacity-80 pointer-events-none'}`}
          style={{ scrollbarWidth: 'thin' }}
        >
          {messages.slice(showHistory ? 0 : -12).map((msg, i) => (
            <ChatLine key={i} msg={msg} myName={myName} />
          ))}
        </div>

        {/* Input box */}
        {chatOpen && (
          <div className="w-full">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 100))}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (!input) { engine.chatOpen = false; setChatOpen(false); } }}
              placeholder="Digite no chat (Enter envia, Esc fecha)..."
              className="w-full bg-black/90 text-white text-sm px-3.5 py-2.5 rounded border border-emerald-500/50 shadow-xl outline-none font-mono"
            />
          </div>
        )}
      </div>
    </>
  );
}