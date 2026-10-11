// Gerenciador de Chat de Voz Posicional 3D via WebRTC (PRD 26)
// Captura microfone local, calcula atenuação 3D espacial e gerencia nós de áudio
import { getAudioContext, getVoiceGain } from '../sounds';

class VoiceChatManager {
  constructor() {
    this.localStream = null;
    this.localTrack = null;
    this.analyser = null;
    this.micMuted = false;
    this.isSpeaking = false;
    this.remotePanners = new Map(); // peerId -> { panner, gainNode, mediaStreamSource, element }
    this.speakingPeers = new Set(); // set of peerIds speaking right now
    this._speakingCheckTimer = null;
    this._onVoiceStateChange = null;
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
        const source = ctx.createMediaStreamSource(stream);
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 512;
        source.connect(this.analyser);
        this._startSpeechDetection();
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

  _startSpeechDetection() {
    if (this._speakingCheckTimer) clearInterval(this._speakingCheckTimer);
    const dataArray = new Uint8Array(256);

    this._speakingCheckTimer = setInterval(() => {
      if (!this.analyser || this.micMuted) {
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
      const speakingNow = average > 18; // Sensibilidade de voz ativa

      if (speakingNow !== this.isSpeaking) {
        this.isSpeaking = speakingNow;
        if (this._onVoiceStateChange) this._onVoiceStateChange();
      }
    }, 100);
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
    this.localStream = null;
    for (const peerId of Array.from(this.remotePanners.keys())) {
      this.detachRemoteAudioStream(peerId);
    }
  }
}

export const voiceChat = new VoiceChatManager();
