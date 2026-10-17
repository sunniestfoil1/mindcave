// Celular: tela emulada com toque. Confere paisagem sem aviso, zoom travado, joystick, câmera (0,5°/px a 100% e a sensibilidade configurável), toque rápido
// x segurar, hotbar, Pular/Agachar/Inv/Pausa e a tela em pé girada por CSS (com o joystick funcionando girado). Salva prints em scripts/e2e/out.
import { pathToFileURL } from 'url';
import fs from 'fs';
import path from 'path';
const root = process.argv[2];
const port = process.argv[3] || '5181';
const puppeteer = (await import(pathToFileURL(root + '/node_modules/puppeteer/lib/puppeteer/puppeteer.js').href)).default;
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(path.join(root, 'scripts', 'e2e', 'out'), { recursive: true });
process.on('uncaughtException', (e) => { console.log(out.join('\n')); console.log('ERRO:', e && e.message); process.exit(1); });

async function open(viewport, worldId) {
  const page = await browser.newPage();
  await page.emulate({ viewport: { ...viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36' });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (/(^|\.)(supabase\.co|crafthead\.net|vercel\.com)$/.test(u.hostname) && !u.pathname.startsWith('/storage/v1/object/public/game-assets/')) {
      const h = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
      if (r.method() === 'OPTIONS') r.respond({ status: 204, headers: h });
      else r.respond({ status: 200, headers: h, contentType: 'application/json', body: '[]' });
    } else r.continue();
  });
  if (!worldId) {
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    worldId = await page.evaluate(async () => { const { createWorld } = await import('/src/game/save.js'); return (await createWorld({ name: 'Toque', seed: '123', gameMode: 'survival', mapType: 'open_world' })).id; });
  }
  await page.goto(`http://localhost:${port}/play/${worldId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__mindcave && window.__mindcave.engine && !document.querySelector('[data-loading-screen]'), { timeout: 240000, polling: 500 });
  await sleep(2500);
  await page.evaluate(async () => { window.__ms = (await import('/src/game/settingsStore.js')).settingsStore; });
  return { page, worldId };
}
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel);
const eng = (page, fn, ...a) => page.evaluate(`(${fn})(window.__mindcave.engine, ...${JSON.stringify(a)})`);
const btnRect = (page, label) => page.evaluate((l) => { const e = [...document.querySelectorAll('[data-touch-controls] [role="button"]')].find((b) => b.getAttribute('aria-label') === l); if (!e) return null; const r = e.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, label);

// ================= paisagem =================
{
  const { page, worldId } = await open({ width: 844, height: 390 });
  globalThis.__wid = worldId;
  const st = await page.evaluate(() => ({ touch: document.documentElement.classList.contains('mc-touch'), rot: document.documentElement.classList.contains('mc-rotate'), meta: document.querySelector('meta[name=viewport]').content, ta: getComputedStyle(document.body).touchAction, sw: document.documentElement.scrollWidth, iw: innerWidth, paused: window.__mindcave.engine.paused, isTouch: window.__mindcave.engine.touch }));
  ok(st.touch && !st.rot, 'celular em paisagem: modo toque ligado e a página NÃO é girada (sem aviso para virar a tela)');
  ok(st.isTouch && st.paused === false, 'o jogo começa rodando (sem menu de pausa, sem pedir trava de ponteiro)');
  ok(/user-scalable=no/.test(st.meta) && /maximum-scale=1/.test(st.meta) && st.ta === 'manipulation', 'zoom travado: viewport sem escala + touch-action manipulation (sem zoom por toque duplo)');
  ok(st.sw <= st.iw, `sem rolagem horizontal (${st.sw} ≤ ${st.iw})`);
  await page.screenshot({ path: path.join(root, 'scripts', 'e2e', 'out', 'toque-paisagem.png') });

  const s0 = await rect(page, '[data-touch-slot="0"]');
  ok(s0 && Math.round(s0.w) === 40, `GUI no celular em escala 2: slot da hotbar com 40 px de largura (${s0 && s0.w})`);

  // joystick: empurrar para cima anda; até o fim corre; soltar para
  const stick = await rect(page, '[data-touch-stick]');
  const t1 = await page.touchscreen.touchStart(stick.cx, stick.cy);
  await t1.move(stick.cx, stick.cy - 24); await sleep(150);
  let k = await eng(page, (e) => ({ w: !!e.keys.KeyW, s: !!e.keys.KeyS, a: !!e.keys.KeyA, d: !!e.keys.KeyD, sp: !!e.sprintToggled }));
  ok(k.w && !k.s && !k.a && !k.d && !k.sp, 'joystick para cima: só W, sem correr');
  await t1.move(stick.cx, stick.cy - 60); await sleep(150);
  k = await eng(page, (e) => ({ w: !!e.keys.KeyW, sp: !!e.sprintToggled }));
  ok(k.w && k.sp, 'joystick no fim do curso para a frente: corre');
  await t1.move(stick.cx + 40, stick.cy + 5); await sleep(150);
  k = await eng(page, (e) => ({ w: !!e.keys.KeyW, d: !!e.keys.KeyD, sp: !!e.sprintToggled }));
  ok(!k.w && k.d && !k.sp, 'joystick para a direita: só D');
  await t1.end(); await sleep(150);
  k = await eng(page, (e) => ({ any: ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((c) => e.keys[c]), sp: !!e.sprintToggled }));
  ok(!k.any && !k.sp, 'soltar o joystick para o personagem');

  // sensibilidade do joystick: baixa = precisa empurrar mais; alta = anda com toque leve
  await page.evaluate(() => window.__ms.set('user.touchMoveSensitivity', 25));
  const t1b = await page.touchscreen.touchStart(stick.cx, stick.cy); await t1b.move(stick.cx, stick.cy - 22); await sleep(150);
  const baixa = await eng(page, (e) => !!e.keys.KeyW);
  await t1b.end();
  await page.evaluate(() => window.__ms.set('user.touchMoveSensitivity', 200));
  const t1c = await page.touchscreen.touchStart(stick.cx, stick.cy); await t1c.move(stick.cx, stick.cy - 14); await sleep(150);
  const alta = await eng(page, (e) => !!e.keys.KeyW);
  await t1c.end();
  await page.evaluate(() => window.__ms.set('user.touchMoveSensitivity', 100));
  ok(!baixa && alta, `sensibilidade do joystick: 25% não anda com empurrão de 22 px, 200% anda com 14 px (${baixa}/${alta})`);

  // câmera: arrastar 100 px na tela = 100 × 0,25° a 100%; a 200% dobra; a 10% cai a um décimo
  const look = async (dx, dy) => {
    await eng(page, (e) => { e.player.yaw = 0; e.player.pitch = 0; });
    const t = await page.touchscreen.touchStart(600, 120);
    for (let i = 1; i <= 10; i++) await t.move(600 + dx * i / 10, 120 + dy * i / 10);
    await t.end(); await sleep(100);
    return eng(page, (e) => ({ yaw: e.player.yaw, pitch: e.player.pitch }));
  };
  let L = await look(100, 0);
  const deg = (r) => (r * 180) / Math.PI;
  ok(Math.abs(deg(L.yaw) - 50) < 2, `arrastar 100 px na horizontal gira ${deg(L.yaw).toFixed(1)}° (esperado 50° a 100%)`);
  L = await look(0, 80);
  ok(Math.abs(deg(L.pitch) - 40) < 2, `arrastar 80 px na vertical inclina ${deg(L.pitch).toFixed(1)}° (esperado 40°)`);
  await page.evaluate(() => window.__ms.set('user.touchLookSensitivity', 200));
  L = await look(100, 0);
  ok(Math.abs(deg(L.yaw) - 100) < 4, `sensibilidade 200%: ${deg(L.yaw).toFixed(1)}° (esperado 100°)`);
  await page.evaluate(() => window.__ms.set('user.touchLookSensitivity', 10));
  L = await look(100, 0);
  ok(Math.abs(deg(L.yaw) - 5) < 0.6, `sensibilidade 10%: ${deg(L.yaw).toFixed(2)}° (esperado 5°)`);
  await page.evaluate(() => window.__ms.set('user.touchLookSensitivity', 100));

  // toque rápido x segurar (espia o botão do mouse virtual)
  await eng(page, (e) => { window.__calls = []; const o = e.touchButton.bind(e); e.touchButton = (b, d) => { window.__calls.push(b + (d ? 'v' : '^')); o(b, d); }; });
  const t2 = await page.touchscreen.touchStart(500, 150); await sleep(60); await t2.end(); await sleep(100);
  let calls = await page.evaluate(() => window.__calls.splice(0));
  ok(calls.join() === '2v,2^', `toque rápido = usar/colocar (botão direito virtual): ${calls.join()}`);
  const t3 = await page.touchscreen.touchStart(500, 150); await sleep(450);
  const mid = await page.evaluate(() => window.__calls.slice());
  await t3.end(); await sleep(100);
  calls = await page.evaluate(() => window.__calls.splice(0));
  ok(mid.join() === '0v' && calls.join() === '0v,0^', `segurar = bater/quebrar enquanto o dedo está na tela e solta ao levantar: ${calls.join()}`);

  // o click que o navegador gera depois de um toque na tela de jogo é engolido (senão fecharia na hora a tela que o toque abriu)
  const gh = await page.evaluate(async () => {
    const { swallowNextClick } = await import('/src/game/touch.js');
    let n = 0; const f = () => n++; document.body.addEventListener('click', f);
    swallowNextClick(); document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const engolido = n;
    await new Promise((r) => setTimeout(r, 600));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.body.removeEventListener('click', f);
    return { engolido, depois: n };
  });
  ok(gh.engolido === 0 && gh.depois === 1, `click logo depois de um toque no jogo é engolido e o seguinte passa (${gh.engolido}/${gh.depois})`);

  // hotbar
  const s4 = await rect(page, '[data-touch-slot="4"]');
  await (await page.touchscreen.touchStart(s4.cx, s4.cy)).end(); await sleep(100);
  ok(await eng(page, (e) => e.player.selectedSlot) === 4, 'tocar no 5º slot da hotbar seleciona o slot 4');

  // pular: fica apertado enquanto o dedo está no botão
  const jump = await btnRect(page, 'Pular');
  const t4 = await page.touchscreen.touchStart(jump.cx, jump.cy); await sleep(120);
  const down = await eng(page, (e) => !!e.keys.Space);
  await t4.end(); await sleep(120);
  const up = await eng(page, (e) => !!e.keys.Space);
  ok(down && !up, 'Pular: Espaço apertado enquanto o dedo está no botão e solto ao levantar');

  // agachar: alterna e MOSTRA o estado (aceso = agachado); depois do toque o botão não fica aceso à toa (no iOS o "hover" grudava)
  const lit = () => page.evaluate(() => { const b = [...document.querySelectorAll('[data-touch-controls] [role="button"]')].find((x) => x.getAttribute('aria-label') === 'Agachar'); return b ? b.firstElementChild.style.backgroundPosition : null; });
  const dark0 = await lit();
  const sn = await btnRect(page, 'Agachar');
  await (await page.touchscreen.touchStart(sn.cx, sn.cy)).end(); await sleep(150);
  const a1 = await eng(page, (e) => !!e.keys.ShiftLeft);
  const lit1 = await lit();
  const sn2 = await btnRect(page, 'Agachar');
  await (await page.touchscreen.touchStart(sn2.cx, sn2.cy)).end(); await sleep(150);
  const a2 = await eng(page, (e) => !!e.keys.ShiftLeft);
  const lit2 = await lit();
  ok(a1 && !a2, 'Agachar liga no primeiro toque e desliga no segundo');
  ok(dark0 === lit2 && lit1 !== dark0, `Agachar fica aceso só enquanto agachado (apagado "${dark0}" → aceso "${lit1}" → apagado "${lit2}")`);

  // inventário pelo botão: abre a tela e os controles somem
  const inv = await btnRect(page, 'Inventário');
  await (await page.touchscreen.touchStart(inv.cx, inv.cy)).end(); await sleep(700);
  const invOpen = await page.evaluate(() => ({ controls: !!document.querySelector('[data-touch-controls]'), txt: /Fabricação|Inventário|Crafting/i.test(document.body.innerText) || !!document.querySelector('[data-inventory], [data-container]') }));
  ok(!invOpen.controls, 'botão Inventário (baú) abre o inventário e os controles de toque saem da frente');
  await page.screenshot({ path: path.join(root, 'scripts', 'e2e', 'out', 'toque-inventario.png') });
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }))); await sleep(500);
  // pausa e retomada por toque
  const pz = await btnRect(page, 'Pausa');
  ok(!!pz, 'botão Pausa visível com o inventário fechado');
  if (pz) {
    await (await page.touchscreen.touchStart(pz.cx, pz.cy)).end(); await sleep(600);
    ok(await eng(page, (e) => e.paused) === true, 'botão Pausa pausa o jogo');
    await page.screenshot({ path: path.join(root, 'scripts', 'e2e', 'out', 'toque-pausa.png') });
    // celular não tem Shift direito: o menu de pausa abre o Mind Client
    const mcBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('[role="button"]')].find((x) => x.getAttribute('aria-label') === 'Mind Client'); if (!b) return null; const r = b.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
    ok(!!mcBtn, 'menu de pausa no celular tem o botão Mind Client');
    if (mcBtn) {
      await (await page.touchscreen.touchStart(mcBtn.cx, mcBtn.cy)).end(); await sleep(600);
      ok(await page.evaluate(() => !!document.querySelector('[data-client-menu]')), 'tocar em Mind Client abre o menu do cliente');
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))); await sleep(500);
      await eng(page, (e) => e.touchPause()); await sleep(500);
    }
    const back = await page.evaluate(() => { const b = [...document.querySelectorAll('[role="button"]')].find((x) => /Voltar ao jogo/.test(x.getAttribute('aria-label') || '')); if (!b) return null; const r = b.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
    if (back) { await (await page.touchscreen.touchStart(back.cx, back.cy)).end(); await sleep(600); }
    ok(back && await eng(page, (e) => e.paused) === false, 'Voltar ao jogo (por toque) retoma sem precisar de trava de ponteiro');
  }
  // teclado virtual: com o campo do chat em foco a janela encolhe, mas a GUI não (senão todos os botões ficam pequenos)
  const chatBtn = await btnRect(page, 'Chat');
  await (await page.touchscreen.touchStart(chatBtn.cx, chatBtn.cy)).end(); await sleep(700);
  const typing = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
  const vs = () => page.evaluate(async () => (await import('/src/game/touch.js')).viewSize());
  const vBefore = await vs();
  await page.setViewport({ width: 844, height: 200, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await sleep(400);
  const vDuring = await vs();
  await eng(page, (e) => e.closeChat()); await sleep(300);
  await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur()); await sleep(200);
  const vAfter = await vs();
  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); await sleep(400);
  ok(typing === 'INPUT' && vDuring.h === vBefore.h && vAfter.h === 200, `teclado aberto: a área da GUI fica em ${vDuring.h} px (antes ${vBefore.h}) e acompanha a janela só quando o teclado fecha (${vAfter.h})`);

  // segurar o dedo no jogo não seleciona texto nem abre menu de contexto (iOS)
  const sel = await page.evaluate(() => { const a = new Event('selectstart', { cancelable: true, bubbles: true }); document.body.dispatchEvent(a); const b = new Event('contextmenu', { cancelable: true, bubbles: true }); document.body.dispatchEvent(b); return [a.defaultPrevented, b.defaultPrevented, getComputedStyle(document.querySelector('[data-touch-stick]') || document.body).userSelect]; });
  ok(sel[0] && sel[1] && sel[2] === 'none', `segurar o dedo não seleciona nem abre menu (selectstart bloqueado ${sel[0]}, contextmenu ${sel[1]}, user-select ${sel[2]})`);

  // escalas: HUD em 2 (dedo); menus em passos de 0,25 até a tela ter 240 de altura de GUI (senão os textos se sobrepõem)
  const sc = await page.evaluate(async () => { const m = await import('/src/game/gui/scale.js'); return { hud: m.getGuiScale(844, 330, 0), menu330: m.getMenuScale(844, 330, 0), menu390: m.getMenuScale(844, 390, 0) }; });
  ok(sc.hud === 2 && sc.menu330 === 1.25 && sc.menu330 * 1 > 0 && 330 / sc.menu330 >= 240 && 390 / sc.menu390 >= 240, `escalas no celular: HUD ${sc.hud}; menu em 330 px de altura = ${sc.menu330} (GUI de ${Math.round(330 / sc.menu330)} px) e em 390 px = ${sc.menu390} (${Math.round(390 / sc.menu390)} px)`);

  await page.close();
}

// ================= em pé: a página gira sozinha =================
{
  const { page } = await open({ width: 390, height: 844 }, globalThis.__wid);
  const st = await page.evaluate(() => {
    const r = document.getElementById('root'), b = r.getBoundingClientRect();
    return { rot: document.documentElement.classList.contains('mc-rotate'), cw: getComputedStyle(r).width, ch: getComputedStyle(r).height, bw: b.width, bh: b.height };
  });
  ok(st.rot && Math.round(parseFloat(st.cw)) === 844 && Math.round(parseFloat(st.ch)) === 390, `celular em pé: o jogo já vem deitado (raiz ${st.cw} × ${st.ch}, ocupa ${Math.round(st.bw)} × ${Math.round(st.bh)} na tela)`);
  await page.screenshot({ path: path.join(root, 'scripts', 'e2e', 'out', 'toque-em-pe.png') });
  const stick = await rect(page, '[data-touch-stick]');
  // na página girada, "para cima" do jogo é "para a direita" na tela
  const t = await page.touchscreen.touchStart(stick.cx, stick.cy);
  await t.move(stick.cx + 20, stick.cy); await sleep(150);
  const k = await eng(page, (e) => ({ w: !!e.keys.KeyW, d: !!e.keys.KeyD, a: !!e.keys.KeyA }));
  await t.end();
  ok(k.w && !k.d && !k.a, 'joystick com a página girada: empurrar para o "alto" do jogo anda para a frente');
  // câmera girada: arrastar na tela para a "direita do jogo" (que é para baixo na tela) vira para o mesmo lado que na paisagem
  await eng(page, (e) => { e.player.yaw = 0; e.player.pitch = 0; });
  const tl = await page.touchscreen.touchStart(150, 300);
  for (let i = 1; i <= 10; i++) await tl.move(150, 300 + 10 * i);
  await tl.end(); await sleep(100);
  const y = await eng(page, (e) => e.player.yaw);
  ok(Math.abs((y * 180) / Math.PI - 50) < 2, `câmera girada: 100 px "para a direita do jogo" = ${((y * 180) / Math.PI).toFixed(1)}° (esperado 50°)`);
  await page.close();
}

console.log(out.join('\n'));
await browser.close();
process.exit(out.some(l => l.startsWith('FALHA')) ? 1 : 0);
