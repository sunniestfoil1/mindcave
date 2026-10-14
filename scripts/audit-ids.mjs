// Audita o registro de itens/blocos contra os dados reais do 1.8.9 (data/mc-1.8.9): ids duplicados no arquivo, ids com nome diferente do real
// e itens reais ausentes. Uso: node scripts/audit-ids.mjs   (sai com código 1 se achar duplicata ou id com nome errado)
import fs from 'fs'; import path from 'path'; import { pathToFileURL, fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = [];
// 1) ids repetidos no texto (a segunda definição sobrescreve a primeira em silêncio)
for (const f of ['src/game/items.js', 'src/game/blocks.js']) {
  const src = fs.readFileSync(path.join(root, f), 'utf8').split('\n');
  const seen = new Map();
  src.forEach((line, i) => {
    const m = line.match(/^\s*(\d+):\s*(?:I|B)\(\1,\s*'([^']+)'/);
    if (!m) return;
    const id = Number(m[1]);
    if (seen.has(id)) out.push(`DUPLICADO ${f}: id ${id} em linha ${seen.get(id).line} ('${seen.get(id).name}') e linha ${i + 1} ('${m[2]}')`);
    else seen.set(id, { line: i + 1, name: m[2] });
  });
}
// 2) nome do registro vs nome real
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { ITEMS } = await server.ssrLoadModule('/src/game/items.js');
const { BLOCKS } = await server.ssrLoadModule('/src/game/blocks.js');
const real = JSON.parse(fs.readFileSync(path.join(root, 'data/mc-1.8.9/items.json'), 'utf8'));
const realBlocks = JSON.parse(fs.readFileSync(path.join(root, 'data/mc-1.8.9/blocks.json'), 'utf8'));
const realById = new Map(real.map(i => [i.id, i.name]));
const realBlockById = new Map(realBlocks.map(b => [b.id, b.name]));
// nomes que o jogo usa de propósito diferentes do real (apelidos antigos); o que não estiver aqui e divergir é reportado
const ALIAS = new Set(JSON.parse(fs.existsSync(path.join(root, 'scripts/audit-ids.alias.json')) ? fs.readFileSync(path.join(root, 'scripts/audit-ids.alias.json'), 'utf8') : '[]'));
const wrong = [];
for (const [idStr, it] of Object.entries(ITEMS)) {
  const id = Number(idStr);
  if (id >= 450 && id <= 468) continue; // armas custom do jogo (não existem no 1.8.9)
  const rn = id < 256 ? realBlockById.get(id) : realById.get(id);
  if (rn === undefined) { wrong.push(`SEM_ID_REAL item ${id} '${it.name}'`); continue; }
  if (rn !== it.name && !ALIAS.has(`${id}:${it.name}`)) wrong.push(`NOME_DIFERENTE item ${id}: jogo='${it.name}' real='${rn}'`);
}
for (const [idStr, b] of Object.entries(BLOCKS)) {
  const id = Number(idStr);
  const rn = realBlockById.get(id);
  if (rn === undefined) { wrong.push(`SEM_ID_REAL bloco ${id} '${b.name}'`); continue; }
  if (rn !== b.name && !ALIAS.has(`${id}:${b.name}`)) wrong.push(`NOME_DIFERENTE bloco ${id}: jogo='${b.name}' real='${rn}'`);
}
await server.close();
console.log(out.join('\n') || 'sem ids duplicados nos arquivos');
console.log(`${wrong.length} divergências de nome/id contra o 1.8.9 real:`);
console.log(wrong.join('\n'));
process.exit(out.length ? 1 : 0);
