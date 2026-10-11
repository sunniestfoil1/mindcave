// Gerenciador de Chat de Voz Posicional 3D via WebRTC (PRD 26)
// Captura microfone local, calcula atenuação 3D espacial e gerencia nós de áudio
import { getAudioContext, getVoiceGain } from '../sounds';

class VoiceChatManager {
  constructor() {
    this.localStream = null;
    this.outgoingStream = null;
    this.localTrack = null;
    this.analyser = null;
    this.gateGain = null;
    this.micMuted = false;
    this.isSpeaking = false;
    this.remotePanners = new Map(); // peerId -> { panner, gainNode, mediaStreamSource, element }
    this.speakingPeers = new Set(); // set of peerIds speaking right now
    this._speakingCheckTimer = null;
    this._onVoiceStateChange = null;
    this._dspNodes = [];
  }

  getOutgoingStream() {
    return this.outgoingStream || this.localStream;
  }

  async initLocalMicrophone() {
    if (this.localStream) return this.localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localStream = stream;
      this.localTrack = stream.getAudioTracks()[0];
      if (this.localTrack) {
        this.localTrack.enabled = !this.micMuted;
      }

      const ctx = getAudioContext();
      if (ctx) {
        // === PIPELINE DE REDUÇÃO DE RUÍDO DSP LEVE EM CPU (NATIVO WEB AUDIO) ===
        // 1. High-Pass Filter (85 Hz) - Remove rumble, ventoinhas e vibração mecânica de mesa
        const highPass = ctx.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.value = 85;
        highPass.Q.value = 0.7;

        // 2. Low-Pass Filter (7500 Hz) - Remove chiados agudos (hiss) de microfones comuns
        const lowPass = ctx.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.value = 7500;
        lowPass.Q.value = 0.7;

        // 3. Compressor Dinâmico - Equilibra volumes sem distorção e sem peso em CPU
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 10;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        // 4. Noise Gate Gain Node - Corta silêncios com decaimento suave
        const gateGain = ctx.createGain();
        gateGain.gain.value = 0.0;
        this.gateGain = gateGain;

        // 5. Analisador de espectro leve (FFT 256)
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.4;

        // Conectar cadeia: Mic -> HighPass -> LowPass -> Gate -> Compressor -> Destino WebRTC
        const micSource = ctx.createMediaStreamSource(stream);
        micSource.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(gateGain);
        gateGain.connect(compressor);

        // Analyser conectado após filtros para detecção precisa de voz humana
        lowPass.connect(this.analyser);

        const dest = ctx.createMediaStreamDestination();
        compressor.connect(dest);
        this.outgoingStream = dest.stream;

        this._dspNodes = [micSource, highPass, lowPass, gateGain, compressor, dest];
        this._startSpeechDetection(ctx);
      }

      if (this._onVoiceStateChange) this._onVoiceStateChange();
      return stream;
    } catch (err) {
      console.warn('[VoiceChat] Microfone não disponível ou negado:', err);
      if (this._onVoiceStateChange) this._onVoiceStateChange();
      return null;
    }
  }

  toggleMute() {
    this.micMuted = !this.micMuted;
    if (this.localTrack) {
      this.localTrack.enabled = !this.micMuted;
    }
    if (this._onVoiceStateChange) this._onVoiceStateChange();
    return this.micMuted;
  }

  setMuted(muted) {
    this.micMuted = !!muted;
    if (this.localTrack) {
      this.localTrack.enabled = !this.micMuted;
    }
    if (this._onVoiceStateChange) this._onVoiceStateChange();
  }

  _startSpeechDetection(ctx) {
    if (this._speakingCheckTimer) clearInterval(this._speakingCheckTimer);
    const dataArray = new Uint8Array(128);

    this._speakingCheckTimer = setInterval(() => {
      if (!this.analyser || this.micMuted) {
        if (this.gateGain && ctx) {
          try { this.gateGain.gain.setTargetAtTime(0.0, ctx.currentTime, 0.05); } catch {}
        }
        if (this.isSpeaking) {
          this.isSpeaking = false;
          if (this._onVoiceStateChange) this._onVoiceStateChange();
        }
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const speakingNow = average > 14; // Sensibilidade do Noise Gate

      // Noise Gate ativo: abre para fala, fecha suavemente para ruído de fundo
      if (this.gateGain && ctx) {
        try {
          const targetGain = speakingNow ? 1.0 : 0.0;
          const timeConstant = speakingNow ? 0.015 : 0.12;
          this.gateGain.gain.setTargetAtTime(targetGain, ctx.currentTime, timeConstant);
        } catch {}
      }

      if (speakingNow !== this.isSpeaking) {
        this.isSpeaking = speakingNow;
        if (this._onVoiceStateChange) this._onVoiceStateChange();
      }
    }, 40); // 25 updates/segundo — baixíssimo custo de CPU (<0.1%)
  }

  attachRemoteAudioStream(peerId, remoteStream) {
    const ctx = getAudioContext();
    const voiceMasterGain = getVoiceGain();
    if (!ctx || !remoteStream) return;

    this.detachRemoteAudioStream(peerId);

    try {
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'linear';
      panner.refDistance = 3;   // Volume máximo até 3 blocos
      panner.maxDistance = 30;  // Alcance máximo de 30 blocos
      panner.rolloffFactor = 1;

      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.0;

      const source = ctx.createMediaStreamSource(remoteStream);
      source.connect(panner);
      panner.connect(gainNode);
      if (voiceMasterGain) {
        gainNode.connect(voiceMasterGain);
      } else {
        gainNode.connect(ctx.destination);
      }

      // Elemento de áudio escondido para garantir reprodução no navegador
      const audioEl = document.createElement('audio');
      audioEl.srcObject = remoteStream;
      audioEl.autoplay = true;
      audioEl.muted = true; // Muted no elemento DOM pois o som sai via Web Audio PannerNode

      this.remotePanners.set(peerId, {
        panner,
        gainNode,
        source,
        audioEl,
        x: 0, y: 0, z: 0,
      });
    } catch (e) {
      console.warn('[VoiceChat] Erro ao conectar PannerNode para peer:', peerId, e);
    }
  }

  updateRemotePosition(peerId, pos) {
    const item = this.remotePanners.get(peerId);
    if (!item || !item.panner || !pos) return;

    item.x = pos.x; item.y = pos.y; item.z = pos.z;
    try {
      if (item.panner.positionX) {
        item.panner.positionX.value = pos.x;
        item.panner.positionY.value = pos.y;
        item.panner.positionZ.value = pos.z;
      } else if (item.panner.setPosition) {
        item.panner.setPosition(pos.x, pos.y, pos.z);
      }
    } catch {}
  }

  setPeerSpeaking(peerId, speaking) {
    if (speaking) this.speakingPeers.add(peerId);
    else this.speakingPeers.delete(peerId);
    if (this._onVoiceStateChange) this._onVoiceStateChange();
  }

  detachRemoteAudioStream(peerId) {
    const item = this.remotePanners.get(peerId);
    if (!item) return;
    try {
      if (item.source) item.source.disconnect();
      if (item.panner) item.panner.disconnect();
      if (item.gainNode) item.gainNode.disconnect();
      if (item.audioEl) item.audioEl.remove();
    } catch {}
    this.remotePanners.delete(peerId);
    this.speakingPeers.delete(peerId);
  }

  stop() {
    if (this._speakingCheckTimer) clearInterval(this._speakingCheckTimer);
    if (this.localTrack) {
      this.localTrack.stop();
      this.localTrack = null;
    }
    if (this._dspNodes) {
      for (const node of this._dspNodes) {
        try { node.disconnect(); } catch {}
      }
      this._dspNodes = [];
    }
    this.localStream = null;
    this.outgoingStream = null;
    this.gateGain = null;
    this.analyser = null;
    for (const peerId of Array.from(this.remotePanners.keys())) {
      this.detachRemoteAudioStream(peerId);
    }
  }
}

export const voiceChat = new VoiceChatManager();
