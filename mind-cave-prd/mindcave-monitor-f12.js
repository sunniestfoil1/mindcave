/* =====================================================================
   MIND CAVE — MONITOR DE DESEMPENHO (colar no Console do F12)
   ---------------------------------------------------------------------
   Como usar:
   1. Entre no mundo (com o jogo já carregado).
   2. F12 → aba Console → cole TUDO isto → Enter.
      (Se o Chrome bloquear colar, digite: allow pasting  e Enter antes)
   3. Volte para o jogo e faça o roteiro que aparece no canto da tela
      (parado 10 s → olhando o céu 10 s → andando 20 s → girando 10 s).
   4. Ao terminar, o relatório é copiado automaticamente.
      Se não copiar: no Console digite  copy(MC_REPORT)  e Enter.
   5. Cole o relatório na conversa.
   Parar antes: MC_STOP()
   ===================================================================== */
(() => {
  if (window.MC_STOP) { try { window.MC_STOP(true); } catch (e) {} }

  const DURATION_S = 50;
  const PHASES = [
    { name: 'parado', until: 10, hint: 'Fique PARADO olhando o horizonte' },
    { name: 'ceu', until: 20, hint: 'Olhe para o CÉU, parado' },
    { name: 'andando', until: 40, hint: 'ANDE/CORRA em linha reta (W + Ctrl)' },
    { name: 'girando', until: 50, hint: 'GIRE a câmera 360° devagar' },
  ];
  const now = () => performance.now();
  const t0 = now();
  const phaseOf = (t) => { const s = (t - t0) / 1000; return (PHASES.find(p => s < p.until) || PHASES[PHASES.length - 1]).name; };

  // ---------- estado ----------
  const R = {
    meta: {}, phases: {}, longTasks: [], loaf: [], gl: {}, workers: {}, timers: {},
    dom: { mutations: 0 }, console: { errors: [], warns: 0 }, memory: [], scripts: {},
  };
  const newPhase = () => ({
    frames: 0, frameTimes: [], over33: 0, over50: 0, over100: 0, worst: 0,
    draws: 0, triangles: 0, bufferUploads: 0, bufferBytes: 0, texUploads: 0,
    texBytes: 0, shaderCompiles: 0, programLinks: 0, createBuffer: 0, deleteBuffer: 0,
    useProgram: 0, bindTexture: 0, workerMsgsIn: 0, workerMsgsOut: 0, workerBytesOut: 0,
    domMutations: 0, longTaskMs: 0, rafCallbacks: 0, timeouts: 0, intervals: 0,
  });
  PHASES.forEach(p => (R.phases[p.name] = newPhase()));
  const P = () => R.phases[phaseOf(now())];

  // ---------- meta ----------
  R.meta.url = location.href;
  R.meta.userAgent = navigator.userAgent;
  R.meta.cores = navigator.hardwareConcurrency;
  R.meta.deviceMemoryGB = navigator.deviceMemory;
  R.meta.dpr = devicePixelRatio;
  R.meta.screen = `${screen.width}x${screen.height}`;
  R.meta.window = `${innerWidth}x${innerHeight}`;
  R.meta.crossOriginIsolated = window.crossOriginIsolated;
  R.meta.reactDevMode = !!document.querySelector('[data-reactroot]') || undefined;

  // ---------- canvas / WebGL ----------
  const canvases = [...document.querySelectorAll('canvas')].map(c => ({
    el: c, w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight,
  }));
  R.meta.canvases = canvases.map(c => ({ size: `${c.w}x${c.h}`, css: `${c.cssW}x${c.cssH}`, scale: c.cssW ? +(c.w / c.cssW).toFixed(2) : null }));
  let gl = null;
  for (const c of canvases) {
    gl = c.el.getContext('webgl2') || c.el.getContext('webgl');
    if (gl) break;
  }
  if (gl) {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    R.gl.version = gl.getParameter(gl.VERSION);
    R.gl.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    R.gl.vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    R.gl.softwareRender = /swiftshader|llvmpipe|basic render|software/i.test(R.gl.renderer || '');
    R.gl.attrs = gl.getContextAttributes();
    R.gl.maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    R.gl.multiDraw = !!gl.getExtension('WEBGL_multi_draw');
    R.gl.isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  } else {
    R.gl.error = 'Nenhum contexto WebGL encontrado no canvas';
  }

  // ---------- patch WebGL (protótipo) ----------
  const restore = [];
  const patch = (proto, name, fn) => {
    if (!proto || !proto[name]) return;
    const orig = proto[name];
    proto[name] = function (...a) { try { fn.apply(this, a); } catch (e) {} return orig.apply(this, a); };
    restore.push(() => (proto[name] = orig));
  };
  const modeTris = (mode, count) => (mode === 4 ? count / 3 : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0);
  const protos = [window.WebGLRenderingContext && WebGLRenderingContext.prototype, window.WebGL2RenderingContext && WebGL2RenderingContext.prototype].filter(Boolean);
  for (const pr of protos) {
    patch(pr, 'drawArrays', (m, f, c) => { const p = P(); p.draws++; p.triangles += modeTris(m, c); });
    patch(pr, 'drawElements', (m, c) => { const p = P(); p.draws++; p.triangles += modeTris(m, c); });
    patch(pr, 'drawArraysInstanced', (m, f, c, n) => { const p = P(); p.draws++; p.triangles += modeTris(m, c) * n; });
    patch(pr, 'drawElementsInstanced', (m, c, t, o, n) => { const p = P(); p.draws++; p.triangles += modeTris(m, c) * n; });
    patch(pr, 'bufferData', (t, d) => { const p = P(); p.bufferUploads++; p.bufferBytes += (d && d.byteLength) || (typeof d === 'number' ? d : 0); });
    patch(pr, 'bufferSubData', (t, o, d) => { const p = P(); p.bufferUploads++; p.bufferBytes += (d && d.byteLength) || 0; });
    patch(pr, 'texImage2D', (...a) => { const p = P(); p.texUploads++; const d = a.find(x => x && x.byteLength); p.texBytes += d ? d.byteLength : 0; });
    patch(pr, 'texSubImage2D', () => { P().texUploads++; });
    patch(pr, 'texImage3D', (...a) => { const p = P(); p.texUploads++; const d = a.find(x => x && x.byteLength); p.texBytes += d ? d.byteLength : 0; });
    patch(pr, 'texSubImage3D', () => { P().texUploads++; });
    patch(pr, 'compileShader', () => { P().shaderCompiles++; });
    patch(pr, 'linkProgram', () => { P().programLinks++; });
    patch(pr, 'createBuffer', () => { P().createBuffer++; });
    patch(pr, 'deleteBuffer', () => { P().deleteBuffer++; });
    patch(pr, 'useProgram', () => { P().useProgram++; });
    patch(pr, 'bindTexture', () => { P().bindTexture++; });
  }
  // multi draw
  if (gl) {
    const md = gl.getExtension('WEBGL_multi_draw');
    if (md) {
      const mp = Object.getPrototypeOf(md);
      patch(mp, 'multiDrawElementsWEBGL', (m, c, co, t, o, oo, n) => { const p = P(); p.draws++; for (let i = 0; i < n; i++) p.triangles += modeTris(m, c[co + i]); });
      patch(mp, 'multiDrawArraysWEBGL', (m, f, fo, c, co, n) => { const p = P(); p.draws++; for (let i = 0; i < n; i++) p.triangles += modeTris(m, c[co + i]); });
    }
  }

  // ---------- Workers (novos e mensagens) ----------
  const OrigWorker = window.Worker;
  let workersCreated = 0;
  if (OrigWorker) {
    window.Worker = function (...a) {
      workersCreated++;
      const w = new OrigWorker(...a);
      w.addEventListener('message', () => { P().workerMsgsIn++; });
      return w;
    };
    window.Worker.prototype = OrigWorker.prototype;
    restore.push(() => (window.Worker = OrigWorker));
  }
  const origPost = OrigWorker && OrigWorker.prototype.postMessage;
  if (origPost) {
    OrigWorker.prototype.postMessage = function (msg, transfer) {
      try {
        const p = P(); p.workerMsgsOut++;
        if (msg && msg.byteLength) p.workerBytesOut += msg.byteLength;
        R.workers.transferUsed = (R.workers.transferUsed || 0) + (transfer && (transfer.length || (transfer.transfer && transfer.transfer.length)) ? 1 : 0);
        R.workers.noTransfer = (R.workers.noTransfer || 0) + (transfer ? 0 : 1);
      } catch (e) {}
      return origPost.apply(this, arguments);
    };
    restore.push(() => (OrigWorker.prototype.postMessage = origPost));
  }
  // mensagens recebidas por workers já existentes (escuta global de MessageEvent não é possível; conta via onmessage setter)
  R.workers.note = 'Workers criados ANTES do script não aparecem em "criados"; mensagens enviadas a eles são contadas.';

  // ---------- timers ----------
  const oST = window.setTimeout, oSI = window.setInterval, oRAF = window.requestAnimationFrame;
  window.setTimeout = function (...a) { P().timeouts++; return oST.apply(this, a); };
  window.setInterval = function (...a) { P().intervals++; R.timers.newIntervals = (R.timers.newIntervals || 0) + 1; return oSI.apply(this, a); };
  window.requestAnimationFrame = function (...a) { P().rafCallbacks++; return oRAF.apply(this, a); };
  restore.push(() => { window.setTimeout = oST; window.setInterval = oSI; window.requestAnimationFrame = oRAF; });

  // ---------- DOM (re-render do React / HUD) ----------
  const mo = new MutationObserver(list => { const p = P(); p.domMutations += list.length; R.dom.mutations += list.length; });
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  restore.push(() => mo.disconnect());

  // ---------- console ----------
  const oErr = console.error, oWarn = console.warn;
  console.error = function (...a) { if (R.console.errors.length < 30) R.console.errors.push(a.map(String).join(' ').slice(0, 300)); return oErr.apply(this, a); };
  console.warn = function (...a) { R.console.warns++; return oWarn.apply(this, a); };
  const onErr = e => { if (R.console.errors.length < 30) R.console.errors.push('UNCAUGHT: ' + (e.message || e.reason || e).toString().slice(0, 300)); };
  addEventListener('error', onErr); addEventListener('unhandledrejection', onErr);
  restore.push(() => { console.error = oErr; console.warn = oWarn; removeEventListener('error', onErr); removeEventListener('unhandledrejection', onErr); });

  // ---------- Long tasks e Long Animation Frames (quem travou) ----------
  const observers = [];
  try {
    const lt = new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        P().longTaskMs += e.duration;
        if (R.longTasks.length < 200) R.longTasks.push({ t: +((e.startTime - t0) / 1000).toFixed(2), ms: Math.round(e.duration), fase: phaseOf(e.startTime) });
      }
    });
    lt.observe({ type: 'longtask', buffered: false }); observers.push(lt);
  } catch (e) { R.meta.longtaskApi = 'indisponível'; }
  try {
    const lo = new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        const scripts = (e.scripts || []).map(s => {
          const key = `${s.sourceFunctionName || '(anon)'} @ ${(s.sourceURL || '').split('/').pop()}:${s.sourceCharPosition ?? ''} [${s.invoker || s.invokerType || ''}]`;
          const agg = (R.scripts[key] = R.scripts[key] || { ms: 0, count: 0 });
          agg.ms += s.duration; agg.count++;
          return { fn: s.sourceFunctionName || '(anon)', file: (s.sourceURL || '').split('/').pop(), pos: s.sourceCharPosition, ms: Math.round(s.duration), invoker: s.invoker };
        });
        if (R.loaf.length < 60) R.loaf.push({
          t: +((e.startTime - t0) / 1000).toFixed(2), ms: Math.round(e.duration),
          blocking: Math.round(e.blockingDuration || 0), render: Math.round((e.renderStart ? e.startTime + e.duration - e.renderStart : 0)),
          styleLayout: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0),
          fase: phaseOf(e.startTime), scripts: scripts.sort((a, b) => b.ms - a.ms).slice(0, 5),
        });
      }
    });
    lo.observe({ type: 'long-animation-frame', buffered: false }); observers.push(lo);
  } catch (e) { R.meta.loafApi = 'indisponível (use Chrome atualizado para ver QUAIS funções travam)'; }
  restore.push(() => observers.forEach(o => o.disconnect()));

  // ---------- loop de quadros ----------
  let last = now(), running = true, rafId;
  const frame = (t) => {
    if (!running) return;
    const dt = t - last; last = t;
    const p = R.phases[phaseOf(t)];
    p.frames++; p.frameTimes.push(dt);
    if (dt > 33.4) p.over33++; if (dt > 50) p.over50++; if (dt > 100) p.over100++;
    if (dt > p.worst) p.worst = dt;
    rafId = oRAF(frame);
  };
  rafId = oRAF(frame);

  // ---------- memória + texto do F3 a cada segundo ----------
  const readF3 = () => {
    const txt = document.body.innerText || '';
    const m = txt.match(/(POS|XYZ)[^\n]{0,300}(\n[^\n]{0,200}){0,8}/);
    return m ? m[0].slice(0, 600) : null;
  };
  const memTimer = oSI(() => {
    const s = +((now() - t0) / 1000).toFixed(0);
    const m = performance.memory;
    R.memory.push({ s, fase: phaseOf(now()), usedMB: m ? Math.round(m.usedJSHeapSize / 1048576) : null, f3: s % 5 === 0 ? readF3() : undefined });
  }, 1000);
  restore.push(() => clearInterval(memTimer));

  // ---------- overlay ----------
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;right:8px;bottom:8px;background:rgba(0,0,0,.8);color:#7CFC00;font:12px monospace;padding:8px 10px;border:1px solid #7CFC00;pointer-events:none;white-space:pre';
  document.body.appendChild(box);
  restore.push(() => box.remove());
  const ui = oSI(() => {
    const s = (now() - t0) / 1000;
    const ph = PHASES.find(p => s < p.until) || PHASES[PHASES.length - 1];
    const p = R.phases[ph.name];
    const recent = p.frameTimes.slice(-30);
    const fps = recent.length ? Math.round(1000 / (recent.reduce((a, b) => a + b, 0) / recent.length)) : 0;
    box.textContent = `MIND CAVE MONITOR  ${Math.max(0, DURATION_S - s).toFixed(0)}s\n> ${ph.hint}\nFPS ~${fps}  pior ${Math.round(p.worst)}ms  draws/q ${p.frames ? Math.round(p.draws / p.frames) : 0}`;
    if (s >= DURATION_S) finish();
  }, 250);
  restore.push(() => clearInterval(ui));

  // ---------- relatório ----------
  const pct = (arr, q) => { if (!arr.length) return 0; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
  const summarize = () => {
    const out = {};
    for (const [name, p] of Object.entries(R.phases)) {
      const n = p.frames || 1, total = p.frameTimes.reduce((a, b) => a + b, 0) || 1;
      out[name] = {
        fps_medio: Math.round(p.frames / (total / 1000)),
        frame_ms: { p50: +pct(p.frameTimes, .5).toFixed(1), p95: +pct(p.frameTimes, .95).toFixed(1), p99: +pct(p.frameTimes, .99).toFixed(1), pior: Math.round(p.worst) },
        quadros_acima: { '33ms': p.over33, '50ms': p.over50, '100ms': p.over100 },
        longtask_ms_total: Math.round(p.longTaskMs),
        por_quadro: {
          draw_calls: Math.round(p.draws / n), triangulos: Math.round(p.triangles / n),
          uploads_buffer: +(p.bufferUploads / n).toFixed(2), kb_buffer: +(p.bufferBytes / n / 1024).toFixed(1),
          uploads_textura: +(p.texUploads / n).toFixed(2), useProgram: Math.round(p.useProgram / n), bindTexture: Math.round(p.bindTexture / n),
          mutacoes_dom: +(p.domMutations / n).toFixed(1), msgs_para_workers: +(p.workerMsgsOut / n).toFixed(2),
          setTimeout: +(p.timeouts / n).toFixed(2),
        },
        totais: { compilacoes_shader: p.shaderCompiles, links_programa: p.programLinks, buffers_criados: p.createBuffer, buffers_apagados: p.deleteBuffer, kb_textura: Math.round(p.texBytes / 1024), kb_enviados_workers: Math.round(p.workerBytesOut / 1024), msgs_de_workers_novos: p.workerMsgsIn },
      };
    }
    return out;
  };
  const diagnose = (S) => {
    const d = [];
    if (R.gl.softwareRender) d.push('CRÍTICO: render por SOFTWARE (' + R.gl.renderer + '). Ativar aceleração de hardware no navegador.');
    const c = R.meta.canvases[0];
    if (c && c.scale > 1.5) d.push(`Canvas renderizando em ${c.scale}x a resolução da tela (${c.size}). Limitar pixel ratio a 1–1,5.`);
    for (const [n, s] of Object.entries(S)) {
      if (s.fps_medio < 30) d.push(`[${n}] FPS médio ${s.fps_medio}.`);
      if (s.por_quadro.draw_calls > 600) d.push(`[${n}] ${s.por_quadro.draw_calls} draw calls por quadro (meta ≤ 600): objetos demais na cena / sem lote.`);
      if (s.por_quadro.triangulos > 1.5e6) d.push(`[${n}] ${Math.round(s.por_quadro.triangulos / 1e3)}k triângulos por quadro: faces escondidas não estão sendo removidas.`);
      if (s.por_quadro.uploads_buffer > 10) d.push(`[${n}] ${s.por_quadro.uploads_buffer} uploads de buffer por quadro: geometria sendo recriada/enviada a cada quadro.`);
      if (s.por_quadro.kb_buffer > 500) d.push(`[${n}] ${s.por_quadro.kb_buffer} KB enviados à GPU por quadro.`);
      if (s.totais.compilacoes_shader > 0 && n !== 'parado') d.push(`[${n}] ${s.totais.compilacoes_shader} shaders compilados durante o jogo (deveria ser na tela de carregamento).`);
      if (s.por_quadro.mutacoes_dom > 20) d.push(`[${n}] ${s.por_quadro.mutacoes_dom} mudanças no DOM por quadro: React/HUD re-renderizando demais.`);
      if (s.longtask_ms_total > 2000) d.push(`[${n}] ${s.longtask_ms_total} ms em tarefas longas na thread principal.`);
      if (s.totais.buffers_criados > 200) d.push(`[${n}] ${s.totais.buffers_criados} buffers criados (e ${s.totais.buffers_apagados} apagados): sem reaproveitamento.`);
    }
    if (n_ceu_vs_parado(S)) d.push('Olhando para o céu o FPS não melhora: gargalo é CPU (meshing, loops, luz ou React na thread principal), não a GPU.');
    if (R.workers.noTransfer > 50 && !R.workers.transferUsed) d.push('Mensagens para workers sem transferência de buffers (cópia de dados a cada mensagem).');
    const mem = R.memory.filter(m => m.usedMB != null).map(m => m.usedMB);
    if (mem.length > 5) {
      let drops = 0; for (let i = 1; i < mem.length; i++) if (mem[i - 1] - mem[i] > 30) drops++;
      if (drops >= 3) d.push(`Memória JS em "serrote" (${drops} quedas >30MB): coleta de lixo pesada, objetos criados por quadro.`);
      if (mem[mem.length - 1] - mem[0] > 300) d.push(`Memória JS subiu ${mem[mem.length - 1] - mem[0]} MB em ${DURATION_S}s: possível vazamento (chunks/malhas não liberados).`);
    }
    if (R.console.errors.length) d.push(`${R.console.errors.length} erros no console durante o teste.`);
    return d;
  };
  const n_ceu_vs_parado = (S) => S.ceu && S.parado && S.ceu.fps_medio <= S.parado.fps_medio * 1.15 && S.ceu.fps_medio < 50;

  let finished = false;
  const finish = (silent) => {
    if (finished) return; finished = true; running = false;
    cancelAnimationFrame(rafId);
    restore.reverse().forEach(f => { try { f(); } catch (e) {} });
    if (silent === true) return;
    const S = summarize();
    const topScripts = Object.entries(R.scripts).sort((a, b) => b[1].ms - a[1].ms).slice(0, 25).map(([k, v]) => ({ funcao: k, ms_total: Math.round(v.ms), vezes: v.count }));
    const report = {
      mindcave_monitor: 'v1', duracao_s: DURATION_S, quando: new Date().toISOString(),
      diagnostico_automatico: diagnose(S),
      ambiente: R.meta, webgl: R.gl, fases: S,
      funcoes_que_mais_travaram: topScripts,
      piores_quadros: R.loaf.sort((a, b) => b.ms - a.ms).slice(0, 15),
      tarefas_longas: R.longTasks.sort((a, b) => b.ms - a.ms).slice(0, 30),
      workers: { criados_durante_teste: workersCreated, ...R.workers },
      memoria_por_segundo: R.memory,
      console: R.console,
    };
    window.MC_REPORT = JSON.stringify(report, null, 1);
    console.log('%cMIND CAVE MONITOR — relatório pronto', 'color:#7CFC00;font-weight:bold;font-size:14px');
    console.log(report);
    const done = () => console.log('%cRelatório COPIADO. Cole na conversa. (Se precisar de novo: copy(MC_REPORT))', 'color:#7CFC00');
    try { if (typeof copy === 'function') { copy(window.MC_REPORT); done(); } else navigator.clipboard.writeText(window.MC_REPORT).then(done, () => console.log('Digite: copy(MC_REPORT)')); }
    catch (e) { console.log('Digite: copy(MC_REPORT)'); }
  };
  window.MC_STOP = finish;
  console.log('%cMIND CAVE MONITOR iniciado — volte ao jogo e siga o roteiro no canto inferior direito (' + DURATION_S + 's).', 'color:#7CFC00;font-weight:bold');
})();
