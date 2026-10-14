// Chat de voz por aproximação: alcance pelo tom de voz (8/18/24 blocos), estado enviado aos outros jogadores e trilha sempre presente.
// Usa o microfone falso do Chrome (--use-fake-device-for-media-stream).
import { pathToFileURL } from 'url';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname)) r.abort(); else r.continue(); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const res = await page.evaluate(async () => {
  const out = [];
  const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
  const vc = await import('/src/game/net/voiceChat.js');
  const { voiceChat, VOICE_RANGES, classifyTier } = vc;
  const { getAudioContext } = await import('/src/game/sounds.js');
  ok(VOICE_RANGES.join('/') === '8/18/24', 'alcances: baixo 8, médio 18, alto 24 blocos');
  ok(classifyTier(0.02, 0.05) === 0 && classifyTier(0.05, 0.05) === 1 && classifyTier(0.12, 0.05) === 2, 'tom pelo volume relativo: sussurro, normal, voz alta');
  ok(voiceChat.getWireState() === 0, 'sem microfone o estado enviado é 0 (desligado)');
  const out0 = voiceChat.getOutgoingStream();
  ok(!!out0 && out0.getAudioTracks().length === 1, 'a trilha de saída já existe antes de ligar o microfone (sem renegociar o WebRTC)');

  // jogador remoto: o tom define o alcance do PannerNode
  const ctx = getAudioContext();
  const osc = ctx.createOscillator(); const dest = ctx.createMediaStreamDestination(); osc.connect(dest); osc.start();
  voiceChat.attachRemoteAudioStream('p1', dest.stream);
  const item = voiceChat.remotePanners.get('p1');
  for (const [v, range] of [[3, 8], [4, 18], [5, 24]]) {
    voiceChat.setRemoteVoice('p1', v);
    ok(item.panner.maxDistance === range && Math.abs(item.panner.refDistance - range * 0.55) < 1e-6, `estado ${v} (tom ${['baixo', 'médio', 'alto'][v - 3]}): alcance ${range} blocos`);
  }
  ok(voiceChat.speakingPeers.has('p1'), 'jogador falando entra na lista de quem fala');
  voiceChat.setRemoteVoice('p1', 2);
  ok(!voiceChat.speakingPeers.has('p1') && item.panner.maxDistance === 24, 'em silêncio sai da lista e o último alcance fica');
  ok(item.panner.distanceModel === 'linear', 'o volume cai linearmente até o limite do alcance');

  // microfone (falso): liga, muta, desliga
  const stream = await voiceChat.initLocalMicrophone();
  ok(!!stream && voiceChat.enabled, 'ativar o chat de voz liga o microfone');
  ok([2, 3, 4, 5].includes(voiceChat.getWireState()), `estado enviado com o microfone ligado (${voiceChat.getWireState()})`);
  voiceChat.setMuted(true);
  ok(voiceChat.getWireState() === 1, 'mutado envia o estado 1');
  voiceChat.setMuted(false);
  voiceChat.stopMicrophone();
  ok(!voiceChat.enabled && voiceChat.getWireState() === 0, 'desativar solta o microfone e volta ao estado 0');
  ok(voiceChat.getOutgoingStream() === out0, 'a trilha de saída continua a mesma depois de desativar (religar sem renegociar)');
  voiceChat.stop();
  return out;
});
console.log(res.join('\n'));
console.log('--- erros:', errors.length, errors[0] || '');
await browser.close();
process.exit(res.some((l) => l.startsWith('FALHA')) ? 1 : 0);
