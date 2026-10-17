// Gerenciador de rede (host/cliente) — PRD 15 MC15-RF-060..064
// Host: mantém Room, aceita conexões, difunde estado do jogo.
// Cliente: conecta ao host, envia ações, recebe estado.
import { mindcaveApi, supabase } from '@/api/supabaseClient';
import { roomManager } from './roomManager';
import { WebRTCConnection } from './webrtc';
import { parseChatMessage, FloodController, systemMessage, joinMessage, leaveMessage, checkMention } from './chatSystem';
import { receiveRemoteHit } from '@/game/combat';
import { playMobSound, playEvent, playSound } from '@/game/sounds';
import { processCommand, WORLD_COMMANDS, PLAYER_COMMANDS } from '@/game/commands';
import { fillRegion, cloneRegion, validRegion } from './regionOps';
import { recordPlayerSnapshot } from './netInterpolation';
import { buildMobSnapshot } from './mobSync';
import { SPAWN_EGGS } from '@/game/spawnEggData';

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
        this.broadcast({ t: 'chat', u: userName, m: msg.m }, userId);
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
          p = { id: userId, name: userName, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw, pitch: msg.pitch };
          this.remotePlayers.set(userId, p);
        }
        recordPlayerSnapshot(p, msg);
        // Repassa posição do jogador para outros convidados via canal UDP/não confiável
        this.broadcast({ t: 'move', id: userId, n: userName, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw, pitch: msg.pitch, dead: !!msg.dead, sleeping: !!msg.sleeping, h: msg.h || 0, v: msg.v | 0, a: msg.a | 0, g: msg.g | 0 }, userId, false);
        break;
      }
      case 'sleep': {
        if (!this.remotePlayers) this.remotePlayers = new Map();
        let p = this.remotePlayers.get(userId);
        if (p) {
          p.sleeping = !!msg.sleeping;
          p.bedPos = msg.bedPos;
        }
        this.broadcast({ t: 'sleep', id: userId, sleeping: !!msg.sleeping, bedPos: msg.bedPos }, userId);
        this.engine?.checkAllSleeping?.();
        this.engine?.emitHud?.();
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
      case 'sound': {
        if (msg.mobType && msg.kind) {
          playMobSound({ typeId: msg.mobType, pos: msg.pos }, msg.kind);
        } else if (msg.event) {
          playEvent(msg.event, { pos: msg.pos, volume: msg.volume, pitch: msg.pitch });
        } else if (msg.sound) {
          playSound(msg.sound, { pos: msg.pos, volume: msg.volume, pitch: msg.pitch });
        }
        this.broadcast(msg, userId);
        break;
      }
      case 'jukebox': {
        this.engine?.jukebox?.onRemote(msg);
        this.broadcast(msg, userId);
        break;
      }
      case 'mobhit': {   // convidado bateu numa cópia: o host confere (alcance e dano) e aplica no mob de verdade
        const proxy = this.engine?._remoteProxies?.().find((r) => r.id === userId);
        this.engine?.mobs?.applyRemoteHit(msg, proxy);
        break;
      }
      case 'mobuse': {   // tesoura numa ovelha
        const proxy = this.engine?._remoteProxies?.().find((r) => r.id === userId);
        const mob = this.engine?.mobs?.findByNetId(msg.id);
        if (proxy && mob && msg.act === 'shear' && Math.hypot(proxy.pos.x - mob.pos.x, proxy.pos.z - mob.pos.z) <= 8) this.engine.shearSheep(mob);
        break;
      }
      case 'mobspawn': {   // ovo de spawn do convidado: o host cria o mob (persistente), perto de onde o convidado está
        const proxy = this.engine?._remoteProxies?.().find((r) => r.id === userId);
        const now = Date.now();
        const peer = this.peers.get(userId);
        if (!proxy || !peer || now - (peer.lastEgg || 0) < 150) break;
        const allowed = Object.values(SPAWN_EGGS).some((e) => e.mob === msg.mob);
        if (!allowed || ![msg.x, msg.y, msg.z].every(Number.isFinite) || Math.hypot(proxy.pos.x - msg.x, proxy.pos.z - msg.z) > 14) break;
        peer.lastEgg = now;
        const m = this.engine.mobs.spawn(msg.mob, { x: msg.x, y: msg.y, z: msg.z });
        if (m) m.persistent = true;
        break;
      }
      case 'blast': {   // explosão causada por um convidado: o host aplica no mundo dele e repassa aos outros
        this.engine?.applyRemoteBlast?.(msg);
        this.broadcast(msg, userId);
        break;
      }
      case 'firework': {
        this.engine?.fireworks?.launch(msg.x, msg.y, msg.z, msg.preset || 0, this.engine.player.pos);
        this.broadcast(msg, userId);
        break;
      }
      case 'item_drop': {
        if (this.engine?.itemEntities && msg.item) {
          this.engine.itemEntities.spawnItem(msg.item, msg.pos, msg.vel, msg.pickupDelay || 20);
        }
        this.broadcast(msg, userId);
        break;
      }
      case 'item_pickup': {
        if (this.engine?.itemEntities && msg.pos) {
          const items = this.engine.itemEntities.items;
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it && it.id === msg.id && Math.hypot(it.pos.x - msg.pos.x, it.pos.y - msg.pos.y, it.pos.z - msg.pos.z) < 2.0) {
              this.engine.itemEntities.removeItem(i);
              break;
            }
          }
        }
        this.broadcast(msg, userId);
        break;
      }
    }
  }

  // Comando de jogo (/fill, /give, /tp...) vindo de um convidado, já com a permissão checada:
  //  · comando de MUNDO roda aqui no host, com as coordenadas relativas (~) tomadas da posição do convidado; a resposta volta a ele;
  //  · comando de JOGADOR volta para o convidado, que o executa no próprio jogador (inventário, modo de jogo, posição...).
  _routeGameCommand(userId, text) {
    const peer = this.peers.get(userId);
    if (!peer || !text.startsWith('/')) return;
    const name = text.slice(1).split(/\s+/)[0].toLowerCase();
    const reply = (t) => peer.conn.send({ t: 'chat', system: true, text: t });
    if (PLAYER_COMMANDS.has(name)) { peer.conn.send({ t: 'runcmd', cmd: text.slice(0, 200) }); return; }
    if (!WORLD_COMMANDS.has(name)) { reply('§cComando desconhecido: /' + name); return; }
    const engine = this.engine;
    if (!engine?.player) return;
    const rp = this.remotePlayers?.get(userId);
    const pos = engine.player.pos, saved = { x: pos.x, y: pos.y, z: pos.z };
    if (rp && rp.x !== undefined) { pos.x = rp.x; pos.y = rp.y; pos.z = rp.z; }
    engine._cmdReply = reply;
    try { processCommand(engine, text); } catch (e) { reply('§cErro no comando: ' + e.message); } finally {
      engine._cmdReply = null;
      pos.x = saved.x; pos.y = saved.y; pos.z = saved.z;
    }
  }

  _handleServerCommand(userId, userName, msg) {
    const isOp = (this.room.ops || []).includes(userId);
    if (!isOp && !this.room.allowCommands) {
      this.peers.get(userId)?.conn.send({ t: 'chat', system: true, text: '§cVocê não tem permissão para usar comandos.' });
      return;
    }
    const parsed = parseChatMessage(msg.cmd, userName);
    if (!parsed) { this._routeGameCommand(userId, String(msg.cmd || '')); return; }

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

  // Estado dos mobs para cada convidado (só os que estão a até 96 blocos dele); sem mob nenhum, só avisa uma vez para as cópias sumirem
  broadcastMobs(mobs, dim) {
    for (const [uid, peer] of this.peers) {
      const rp = this.remotePlayers?.get(uid);
      const near = rp && rp.x !== undefined ? { x: rp.x, z: rp.z } : { x: this.engine.player.pos.x, z: this.engine.player.pos.z };
      const list = buildMobSnapshot(mobs.mobs, near, 96, 64, (m) => mobs.netIdOf(m));
      if (!list.length && !peer.hadMobs) continue;
      peer.hadMobs = list.length > 0;
      peer.conn.send({ t: 'mobs', dim, m: list }, false);
    }
  }

  // Um mob bateu num convidado: o convidado aplica o dano em si mesmo (armadura, janela de 10 ticks e bloqueio são dele)
  sendMobAttack(userId, payload) {
    this.peers.get(userId)?.conn.send({ t: 'mobatk', ...payload });
  }

  broadcast(msg, excludeUserId, reliable = true) {
    for (const [uid, peer] of this.peers) {
      if (uid !== excludeUserId) peer.conn.send(msg, reliable);
    }
  }

  getPing(peerUserId) {
    if (!peerUserId || peerUserId === this.user.id) return 0;
    const peer = this.peers.get(peerUserId);
    return peer?.conn?.pingMs ?? null;
  }

  getAllPings() {
    const list = [
      { name: this.engine?.player?.nomeJogador || this.user.full_name || this.user.email || 'Host', pingMs: 0, isHost: true, id: this.user.id, rank: 'owner' }
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

  sendChat(arg1, arg2) {
    let userName, text;
    if (arg2 !== undefined) {
      userName = arg1;
      text = arg2;
    } else {
      userName = this.engine?.player?.nomeJogador || this.user?.full_name || this.user?.email || 'Host';
      text = arg1;
    }
    this.onChatMessage({ type: 'chat', user: userName, text, timestamp: Date.now() });
    this.broadcast({ t: 'chat', u: userName, m: text });
  }

  // /tell — whisper direto para um convidado por nome
  sendWhisper(targetName, message) {
    const from = this.engine?.player?.nomeJogador || this.user?.full_name || this.user?.email || 'Host';
    const entry = [...this.peers.entries()].find(([_, peer]) => peer.name?.toLowerCase() === String(targetName).toLowerCase());
    if (!entry) return false;
    entry[1].conn.send({ t: 'whisper', from, m: message });
    this.onChatMessage({ type: 'whisper-out', user: from, text: message, target: entry[1].name, timestamp: Date.now() });
    return true;
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
          p = { id, name: msg.n, x: msg.x, y: msg.y, z: msg.z, yaw: msg.yaw, pitch: msg.pitch };
          this.remotePlayers.set(id, p);
        }
        recordPlayerSnapshot(p, msg);
        this.onPlayerUpdate({ id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, time: msg.t || Date.now() });
        break;
      }
      case 'plist': {
        if (Array.isArray(msg.list)) this.listCache = msg.list;
        break;
      }
      case 'sound': {
        if (msg.mobType && msg.kind) {
          playMobSound({ typeId: msg.mobType, pos: msg.pos }, msg.kind);
        } else if (msg.event) {
          playEvent(msg.event, { pos: msg.pos, volume: msg.volume, pitch: msg.pitch });
        } else if (msg.sound) {
          playSound(msg.sound, { pos: msg.pos, volume: msg.volume, pitch: msg.pitch });
        }
        break;
      }
      case 'jukebox': {
        this.engine?.jukebox?.onRemote(msg);
        break;
      }
      case 'mobs': {
        this.engine?.mobs?.applySnapshot(msg, this.engine.dimension);
        break;
      }
      case 'mobatk': {
        this.engine?.hurtByMob?.(msg.dmg, msg.who, msg);
        break;
      }
      case 'marrow': {   // flecha de esqueleto do host: o convidado a simula também e ela acerta (ou erra) o jogador dele
        this.engine?.projectiles?.spawnArrow({ id: -1, pos: msg.eye, vel: { x: 0, y: 0, z: 0 } }, msg.speed, { eye: msg.eye, shooterIsMob: true, shooterName: msg.name, lookDir: msg.dir });
        break;
      }
      case 'xp_drop': {
        this.engine?.itemEntities?.spawnXpOrb?.(msg.amount, msg.pos);
        break;
      }
      case 'blast': {
        this.engine?.applyRemoteBlast?.(msg);
        break;
      }
      case 'firework': {
        this.engine?.fireworks?.launch(msg.x, msg.y, msg.z, msg.preset || 0, this.engine.player.pos);
        break;
      }
      case 'item_drop': {
        if (this.engine?.itemEntities && msg.item) {
          this.engine.itemEntities.spawnItem(msg.item, msg.pos, msg.vel, msg.pickupDelay || 20);
        }
        break;
      }
      case 'item_pickup': {
        if (this.engine?.itemEntities && msg.pos) {
          const items = this.engine.itemEntities.items;
          for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            if (it && it.id === msg.id && Math.hypot(it.pos.x - msg.pos.x, it.pos.y - msg.pos.y, it.pos.z - msg.pos.z) < 2.0) {
              this.engine.itemEntities.removeItem(i);
              break;
            }
          }
        }
        break;
      }
      case 'sleep': {
        if (!this.remotePlayers) this.remotePlayers = new Map();
        let p = this.remotePlayers.get(msg.id);
        if (p) {
          p.sleeping = !!msg.sleeping;
          p.bedPos = msg.bedPos;
        }
        this.engine?.emitHud?.();
        break;
      }
      case 'runcmd': {
        // O host mandou executar no meu jogador um comando que eu pedi (permissão já checada por ele); só a lista de comandos de jogador
        const name = String(msg.cmd || '').slice(1).split(/\s+/)[0].toLowerCase();
        if (this.engine && PLAYER_COMMANDS.has(name)) processCommand(this.engine, msg.cmd);
        break;
      }
      case 'FILL': {
        if (this.engine?.world && validRegion(msg, ['x1', 'y1', 'z1', 'x2', 'y2', 'z2', 'blockState'])) {
          fillRegion(this.engine.world, msg);
          this.engine._cachedRaycastFrame = -1;
        }
        break;
      }
      case 'CLONE': {
        if (this.engine?.world && validRegion(msg, ['x1', 'y1', 'z1', 'x2', 'y2', 'z2', 'dx', 'dy', 'dz'])) {
          cloneRegion(this.engine.world, msg);
          this.engine._cachedRaycastFrame = -1;
        }
        break;
      }
      case 'time': {
        if (this.engine && msg.worldTime !== undefined) {
          this.engine.worldTime = msg.worldTime;
        }
        break;
      }
      case 'wake_all': {
        if (this.engine?.player?.sleeping) {
          this.engine.wakeUp();
        }
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
    const author = this.engine?.player?.nomeJogador || this.user?.full_name || this.user?.email || 'Player';
    const parsed = parseChatMessage(text, author);

    if (!parsed) {
      // Não é comando de chat — envia como comando do jogo
      this.conn.send({ t: 'cmd', cmd: text });
      return;
    }

    switch (parsed.type) {
      case 'chat':
        this.conn.send({ t: 'chat', m: parsed.text });
        this.onChatMessage({ type: 'chat', user: author, text: parsed.text, timestamp: Date.now() });
        break;
      case 'whisper':
        this.conn.send({ t: 'whisper', to: parsed.target, m: parsed.message });
        this.onChatMessage({ type: 'whisper-out', user: author, text: parsed.message, target: parsed.target, timestamp: Date.now() });
        break;
      case 'me':
        this.conn.send({ t: 'chat', m: '* ' + author + ' ' + parsed.text });
        break;

      case 'command':
        this.conn.send({ t: 'cmd', cmd: text });
        break;
    }
  }

  // /tell — convidado sussurra para o host ou outro convidado (host roteia)
  sendWhisper(to, message) {
    if (!this.conn) return false;
    const author = this.engine?.player?.nomeJogador || this.user?.full_name || this.user?.email || 'Player';
    this.conn.send({ t: 'whisper', to, m: message });
    this.onChatMessage({ type: 'whisper-out', user: author, text: message, target: to, timestamp: Date.now() });
    return true;
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

  // Golpe, tesoura e ovo do convidado: o host decide (os mobs só existem de verdade lá)
  sendMobHit(msg) { this.conn?.send({ t: 'mobhit', ...msg }); }
  sendMobUse(msg) { this.conn?.send({ t: 'mobuse', ...msg }); }
  sendMobSpawn(msg) { this.conn?.send({ t: 'mobspawn', ...msg }); }

  _applyIncomingHit(hit) {
    if (!receiveRemoteHit(this.engine?.player, hit)) return;
    this.engine.emitHud?.();
  }

  close() {
    this.conn?.close();
  }
}