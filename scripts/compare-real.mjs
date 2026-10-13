// Compara o jogo com os dados reais do Minecraft 1.8.9 (PrismarineJS/minecraft-data, MIT) em data/mc-1.8.9/.
// Uso: node scripts/compare-real.mjs   → imprime o que falta (blocos, itens, receitas, entidades) e grava docs/FALTA-VS-REAL.json
import { pathToFileURL, fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (n) => JSON.parse(fs.readFileSync(path.join(root, 'data/mc-1.8.9', n), 'utf8'));
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
try {
  const { BLOCKS } = await server.ssrLoadModule('/src/game/blocks.js');
  const { ITEMS } = await server.ssrLoadModule('/src/game/items.js');
  const { RECIPES } = await server.ssrLoadModule('/src/game/recipes.js');
  const { MOB_TYPES } = await server.ssrLoadModule('/src/game/mobRegistry.js');
  const rb = rd('blocks.json'), ri = rd('items.json'), rr = rd('recipes.json'), re = rd('entities.json');
  const blocksMissing = rb.filter(b => !BLOCKS[b.id]).map(b => ({ id: b.id, name: b.name, hardness: b.hardness, material: b.material }));
  const itemsMissing = ri.filter(i => !ITEMS[i.id] && !BLOCKS[i.id]).map(i => ({ id: i.id, name: i.name }));
  const have = new Set(RECIPES.map(r => r.result.id));
  const recipesMissing = Object.keys(rr).map(Number).filter(id => !have.has(id)).map(id => ({ id, name: (ri.find(i => i.id === id) || rb.find(b => b.id === id) || {}).name || '?', variantes: rr[id].length }));
  const mobsReal = re.filter(e => e.type === 'mob' && e.name !== 'Mob' && e.category !== 'UNKNOWN').map(e => e.name);
  const mobsHave = new Set(Object.keys(MOB_TYPES));
  const out = { blocosReais: rb.length, blocosNossos: Object.keys(BLOCKS).length, blocosFaltando: blocksMissing, itensReais: ri.length, itensFaltando: itemsMissing, receitasReaisPorItem: Object.keys(rr).length, receitasFaltando: recipesMissing, entidadesReais: re.map(e => `${e.name}(${e.type})`), mobsNossos: [...mobsHave] };
  fs.writeFileSync(path.join(root, 'docs/FALTA-VS-REAL.json'), JSON.stringify(out, null, 1));
  console.log(`blocos: ${out.blocosNossos}/${out.blocosReais} (faltam ${blocksMissing.length})`);
  console.log(`itens faltando: ${itemsMissing.length} de ${ri.length}`);
  console.log(`receitas faltando (por item): ${recipesMissing.length} de ${out.receitasReaisPorItem}`);
  console.log('blocos que faltam:', blocksMissing.map(b => b.name).join(', '));
  console.log('receitas que faltam:', recipesMissing.map(r => r.name).join(', '));
  console.log('entidades reais:', out.entidadesReais.join(', '));
} catch (e) { console.log('ERRO', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')); }
await server.close();
