// Gerenciador de rede (host/cliente) — PRD 15 MC15-RF-060..064
// Host: mantém Room, aceita conexões, difunde estado do jogo.
// Cliente: conecta ao host, envia ações, recebe estado.
import { mindcaveApi, supabase } from '@/api/supabaseClient';
import { roomManager } from './roomManager';
import { WebRTCConnection } from './webrtc';
import { parseChatMessage, FloodController, systemMessage, joinMessage, leaveMessage, checkMention } from './chatSystem';
import { receiveRemoteHit } from '@/game/combat';

// === HOST ===
export class NetHost {
  constructor(opts) {
    this.engine = opts.engine;
    this.world = opts.world;
    this.user = opts.user;
    this.room = null;
    this.peers = new Map(); // userId → { conn, name }
    this.playerNames = [opts.user.full_name || opts.user.email || 'Host'];
    this.flood = new FloodController();
    this.heartbeatTimer = null;
    this.signalUnsub = null;
    this.onChatMessage = opts.onChatMessage || (() => {});
    this.onPlayerUpdate = opts.onPlayerUpdate || (() => {});
    this._closed = false;
  }

  async start(settings) {
    this.room = await roomManager.openRoom(this.world, settings, this.user);
    this.onChatMessage(systemMessage('Mundo aberto. Código: §e§l' + this.room.code + '§r — visível para todos'));
    this.ranks = new Map(); // userId → cargo (profiles.rank)
    // O host mede o ping de cada convidado e difunde a lista a cada 2 s, para o TAB de todos mostrar o ping de todos
    this.listTimer = setInterval(() => {
      if (!this._closed && this.peers.size) this.broadcast({ t: 'plist', list: this.getAllPings().map(({ name, pingMs, isHost, rank }) => ({ name, pingMs, isHost, rank })) });
    }, 2000);

    // Heartbeat a cada 15s
    this.heartbeatTimer = setInterval(() => {
      if (this.room && !this._closed) roomManager.heartbeat(this.room.id);
    }, roomManager.HEARTBEAT_INTERVAL);

    // Escuta por sinais de join (ofertas de convidados)
    this.signalUnsub = mindcaveApi.entities.Signal.subscribe((event) => {
      if (event.type === 'delete') return;
      const s = event.data;
      if (!s || s.roomId !== this.room.id || s.toUserId !== this.user.id) return;
      if (s.type === 'offer' && !this.peers.has(s.fromUserId)) {
        this._handleNewPeer(s);
      }
    });

    // Poll inicial
    this._pollOffers();

    return this.room;
  }

  async _pollOffers() {
    try {
      const res = await mindcaveApi.entities.Signal.filter({
        roomId: this.room.id,
        toUserId: this.user.id,
        type: 'offer',
        consumed: false,
      }, { limit: 10 });
      const items = res.items || res || [];
      for (const s of items) {
        if (!this.peers.has(s.fromUserId)) this._handleNewPeer(s);
      }
    } catch {}
  }

  async _handleNewPeer(signal) {
    if (this.playerNames.length >= this.room.maxPlayers) {
      // Sala cheia
      await mindcaveApi.entities.Signal.create({
        roomId: this.room.id, fromUserId: this.user.id, fromName: this.user.full_name,
        toUserId: signal.fromUserId, type: 'join-reject', data: 'full', consumed: false,
      });
      try { await mindcaveApi.entities.Signal.update(signal.id, { consumed: true }); } catch {}
      return;
    }

    // Verifica banimento
    const banned = roomManager.getBannedList(this.room);
    if (banned.find(b => b.userId === signal.fromUserId)) {
      await mindcaveApi.entities.Signal.create({
        roomId: this.room.id, fromUserId: this.user.id, fromName: this.user.full_name,
        toUserId: signal.fromUserId, type: 'join-reject', data: 'banned', consumed: false,
      });
      try { await mindcaveApi.entities.Signal.update(signal.id, { consumed: true }); } catch {}
      return;
    }

    // Verifica whitelist
    if (this.room.whitelistEnabled && !(this.room.whitelist || []).includes(signal.fromUserId)) {
      await mindcaveApi.entities.Signal.create({
        roomId: this.room.id, fromUserId: this.user.id, fromName: this.user.full_name,
        toUserId: signal.fromUserId, type: 'join-reject', data: 'not_allowed', consumed: false,
      });
      try { await mindcaveApi.entities.Signal.update(signal.id, { consumed: true }); } catch {}
      return;
    }

    try { await mindcaveApi.entities.Signal.update(signal.id, { consumed: true }); } catch {}

    const conn = new WebRTCConnection({
      isHost: true,
      roomId: this.room.id,
      userId: this.user.id,
      userName: this.user.full_name || this.user.email || 'Host',
      peerUserId: signal.fromUserId,
      peerName: signal.fromName,
      onStateChange: (state) => {
        if (state === 'connected') {
          this.playerNames.push(signal.fromName);
          roomManager.updatePlayerList(this.room.id, this.playerNames);
          this.onChatMessage(joinMessage(signal.fromName));
          this._loadRank(signal.fromUserId);
          // Envia lista de jogadores e configurações
          conn.send({ t: 'init', motd: this.room.motd, gameMode: this.room.guestGameMode,
            allowCommands: this.room.allowCommands, pvp: this.room.pvp, players: this.playerNames });
        }
        if (state === 'closed' || state === 'failed') {
          this._removePeer(signal.fromUserId);
        }
      },
      onMessage: (msg) => this._handleGuestMessage(signal.fromUserId, signal.fromName, msg),
      onClose: () => this._removePeer(signal.fromUserId),
    });

    // Host primeiro inicializa a conexão RTCPeerConnection, depois processa a oferta
    await conn.connect();
    await conn.handleOffer(signal.fromUserId, signal.data);
    this.peers.set(signal.fromUserId, { conn, name: signal.fromName });
  }

  async _loadRank(userId) {
    try {
      const { data } = await supabase.from('profiles').select('rank').eq('id', userId).maybeSingle();
      if (data?.rank) this.ranks.set(userId, data.rank);
    } catch { /* coluna ainda não existe: fica JOGADOR */ }
  }

  _removePeer(userId) {
    const peer = this.peers.get(userId);
    if (!peer) return;
    peer.conn.close();
    this.peers.delete(userId);
    if (this.remotePlayers) this.remotePlayers.delete(userId);
    this.playerNames = this.playerNames.filter(n => n !== peer.name);
    roomManager.updatePlayerList(this.room.id, this.playerNames);
    this.onChatMessage(leaveMessage(peer.name));
  }

  _handleGuestMessage(userId, userName, msg) {
    switch (msg.t) {
      case 'chat': {
        const flood = this.flood.check(userId);
        if (!flood.allowed) {
          this.peers.get(userId)?.conn.send({ t: 'chat', system: true, text: '§c' + flood.message });
          return;
        }
        const full = '<' + userName + '> ' + msg.m;
        this.onChatMessage({ type: 'chat', user: userName, text: msg.m, timestamp: Date.now() });
        this.broadcast({ t: 'chat', u: userName, m: msg.m });
        break;
      }
      case 'whisper': {
        this.onChatMessage({ type: 'whisper', user: userName, text: msg.m, target: msg.to, timestamp: Date.now() });
        // Roteia para o destinatário
        const targetPeer = [...this.peers.entries()].find(([_, p]) => p.name === msg.to);
        if (targetPeer) {
          targetPeer[1].conn.send({ t: 'whisper', from: userName, m: msg.m });
        }
        break;
      }
      case 'BLOCK_CHANGE':
      case 'block': {
        this.engine?.world?.setBlock(msg.x, msg.y, msg.z, msg.s ?? msg.blockState);
        this.broadcast({ t: 'BLOCK_CHANGE', x: msg.x, y: msg.y, z: msg.z, blockState: msg.s ?? msg.blockState, senderId: userId }, userId);
        break;
      }
      case 'hit': {
        const isTargetHost = msg.targetId === (this.user?.id || 'host');
        if (isTargetHost) {
          this._applyIncomingHit({ ...msg, fromName: userName });
        } else {
          // Repassa para o convidado alvo
          const targetPeer = this.peers.get(msg.targetId);
          if (targetPeer) {
            targetPeer.conn.send(msg);
          } else {
            this.broadcast(msg, userId);
          }
        }
        break;
      }
      case 'move': {
        if (!this.remotePlayers) this.remotePlayers = new Map();
        let p = this.remotePlayers.get(userId);
        if (!p) {
          p = { id: userId, name: userName, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw, pitch: msg.pitch, targetX: msg.x, targetY: msg.y, targetZ: msg.z, targetYaw: msg.yaw };
          this.remotePlayers.set(userId, p);
        } else {
          p.isDead = !!msg.dead;
          p.targetX = msg.x;
          p.targetY = msg.y;
          p.targetZ = msg.z;
          p.targetYaw = msg.yaw;
          p.pitch = msg.pitch;
        }
        // Repassa posição do jogador para outros convidados
        p.isDead = !!msg.dead;
        this.broadcast({ t: 'move', id: userId, n: userName, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw, pitch: msg.pitch, dead: !!msg.dead }, userId);
        break;
      }
      case 'cmd': {
        this._handleServerCommand(userId, userName, msg);
        break;
      }
      case 'death': {
        // Convidado morreu: o host mostra e repassa aos demais; o nome vem da conexão, não da mensagem
        const text = `${userName} ${String(msg.cause || 'morreu')}`.slice(0, 160);
        this.onChatMessage({ type: 'system', text: '§f' + text, timestamp: Date.now() });
        this.broadcast({ t: 'chat', system: true, text: '§f' + text }, userId);
        break;
      }
    }
  }

  _handleServerCommand(userId, userName, msg) {
    const isOp = (this.room.ops || []).includes(userId);
    if (!isOp && !this.room.allowCommands) {
      this.peers.get(userId)?.conn.send({ t: 'chat', system: true, text: '§cVocê não tem permissão para usar comandos.' });
      return;
    }
    const parsed = parseChatMessage(msg.cmd, userName);
    if (!parsed) return;

    if (parsed.type === 'command') {
      switch (parsed.cmd) {
        case 'kick': {
          this._removePeer([...this.peers.entries()].find(([_, p]) => p.name === parsed.target)?.[0]);
          break;
        }
        case 'ban': {
          const peerEntry = [...this.peers.entries()].find(([_, p]) => p.name === parsed.target);
          if (peerEntry) {
            roomManager.addBan(this.room, peerEntry[0], parsed.target, parsed.reason);
            this._removePeer(peerEntry[0]);
          }
          break;
        }
        case 'list': {
          this.peers.get(userId)?.conn.send({ t: 'chat', system: true, text: '§7Jogadores: ' + this.playerNames.join(', ') });
          break;
        }
      }
    }
  }

  broadcast(msg, excludeUserId) {
    for (const [uid, peer] of this.peers) {
      if (uid !== excludeUserId) peer.conn.send(msg);
    }
  }

  getPing(peerUserId) {
    if (!peerUserId || peerUserId === this.user.id) return 0;
    const peer = this.peers.get(peerUserId);
    return peer?.conn?.pingMs ?? null;
  }

  getAllPings() {
    const list = [
      { name: this.user.full_name || this.user.email || 'Host', pingMs: 0, isHost: true, id: this.user.id, rank: 'owner' }
    ];
    for (const [uid, p] of this.peers) {
      list.push({
        name: p.name,
        pingMs: p.conn?.pingMs ?? null,
        isHost: false,
        id: uid,
        rank: this.ranks?.get(uid) || 'player',
      });
    }
    return list.sort((a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0) || a.name.localeCompare(b.name));
  }

  sendChat(userName, text) {
    this.onChatMessage({ type: 'chat', user: userName, text, timestamp: Date.now() });
    this.broadcast({ t: 'chat', u: userName, m: text });
  }

  sendBlock(x, y, z, state) {
    this.broadcast({ t: 'BLOCK_CHANGE', x, y, z, blockState: state });
  }

  sendBlockChange(x, y, z, blockState) {
    this.broadcast({ t: 'BLOCK_CHANGE', x, y, z, blockState });
  }

  sendHit(targetId, hit) {
    const msg = { t: 'hit', targetId, ...hit, fromName: this.user?.full_name || 'Host' };
    const peer = this.peers.get(targetId);
    if (peer) peer.conn.send(msg);
    else this.broadcast(msg);
  }

  _applyIncomingHit(hit) {
    if (!receiveRemoteHit(this.engine?.player, hit)) return;
    this.engine.emitHud?.();
  }

  async close() {
    this._closed = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.listTimer) clearInterval(this.listTimer);
    if (this.signalUnsub) this.signalUnsub();
    for (const [_, peer] of this.peers) {
      peer.conn.send({ t: 'disconnect', reason: 'Host fechou o mundo' });
      peer.conn.close();
    }
    if (this.room) await roomManager.closeRoom(this.room.id);
  }
}

// === CLIENTE ===
export class NetClient {
  constructor(opts) {
    this.engine = opts.engine;
    this.world = opts.world;
    this.user = opts.user;
    this.room = opts.room;
    this.conn = null;
    this.onChatMessage = opts.onChatMessage || (() => {});
    this.onPlayerUpdate = opts.onPlayerUpdate || (() => {});
    this.onStateChange = opts.onStateChange || (() => {});
    this.onRouteChange = opts.onRouteChange || (() => {});
    this.ignored = new Set();
  }

  getPing() {
    return this.conn?.pingMs ?? null;
  }

  getAllPings() {
    if (this.listCache) { // lista medida pelo host (ping de todos); o ping do próprio jogador é o da sua conexão
      const me = this.user.full_name || this.user.email || 'Player';
      return this.listCache.map(e => ({ ...e, id: e.name, pingMs: e.name === me ? (this.conn?.pingMs ?? e.pingMs) : e.pingMs }));
    }
    const playersList = this.room?.playerNames || [this.user.full_name || 'Player'];
    const list = playersList.map(name => {
      const isMe = name === (this.user.full_name || this.user.email || 'Player');
      const isHost = name === this.room?.hostName;
      return {
        name,
        pingMs: isMe || isHost ? (this.conn?.pingMs ?? null) : null,
        isHost,
        id: name,
      };
    });
    return list.sort((a, b) => (b.isHost ? 1 : 0) - (a.isHost ? 1 : 0) || a.name.localeCompare(b.name));
  }

  async connect(password) {
    const valid = await roomManager.verifyPassword(this.room, password);
    if (!valid) throw new Error('Senha incorreta.');

    if (this.room.buildVersion) {
      const { BUILD_VERSION } = await import('../constants');
      if (this.room.buildVersion !== BUILD_VERSION) {
        throw new Error(`Versões diferentes: o host está no build ${this.room.buildVersion} e você no ${BUILD_VERSION}. Atualizem a página.`);
      }
    }

    this.conn = new WebRTCConnection({
      isHost: false,
      roomId: this.room.id,
      userId: this.user.id,
      userName: this.user.full_name || this.user.email || 'Player',
      peerUserId: this.room.hostId,
      peerName: this.room.hostName,
      onStateChange: (s) => this.onStateChange(s),
      onRouteChange: (r) => this.onRouteChange(r),
      onMessage: (msg) => this._handleHostMessage(msg),
      onClose: () => this.onStateChange('closed'),
    });

    await this.conn.connect();
  }

  _handleHostMessage(msg) {
    switch (msg.t) {
      case 'init': {
        this.onChatMessage(systemMessage('Conectado a §e' + this.room.worldName));
        if (msg.players) this.onPlayerUpdate(msg.players);
        break;
      }
      case 'scoreboard': {
        if (this.engine?.world) {
          this.engine.world.scoreboard = msg.scoreboard;
          this.engine.emitHud();
        }
        break;
      }
      case 'chat': {
        if (msg.system) {
          this.onChatMessage({ type: 'system', text: msg.text, timestamp: Date.now() });
        } else {
          if (this.ignored.has(msg.u)) break;
          this.onChatMessage({ type: 'chat', user: msg.u, text: msg.m, timestamp: Date.now() });
        }
        break;
      }
      case 'whisper': {
        this.onChatMessage({ type: 'whisper', user: msg.from, text: msg.m, timestamp: Date.now() });
        break;
      }
      case 'BLOCK_CHANGE':
      case 'block': {
        this.engine?.world?.setBlock(msg.x, msg.y, msg.z, msg.s ?? msg.blockState);
        break;
      }
      case 'hit': {
        if (msg.targetId === (this.user?.id || 'guest')) {
          this._applyIncomingHit(msg);
        }
        break;
      }
      case 'move': {
        const id = msg.id;
        if (!this.remotePlayers) this.remotePlayers = new Map();
        let p = this.remotePlayers.get(id);
        if (!p) {
          p = { id, name: msg.n, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw, pitch: msg.pitch, targetX: msg.x, targetY: msg.y, targetZ: msg.z, targetYaw: msg.yaw };
          this.remotePlayers.set(id, p);
        } else {
          p.targetX = msg.x;
          p.targetY = msg.y;
          p.targetZ = msg.z;
          p.targetYaw = msg.yaw;
          p.pitch = msg.pitch;
        }
        p.isDead = !!msg.dead;
        // Smooth lerp towards target position
        p.x += (p.targetX - p.x) * 0.3;
        p.y += (p.targetY - p.y) * 0.3;
        p.z += (p.targetZ - p.z) * 0.3;
        p.yaw += (p.targetYaw - p.yaw) * 0.3;
        this.onPlayerUpdate({ id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, time: msg.t || Date.now() });
        break;
      }
      case 'plist': {
        if (Array.isArray(msg.list)) this.listCache = msg.list;
        break;
      }
      case 'players': {
        this.onPlayerUpdate(msg.list);
        break;
      }
      case 'disconnect': {
        this.onChatMessage(systemMessage('Desconectado: ' + (msg.reason || 'host fechou')));
        this.onStateChange('closed');
        break;
      }
    }
  }

  sendChat(text) {
    if (!this.conn) return;
    const parsed = parseChatMessage(text, this.user.full_name || this.user.email || 'Player');

    if (!parsed) {
      // Não é comando de chat — envia como comando do jogo
      this.conn.send({ t: 'cmd', cmd: text });
      return;
    }

    switch (parsed.type) {
      case 'chat':
        this.conn.send({ t: 'chat', m: parsed.text });
        this.onChatMessage({ type: 'chat', user: this.user.full_name || 'Player', text: parsed.text, timestamp: Date.now() });
        break;
      case 'whisper':
        this.conn.send({ t: 'whisper', to: parsed.target, m: parsed.message });
        this.onChatMessage({ type: 'whisper-out', user: this.user.full_name || 'Player', text: parsed.message, target: parsed.target, timestamp: Date.now() });
        break;
      case 'me':
        this.conn.send({ t: 'chat', m: '* ' + (this.user.full_name || 'Player') + ' ' + parsed.text });
        break;
      case 'command':
        this.conn.send({ t: 'cmd', cmd: text });
        break;
    }
  }

  sendBlock(x, y, z, state) {
    this.conn?.send({ t: 'BLOCK_CHANGE', x, y, z, blockState: state });
  }

  sendBlockChange(x, y, z, blockState) {
    this.conn?.send({ t: 'BLOCK_CHANGE', x, y, z, blockState });
  }

  sendMove(x, y, z, yaw, pitch) {
    this.conn?.send({ t: 'move', x, y, z, yaw, pitch }, false);
  }

  sendHit(targetId, hit) {
    this.conn?.send({ t: 'hit', targetId, ...hit, fromName: this.user?.full_name || 'Player' });
  }

  _applyIncomingHit(hit) {
    if (!receiveRemoteHit(this.engine?.player, hit)) return;
    this.engine.emitHud?.();
  }

  close() {
    this.conn?.close();
  }
}