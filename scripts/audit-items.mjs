// Auditoria estática de itens e blocos: texturas, receitas, drops e onde cada item é USADO no código.
// Uso: node scripts/audit-items.mjs   (gera docs/AUDITORIA-ITENS.json e imprime o resumo)
import { pathToFileURL, fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js').href);
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const out = {};
try {
  const { ITEMS } = await server.ssrLoadModule('/src/game/items.js');
  const { BLOCKS } = await server.ssrLoadModule('/src/game/blocks.js');
  const { RECIPES } = await server.ssrLoadModule('/src/game/recipes.js');
  const { FOODS } = await server.ssrLoadModule('/src/game/survival.js');
  const { itemIconFile, itemBlockTile } = await server.ssrLoadModule('/src/game/gui/iconNames.js');
  const { SMELT_RECIPES } = await server.ssrLoadModule('/src/game/furnace.js').catch(() => ({}));

  // arquivos do pacote
  const zip = path.join(root, 'public/assets/Old_Default_1.8.9.zip');
  const list = execSync(`unzip -l "${zip}"`, { maxBuffer: 1 << 26 }).toString();
  const files = new Set([...list.matchAll(/assets\/minecraft\/(textures\/[^\s]+\.png)/g)].map(m => m[1]));

  // mapeamento tile → arquivo do pacote
  const texSrc = fs.readFileSync(path.join(root, 'src/game/textures.js'), 'utf8');
  const order = [...texSrc.slice(texSrc.indexOf('const TILE_ORDER'), texSrc.indexOf('];', texSrc.indexOf('const TILE_ORDER'))).matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);
  const mapBlock = texSrc.slice(texSrc.indexOf('const MC_TEXTURE_MAP'), texSrc.indexOf('};', texSrc.indexOf('const MC_TEXTURE_MAP')));
  const tileMap = Object.fromEntries([...mapBlock.matchAll(/'([a-z0-9_]+)':\s*'([a-z0-9_]+)'/g)].map(m => [m[1], m[2]]));
  const tileOk = (t) => order.includes(t);
  const tileReal = (t) => !!tileMap[t] && files.has(`textures/blocks/${tileMap[t]}.png`);

  // texto de todo o código de jogo (menos o registro e as receitas) para ver o uso de cada id/nome
  const gameDir = path.join(root, 'src');
  const skip = new Set(['items.js', 'recipes.js', 'blocks.js', 'iconNames.js']);
  let code = '';
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(js|jsx)$/.test(f.name) && !skip.has(f.name)) code += fs.readFileSync(p, 'utf8') + '\n'; } };
  walk(gameDir);
  const mentioned = (id, name) => new RegExp(`(?<![0-9a-zA-Z_.])${id}(?![0-9a-zA-Z_])`).test(code) || new RegExp(`['"]${name}['"]`).test(code);

  // receitas
  const asResult = new Set(), asIngredient = new Set();
  for (const r of RECIPES) {
    asResult.add(r.result.id);
    const ing = r.type === 'shaped' ? Object.values(r.keys) : r.ingredients;
    for (const i of ing) { if (i.id) asIngredient.add(i.id); for (const a of (i.any || [])) asIngredient.add(a); }
  }
  const smeltIn = new Set(), smeltOut = new Set();
  const furnaceSrc = fs.readFileSync(path.join(root, 'src/game/furnace.js'), 'utf8');
  for (const m of furnaceSrc.matchAll(/^\s*(\d+):\s*\{\s*out:\s*(\d+)/gm)) { smeltIn.add(Number(m[1])); smeltOut.add(Number(m[2])); }

  const rows = [];
  // ---- itens ----
  for (const [k, it] of Object.entries(ITEMS)) {
    const id = Number(k);
    const isBlockItem = !!BLOCKS[id];
    const iconFile = itemIconFile(it.name);
    const iconExists = files.has(`textures/items/${iconFile}.png`);
    const blockTile = itemBlockTile(it.name);
    const icon = iconExists ? 'pacote' : (isBlockItem ? 'bloco' : (blockTile && tileOk(blockTile) ? 'tile-bloco' : 'SEM ÍCONE'));
    const cls = it.food || FOODS[id] ? 'comida' : it.tool ? 'ferramenta' : it.weapon ? 'arma' : it.armor ? 'armadura' : it.gun ? 'arma de fogo' : it.accessory ? 'acessório' : isBlockItem ? 'bloco' : 'outro';
    const uses = [];
    if (FOODS[id]) uses.push('come');
    if (it.tool || it.weapon || it.armor || it.gun || it.accessory) uses.push('equipa/usa');
    if (it.fuel) uses.push('combustível');
    if (asIngredient.has(id)) uses.push('ingrediente');
    if (asResult.has(id)) uses.push('receita');
    if (smeltIn.has(id)) uses.push('derrete');
    if (smeltOut.has(id)) uses.push('resultado de fornalha');
    const inCode = mentioned(id, it.name);
    rows.push({ id, name: it.name, namePt: it.namePt, tipo: 'item', cls, icon, uses, noCodigo: inCode, craftavel: asResult.has(id), obtivel: asResult.has(id) || smeltOut.has(id) || mentioned(id, it.name) });
  }
  // ---- blocos ----
  for (const [k, b] of Object.entries(BLOCKS)) {
    const id = Number(k);
    if (id === 0) continue;
    const faces = new Set();
    const addFaces = (f) => { if (!f) return; for (const v of Object.values(f)) faces.add(v); };
    addFaces(b.faces); (b.variants || []).forEach(addFaces);
    if (b.doorTiles) b.doorTiles.forEach(t => faces.add(t));
    const missing = [...faces].filter(t => !tileOk(t));
    const fake = [...faces].filter(t => tileOk(t) && !tileReal(t));
    rows.push({ id, name: b.name, namePt: b.namePt, tipo: 'bloco', modelo: b.model, faces: [...faces], texturaAusente: missing, texturaFalsa: fake, drop: b.drop, dropExiste: b.drop === null || b.drop === undefined || !!(ITEMS[b.drop] || BLOCKS[b.drop]), noItems: !!ITEMS[id], craftavel: asResult.has(id), obtivel: asResult.has(id) || smeltOut.has(id) || mentioned(id, b.name) || b.drop === id });
  }
  // receitas com ids inexistentes
  const bad = [];
  for (const r of RECIPES) {
    if (!ITEMS[r.result.id] && !BLOCKS[r.result.id]) bad.push(`resultado ${r.result.id}`);
    const ing = r.type === 'shaped' ? Object.values(r.keys) : r.ingredients;
    for (const i of ing) for (const a of (i.any || [i.id])) if (a && !ITEMS[a] && !BLOCKS[a]) bad.push(`ingrediente ${a} (resultado ${r.result.id})`);
  }
  out.rows = rows; out.receitasInvalidas = bad; out.tilesSemArquivo = order.filter(t => !tileReal(t));
  out.resumo = {
    itens: rows.filter(r => r.tipo === 'item').length, blocos: rows.filter(r => r.tipo === 'bloco').length,
    itensSemIcone: rows.filter(r => r.tipo === 'item' && r.icon === 'SEM ÍCONE').map(r => `${r.id} ${r.name}`),
    itensSemUsoNemReceita: rows.filter(r => r.tipo === 'item' && !r.uses.length && !r.noCodigo).map(r => `${r.id} ${r.name}`),
    blocosTexturaAusente: rows.filter(r => r.tipo === 'bloco' && r.texturaAusente.length).map(r => `${r.id} ${r.name}: ${r.texturaAusente}`),
    blocosTexturaFalsa: rows.filter(r => r.tipo === 'bloco' && r.texturaFalsa.length).map(r => `${r.id} ${r.name}: ${r.texturaFalsa}`),
    blocosDropInexistente: rows.filter(r => r.tipo === 'bloco' && !r.dropExiste).map(r => `${r.id} ${r.name} → ${r.drop}`),
    receitasInvalidas: bad,
  };
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs/AUDITORIA-ITENS.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.resumo, null, 1));
} catch (e) { console.log('ERRO', e.message, (e.stack || '').split('\n').slice(0, 5).join(' | ')); }
await server.close();
