// Jukebox: o disco mora na meta do bloco (1–12 = os discos do 1.8.9, 13–15 = os que sobraram no pacote de áudio), então a rede sincroniza o
// estado sozinha pelas mudanças de bloco; a música sai do arquivo do disco, com volume pela distância (alcance de 64 blocos como no jogo),
// subida e descida suaves, notas musicais subindo do bloco e o rádio do jogo abafado enquanto algum jukebox estiver audível.
import * as THREE from 'three';
import { settingsStore } from './settingsStore';
import { radioBus } from './radioBus';
import { stateId, stateMeta } from './chunk';
import { getPackCanvas, MC } from './pack';

export const DISCS = [null,
  { item: 2256, file: '13', title: 'C418 - 13' }, { item: 2257, file: 'cat', title: 'C418 - cat' }, { item: 2258, file: 'blocks', title: 'C418 - blocks' },
  { item: 2259, file: 'chirp', title: 'C418 - chirp' }, { item: 2260, file: 'far', title: 'C418 - far' }, { item: 2261, file: 'mall', title: 'C418 - mall' },
  { item: 2262, file: 'mellohi', title: 'C418 - mellohi' }, { item: 2263, file: 'stal', title: 'C418 - stal' }, { item: 2264, file: 'strad', title: 'C418 - strad' },
  { item: 2265, file: 'ward', title: 'C418 - ward' }, { item: 2266, file: '11', title: 'C418 - 11' }, { item: 2267, file: 'wait', title: 'C418 - wait' },
  { item: 2268, file: '5', title: 'Samuel Aberg - 5' }, { item: 2269, file: 'otherside', title: 'Lena Raine - otherside' }, { item: 2270, file: 'pigstep', title: 'Lena Raine - Pigstep' },
];
export const discMetaForItem = (id) => { const i = DISCS.findIndex((d, k) => k > 0 && d.item === id); return i > 0 ? i : 0; };

const RANGE = 64;            // blocos (tocar disco: volume 4,0 → 16 × 4)
const NOTE_LIFE = 28;        // ticks

let _noteTex = null;
function noteTexture() {
  if (_noteTex) return _noteTex;
  const cv = document.createElement('canvas');
  cv.width = 32; cv.height = 32;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#fff'; g.font = '28px Minecraft, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 16, 18);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  getPackCanvas(MC + 'textures/particle/particles.png').then((src) => {
    if (!src) return;
    const k = src.width / 128;
    g.clearRect(0, 0, 32, 32);
    g.drawImage(src, 0, 32 * k, 8 * k, 8 * k, 0, 0, 32, 32);   // EntityNoteFX: índice 64 → coluna 0, linha 4 do atlas de partículas 128×128
    tex.needsUpdate = true;
  }).catch(() => {});
  _noteTex = tex;
  return tex;
}

export class JukeboxManager {
  constructor(scene) {
    this.scene = scene;
    this.playing = new Map();   // "x,y,z" → { x, y, z, disc, audio, vol, startMs, ended }
    this.notes = [];
    this.tick = 0;
    this.quiet = 0;
    this.onNowPlaying = null;
  }

  _key(x, y, z) { return x + ',' + y + ',' + z; }

  _recordVolume() { return Math.max(0, Math.min(1, ((settingsStore.get('user.volumeRecords') ?? 100) / 100) * ((settingsStore.get('user.volumeMaster') ?? 100) / 100))); }

  play(x, y, z, disc, startMs = Date.now(), announce = false) {
    const d = DISCS[disc];
    if (!d) return;
    this.stop(x, y, z);
    const audio = new Audio(`/assets/sounds/records/${d.file}.ogg`);
    audio.preload = 'auto';
    audio.volume = 0;
    const e = { x, y, z, disc, audio, vol: 0, startMs, ended: false };
    audio.addEventListener('ended', () => { e.ended = true; });
    audio.addEventListener('loadedmetadata', () => {
      const off = (Date.now() - startMs) / 1000;
      if (off > 1) { if (off >= audio.duration) e.ended = true; else { try { audio.currentTime = off; } catch { /* ainda não dá para buscar */ } } }
    });
    audio.play().catch(() => {});
    this.playing.set(this._key(x, y, z), e);
    if (announce && this.onNowPlaying) this.onNowPlaying(d.title);
  }

  stop(x, y, z) {
    const k = this._key(x, y, z);
    const e = this.playing.get(k);
    if (!e) return;
    try { e.audio.pause(); e.audio.src = ''; } catch { /* já parou */ }
    this.playing.delete(k);
  }

  // pacote de rede { x, y, z, disc, startMs }: disc 0 = parou
  onRemote(msg) {
    if (!msg) return;
    if (!msg.disc) this.stop(msg.x, msg.y, msg.z);
    else this.play(msg.x, msg.y, msg.z, msg.disc, msg.startMs || Date.now(), false);
  }

  // A cada tick: volume pela distância (anda 10% do caminho até o alvo), abafa o rádio, notas, e confere se o jukebox ainda existe
  update(world, pos) {
    this.tick++;
    let audible = false;
    for (const e of [...this.playing.values()]) {
      if (this.tick % 20 === 0) {
        const st = world.getBlock(e.x, e.y, e.z);
        if (stateId(st) !== 84 || stateMeta(st) !== e.disc) { this.stop(e.x, e.y, e.z); continue; }
      }
      const dist = Math.hypot(pos.x - (e.x + 0.5), pos.y + 1 - (e.y + 0.5), pos.z - (e.z + 0.5));
      const target = e.ended ? 0 : Math.max(0, 1 - dist / RANGE) * this._recordVolume();
      e.vol += (target - e.vol) * 0.1;
      try { e.audio.volume = Math.max(0, Math.min(1, e.vol)); } catch { /* sem áudio */ }
      if (e.vol > 0.03 && !e.ended) {
        audible = true;
        if (dist < 20 && this.tick % 14 === 0) this._note(e);
      }
    }
    if (audible) { this.quiet = 0; radioBus.duck('jukebox'); }
    else if (radioBus.isDucked() && ++this.quiet > 50) radioBus.release('jukebox');
    this._tickNotes();
  }

  _note(e) {
    const m = new THREE.SpriteMaterial({ map: noteTexture(), transparent: true, depthWrite: false, fog: false });
    const f = Math.floor(Math.random() * 24) / 24;   // a nota tem uma cor própria (EntityNoteFX): três senóides defasadas
    m.color.setRGB(Math.max(0, Math.sin((f + 0) * Math.PI * 2) * 0.65 + 0.35), Math.max(0, Math.sin((f + 1 / 3) * Math.PI * 2) * 0.65 + 0.35), Math.max(0, Math.sin((f + 2 / 3) * Math.PI * 2) * 0.65 + 0.35));
    const s = new THREE.Sprite(m);
    s.scale.set(0.35, 0.35, 1);
    s.position.set(e.x + 0.25 + Math.random() * 0.5, e.y + 1.15, e.z + 0.25 + Math.random() * 0.5);
    s.renderOrder = 6;
    this.scene.add(s);
    this.notes.push({ s, age: 0 });
  }

  _tickNotes() {
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      n.age++;
      n.s.position.y += 0.03; n.s.position.x += Math.sin(n.age * 0.4) * 0.004;
      n.s.material.opacity = Math.min(1, (NOTE_LIFE - n.age) / 8);
      if (n.age >= NOTE_LIFE) { this.scene.remove(n.s); n.s.material.dispose(); this.notes.splice(i, 1); }
    }
  }

  dispose() {
    for (const e of [...this.playing.values()]) this.stop(e.x, e.y, e.z);
    this.notes.forEach((n) => { this.scene.remove(n.s); n.s.material.dispose(); });
    this.notes = [];
    radioBus.release('jukebox');
  }
}
