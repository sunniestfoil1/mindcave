// Gera src/game/recipesReal.json a partir das receitas REAIS do 1.8.9 (data/mc-1.8.9/recipes.json, PrismarineJS/minecraft-data, MIT).
// Só entram receitas cujo resultado e ingredientes existem no jogo, que ainda não temos e que são alcançáveis (sem variantes de madeira
// que o jogo não tem). Rode de novo sempre que o registro de blocos/itens crescer:  node scripts/gen-recipes.mjs
import { pathToFileURL, fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { ITEMS } = await server.ssrLoadModule('/src/game/items.js');
  const { BLOCKS } = await server.ssrLoadModule('/src/game/blocks.js');
  const { BASE_RECIPES: RECIPES } = await server.ssrLoadModule('/src/game/recipes.js');
  const real = JSON.parse(fs.readFileSync(path.join(root, 'data/mc-1.8.9/recipes.json'), 'utf8'));
  const exists = (id) => !!(ITEMS[id] || BLOCKS[id]);
  // ids em que a meta é uma variante de verdade no jogo (cores, tipos de laje); nos demais, meta > 0 é variante que não existe (ex.: madeiras)
  const META_OK = new Set([35, 95, 159, 160, 171, 351, 44, 126, 182, 263, 373, 397, 1, 3, 5, 6, 12, 17, 18, 24, 97, 98, 139, 145, 155, 162, 168, 179]);
  const ours = new Set(RECIPES.map(r => `${r.result.id}:${r.result.meta || 0}`));
  const sigs = new Set();
  const out = [];
  const stats = { vistas: 0, resultadoInexistente: 0, ingredienteInexistente: 0, metaInalcancavel: 0, jaTemos: 0, duplicada: 0, importadas: 0 };
  const norm = (c) => {
    if (c === null || c === undefined || c === -1) return null;
    if (typeof c === 'number') return [c, -1];
    return [c.id, c.metadata === undefined || c.metadata === -1 ? -1 : c.metadata];
  };
  for (const [rid, list] of Object.entries(real)) {
    for (const r of list) {
      stats.vistas++;
      const res = r.result;
      if (!exists(res.id)) { stats.resultadoInexistente++; continue; }
      const shape = r.inShape ? r.inShape.map(row => row.map(norm)) : null;
      const ing = shape ? shape.flat().filter(Boolean) : (r.ingredients || []).map(norm).filter(Boolean);
      if (ing.some(([id]) => !exists(id))) { stats.ingredienteInexistente++; continue; }
      const resMeta = res.metadata || 0;
      if ((resMeta > 0 && !META_OK.has(res.id)) || ing.some(([id, m]) => m > 0 && !META_OK.has(id))) { stats.metaInalcancavel++; continue; }
      if (ours.has(`${res.id}:${resMeta}`)) { stats.jaTemos++; continue; }
      const sig = JSON.stringify([shape || ing.map(i => i.join(',')).sort(), res.id, resMeta, res.count]);
      if (sigs.has(sig)) { stats.duplicada++; continue; }
      sigs.add(sig);
      out.push(shape ? { s: shape, r: [res.id, res.count, resMeta] } : { l: ing, r: [res.id, res.count, resMeta] });
      stats.importadas++;
    }
  }
  fs.writeFileSync(path.join(root, 'src/game/recipesReal.json'), JSON.stringify(out));
  console.log(JSON.stringify(stats));
  const names = [...new Set(out.map(o => (ITEMS[o.r[0]] || BLOCKS[o.r[0]]).name))];
  console.log('resultados importados:', names.join(', '));
} catch (e) { console.log('ERRO', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')); }
await server.close();
