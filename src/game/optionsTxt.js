// options.txt (Minecraft 1.8.9): par key:valor, uma por linha.
// Este módulo só mexe nas chaves que existem dos dois lados (formato vanilla ↔ nossas
// configurações). Chaves desconhecidas são contadas e ignoradas — nada é inventado.
import { LANGS } from './i18n';

const LANG_IDS = LANGS.map((l) => l.id);

const MAX_FPS_CHOICES = ['30', '60', '120', '260']; // opções que o seletor sabe exibir

// Conversores: toVanilla(our) → string do options.txt | null = não exportar
//              fromVanilla(str) → nosso valor     | null = valor inválido
const T = {
  num: {
    to: (v) => (Number.isFinite(Number(v)) ? String(Number(v)) : null),
    from: (v) => (Number.isFinite(Number(v)) ? Number(v) : null),
  },
  bool: {
    to: (v) => (typeof v === 'boolean' ? String(v) : null),
    from: (v) => (v === 'true' ? true : v === 'false' ? false : null),
  },
  lang: {
    to: (v) => (LANG_IDS.includes(v) ? v : null),
    from: (v) => (LANG_IDS.includes(v) ? v : null),
  },
  guiScale: {
    to: (v) => (v === 'auto' ? '0' : Number.isInteger(Number(v)) && v >= 1 && v <= 4 ? String(v) : null),
    from: (v) => (v === '0' ? 'auto' : ['1', '2', '3', '4'].includes(v) ? Number(v) : null),
  },
  enumSame: {
    to: (v) => (['all', 'decreased', 'minimal'].includes(v) ? v : null),
    from: (v) => (['all', 'decreased', 'minimal'].includes(v) ? v : null),
  },
  fancy: { // vanilla fancyGraphics:boolean ⇄ nosso graphics 'fancy'/'fast'
    to: (v) => (v === 'fancy' ? 'true' : v === 'fast' ? 'false' : null),
    from: (v) => (v === 'true' ? 'fancy' : v === 'false' ? 'fast' : null),
  },
  smoothLighting: { // vanilla boolean ⇄ 'off'/'min'/'max' ('min' vira true no export)
    to: (v) => (v === 'off' ? 'false' : v === 'min' || v === 'max' ? 'true' : null),
    from: (v) => (v === 'false' ? 'off' : v === 'true' ? 'max' : null),
  },
  clouds: { // vanilla boolean ⇄ 'off'/'fast'/'fancy'
    to: (v) => (v === 'off' ? 'false' : v === 'fast' || v === 'fancy' ? 'true' : null),
    from: (v) => (v === 'false' ? 'off' : v === 'true' ? 'fancy' : null),
  },
  ao: { // vanilla ao:boolean ⇄ ambientOcclusion 'off'/'vertex'/...
    to: (v) => (v === 'off' ? 'false' : typeof v === 'string' ? 'true' : null),
    from: (v) => (v === 'false' ? 'off' : v === 'true' ? 'vertex' : null),
  },
  gamma: { // vanilla gamma 0.0–1.0 ⇄ brightness 0–100
    to: (v) => (Number.isFinite(Number(v)) ? (Number(v) / 100).toFixed(2) : null),
    from: (v) => (Number.isFinite(Number(v)) ? Math.round(Math.min(1, Math.max(0, Number(v))) * 100) : null),
  },
  vol: { // vanilla sound* 0.0–1.0 ⇄ volume* 0–100
    to: (v) => (Number.isFinite(Number(v)) ? (Number(v) / 100).toFixed(2) : null),
    from: (v) => (Number.isFinite(Number(v)) ? Math.round(Math.min(1, Math.max(0, Number(v))) * 100) : null),
  },
  maxFps: { // só exporta o que o seletor exibe; importa aproximando para o valor mais próximo
    to: (v) => (MAX_FPS_CHOICES.includes(String(v)) ? String(v) : null),
    from: (v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      return MAX_FPS_CHOICES.reduce((a, b) => (Math.abs(n - Number(a)) <= Math.abs(n - Number(b)) ? a : b));
    },
  },
};

const MAP = [
  { vk: 'fov', path: 'user.fov', t: T.num },
  { vk: 'lang', path: 'user.lang', t: T.lang },
  { vk: 'mouseSensitivity', path: 'user.mouseSensitivity', t: T.num },
  { vk: 'invertMouse', path: 'user.invertMouse', t: T.bool },
  { vk: 'viewBobbing', path: 'user.viewBobbing', t: T.bool },
  { vk: 'showSubtitles', path: 'user.subtitles', t: T.bool },
  { vk: 'chatLinks', path: 'user.webLinks', t: T.bool },
  { vk: 'chatLinksPrompt', path: 'user.confirmLinks', t: T.bool },
  { vk: 'soundMaster', path: 'user.volumeMaster', t: T.vol },
  { vk: 'soundMusic', path: 'user.volumeMusic', t: T.vol },
  { vk: 'soundWeather', path: 'user.volumeWeather', t: T.vol },
  { vk: 'soundBlock', path: 'user.volumeBlocks', t: T.vol },
  { vk: 'soundHostile', path: 'user.volumeHostile', t: T.vol },
  { vk: 'soundNeutral', path: 'user.volumeNeutral', t: T.vol },
  { vk: 'soundPlayer', path: 'user.volumePlayers', t: T.vol },
  { vk: 'soundAmbient', path: 'user.volumeAmbient', t: T.vol },
  { vk: 'renderDistance', path: 'device.renderDistance', t: T.num },
  { vk: 'fullscreen', path: 'device.fullscreen', t: T.bool },
  { vk: 'guiScale', path: 'device.guiScale', t: T.guiScale },
  { vk: 'particles', path: 'device.particles', t: T.enumSame },
  { vk: 'mipmapLevels', path: 'device.mipmaps', t: T.num },
  { vk: 'entityShadows', path: 'device.entityShadows', t: T.bool },
  { vk: 'enableVsync', path: 'device.vsync', t: T.bool },
  { vk: 'anaglyph3d', path: 'device.anaglyph3d', t: T.bool },
  { vk: 'fancyGraphics', path: 'device.graphics', t: T.fancy },
  { vk: 'smoothLighting', path: 'device.smoothLighting', t: T.smoothLighting },
  { vk: 'clouds', path: 'device.clouds', t: T.clouds },
  { vk: 'ao', path: 'device.ambientOcclusion', t: T.ao },
  { vk: 'gamma', path: 'device.brightness', t: T.gamma },
  { vk: 'maxFps', path: 'device.maxFps', t: T.maxFps },
];

// Nosso settings → texto options.txt. { text, skipped } (skipped = chave nossa sem par vanilla)
export function exportOptionsTxt(get) {
  const lines = [];
  const skipped = [];
  for (const { vk, path, t } of MAP) {
    const raw = t.to(get(path));
    if (raw === null) { skipped.push(path); continue; }
    lines.push(`${vk}:${raw}`);
  }
  return { text: `${lines.join('\n')}\n`, skipped };
}

// options.txt → mudanças. { changes: [{path, from, to}], ignored, invalid }
export function parseOptionsTxt(text, get) {
  const byKey = new Map(MAP.map((m) => [m.vk, m]));
  const changes = [];
  const ignored = [];
  const invalid = [];
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const i = t.indexOf(':');
    if (i < 1) { invalid.push(t.slice(0, 24)); continue; }
    const vk = t.slice(0, i);
    const raw = t.slice(i + 1);
    const entry = byKey.get(vk);
    if (!entry) { ignored.push(vk); continue; }
    const to = entry.t.from(raw);
    if (to === null) { invalid.push(vk); continue; }
    const from = get(entry.path);
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ path: entry.path, from, to });
  }
  return { changes, ignored, invalid };
}
