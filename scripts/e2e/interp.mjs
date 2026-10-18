// Interpolação de jogadores remotos (lógica pura): o "jogador voa 20 blocos para a frente e volta" do PvP vinha de dois pacotes que chegavam juntos
// (1 ms de diferença) com 1 bloco de distância: a velocidade estimada ia a ~1000 blocos/s e a extrapolação multiplicava por até 75.
// Agora o instante do snapshot é a hora do REMETENTE, o intervalo mínimo é 30 ms e a extrapolação tem teto de 1,2 bloco e só vale para sinal recente.
import { pathToFileURL } from 'url';
const root = process.argv[2];
const I = await import(pathToFileURL(root + '/src/game/net/netInterpolation.js').href);
const out = [];
const ok = (c, m) => out.push((c ? 'OK   ' : 'FALHA') + ' ' + m);
const pkt = (x, ts, extra = {}) => ({ t: 'move', n: 'P', x, y: 100, z: 0, yaw: 0, pitch: 0, ts, ...extra });

// 1) rajada: dois pacotes de 1 bloco de distância chegam no mesmo instante (relógio de chegada igual), 100 ms depois do último
{
  const p = {};
  I.recordPlayerSnapshot(p, pkt(0, 0), 1000);
  I.recordPlayerSnapshot(p, pkt(1.0, 50), 1050);      // chegada normal
  I.recordPlayerSnapshot(p, pkt(1.3, 100), 1300);     // atrasou 200 ms...
  I.recordPlayerSnapshot(p, pkt(1.6, 150), 1301);     // ...e o seguinte chegou colado (1 ms)
  let maxJump = 0, last = null;
  for (let t = 1300; t <= 1700; t += 8) { I.interpolateRemotePlayer(p, t); if (last !== null) maxJump = Math.max(maxJump, Math.abs(p.x - last)); last = p.x; }
  ok(p.x < 3 && maxJump < 1.0, `rajada de pacotes colados: o jogador vai até x=${p.x.toFixed(2)} (esperado ≤ 3) e o maior salto entre quadros foi ${maxJump.toFixed(2)} bloco`);
}

// 2) a extrapolação com 1 ms de diferença não explode (era ×75): pior caso possível
{
  const p = {};
  I.recordPlayerSnapshot(p, { t: 'move', x: 0, y: 100, z: 0, yaw: 0, pitch: 0 }, 1000);          // sem ts (cliente antigo): hora de chegada
  I.recordPlayerSnapshot(p, { t: 'move', x: 1, y: 100, z: 0, yaw: 0, pitch: 0 }, 1001);
  let max = 0;
  for (let t = 1001; t <= 1300; t += 5) { I.interpolateRemotePlayer(p, t); max = Math.max(max, p.x); }
  ok(max <= 1 + 1.2 + 1e-9, `dois pacotes sem ts a 1 ms: a extrapolação para em x=${max.toFixed(2)} (teto: 1 + 1,2 blocos)`);
}

// 3) movimento contínuo a 6 blocos/s, pacotes a 20 Hz com jitter de ±40 ms na chegada: o caminho desenhado segue a verdade com folga pequena
{
  const p = {}; let arrivals = [];
  for (let i = 0; i <= 60; i++) { const ts = i * 50, jitter = Math.sin(i * 7.3) * 40; arrivals.push({ ts, at: 1000 + ts + 30 + jitter }); }
  arrivals.sort((a, b) => a.at - b.at);
  let worst = 0, steps = 0, ai = 0;
  for (let t = 1000; t <= 1000 + 3000; t += 8) {
    while (ai < arrivals.length && arrivals[ai].at <= t) { const a = arrivals[ai++]; I.recordPlayerSnapshot(p, pkt(a.ts / 1000 * 6, a.ts), a.at); }
    if (!p.buffer || p.buffer.length < 2) continue;
    I.interpolateRemotePlayer(p, t);
    const truth = Math.max(0, (t - 1000 - 30 - I.INTERPOLATION_DELAY_MS)) / 1000 * 6;   // onde ele estava há 100 ms
    if (t > 1400) { worst = Math.max(worst, Math.abs(p.x - truth)); steps++; }
  }
  ok(steps > 100 && worst < 0.75, `6 blocos/s com jitter de ±40 ms: o desvio máximo da posição desenhada foi ${worst.toFixed(2)} bloco em ${steps} quadros`);
}

// 4) jogador parou: o último pacote é a verdade; passado o sinal recente ele NÃO escorrega
{
  const p = {};
  I.recordPlayerSnapshot(p, pkt(0, 0), 1000);
  I.recordPlayerSnapshot(p, pkt(0.3, 50), 1050);
  I.recordPlayerSnapshot(p, pkt(0.6, 100), 1100);      // andava a 6 b/s e parou aqui
  I.interpolateRemotePlayer(p, 1700);                  // 600 ms depois, sem pacote novo (deadband de inatividade)
  ok(Math.abs(p.x - 0.6) < 1e-9, `parou em x=0,6 e 600 ms depois continua em x=${p.x.toFixed(3)} (sem escorregar)`);
}

// 5) teleporte (> 8 blocos) aparece na hora, sem deslizar pelo mapa
{
  const p = {};
  I.recordPlayerSnapshot(p, pkt(0, 0), 1000);
  I.recordPlayerSnapshot(p, pkt(0.3, 50), 1050);
  I.recordPlayerSnapshot(p, pkt(40, 100), 1100);
  I.interpolateRemotePlayer(p, 1110);
  ok(p.x === 40 || Math.abs(p.x - 40) < 1, `teleporte de 40 blocos: aparece em x=${p.x.toFixed(1)} sem atravessar o mapa deslizando`);
}

// 6) pose, item e golpes vêm no mesmo pacote
{
  const p = {};
  I.recordPlayerSnapshot(p, pkt(0, 0, { st: I.POSE.SNEAK | I.POSE.BOW, bc: 60, h: 276, hm: 3, sw: 7, g: 1 }), 1000);
  ok(p.sneaking === true && p.bowDrawing === true && p.sprinting === false && p.bowCharge === 0.6 && p.held === 276 && p.heldMeta === 3 && p.swingCount === 7 && p.gameMode === 'creative', 'pose, carga do arco, item (id e meta), contador de golpes e modo de jogo saem do pacote');
}

// 7) o deslocamento de relógio acompanha o pacote mais rápido e a hora nunca volta atrás
{
  const p = {};
  for (let i = 0; i < 10; i++) I.recordPlayerSnapshot(p, pkt(i, i * 50), 1000 + i * 50 + 20 + (i % 3) * 25);
  const times = p.buffer.map((s) => s.time);
  ok(times.every((t, i) => i === 0 || t > times[i - 1]) && Math.abs(p.clockOff - 1020) < 1, `a hora dos snapshots só cresce e o deslocamento de relógio é o do pacote mais rápido (${p.clockOff.toFixed(1)} ≈ 1020)`);
}

console.log(out.join('\n'));
process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
