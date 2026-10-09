// Sistema de chat — PRD 15 MC15-RF-050..053
// Formatação §, comandos 1.8.9, flood control, autocomplete, histórico.
import { BLOCK_NAMES } from '../blocks';

// Cores § do Minecraft 1.8.9
export const MC_COLORS = {
  '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
  '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
  '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
  'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF',
};

// Parseia § codes → array de { text, style }
export function parseMcCodes(text) {
  if (!text || typeof text !== 'string') text = '';
  const parts = [];
  let style = { color: '#FFFFFF', bold: false, italic: false, underline: false, strikethrough: false };
  let buffer = '';

  for (let i = 0; i < text.length; i++) {
    if ((text[i] === '§' || text[i] === '&') && i + 1 < text.length) {
      if (buffer) { parts.push({ text: buffer, style: { ...style } }); buffer = ''; }
      const code = text[i + 1].toLowerCase();
      if (MC_COLORS[code]) style.color = MC_COLORS[code];
      else if (code === 'l') style.bold = true;
      else if (code === 'o') style.italic = true;
      else if (code === 'n') style.underline = true;
      else if (code === 'm') style.strikethrough = true;
      else if (code === 'r') style = { color: '#FFFFFF', bold: false, italic: false, underline: false, strikethrough: false };
      i++;
    } else {
      buffer += text[i];
    }
  }
  if (buffer) parts.push({ text: buffer, style: { ...style } });
  return parts;
}

// Detecta URLs no texto
export function extractLinks(text) {
  if (!text || typeof text !== 'string') text = '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = [];
  let lastIdx = 0;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push({ type: 'text', text: text.slice(lastIdx, match.index) });
    parts.push({ type: 'link', text: match[0] });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push({ type: 'text', text: text.slice(lastIdx) });
  return parts.length > 0 ? parts : [{ type: 'text', text }];
}

// === Flood control ===
export class FloodController {
  constructor() {
    this._msgTimes = new Map(); // userId → [timestamps]
  }

  check(userId) {
    const now = Date.now();
    let times = this._msgTimes.get(userId) || [];
    times = times.filter(t => now - t < 2000);
    if (times.length >= 5) {
      this._msgTimes.set(userId, times);
      return { allowed: false, cooldown: 3000, message: 'Calma aí! Você está enviando mensagens rápido demais.' };
    }
    times.push(now);
    this._msgTimes.set(userId, times);
    return { allowed: true };
  }
}

// === Autocomplete ===
export function autocompleteChat(partial, players, commands) {
  if (!partial || typeof partial !== 'string') return null;
  if (partial.startsWith('/')) {
    const parts = partial.slice(1).split(' ');
    if (parts.length === 1) {
      const cmd = parts[0].toLowerCase();
      const matches = (commands || []).filter(c => c.startsWith(cmd));
      return matches.length === 1 ? '/' + matches[0] + ' ' : matches.length > 1 ? matches.map(m => '/' + m) : null;
    }
    // Autocomplete player name as argument
    const lastArg = parts[parts.length - 1] || '';
    if (lastArg.length > 0) {
      const matches = (players || []).filter(p => p.toLowerCase().startsWith(lastArg.toLowerCase()));
      if (matches.length === 1) {
        parts[parts.length - 1] = matches[0];
        return '/' + parts.join(' ');
      }
    }
  } else {
    if (partial.length === 0) return null;
    const matches = (players || []).filter(p => p.toLowerCase().startsWith(partial.toLowerCase()));
    if (matches.length === 1) return matches[0] + ' ';
  }
  return null;
}

// === Comandos de chat 1.8.9 ===
export const CHAT_COMMANDS = [
  'tell', 'msg', 'w', 'r', 'me', 'say', 'tellraw', 'title',
  'ignore', 'unignore', 'list', 'kick', 'ban', 'pardon', 'banlist',
  'whitelist', 'op', 'deop', 'publish', 'close', 'save-all',
  'save-on', 'save-off', 'setidletimeout', 'defaultgamemode',
];

// Processa mensagem de chat → retorna { type, target, text, system } ou null se não for comando
export function parseChatMessage(text, userName) {
  if (!text || typeof text !== 'string') return null;
  if (!text.startsWith('/')) {
    return { type: 'chat', user: userName, text: text.slice(0, 100) };
  }
  const parts = text.slice(1).split(' ');
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (cmd) {
    case 'tell': case 'msg': case 'w': {
      const target = parts[1];
      const message = parts.slice(2).join(' ');
      return { type: 'whisper', target, message, user: userName };
    }
    case 'r': {
      return { type: 'whisper-reply', message: args, user: userName };
    }
    case 'me': {
      return { type: 'me', text: args, user: userName };
    }
    case 'say': {
      return { type: 'say', text: args, user: userName };
    }
    case 'ignore': {
      return { type: 'command', cmd: 'ignore', target: parts[1] };
    }
    case 'unignore': {
      return { type: 'command', cmd: 'unignore', target: parts[1] };
    }
    case 'list': {
      return { type: 'command', cmd: 'list' };
    }
    case 'kick': {
      return { type: 'command', cmd: 'kick', target: parts[1], reason: parts.slice(2).join(' ') };
    }
    case 'ban': {
      return { type: 'command', cmd: 'ban', target: parts[1], reason: parts.slice(2).join(' ') };
    }
    case 'pardon': {
      return { type: 'command', cmd: 'pardon', target: parts[1] };
    }
    case 'banlist': {
      return { type: 'command', cmd: 'banlist' };
    }
    case 'whitelist': {
      return { type: 'command', cmd: 'whitelist', action: parts[1], target: parts[2] };
    }
    case 'op': {
      return { type: 'command', cmd: 'op', target: parts[1] };
    }
    case 'deop': {
      return { type: 'command', cmd: 'deop', target: parts[1] };
    }
    case 'publish': {
      return { type: 'command', cmd: 'publish' };
    }
    case 'close': {
      return { type: 'command', cmd: 'close' };
    }
    case 'save-all': {
      return { type: 'command', cmd: 'save-all' };
    }
    case 'defaultgamemode': {
      return { type: 'command', cmd: 'defaultgamemode', mode: parts[1] };
    }
    case 'setidletimeout': {
      return { type: 'command', cmd: 'setidletimeout', minutes: parseInt(parts[1]) || 0 };
    }
    default:
      return null; // Not a chat command — pass to game command processor
  }
}

// Formata mensagem de sistema
export function systemMessage(text) {
  return { type: 'system', text: '§7' + (text || ''), timestamp: Date.now() };
}

export function joinMessage(userName) {
  return { type: 'system', text: '§e' + (userName || 'Jogador') + ' entrou no jogo', timestamp: Date.now() };
}

export function leaveMessage(userName) {
  return { type: 'system', text: '§e' + (userName || 'Jogador') + ' saiu do jogo', timestamp: Date.now() };
}

export function deathMessage(userName, cause) {
  return { type: 'system', text: '§7' + (userName || 'Jogador') + ' morreu', timestamp: Date.now() };
}

// Verifica menção
export function checkMention(text, myName) {
  if (!text || typeof text !== 'string' || !myName) return false;
  const lower = text.toLowerCase();
  return lower.includes('@' + myName.toLowerCase()) || lower.includes(myName.toLowerCase());
}