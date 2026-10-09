// PRD 21 RF-001: Painel de desempenho — gráfico de tempo de quadro com linhas de 16.7ms e 33ms
import React, { useRef, useEffect } from 'react';
import { perfMonitor } from '@/game/perfMonitor';

export default function PerformancePanel({ visible }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    let raf;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) { raf = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, w, h);

      const times = perfMonitor.getFrameTimes();
      const n = times.length;
      const barW = w / n;
      const maxMs = 100;
      const yFor = (ms) => h - (ms / maxMs) * h;

      // Linhas de referência 16.7ms (60fps) e 33ms (30fps)
      ctx.strokeStyle = 'rgba(80,255,80,0.25)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(0, yFor(16.7)); ctx.lineTo(w, yFor(16.7)); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,200,80,0.25)';
      ctx.beginPath(); ctx.moveTo(0, yFor(33.3)); ctx.lineTo(w, yFor(33.3)); ctx.stroke();
      ctx.setLineDash([]);

      for (let i = 0; i < n; i++) {
        const t = times[i];
        if (t === 0) continue;
        const barH = Math.min(h, (t / maxMs) * h);
        const y = h - barH;
        ctx.fillStyle = t > 50 ? '#ff4444' : t > 33 ? '#ffaa00' : t > 16.7 ? '#ffff44' : '#44ff44';
        ctx.fillRect(i * barW, y, Math.max(1, barW), barH);
      }

      const stats = perfMonitor.getStats();
      ctx.fillStyle = '#ffffff';
      ctx.font = '11px monospace';
      ctx.fillText(`${stats.fps} FPS | avg ${stats.avgMs}ms | max ${stats.maxMs}ms | >50ms: ${stats.over50}`, 4, 12);
      ctx.fillText(`Heap ${stats.jsHeapMB}MB | GC longas: ${stats.longGcCount}`, 4, 26);
      const st = stats.stages;
      ctx.fillText(Object.keys(st).map(k => `${k} ${st[k].toFixed(1)}`).join(' · '), 4, 40);
      const inf = perfMonitor.info;
      ctx.fillText(`fila ${inf.meshQ} · em voo ${inf.inFlight} · chunks ${inf.chunks} · erros ${inf.errors} · timeouts ${inf.timeouts}`, 4, 54);
      if (perfMonitor.isSoftwareRenderer) {
        ctx.fillStyle = '#ff6644';
        ctx.fillText('⚠ Renderização por software — ative aceleração de hardware no navegador', 4, h - 4);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;
  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={96}
      className="absolute top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none rounded"
    />
  );
}