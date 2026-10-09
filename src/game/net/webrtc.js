// Gerenciador de conexão WebRTC — PRD 15 MC15-RF-060..064
// Sinalização via entity Signal, canais confiável + não confiável, detecção de rota.
import { mindcaveApi } from '@/api/supabaseClient';
import { voiceChat } from './voiceChat';

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.services.mozilla.com' },
];

// Limpa sinais antigos (>60s) marcados como consumidos
async function cleanupSignals(roomId) {
  try {
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const res = await mindcaveApi.entities.Signal.filter({ roomId, consumed: true }, { limit: 50 });
    const items = res.items || res || [];
    for (const s of items) {
      if (s.created_date && s.created_date < cutoff) {
        await mindcaveApi.entities.Signal.delete(s.id);
      }
    }
  } catch {}
}

export class WebRTCConnection {
  constructor(opts) {
    this.isHost = opts.isHost;
    this.roomId = opts.roomId;
    this.userId = opts.userId;
    this.userName = opts.userName;
    this.peerUserId = opts.peerUserId;
    this.peerName = opts.peerName;
    this.onStateChange = opts.onStateChange || (() => {});
    this.onMessage = opts.onMessage || (() => {});
    this.onRouteChange = opts.onRouteChange || (() => {});
    this.onClose = opts.onClose || (() => {});

    this.pc = null;
    this.reliableDc = null;
    this.unreliableDc = null;
    this.state = 'idle';
    this.route = 'unknown';
    this.pingMs = null;
    this.rttHistory = [];
    this._pingTimer = null;
    this._lastPongTime = Date.now();
    this._pollTimer = null;
    this._signalUnsub = null;
    this._consumedSignals = new Set();
    this._pendingCandidates = [];
    this._closed = false;
  }

  async connect(iceServers) {
    const servers = iceServers?.length ? iceServers : DEFAULT_ICE_SERVERS;
    const Configuration = { iceServers: servers };

    this.setState('connecting');

    try {
      this.pc = new RTCPeerConnection(Configuration);

      this.pc.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          voiceChat.attachRemoteAudioStream(this.peerUserId, e.streams[0]);
        }
      };

      if (voiceChat.localStream) {
        for (const track of voiceChat.localStream.getAudioTracks()) {
          this.pc.addTrack(track, voiceChat.localStream);
        }
      }

      this.pc.oniceconnectionstatechange = () => {
        const s = this.pc.iceConnectionState;
        if (s === 'connected' || s === 'completed') {
          this._checkRoute();
        } else if (s === 'failed' || s === 'disconnected' || s === 'closed') {
          this.setState(s === 'failed' ? 'failed' : 'closed');
        }
      };

      if (!this.isHost) {
        // Cliente cria os canais de dados
        this.reliableDc = this.pc.createDataChannel('reliable', { ordered: true });
        this.unreliableDc = this.pc.createDataChannel('unreliable', { ordered: false, maxRetransmits: 0 });
        this._setupDataChannel(this.reliableDc);
        this._setupDataChannel(this.unreliableDc);

        await this._createOffer();
      } else {
        // Host espera os canais de dados do cliente
        this.pc.ondatachannel = (e) => this._setupDataChannel(e.channel);
      }

      this._listenSignals();
      cleanupSignals(this.roomId);
    } catch (e) {
      console.error('[WebRTC] erro ao criar conexão:', e);
      this.setState('failed');
    }
  }

  _listenSignals() {
    this._signalUnsub = mindcaveApi.entities.Signal.subscribe((event) => {
      const sig = event.data;
      if (!sig || sig.roomId !== this.roomId) return;
      if (sig.toUserId && sig.toUserId !== this.userId) return;
      if (sig.fromUserId === this.userId) return;
      this._handleSignal(sig);
    });

    // Poll inicial único para recuperar sinais pendentes sem gerar ping em loop
    this._checkPendingSignals();

    // Polling limitado durante a fase de conexão (máximo 8 tentativas = 12 segundos)
    let pollCount = 0;
    this._pollTimer = setInterval(async () => {
      if (this._closed || this.state !== 'connecting' || pollCount >= 8) {
        this._stopSignalListeners();
        if (this.state === 'connecting') {
          console.warn('[WebRTC] Timeout de conexão atingido');
          this.setState('failed');
        }
        return;
      }
      pollCount++;
      await this._checkPendingSignals();
    }, 1500);
  }

  async _checkPendingSignals() {
    if (this._closed || this.state === 'connected') return;
    try {
      const res = await mindcaveApi.entities.Signal.filter({
        roomId: this.roomId,
        toUserId: this.userId,
        consumed: false,
      }, { limit: 20 });
      const items = res.items || res || [];
      for (const s of items) {
        this._handleSignal(s);
      }
    } catch {}
  }

  _stopSignalListeners() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    if (this._signalUnsub) { try { this._signalUnsub(); } catch {} this._signalUnsub = null; }
  }

  _startPingLoop() {
    if (this._pingTimer) clearInterval(this._pingTimer);
    this._lastPongTime = Date.now();
    this._pingTimer = setInterval(() => {
      if (this._closed || this.state !== 'connected') {
        this._stopPingLoop();
        return;
      }
      // Se sem resposta há 4s, marca ping como nulo (barras cinzas)
      if (Date.now() - this._lastPongTime > 4000) {
        this.pingMs = null;
      }
      if (this.reliableDc && this.reliableDc.bufferedAmount > 65536) return;
      this.send({ t: 'ping', id: Math.random().toString(36).slice(2), ts: Date.now() }, true);
    }, 1000);
  }

  _stopPingLoop() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }

  async _processPendingCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this._pendingCandidates.length > 0) {
      const cand = this._pendingCandidates.shift();
      try { await this.pc.addIceCandidate(cand); } catch {}
    }
  }

  async _handleSignal(signal) {
    if (this._consumedSignals.has(signal.id)) return;
    this._consumedSignals.add(signal.id);
    try { await mindcaveApi.entities.Signal.update(signal.id, { consumed: true }); } catch {}

    if (signal.type === 'offer' && this.isHost) {
      await this.pc.setRemoteDescription({ type: 'offer', sdp: signal.data });
      await this._processPendingCandidates();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await this._sendSignal(signal.fromUserId, 'answer', answer.sdp);
    } else if (signal.type === 'answer' && !this.isHost) {
      await this.pc.setRemoteDescription({ type: 'answer', sdp: signal.data });
      await this._processPendingCandidates();
    } else if (signal.type === 'candidate') {
      try {
        const cand = JSON.parse(signal.data);
        if (this.pc && this.pc.remoteDescription) {
          await this.pc.addIceCandidate(cand);
        } else {
          this._pendingCandidates.push(cand);
        }
      } catch {}
    }
  }

  async _createOffer() {
    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this._sendSignal(this.peerUserId, 'candidate', JSON.stringify(e.candidate.toJSON()));
      }
    };
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this._sendSignal(this.peerUserId, 'offer', offer.sdp);
  }

  async handleOffer(fromUserId, offerSdp) {
    this.peerUserId = fromUserId;
    if (!this.pc) return;
    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this._sendSignal(fromUserId, 'candidate', JSON.stringify(e.candidate.toJSON()));
      }
    };
    await this.pc.setRemoteDescription({ type: 'offer', sdp: offerSdp });
    await this._processPendingCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this._sendSignal(fromUserId, 'answer', answer.sdp);
  }

  async _sendSignal(toUserId, type, data) {
    try {
      await mindcaveApi.entities.Signal.create({
        roomId: this.roomId,
        fromUserId: this.userId,
        fromName: this.userName,
        toUserId,
        type,
        data,
        consumed: false,
      });
    } catch (e) {
      console.error('[WebRTC Signal Send]', e);
    }
  }

  _setupDataChannel(dc) {
    if (dc.label === 'reliable') this.reliableDc = dc;
    else if (dc.label === 'unreliable') this.unreliableDc = dc;

    dc.onopen = () => {
      if (this.reliableDc?.readyState === 'open' || this.unreliableDc?.readyState === 'open') {
        this.setState('connected');
      }
    };
    dc.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.t === 'ping') {
          this.send({ t: 'pong', id: msg.id, ts: msg.ts }, true);
          return;
        }
        if (msg.t === 'pong') {
          const rtt = Date.now() - msg.ts;
          this._lastPongTime = Date.now();
          this.rttHistory.push(rtt);
          if (this.rttHistory.length > 10) this.rttHistory.shift();

          const sorted = [...this.rttHistory].sort((a, b) => a - b);
          let median = sorted[Math.floor(sorted.length / 2)];
          if (sorted.length >= 3) {
            const trimmed = sorted.slice(1, -1);
            median = trimmed[Math.floor(trimmed.length / 2)];
          }
          this.pingMs = Math.round(median);
          return;
        }
        this.onMessage(msg);
      } catch {}
    };
    dc.onclose = () => {
      if (this.reliableDc?.readyState !== 'open' && this.unreliableDc?.readyState !== 'open') {
        this.setState('closed');
        this.onClose();
      }
    };
  }

  send(msg, reliable = true) {
    const dc = reliable ? this.reliableDc : this.unreliableDc;
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  async _checkRoute() {
    if (!this.pc || (this.pc.iceConnectionState !== 'connected' && this.pc.iceConnectionState !== 'completed')) return;
    try {
      const stats = await this.pc.getStats();
      let route = 'direct';
      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const local = stats.get(report.localCandidateId);
          const remote = stats.get(report.remoteCandidateId);
          const types = [local?.candidateType, remote?.candidateType].filter(Boolean);
          if (types.includes('relay')) route = 'turn';
          else if (types.includes('srflx')) route = 'stun';
        }
      });
      if (route !== this.route) {
        this.route = route;
        this.onRouteChange(route);
      }
    } catch {}
  }

  setState(s) {
    if (this.state === s || this._closed) return;
    this.state = s;
    if (s === 'connected') {
      this._stopSignalListeners();
      this._startPingLoop();
    } else if (s === 'failed' || s === 'closed') {
      this._stopSignalListeners();
      this._stopPingLoop();
    }
    this.onStateChange(s);
  }

  close() {
    this._closed = true;
    this._stopSignalListeners();
    this._stopPingLoop();
    if (this.peerUserId) voiceChat.detachRemoteAudioStream(this.peerUserId);
    if (this.reliableDc) { try { this.reliableDc.close(); } catch {} }
    if (this.unreliableDc) { try { this.unreliableDc.close(); } catch {} }
    if (this.pc) { try { this.pc.close(); } catch {} }
    this.setState('closed');
  }
}