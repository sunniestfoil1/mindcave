import React, { useState, useRef, useEffect, useCallback } from 'react';
import { parseMcCodes, extractLinks, autocompleteChat, CHAT_COMMANDS, checkMention } from '@/game/net/chatSystem';
import { useGuiScaleValue } from './GuiSprite';
import { useSettings } from '@/game/settingsStore';
import { clientStore } from '@/game/client/clientStore';

import { viewSize } from '@/game/touch';
function McSpan({ part, useColors, S }) {
  const color = useColors ? part.style.color : '#FFFFFF';
  const style = {
    color,
    fontWeight: useColors && part.style.bold ? 'bold' : 'normal',
    fontStyle: useColors && part.style.italic ? 'italic' : 'normal',
    textDecoration: useColors
      ? [part.style.underline ? 'underline' : '', part.style.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none'
      : 'none',
    textShadow: `${S}px ${S}px 0 rgba(0, 0, 0, 0.85)`,
  };
  return <span style={style}>{part.text}</span>;
}

function McFormattedText({ text, useColors = true, S = 2 }) {
  const parts = parseMcCodes(text);
  return <>{parts.map((p, i) => <McSpan key={i} part={p} useColors={useColors} S={S} />)}</>;
}

function formatTime(ts) {
  const d = new Date(ts || Date.now());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `[${hh}:${mm}] `;
}

function ChatLine({ msg, myName, S, settings, alpha = 1 }) {
  if (!msg || alpha <= 0.02) return null;

  const textStr = typeof msg.text === 'string' ? msg.text : (typeof msg.m === 'string' ? msg.m : (msg.cmd || ''));
  const userStr = msg.user || msg.u || 'Player';
  const isMention = msg.type === 'chat' && checkMention(textStr, myName);

  const useColors = settings.chatColors !== false;
  const allowLinks = settings.webLinks !== false;
  const confirmLinks = settings.confirmLinks !== false;
  const showTimestamp = !!settings.chatTimestamp;
  const textAlpha = ((settings.textOpacity ?? 100) / 100) * alpha;
  const bgAlpha = ((settings.bgOpacity ?? 50) / 100) * 0.55 * alpha;

  const timePrefix = showTimestamp ? (
    <McFormattedText text={`§7${formatTime(msg.timestamp)}`} useColors={useColors} S={S} />
  ) : null;

  // No estilo 1.8.9, o chat local usa o formato puro "<Jogador> texto".
  // Só exibe tag discreta se vier do chat global do lobby.
  const globalPrefix = msg.channel === 'global' ? (
    <McFormattedText text="§7[Global] " useColors={useColors} S={S} />
  ) : null;

  let display;
  if (msg.type === 'system') {
    display = <>{timePrefix}<McFormattedText text={textStr} useColors={useColors} S={S} /></>;
  } else if (msg.type === 'chat') {
    const nameColor = isMention && useColors ? '§e' : '§f';
    display = (
      <>
        {timePrefix}
        {globalPrefix}
        <McFormattedText text={`${nameColor}<${userStr}> `} useColors={useColors} S={S} />
        <span style={{ color: isMention && useColors ? '#FFFF55' : '#FFFFFF' }}>
          {allowLinks
            ? extractLinks(textStr).map((p, i) =>
                p.type === 'link' ? (
                  <a
                    key={i}
                    href={p.text}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: useColors ? '#5555FF' : '#FFFFFF',
                      textDecoration: 'underline',
                      textShadow: `${S}px ${S}px 0 rgba(0, 0, 0, 0.85)`,
                    }}
                    onClick={(e) => {
                      if (confirmLinks && !window.confirm('Abrir link: ' + p.text + '?')) {
                        e.preventDefault();
                      }
                    }}
                  >
                    {p.text}
                  </a>
                ) : (
                  <McFormattedText key={i} text={p.text} useColors={useColors} S={S} />
                )
              )
            : <McFormattedText text={textStr} useColors={useColors} S={S} />}
        </span>
      </>
    );
  } else if (msg.type === 'whisper' || msg.type === 'whisper-out') {
    const prefix = msg.type === 'whisper-out'
      ? `§7§oVocê sussurra para ${msg.target || 'alguém'}: `
      : `§7§o${userStr} sussurra para você: `;
    display = <>{timePrefix}<McFormattedText text={prefix + '§7§o' + textStr} useColors={useColors} S={S} /></>;
  } else if (msg.type === 'me') {
    display = <>{timePrefix}<McFormattedText text={`* ${userStr} ${textStr}`} useColors={useColors} S={S} /></>;
  } else {
    display = <>{timePrefix}<McFormattedText text={textStr} useColors={useColors} S={S} /></>;
  }

  return (
    <div
      style={{
        backgroundColor: `rgba(0, 0, 0, ${bgAlpha})`,
        color: '#FFFFFF',
        opacity: textAlpha,
        padding: `${1 * S}px ${2 * S}px`,
        fontFamily: "'Minecraft', monospace",
        fontSize: `${8 * S}px`,
        lineHeight: `${9 * S}px`,
        wordBreak: 'break-word',
        imageRendering: 'pixelated',
      }}
    >
      {display}
    </div>
  );
}

export default function ChatUI({ engine, netManager, playerNames = [] }) {
  const store = useSettings();
  const baseS = useGuiScaleValue();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [chatOpen, setChatOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef([]);

  // Leitura das opções de chat do menu (optionDefinitions.js)
  const chatMode = store.get('user.chat') ?? 'visible';
  const chatScalePct = (store.get('user.chatScale') ?? 100) / 100;
  const chatWidthGui = store.get('user.chatWidth') ?? 280;
  const heightFocusedGui = store.get('user.chatHeightFocused') ?? 180;
  const heightUnfocusedGui = store.get('user.chatHeightUnfocused') ?? 90;
  const visibleTimeSec = store.get('user.chatVisibleTime') ?? 10;

  const chatSettings = {
    chatColors: store.get('user.chatColors') ?? true,
    webLinks: store.get('user.webLinks') ?? true,
    confirmLinks: store.get('user.confirmLinks') ?? true,
    textOpacity: store.get('user.textOpacity') ?? 100,
    bgOpacity: store.get('user.bgOpacity') ?? 50,
    chatTimestamp: store.get('user.chatTimestamp') ?? false,
  };

  // Recebe mensagens da engine e da rede
  useEffect(() => {
    if (!engine) return;
    const addMessage = (msg) => {
      const channelTag = msg.channel || (netManager ? 'mundo' : 'local');
      const textStr = typeof msg.text === 'string' ? msg.text : (typeof msg.m === 'string' ? msg.m : (msg.cmd || ''));
      const userStr = msg.user || msg.u || 'Player';
      const ts = msg.timestamp || Date.now();
      const isDuplicate = messagesRef.current.some((m) => {
        const mText = typeof m.text === 'string' ? m.text : (typeof m.m === 'string' ? m.m : (msg.cmd || ''));
        const mUser = m.user || m.u || 'Player';
        return mUser === userStr && mText === textStr && Math.abs(ts - (m.timestamp || 0)) < 1800;
      });
      if (isDuplicate) return;
      const full = { ...msg, channel: channelTag, timestamp: ts, text: textStr, user: userStr };
      messagesRef.current = [...messagesRef.current.slice(-99), full];
      setMessages(messagesRef.current);
      setNow(Date.now());
    };
    engine.onChatMessage = addMessage;
    if (netManager) {
      netManager.onChatMessage = addMessage;
    }
    return () => { engine.onChatMessage = null; };
  }, [engine, netManager]);

  // Sincroniza abertura do chat com a engine (T ou /)
  useEffect(() => {
    if (!engine) return;
    const interval = setInterval(() => {
      if (engine.chatOpen !== chatOpen) {
        setChatOpen(engine.chatOpen);
        if (engine.chatOpen) {
          setInput(engine.chatPrefill || '');
          engine.chatPrefill = '';
        }
      } else if (engine.chatOpen && engine.chatPrefill) {
        // atalho "/" apertado com o chat ainda aberto para o React (o ciclo de fechar e abrir coube entre duas leituras): aplica a barra mesmo assim
        setInput(engine.chatPrefill);
        engine.chatPrefill = '';
      }
    }, 50);
    return () => clearInterval(interval);
  }, [engine, chatOpen]);

  // Relógio para fazer o fade-out suave das mensagens antigas quando o chat está fechado.
  // Só roda se houver mensagens recentes não expiradas (evita setInterval perpétuo em idle).
  useEffect(() => {
    if (chatOpen || messages.length === 0) return undefined;
    const visibleTime = (visibleTimeSec ?? 10) * 1000;
    const latestTs = messages[messages.length - 1]?.timestamp || 0;
    if (Date.now() - latestTs > visibleTime + 1000) return undefined;

    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current - latestTs > visibleTime + 1000) clearInterval(timer);
    }, 200);
    return () => clearInterval(timer);
  }, [chatOpen, messages, visibleTimeSec]);

  // Posiciona o cursor após a "/" quando aberto pelo atalho de comando
  useEffect(() => {
    const el = inputRef.current;
    if (chatOpen && el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [chatOpen]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatOpen]);

  // REGRA DO CHAT: depois de enviar (ou Enter vazio) o chat fecha por engine.closeChat(), que devolve o mouse ao jogo.
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
    setHistory((prev) => [...prev.slice(-49), text]);
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
    if (e.key === 'Enter') {
      handleSend();
    } else if (e.key === 'Escape') {
      if (engine?.closeChat) engine.closeChat();
      else if (engine) engine.chatOpen = false;
      setChatOpen(false);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const newIdx = historyIdx < 0 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(newIdx);
      setInput(history[newIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < 0) return;
      const newIdx = historyIdx + 1;
      if (newIdx >= history.length) {
        setHistoryIdx(-1);
        setInput('');
      } else {
        setHistoryIdx(newIdx);
        setInput(history[newIdx]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const result = autocompleteChat(input, playerNames, CHAT_COMMANDS);
      if (result) setInput(typeof result === 'string' ? result : result[0]);
    }
  }, [handleSend, history, historyIdx, input, playerNames, engine]);

  if (chatMode === 'hidden' && !chatOpen) return null;

  const S = Math.max(1, baseS * Math.max(0.5, chatScalePct || 1));
  const myName = engine?.player?.nomeJogador || '';

  // Filtra conforme modo de chat ("visible" vs "commands_only")
  const filteredMessages = messages.filter((m) => {
    if (chatMode === 'commands_only' && m.type === 'chat') return false;
    return true;
  });

  const visibleMs = visibleTimeSec * 1000;
  const displayedMessages = chatOpen
    ? filteredMessages
    : filteredMessages.slice(-20).filter((m) => now - (m.timestamp || 0) < visibleMs + 1000);

  const boxWidth = Math.min(viewSize().w - 16, Math.round(chatWidthGui * S));
  const maxBoxHeight = Math.round((chatOpen ? heightFocusedGui : heightUnfocusedGui) * S);

  return (
    <>
      {/* Histórico do Chat no Canto Inferior Esquerdo (padrão 1.8.9, acima do nível da Hotbar) */}
      <div
        className="fixed z-50 flex flex-col justify-end select-none"
        style={{
          left: 2 * baseS,
          bottom: 28 * baseS,
          width: boxWidth,
          maxHeight: maxBoxHeight,
          pointerEvents: chatOpen ? 'auto' : 'none',
        }}
      >
        <div
          ref={scrollRef}
          className="w-full overflow-y-auto flex flex-col"
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="mt-auto flex flex-col">
            {displayedMessages.map((msg, i) => {
              let alpha = 1;
              if (!chatOpen) {
                const age = now - (msg.timestamp || 0);
                if (age > visibleMs) {
                  alpha = Math.max(0, 1 - (age - visibleMs) / 1000);
                }
              }
              return (
                <ChatLine
                  key={i}
                  msg={msg}
                  myName={myName}
                  S={baseS}
                  settings={chatSettings}
                  alpha={alpha}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Barra de digitação na parte inferior (GuiChat 1.8.9) */}
      {chatOpen && (
        <div
          className="fixed z-50 pointer-events-auto"
          style={{
            left: 2 * baseS,
            right: 2 * baseS,
            bottom: 2 * baseS,
            height: 12 * baseS,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${2 * baseS}px`,
            boxSizing: 'border-box',
          }}
        >
          <input
            data-chat-input
            ref={inputRef}
            autoFocus
            value={input}
            onChange={(e) => {
              const fix = clientStore.isOn('inputfix');
              const val = fix ? e.target.value.normalize('NFC') : e.target.value;
              setInput(val.slice(0, fix ? 256 : 100));
            }}
            onPaste={(e) => {
              if (clientStore.isOn('inputfix')) {
                const text = e.clipboardData?.getData('text') || '';
                if (text) {
                  e.preventDefault();
                  const clean = text.normalize('NFC').replace(/[\r\n\t]/g, ' ');
                  const start = e.target.selectionStart || 0;
                  const end = e.target.selectionEnd || 0;
                  const next = input.slice(0, start) + clean + input.slice(end);
                  setInput(next.slice(0, 256));
                }
              }
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!input) {
                if (engine?.closeChat) engine.closeChat();
                else if (engine) engine.chatOpen = false;
                setChatOpen(false);
              }
            }}
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#E0E0E0',
              fontFamily: "'Minecraft', monospace",
              fontSize: `${8 * baseS}px`,
              lineHeight: `${10 * baseS}px`,
              textShadow: `${baseS}px ${baseS}px 0 #3f3f3f`,
              imageRendering: 'pixelated',
            }}
          />
        </div>
      )}
    </>
  );
}
