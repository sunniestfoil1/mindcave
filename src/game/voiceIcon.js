// Ícone de microfone em cima do nome do jogador (pixel art, arquivos mic.svg e mic-muted.svg): microfone quando está falando
// (a cor mostra o tom: azul claro = baixo, branco = médio, amarelo = alto) e microfone cortado quando está mutado.
// Um sprite por jogador, só liga/desliga a visibilidade e a cor: sem redesenhar nada por quadro.
import * as THREE from 'three';
import { VOICE_MUTED, VOICE_SPEAK0 } from './net/voiceChat';

const TEX = { mic: null, muted: null };
const waiting = new Set();

function loadTexture(kind, url) {
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, 96, 96);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    TEX[kind] = tex;
    for (const s of waiting) applyState(s);
  };
  img.src = url;
}

const TIER_COLOR = [0x9fd8ff, 0xffffff, 0xffd34d];

function applyState(sprite) {
  const v = sprite.userData.voice | 0;
  const kind = v === VOICE_MUTED ? 'muted' : v >= VOICE_SPEAK0 ? 'mic' : null;
  if (!kind) { sprite.visible = false; return; }
  const tex = TEX[kind];
  if (!tex) { waiting.add(sprite); sprite.visible = false; return; }
  waiting.delete(sprite);
  if (sprite.material.map !== tex) { sprite.material.map = tex; sprite.material.needsUpdate = true; }
  sprite.material.color.setHex(kind === 'mic' ? TIER_COLOR[Math.min(2, v - VOICE_SPEAK0)] : 0xffffff);
  sprite.visible = true;
}

export function createVoiceIcon() {
  if (!TEX.mic && !loadTexture.started) {
    loadTexture.started = true;
    loadTexture('mic', '/assets/ui/mic.svg');
    loadTexture('muted', '/assets/ui/mic-muted.svg');
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.05, depthWrite: false }));
  sprite.scale.set(0.24, 0.24, 1);
  sprite.renderOrder = 999;
  sprite.visible = false;
  sprite.userData.voice = 0;
  return sprite;
}

// v = campo de estado do chat de voz (0 desligado, 1 mutado, 2 ligado, 3-5 falando)
export function setVoiceIconState(sprite, v) {
  if (!sprite || sprite.userData.voice === v) return;
  sprite.userData.voice = v;
  applyState(sprite);
}

export function disposeVoiceIcon(sprite) {
  if (!sprite) return;
  waiting.delete(sprite);
  sprite.material.dispose();
}
