// Teste de fumaça do motor REAL no Chrome headless. Rede do Supabase bloqueada (nada é gravado no banco do jogo).
import { pathToFileURL } from 'url';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 450 });
const errors = [];
await page.setRequestInterception(true);
page.on('request', (r) => { const u = new URL(r.url()); if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname)) r.abort(); else r.continue(); });
page.on('requestfailed', (r) => { if (r.url().includes('localhost')) errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|ERR_FAILED|net::/.test(t)) errors.push('console: ' + t.slice(0, 300)); } });

await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

const result = await page.evaluate(async () => {
  const out = [];
  const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
  try {
    const { ClientWorld } = await import('/src/game/world.js');
    const { GameEngine } = await import('/src/game/engine.js');
    const { seedFromString } = await import('/src/game/prng.js');
    const { DEFAULT_HOTBAR } = await import('/src/game/hotbar.js');
    const { packState, stateId, stateMeta } = await import('/src/game/chunk.js');
    const { getBlock } = await import('/src/game/blocks.js');
    const Surv = await import('/src/game/survival.js');

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:800px;height:450px;position:fixed;left:0;top:0';
    document.body.appendChild(canvas);
    const seed = seedFromString('88888');
    const cw = new ClientWorld(seed, new Map(), { generatorId: 'open_world', params: { structures: true } });
    // chão plano de teste em volta do spawn, para não depender do relevo
    const spawn = { x: 8.5, y: 100, z: 8.5 };
    const msgs = [];
    const deaths = [];
    const pState = { pos: { ...spawn }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, onGround: false, flying: false, sneaking: false, sprinting: false, gameMode: 'survival', hotbar: DEFAULT_HOTBAR.slice(), selectedSlot: 0, nomeJogador: 'Tester' };
    const engine = new GameEngine(canvas, { world: cw, player: pState, spawn, worldTime: 1000, gameRules: {}, difficulty: 'normal', onHud: () => {}, onProgress: () => {}, onChatMessage: (m) => msgs.push(m), onDeath: (d) => deaths.push(d), onAutosave: async () => {} });
    await engine.start();
    engine.paused = false;
    for (let i = 0; i < 240 && cw.chunks.size < 9; i++) await new Promise(r => setTimeout(r, 250)); // deixa o loop carregar chunks (até 60 s: o primeiro teste da suíte roda com o Vite frio)
    await new Promise(r => setTimeout(r, 1500));
    ok(cw.chunks.size > 0, `chunks carregados: ${cw.chunks.size}`);

    // plataforma de pedra 21×21 em y=99 e ar acima
    const B0 = 99;
    for (let x = -2; x <= 18; x++) for (let z = -2; z <= 18; z++) { for (let y = B0 + 1; y <= B0 + 6; y++) cw.setBlock(x, y, z, 0); cw.setBlock(x, B0, z, packState(1, 0)); }
    pState.pos = { x: 8.5, y: B0 + 1, z: 8.5 }; pState.vel = { x: 0, y: 0, z: 0 };
    const tickN = (n) => { for (let i = 0; i < n; i++) engine.tick(); };
    tickN(3);


    const ev = (code, repeat = false) => ({ code, repeat, preventDefault() {}, target: document.body });
    const run = (label, keysDown) => {
      pState.pos = { x: 8.5, y: B0 + 1, z: 0.5 }; pState.vel = { x: 0, y: 0, z: 0 }; pState.yaw = 0; pState.pitch = 0; engine.keys = {};
      for (const k of keysDown) engine.onKey(ev(k), true);
      tickN(20); const z1 = pState.pos.z; tickN(40); const z2 = pState.pos.z;
      for (const k of keysDown) engine.onKey(ev(k), false);
      out.push(`${label}: ${((z2 - z1) / 2).toFixed(2)} blocos/s | sneaking=${pState.sneaking} sprinting=${pState.sprinting} onGround=${pState.onGround} vel.z=${pState.vel.z.toFixed(3)} z=${pState.pos.z.toFixed(2)} keys=${Object.keys(engine.keys).filter(k=>engine.keys[k])}`);
      return (z2 - z1) / 2;
    };
    const walk = run('andando', ['KeyW']);
    const sneak = run('agachado', ['KeyW', 'ShiftLeft']);
    ok(walk > 4.0 && walk < 4.7, `andando ${walk.toFixed(2)} b/s (oficial 4,317)`);
    ok(sneak > 1.0 && sneak < 1.6, `agachado ${sneak.toFixed(2)} b/s (oficial ~1,3)`);
    // pulo contra cerca (1,5 de altura): segurar andar + pular não atravessa
    cw.setBlock(6, B0 + 1, 3, packState(85, 0)); cw.setBlock(7, B0 + 1, 3, packState(85, 0));
    pState.pos = { x: 6.5, y: B0 + 1, z: 0.5 }; pState.vel = { x: 0, y: 0, z: 0 }; pState.yaw = 0; engine.keys = {};
    tickN(2); engine.onKey(ev('KeyW'), true); engine.onKey(ev('Space'), true); tickN(50);
    engine.onKey(ev('KeyW'), false); engine.onKey(ev('Space'), false);
    ok(pState.pos.z < 3.2, `pulando contra a cerca o jogador não passa (z=${pState.pos.z.toFixed(2)})`);
    engine.stop?.();
  } catch (e) { out.push('ERRO ' + e.message + ' ' + (e.stack || '').split(String.fromCharCode(10)).slice(0, 4).join(' | ')); }
  return out;
});
console.log(result.join(String.fromCharCode(10)));
await browser.close();
process.exit(result.some(l => l.startsWith('FALHA') || l.startsWith('ERRO')) ? 1 : 0);
