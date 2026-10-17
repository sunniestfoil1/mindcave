// Gera src/game/blockCatalog.js a partir dos dados reais do 1.8.9 (PrismarineJS/minecraft-data, MIT, em data/mc-1.8.9/).
// Uso: node scripts/gen-block-catalog.mjs
// Cada bloco: nome, dureza, resistência, ferramenta que colhe (pickaxe/axe/shovel/shears + nível mínimo), nomes das variações (meta → nome) e luz.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blocks = JSON.parse(fs.readFileSync(path.join(root, 'data/mc-1.8.9/blocks.json'), 'utf8'));
// ids de ferramenta: madeira, pedra, ferro, diamante, ouro (nível mínimo = o primeiro que serve na ordem madeira < pedra < ferro < diamante)
const TOOLS = { pickaxe: [270, 274, 257, 278, 285], shovel: [269, 273, 256, 277, 284], axe: [271, 275, 258, 279, 286] };
function harvest(b) {
  const ht = b.harvestTools;
  if (!ht) return null;
  if (ht['359']) return { tool: 'shears', level: 0 };
  for (const [tool, ids] of Object.entries(TOOLS)) {
    const has = ids.map((i) => !!ht[String(i)]);
    if (!has.some(Boolean)) continue;
    const order = [0, 1, 2, 3];   // madeira, pedra, ferro, diamante (o ouro vale como madeira)
    const lvl = order.find((o) => has[o] || (o === 0 && has[4]));
    return { tool, level: lvl ?? 3 };
  }
  return null;
}
const out = {};
for (const b of blocks) {
  const e = { n: b.name, h: b.hardness ?? -1, r: b.resistance ?? 0 };
  const hv = harvest(b);
  if (hv) { e.t = hv.tool; e.l = hv.level; }
  if (b.emitLight) e.e = b.emitLight;
  if (b.variations) e.v = b.variations.map((v) => [v.metadata, v.displayName]);
  out[b.id] = e;
}
const lines = Object.entries(out).map(([id, e]) => `  ${id}: ${JSON.stringify(e)},`);
fs.writeFileSync(path.join(root, 'src/game/blockCatalog.js'),
`// GERADO por scripts/gen-block-catalog.mjs a partir de data/mc-1.8.9/blocks.json (minecraft-data, MIT). Não editar à mão.
// id → { n nome, h dureza, r resistência, t ferramenta que colhe, l nível mínimo (0 madeira … 3 diamante), e luz emitida, v variações [meta, nome] }
export const CATALOG = {
${lines.join('\n')}
};
`);
console.log(Object.keys(out).length + ' blocos no catálogo');
