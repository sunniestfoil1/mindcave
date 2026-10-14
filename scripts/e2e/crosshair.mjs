// Mira do 1.8.9: sprite 9×9 do icons.png em (i/2 - 7, j/2 - 7) da GUI, com ONE_MINUS_DST_COLOR / ONE_MINUS_SRC_COLOR = inverte o fundo.
// Compara dois quadros do motor real (mira ligada × escondida pelo F3): cada pixel da cruz tem de ser o fundo invertido.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname)) r.abort(); else r.continue(); });
await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 90000 });
const res = await page.evaluate(async () => {
  const { ClientWorld } = await import('/src/game/world.js');
  const { GameEngine } = await import('/src/game/engine.js');
  const { seedFromString } = await import('/src/game/prng.js');
  const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
  const { packState } = await import('/src/game/chunk.js');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:800px;height:450px;position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(canvas);
  const cw = new ClientWorld(seedFromString('88888'), new Map(), { generatorId: 'open_world', params: {} });
  const spawn = { x: 8.5, y: 100, z: 8.5 };
  const pState = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: false, sneaking: false, sprinting: false, gameMode: 'survival', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'Tester' };
  const engine = new GameEngine(canvas, { world: cw, player: pState, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: () => {}, onDeath: () => {}, onAutosave: async () => {} });
  await engine.start();
  engine.paused = false;
  for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250));
  await new Promise(r => setTimeout(r, 1500));
  // chão de pedra/grama em xadrez, câmera olhando para ele e mundo parado: os dois quadros só diferem pela mira
  for (let x = -2; x <= 18; x++) for (let z = -2; z <= 18; z++) { for (let y = 100; y <= 105; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, 99, z, packState((x + z) % 2 ? 2 : 1, 0)); }
  pState.pos = { x: 8.5, y: 100, z: 8.5 }; pState.vel = { x: 0, y: 0, z: 0 }; pState.pitch = 0.7;
  engine.tick = () => {};
  await new Promise(r => setTimeout(r, 1500));
  // o canvas não guarda o quadro depois do render: lê dentro do mesmo ciclo, logo após o desenho da mira
  const frame = () => new Promise((resolve) => {
    const orig = engine.crosshair.render.bind(engine.crosshair);
    engine.crosshair.render = (...a) => {
      orig(...a);
      engine.crosshair.render = orig;
      const c = document.createElement('canvas'); c.width = 800; c.height = 450;
      c.getContext('2d').drawImage(canvas, 0, 0);
      resolve(c.getContext('2d').getImageData(0, 0, 800, 450).data);
    };
  });
  // máquina lenta: espera o chão aparecer (quadro sem nenhum pixel colorido = malha ainda não chegou)
  let off;
  engine.f3 = true;
  for (let i = 0; i < 15; i++) {
    off = await frame();
    if (off.some((v, k) => k % 4 < 3 && v > 0)) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  engine.f3 = false;
  const on = await frame();
  engine.f3 = true;
  off = await frame();
  engine.f3 = false;
  // cruz esperada: sprite 9×9 do icons.png em (393,218) da tela, centro em (400,225)
  let plus = 0, inverted = 0, stray = 0;
  for (let y = 0; y < 450; y++) for (let x = 0; x < 800; x++) {
    const i = (y * 800 + x) * 4;
    const dx = x - 400, dy = y - 225;
    const inPlus = (dx === 0 && Math.abs(dy) <= 4) || (dy === 0 && Math.abs(dx) <= 4);
    const differs = Math.abs(on[i] - off[i]) + Math.abs(on[i + 1] - off[i + 1]) + Math.abs(on[i + 2] - off[i + 2]) > 6;
    if (inPlus) {
      plus++;
      if ([0, 1, 2].every((c) => Math.abs(on[i + c] - (255 - off[i + c])) <= 2)) inverted++;
    } else if (differs) stray++;
  }
  return { plus, inverted, stray };
});
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
ok(res.plus === 17 && res.inverted === res.plus, `os ${res.plus} pixels da cruz 9×9 são o fundo invertido (${res.inverted} confirmados)`);
ok(res.stray === 0, `nada fora da cruz muda entre mira ligada e desligada (${res.stray} pixels)`);
console.log(out.join('\n'));
await browser.close();
process.exit(out.some(l => l.startsWith('FALHA')) ? 1 : 0);
