#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function run(cmd, desc) {
  console.log(`\n\x1b[36m▶ ${desc || cmd}\x1b[0m`);
  try {
    const out = execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' });
    if (out.trim()) console.log(out.trim());
    return out;
  } catch (err) {
    console.error(`\x1b[31m✖ Erro ao executar: ${cmd}\x1b[0m`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    throw err;
  }
}

async function main() {
  const startTime = Date.now();
  console.log('\x1b[32m🚀 [MIND-CAVE SHIP] Iniciando pipeline rápido de verificação, push e deploy...\x1b[0m');

  // 1. Verificação estática do código
  run('node scripts/verify-codebase.js', '1/4 Verificando integridade e tipos do código');

  // 2. Git status
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  const commitMsg = process.argv.slice(2).join(' ') || 'feat: auto ship updates and inventory toggle fix';

  if (status) {
    run('git add -A', '2/4 Adicionando arquivos alterados ao Git');
    run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, `Commit: ${commitMsg}`);
    run('git push origin main', '3/4 Enviando commits para o GitHub origin main');
  } else {
    console.log('\x1b[33mℹ️ Nenhuma alteração pendente no Git. Pulando commit e push.\x1b[0m');
  }

  // 3. Vercel deploy
  console.log('\n\x1b[36m▶ 4/4 Fazendo deploy em produção no Vercel...\x1b[0m');
  try {
    const deployOut = execSync('npx vercel deploy --prod --yes', { encoding: 'utf-8' });
    console.log(deployOut.trim());

    // Procura URL no output
    const lines = deployOut.split('\n');
    const prodUrl = lines.find(l => l.includes('https://') && l.includes('.vercel.app'))?.trim() || 'https://mindcave.vercel.app';

    // Garante que o alias mindcave.vercel.app aponta para este deploy
    try {
      execSync('npx vercel alias set mindcave.vercel.app', { stdio: 'pipe' });
    } catch {
      // Alias já configurado ou automático no projeto
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\x1b[32m======================================================================\x1b[0m`);
    console.log(`\x1b[32m✅ SHIP CONCLUÍDO COM SUCESSO EM ${elapsed}s!\x1b[0m`);
    console.log(`🌐 URL de Produção: \x1b[34mhttps://mindcave.vercel.app\x1b[0m`);
    if (prodUrl && prodUrl !== 'https://mindcave.vercel.app') {
      console.log(`🔗 Deploy direto:   \x1b[34m${prodUrl}\x1b[0m`);
    }
    console.log(`\x1b[32m======================================================================\x1b[0m\n`);
  } catch (e) {
    console.error('\x1b[31m✖ Erro durante deploy no Vercel:\x1b[0m', e.message);
    process.exit(1);
  }
}

main().catch(() => process.exit(1));
