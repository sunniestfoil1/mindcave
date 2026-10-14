// Testes de jogo de verdade (motor + página no Chrome headless, Supabase bloqueado: nada é gravado no banco).
// Uso: npm run test:e2e   (sobe o Vite numa porta própria, roda tudo e derruba o servidor)
//  - mining/shapes/net: lógica pura (net = comandos online: host + convidados simulados) (tempos de quebra, drops, mortes, lajes, escadas, receitas) em Node
//  - move: velocidade andando/agachado; engine: teclas, quebrar, colocar, morte, flecha, cama, balde, enxada...
//  - items: todo bloco dropa, toda comida alimenta, ferramentas/armas/armaduras coerentes; ../audit-render: ícone, malha e item caído de TODO item e bloco
//  - page: página /play completa (chat sem pausar, tecla E, HUD) com pointer lock simulado
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const port = '5191';
const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', port, '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' });
// O npx abre o Vite como neto: matar só o pid do npx deixava o servidor vivo na porta, e a próxima execução testava contra ele
const stop = () => {
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(vite.pid), '/T', '/F'], { stdio: 'ignore' });
      spawnSync('powershell', ['-NoProfile', '-Command', `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`], { stdio: 'ignore' });
    } else vite.kill();
  } catch { /* já parou */ }
};
process.on('exit', stop);
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://localhost:${port}/`); if (r.ok) break; } catch { /* ainda subindo */ } await new Promise(r => setTimeout(r, 1000)); }
const steps = [['mining.mjs', []], ['shapes.mjs', []], ['doors.mjs', []], ['items.mjs', []], ['net.mjs', []], ['move.mjs', [port]], ['engine.mjs', [port]], ['slots.mjs', []], ['skin.mjs', [port]], ['packs.mjs', [port]], ['crosshair.mjs', [port]], ['gui.mjs', [port]], ['voice.mjs', [port]], ['client.mjs', [port]], ['page.mjs', [port]], ['../audit-render.mjs', [port]]];
let failed = 0;
for (const [file, extra] of steps) {
  console.log(`\n=== ${file} ===`);
  const code = await new Promise((res) => spawn(process.execPath, [path.join(root, 'scripts', 'e2e', file), root, ...extra], { stdio: 'inherit' }).on('exit', res));
  if (code !== 0) failed++;
}
stop();
console.log(failed ? `\n❌ ${failed} arquivo(s) de teste com falha` : '\n✅ todos os testes de jogo passaram');
process.exit(failed ? 1 : 0);
