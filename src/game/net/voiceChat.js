// Chat de voz por aproximação (WebRTC + Web Audio). O alcance depende do tom de voz de quem fala:
// baixo = 8 blocos, médio = 18, alto = 24. O tom é medido no microfone de quem fala (sem controle automático de ganho, que achataria
// o volume), em relação ao volume habitual da pessoa, e segue no estado do jogador (campo `v` da mensagem de movimento);
// quem ouve ajusta o alcance do PannerNode daquele jogador.
import { getAudioContext, getVoiceGain } from '../sounds';

export const VOICE_RANGES = [8, 18, 24];       // blocos: tom baixo, médio, alto
export const VOICE_TIER_NAMES = ['baixo', 'médio', 'alto'];
// Estado enviado aos outros jogadores (campo v): 0 desligado, 1 mutado, 2 ligado em silêncio, 3/4/5 falando em tom baixo/médio/alto
export const VOICE_OFF = 0, VOICE_MUTED = 1, VOICE_IDLE = 2, VOICE_SPEAK0 = 3;

const TICK_MS = 40;

// Tom da fala em relação ao volume habitual da pessoa: sussurro (<55%), fala normal, voz alta (>170%)
export function classifyTier(speechLevel, reference) {
  const rel = speechLevel / reference;
  return rel < 0.55 ? 0 : rel > 1.7 ? 2 : 1;
}
const FFT = 512;

class VoiceChatManager {
  constructor() {
    this.localStream = null;
    this.outDest = null;          // destino do Web Audio: a trilha enviada pelo WebRTC existe desde o início (silenciosa até o microfone ligar)
    this.outgoingStream = null;
    this.localTrack = null;
    this.analyser = null;
    this.gateGain = null;
    this.micMuted = false;
    this.isSpeaking = false;
    this.voiceTier = 1;           // 0 baixo, 1 médio, 2 alto (do jogador local)
    this.remotePanners = new Map(); // peerId -> { panner, gainNode, source, audioEl, voice, tier }
    this.speakingPeers = new Set();
    this._timer = null;
    this._onVoiceStateChange = null;
    this._dspNodes = [];
    this._buf = new Float32Array(FFT);
    // medição de nível
    this._level = 0;              // RMS suavizado
    this._noise = 0.004;          // piso de ruído do ambiente
    this._speech = 0;             // nível médio da fala em curso
    this._ref = 0.045;            // volume habitual da pessoa (vira o "médio")
    this._closeTicks = 0;
    this._tierHold = 0;
  }

  get enabled() { return !!this.localStream; }

  // Trilha de saída sempre presente: assim quem liga o microfone depois da conexão já fala sem renegociar o WebRTC
  _ensureOutgoing() {
    if (this.outgoingStream) return this.outgoingStream;
    const ctx = getAudioContext();
    if (!ctx) return null;
    this.outDest = ctx.createMediaStreamDestination();
    this.outgoingStream = this.outDest.stream;
    return this.outgoingStream;
  }

  getOutgoingStream() {
    return this._ensureOutgoing() || this.localStream;
  }

  async initLocalMicrophone() {
    if (this.localStream) return this.localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // sem autoGainControl: o ganho automático apaga a diferença entre sussurro e grito, que é o que define o alcance
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
        video: false,
      });
      this.localStream = stream;
      this.localTrack = stream.getAudioTracks()[0];
      if (this.localTrack) this.localTrack.enabled = !this.micMuted;

      const ctx = getAudioContext();
      const dest = this._ensureOutgoing() && this.outDest;
      if (ctx && dest) {
        const highPass = ctx.createBiquadFilter();   // tira ronco de ventoinha e mesa
        highPass.type = 'highpass'; highPass.frequency.value = 85; highPass.Q.value = 0.7;
        const lowPass = ctx.createBiquadFilter();    // tira chiado agudo
        lowPass.type = 'lowpass'; lowPass.frequency.value = 7500; lowPass.Q.value = 0.7;
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -24; compressor.knee.value = 10; compressor.ratio.value = 3;
        compressor.attack.value = 0.003; compressor.release.value = 0.25;
        const gateGain = ctx.createGain();           // abre na fala, fecha no silêncio
        gateGain.gain.value = 0.0;
        this.gateGain = gateGain;
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = FFT;
        this.analyser.smoothingTimeConstant = 0;

        const micSource = ctx.createMediaStreamSource(stream);
        micSource.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(gateGain);
        gateGain.connect(compressor);
        lowPass.connect(this.analyser);              // o nível é medido antes do portão e do compressor
        compressor.connect(dest);
        this._dspNodes = [micSource, highPass, lowPass, gateGain, compressor];
        this._startSpeechDetection(ctx);
      }
      this._notify();
      return stream;
    } catch (err) {
      console.warn('[VoiceChat] Microfone não disponível ou negado:', err);
      this._notify();
      return null;
    }
  }

  // Desliga o chat de voz: solta o microfone e para de enviar. A trilha de saída fica (em silêncio) para religar depois.
  stopMicrophone() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this.localTrack) { this.localTrack.stop(); this.localTrack = null; }
    for (const node of this._dspNodes) { try { node.disconnect(); } catch { /* já solto */ } }
    this._dspNodes = [];
    this.localStream = null;
    this.gateGain = null;
    this.analyser = null;
    this.isSpeaking = false;
    this._level = 0; this._speech = 0; this._closeTicks = 0;
    this._notify();
  }

  toggleMute() { this.setMuted(!this.micMuted); return this.micMuted; }

  setMuted(muted) {
    this.micMuted = !!muted;
    if (this.localTrack) this.localTrack.enabled = !this.micMuted;
    this._notify();
  }

  _notify() { if (this._onVoiceStateChange) this._onVoiceStateChange(); }

  // Estado enviado aos outros jogadores
  getWireState() {
    if (!this.enabled) return VOICE_OFF;
    if (this.micMuted) return VOICE_MUTED;
    return this.isSpeaking ? VOICE_SPEAK0 + this.voiceTier : VOICE_IDLE;
  }

  _startSpeechDetection(ctx) {
    if (this._timer) clearInterval(this._timer);
    const buf = this._buf;
    this._timer = setInterval(() => {
      if (!this.analyser || this.micMuted) {
        if (this.gateGain) { try { this.gateGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.05); } catch { /* contexto fechado */ } }
        if (this.isSpeaking) { this.isSpeaking = false; this._notify(); }
        return;
      }
      this.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      this._level = rms > this._level ? rms : this._level * 0.85 + rms * 0.15;   // sobe na hora, desce devagar

      const open = Math.max(0.012, this._noise * 2.6);
      const close = open * 0.6;
      const loud = this._level > (this.isSpeaking ? close : open);
      let changed = false;
      if (loud) {
        this._closeTicks = 0;
        if (!this.isSpeaking) { this.isSpeaking = true; this._speech = this._level; changed = true; }
      } else if (this.isSpeaking && ++this._closeTicks >= 6) {   // ~240 ms de silêncio fecha
        this.isSpeaking = false; changed = true;
      }
      if (!this.isSpeaking) {
        this._noise += (Math.min(rms, 0.03) - this._noise) * 0.05;               // aprende o ruído do ambiente
      } else {
        this._speech += (this._level - this._speech) * 0.25;
        this._ref += (Math.min(0.25, Math.max(0.01, this._speech)) - this._ref) * 0.0015; // o volume habitual acompanha a pessoa devagar
        const next = classifyTier(this._speech, this._ref);
        if (next !== this.voiceTier) {
          if (++this._tierHold >= 3) { this.voiceTier = next; this._tierHold = 0; changed = true; }  // 120 ms no novo tom
        } else this._tierHold = 0;
      }
      if (this.gateGain) {
        try { this.gateGain.gain.setTargetAtTime(this.isSpeaking ? 1.0 : 0.0, ctx.currentTime, this.isSpeaking ? 0.015 : 0.12); } catch { /* contexto fechado */ }
      }
      if (changed) this._notify();
    }, TICK_MS);
  }

  attachRemoteAudioStream(peerId, remoteStream) {
    const ctx = getAudioContext();
    const voiceMasterGain = getVoiceGain();
    if (!ctx || !remoteStream) return;
    this.detachRemoteAudioStream(peerId);
    try {
      const panner = ctx.createPanner();
      // HRTF é o mais realista mas pesa por jogador: com muita gente usa o panorama simples
      panner.panningModel = this.remotePanners.size < 4 ? 'HRTF' : 'equalpower';
      panner.distanceModel = 'linear';
      panner.rolloffFactor = 1;
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.0;
      const source = ctx.createMediaStreamSource(remoteStream);
      source.connect(panner);
      panner.connect(gainNode);
      gainNode.connect(voiceMasterGain || ctx.destination);
      // Elemento de áudio escondido: sem ele alguns navegadores não tocam o stream remoto
      const audioEl = document.createElement('audio');
      audioEl.srcObject = remoteStream;
      audioEl.autoplay = true;
      audioEl.muted = true;
      const item = { panner, gainNode, source, audioEl, voice: VOICE_OFF, tier: 1 };
      this.remotePanners.set(peerId, item);
      this._applyRange(item, 1);
    } catch (e) {
      console.warn('[VoiceChat] Erro ao conectar PannerNode para peer:', peerId, e);
    }
  }

  // Alcance do jogador pelo tom: volume cheio até 55% do alcance e some linearmente até o limite (8, 18 ou 24 blocos)
  _applyRange(item, tier) {
    const range = VOICE_RANGES[tier] ?? VOICE_RANGES[1];
    item.tier = tier;
    item.panner.refDistance = range * 0.55;
    item.panner.maxDistance = range;
  }

  // Estado de voz de outro jogador (campo v). Falando: o tom define o alcance.
  setRemoteVoice(peerId, v) {
    const item = this.remotePanners.get(peerId);
    v = v | 0;
    if (v >= VOICE_SPEAK0) this.speakingPeers.add(peerId); else this.speakingPeers.delete(peerId);
    if (!item) return;
    item.voice = v;
    if (v >= VOICE_SPEAK0) {
      const tier = Math.min(2, v - VOICE_SPEAK0);
      if (tier !== item.tier) this._applyRange(item, tier);
    }
  }

  updateRemotePosition(peerId, pos) {
    const item = this.remotePanners.get(peerId);
    if (!item || !item.panner || !pos) return;
    try {
      if (item.panner.positionX) {
        item.panner.positionX.value = pos.x;
        item.panner.positionY.value = pos.y;
        item.panner.positionZ.value = pos.z;
      } else if (item.panner.setPosition) {
        item.panner.setPosition(pos.x, pos.y, pos.z);
      }
    } catch { /* contexto fechado */ }
  }

  setPeerSpeaking(peerId, speaking) {
    if (speaking) this.speakingPeers.add(peerId); else this.speakingPeers.delete(peerId);
    this._notify();
  }

  detachRemoteAudioStream(peerId) {
    const item = this.remotePanners.get(peerId);
    if (!item) return;
    try {
      item.source?.disconnect();
      item.panner?.disconnect();
      item.gainNode?.disconnect();
      item.audioEl?.remove();
    } catch { /* já solto */ }
    this.remotePanners.delete(peerId);
    this.speakingPeers.delete(peerId);
  }

  stop() {
    this.stopMicrophone();
    for (const peerId of Array.from(this.remotePanners.keys())) this.detachRemoteAudioStream(peerId);
  }
}

export const voiceChat = new VoiceChatManager();
