// PRD 21: Diagnóstico de performance — timing de quadros, stages, detecção de travamentos (RF-001/002/010)
const FRAME_HISTORY = 240;
const FREEZE_MS = 50;

class PerfMonitor {
  constructor() {
    this.frameTimes = new Float32Array(FRAME_HISTORY);
    this.idx = 0;
    this.count = 0;
    this.stages = {};
    this._stageStart = {};
    this.freezes = [];
    this.frameStart = 0;
    this.lastUsedHeap = 0;
    this.longGcCount = 0;
    this.gpuRenderer = null;
    this.gpuChecked = false;
    this.isSoftwareRenderer = false;
    // PRD 23 RF-010: contadores do pipeline de malhas (atualizados pelo engine a cada quadro, sem alocar)
    this.info = { meshQ: 0, inFlight: 0, chunks: 0, errors: 0, timeouts: 0 };
  }

  // Estágios acumulam dentro do quadro (a física pode rodar vários passos por quadro)
  beginFrame() {
    this.frameStart = performance.now();
    for (const k in this.stages) this.stages[k] = 0;
  }

  beginStage(s) { this._stageStart[s] = performance.now(); }
  endStage(s) { this.stages[s] = (this.stages[s] || 0) + (performance.now() - this._stageStart[s]); }

  endFrame(context = {}) {
    const now = performance.now();
    const t = now - this.frameStart;
    this.frameTimes[this.idx] = t;
    this.idx = (this.idx + 1) % FRAME_HISTORY;
    this.count++;

    if (t > FREEZE_MS) {
      this.freezes.push({
        frame: this.count,
        ms: +t.toFixed(1),
        stages: Object.assign({}, this.stages),
        ctx: Object.assign({}, context),
        time: new Date().toISOString(),
      });
      if (this.freezes.length > 100) this.freezes.shift();
    }

    // Heurística de GC: queda brusca de heap = coleta longa (RF-042)
    if (performance.memory && this.count % 30 === 0) {
      const used = performance.memory.usedJSHeapSize;
      if (this.lastUsedHeap > 0 && used < this.lastUsedHeap * 0.8) {
        this.longGcCount++;
      }
      this.lastUsedHeap = used;
    }
  }

  getFrameTimes() { return this.frameTimes; }
  getStages() { return this.stages; }
  getFreezes() { return this.freezes; }

  getStats() {
    const n = Math.min(this.count, FRAME_HISTORY);
    let sum = 0, max = 0, over16 = 0, over33 = 0, over50 = 0;
    for (let i = 0; i < n; i++) {
      const t = this.frameTimes[i];
      sum += t;
      if (t > max) max = t;
      if (t > 16.7) over16++;
      if (t > 33.3) over33++;
      if (t > 50) over50++;
    }
    const avg = n > 0 ? sum / n : 0;
    return {
      avgMs: +avg.toFixed(2),
      maxMs: +max.toFixed(1),
      fps: avg > 0 ? Math.round(1000 / avg) : 0,
      over16, over33, over50,
      sampleCount: n,
      longGcCount: this.longGcCount,
      jsHeapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 0,
      jsHeapTotalMB: performance.memory ? +(performance.memory.totalJSHeapSize / 1048576).toFixed(1) : 0,
      stages: this.stages,
    };
  }

  // RF-010: detectar GPU e renderização por software
  detectGpu(gl) {
    if (this.gpuChecked) return this.gpuRenderer;
    this.gpuChecked = true;
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        this.gpuRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || 'unknown';
      } else {
        this.gpuRenderer = gl.getParameter(gl.RENDERER) || 'unknown';
      }
    } catch { this.gpuRenderer = 'unknown'; }
    this.isSoftwareRenderer = /SwiftShader|llvmpipe|Microsoft Basic Render|Software/i.test(this.gpuRenderer || '');
    return this.gpuRenderer;
  }

  reset() {
    this.frameTimes.fill(0);
    this.idx = 0; this.count = 0;
    this.freezes = [];
  }
}

export const perfMonitor = new PerfMonitor();